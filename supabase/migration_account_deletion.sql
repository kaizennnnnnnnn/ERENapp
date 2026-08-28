-- ============================================================
-- delete_my_account() — Google Play's in-app deletion requirement
--
-- Play requires an app with account creation to offer in-app account deletion
-- AND a publicly reachable web deletion URL. Neither existed.
--
-- ─── THE DESIGN DECISION ─────────────────────────────────────────────────
-- Two partners co-create a household: the journal is a conversation, the
-- memory wall holds photos they both added, the cat has a shared history.
-- When partner A deletes their account there is a genuine conflict:
--
--   • Deleting everything A wrote destroys half of B's conversation and the
--     shared memories — B did not ask for that and did not consent to it.
--   • Keeping A's rows intact, linked to A, conflicts with A's erasure right.
--
-- The policy implemented here: DELETE what is personal, ANONYMISE what is
-- shared. A's private data (AI chat and its memories, push tokens, inventory,
-- scores, moods, play history) is destroyed outright. Co-authored content
-- that B legitimately holds — journal messages B received, memories on the
-- wall, household reminders — is kept but severed from A: the author link is
-- nulled, so the row is no longer personal data about an identifiable person.
--
-- That severing is the crux, and it is the standard reading: erasure requires
-- the data no longer be attributable to the individual, not that every trace
-- of a conversation someone else also participated in be destroyed. It is
-- also the only option that does not let one partner unilaterally delete the
-- other's history.
--
-- If A is the LAST member, nothing is shared any more: the household, the
-- cat, and every uploaded photo go with them.
--
-- ⚠️  The UI must tell A plainly, before they confirm, that messages and
--     memories they added stay visible to their partner without their name
--     attached. Silent anonymisation is not consent.
--
-- ⚠️  Confirm this policy against current Play + GDPR guidance before public
--     release. The mechanism is sound; the legal framing deserves review.
--
-- Safe to re-run.
-- ============================================================

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
  DELETE FROM public.game_best_scores       WHERE user_id = v_uid;
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
      -- Last one out. Nothing here is shared any more, so the uploaded
      -- photos go too — deleting the memories rows alone would leave the
      -- objects sitting in a PUBLIC bucket forever, still reachable by URL.
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
  -- Last, because everything above needs the profile row to resolve the
  -- household. profiles.id references auth.users, so this cascades the
  -- profile away with it and the login stops existing.
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ─── Deletion requests from people who cannot sign in ─────────────────────
-- Play also requires a route for someone who has lost access. The web form
-- posts here; the developer works the queue by hand.
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  handled_at  timestamptz
);

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Deliberately no SELECT policy: nobody reads this through the API. The
-- developer reads it in the dashboard. Anonymous INSERT is the whole point —
-- the requester by definition may not have a working login.
DROP POLICY IF EXISTS "Anyone can request deletion" ON public.deletion_requests;
CREATE POLICY "Anyone can request deletion"
  ON public.deletion_requests FOR INSERT
  WITH CHECK (true);
