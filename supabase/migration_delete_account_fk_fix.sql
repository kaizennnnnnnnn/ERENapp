-- ═══════════════════════════════════════════════════════════════════════════
-- DELETE ACCOUNT — the two foreign keys that block it
--
-- `delete_my_account()` ends with `DELETE FROM auth.users`, which cascades to
-- `public.profiles`. Twenty-four of the twenty-seven columns pointing at
-- profiles(id) declare `ON DELETE CASCADE`, and section 2 of the RPC nulls the
-- five co-authored ones by hand first so the partner's history survives.
--
-- Two columns declare NO on-delete action at all:
--
--     countdown_doors.opened_by   (migration_cozy_countdown.sql:18)
--     memory_frames.unlocked_by   (migration_phase3_spine.sql:97)
--
-- NO ACTION means the delete is REFUSED. Any user who has ever unlocked a
-- memory frame or opened a countdown door — which is nearly all of them —
-- raises 23503 and the whole function rolls back. The user sees "Couldn't
-- delete the account just now", forever. Google Play requires a working
-- in-app deletion path, so this is a submission blocker as well as a bug.
--
-- It only appears to work solo: the last-member branch drops the household
-- first, and both tables cascade from households(id), so the offending rows
-- are already gone by the time auth.users is touched. In a two-person
-- household — the app's whole premise — it has never worked once.
--
-- FIXED IN THE SCHEMA, NOT IN THE FUNCTION. Adding two more UPDATE ... SET
-- NULL lines to the RPC's sever block would work today and rot tomorrow:
-- that list has to be kept in sync by hand with every table anyone adds, and
-- it has now silently fallen out of sync twice. `ON DELETE SET NULL` states
-- the intent where the intent belongs, and it holds no matter which code path
-- removes the profile.
--
-- SET NULL is the same semantics the sever block already applies to
-- memories.user_id and couple_journal.sender_id: the row is household-owned
-- and outlives its author; only the attribution goes. A memory frame stays on
-- the wall, an opened door stays open.
--
-- Idempotent. Safe to run twice. No data is written.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  r record;
begin
  for r in
    select con.conname,
           con.conrelid::regclass::text as tbl,
           att.attname                  as col
      from pg_constraint con
      join pg_attribute  att
        on att.attrelid = con.conrelid
       and att.attnum   = con.conkey[1]
     where con.contype   = 'f'
       and con.confrelid = 'public.profiles'::regclass
       and con.confdeltype = 'a'              -- 'a' = NO ACTION, the bug
       and array_length(con.conkey, 1) = 1
  loop
    raise notice 'Repairing % on %.%', r.conname, r.tbl, r.col;

    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) '
      'references public.profiles(id) on delete set null',
      r.tbl, r.conname, r.col
    );
  end loop;
end $$;

-- ── Verify ────────────────────────────────────────────────────────────────
-- Every row must read 'SET NULL' or 'CASCADE'. A 'NO ACTION' here is a
-- deletion blocker and the next person to hit it gets a permanent failure.
select con.conrelid::regclass::text as table_name,
       att.attname                  as column_name,
       case con.confdeltype
         when 'a' then '** NO ACTION — BLOCKS DELETION **'
         when 'n' then 'SET NULL'
         when 'c' then 'CASCADE'
         when 'r' then '** RESTRICT — BLOCKS DELETION **'
         when 'd' then 'SET DEFAULT'
       end                          as on_delete
  from pg_constraint con
  join pg_attribute  att
    on att.attrelid = con.conrelid
   and att.attnum   = con.conkey[1]
 where con.contype   = 'f'
   and con.confrelid = 'public.profiles'::regclass
 order by 3 desc, 1;
