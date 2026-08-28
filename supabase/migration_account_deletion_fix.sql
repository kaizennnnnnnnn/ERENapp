-- ═══════════════════════════════════════════════════════════════════════
-- FIX delete_my_account() — IT HAS NEVER WORKED
--
-- Google Play requires in-app account deletion. migration_account_deletion.sql
-- added it, the UI calls it, and the button reports a polite failure. It could
-- never have succeeded, for two independent reasons, and the second one would
-- have surfaced only after the first was fixed.
--
--   1. Line 72: `DELETE FROM public.game_best_scores`. That is not a table.
--      migration_game_best_scores.sql:9 defines it as a VIEW with GROUP BY and
--      max() — not auto-updatable, so the DELETE raises 55000 "cannot delete
--      from view". It fires for EVERY caller, before any real work, so the
--      whole function is a no-op that throws.
--
--   2. Lines 85-89 anonymise co-authored content by setting the author column
--      to NULL, but three of those columns are declared NOT NULL:
--        couple_journal.sender_id  (migration_gacha_couple_fortune.sql:62)
--        memories.user_id          (schema.sql:148)
--        reminders.created_by      (schema.sql:114)
--      Each raises 23502 for anyone who has ever sent a message, added a
--      memory, or made a reminder — i.e. every real user.
--
-- The design was right; the schema never permitted it. Nulling the author
-- BEFORE deleting auth.users is also what stops the ON DELETE CASCADE from
-- destroying the partner's history: a NULL no longer matches the parent row,
-- so the content survives with the name off it, which is exactly what the
-- deletion dialog promises.
--
-- Safe to re-run. Run AFTER migration_account_deletion.sql.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Let the author columns be nulled ──────────────────────────────────
-- Looped rather than five ALTER statements because household_reminders has no
-- CREATE TABLE anywhere in this repo — it was made by hand in the dashboard —
-- so its existence cannot be assumed from the migrations. DROP NOT NULL on a
-- column that is already nullable is a no-op, so this is safe to re-run and
-- safe to run against a database where some of these differ.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('couple_journal',      'sender_id'),
      ('memories',            'user_id'),
      ('reminders',           'created_by'),
      ('household_reminders', 'created_by'),
      ('eren_wishes',         'granted_by')
    ) as t(tbl, col)
  loop
    if to_regclass('public.' || r.tbl) is null then
      raise notice 'SKIP %.% — table does not exist', r.tbl, r.col;
      continue;
    end if;
    execute format('alter table public.%I alter column %I drop not null', r.tbl, r.col);
    raise notice 'nullable: %.%', r.tbl, r.col;
  end loop;
end $$;

-- ─── 2. The function, without the DELETE on a view ────────────────────────
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_household uuid;
  v_remaining int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'delete_my_account: not authenticated';
  END IF;

  SELECT household_id INTO v_household
    FROM public.profiles WHERE id = v_uid;

  -- ── 1. Personal data: destroyed outright ────────────────────────────────
  -- Everything here must be a BASE TABLE. game_best_scores used to be in this
  -- list and is a view over game_scores — deleting the underlying game_scores
  -- rows (below) is what actually clears it.
  DELETE FROM public.eren_chat_messages     WHERE user_id = v_uid;
  DELETE FROM public.eren_chat_memories     WHERE user_id = v_uid;
  DELETE FROM public.push_subscriptions     WHERE user_id = v_uid;
  DELETE FROM public.user_gacha_state       WHERE user_id = v_uid;
  DELETE FROM public.user_inventory         WHERE user_id = v_uid;
  DELETE FROM public.gacha_pull_log         WHERE user_id = v_uid;
  DELETE FROM public.user_task_completions  WHERE user_id = v_uid;
  DELETE FROM public.interactions           WHERE user_id = v_uid;
  DELETE FROM public.time_spent             WHERE user_id = v_uid;
  DELETE FROM public.daily_moods            WHERE user_id = v_uid;
  DELETE FROM public.game_scores            WHERE user_id = v_uid;
  DELETE FROM public.jelly_scores           WHERE user_id = v_uid;
  DELETE FROM public.jelly_duel_leads       WHERE user_id = v_uid;
  DELETE FROM public.jelly_progress         WHERE user_id = v_uid;
  DELETE FROM public.kiosk_shifts           WHERE user_id = v_uid;
  DELETE FROM public.daily_battle_results   WHERE user_id = v_uid;
  DELETE FROM public.weekly_battle_results  WHERE user_id = v_uid;
  DELETE FROM public.weekly_coop_results    WHERE user_id = v_uid;
  DELETE FROM public.weekly_game_results    WHERE user_id = v_uid;
  DELETE FROM public.reminder_fires         WHERE user_id = v_uid;
  DELETE FROM public.reminder_logs          WHERE user_id = v_uid;

  -- ── 2. Co-authored content: severed, not destroyed ──────────────────────
  -- Must run before the auth.users delete below: these columns carry
  -- ON DELETE CASCADE, so a row still pointing at this user would be deleted
  -- with them rather than anonymised, taking the partner's history with it.
  UPDATE public.couple_journal      SET sender_id  = NULL WHERE sender_id  = v_uid;
  UPDATE public.memories            SET user_id    = NULL WHERE user_id    = v_uid;
  UPDATE public.household_reminders SET created_by = NULL WHERE created_by = v_uid;
  UPDATE public.reminders           SET created_by = NULL WHERE created_by = v_uid;
  UPDATE public.eren_wishes         SET granted_by = NULL WHERE granted_by = v_uid;

  -- ── 3. The household ────────────────────────────────────────────────────
  IF v_household IS NOT NULL THEN
    SELECT count(*) INTO v_remaining
      FROM public.profiles
     WHERE household_id = v_household AND id <> v_uid;

    IF v_remaining = 0 THEN
      -- Last one out. Nothing here is shared any more, so the uploaded photos
      -- go too. The bucket is private now, but an orphaned object still costs
      -- storage and still answers any signed URL minted before this ran.
      DELETE FROM storage.objects
       WHERE bucket_id = 'memories'
         AND name LIKE v_household::text || '/%';

      DELETE FROM public.households WHERE id = v_household;
    ELSE
      -- Someone stays: rotate the code so a departed partner cannot rejoin,
      -- and make sure the survivor holds a colour.
      UPDATE public.households
         SET invite_code = upper(substring(gen_random_uuid()::text FROM 1 FOR 8))
       WHERE id = v_household;

      UPDATE public.profiles
         SET heart = 'brown_heart'
       WHERE household_id = v_household
         AND NOT EXISTS (
           SELECT 1 FROM public.profiles
            WHERE household_id = v_household AND heart = 'brown_heart' AND id <> v_uid
         );
    END IF;
  END IF;

  -- ── 4. The identity itself ──────────────────────────────────────────────
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION — read this output
--
-- Every name the function deletes from must come back kind = 'table'. A
-- 'view' is the bug that was just fixed; a NULL means the statement will
-- raise 42P01 and the whole deletion aborts.
--
-- Every anonymised column must come back nullable = 'YES'.
-- ═══════════════════════════════════════════════════════════════════════
select
  n as relation,
  case c.relkind
    when 'r' then 'table' when 'v' then 'VIEW — BUG'
    when 'm' then 'MATVIEW — BUG' else c.relkind::text
  end as kind
from unnest(array[
  'eren_chat_messages','eren_chat_memories','push_subscriptions','user_gacha_state',
  'user_inventory','gacha_pull_log','user_task_completions','interactions','time_spent',
  'daily_moods','game_scores','jelly_scores','jelly_duel_leads','jelly_progress',
  'kiosk_shifts','daily_battle_results','weekly_battle_results','weekly_coop_results',
  'weekly_game_results','reminder_fires','reminder_logs',
  'couple_journal','memories','reminders','household_reminders','eren_wishes','households'
]) as n
left join pg_class c
  on c.oid = to_regclass('public.' || n)
order by kind desc, n;
