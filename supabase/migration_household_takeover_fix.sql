-- ============================================================
-- Pre-launch security hardening
--
-- Fixes, in order:
--   1. profiles UPDATE had no WITH CHECK and no column restriction, so any
--      authenticated user could set their OWN household_id to any household
--      UUID and instantly read that couple's journal, notes, memories, chat
--      and stats. (Postgres reuses the USING expression as the check when
--      WITH CHECK is omitted, and USING only pinned `id` — every other
--      column stayed freely self-writable.)
--   2. joinHousehold() in the app could never work: it does a client-side
--      SELECT on households by invite_code, but the only SELECT policy is
--      `id = my_household_id()`, which is NULL for a user who hasn't joined
--      yet — so the lookup always returned zero rows and every valid code
--      reported "Code not found". Replaced with a SECURITY DEFINER RPC.
--   3. push_subscriptions and couple_journal INSERT checked row ownership
--      but never that household_id was the caller's own.
--   4. eren_wishes and memory_frames were subscribed to in code but never
--      added to the realtime publication, so those listeners never fired.
--
-- Safe to re-run.
-- ============================================================

-- ─── 1. profiles: pin identity, take household_id out of client reach ──────
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Column-level UPDATE. Postgres can't revoke a single column out of a
-- table-wide grant, so we drop the table grant and re-grant the allowed
-- columns explicitly. `household_id` is deliberately absent — it is now
-- settable only through join_household() below. `id` and `created_at` are
-- absent because nothing should ever rewrite them.
--
-- NOTE: coins / xp / level / claimed_level ARE still granted. The client
-- writes them today (TaskContext, rewards page), so revoking them here would
-- break the app. Moving those behind server-authoritative earn RPCs is the
-- separate economy-hardening task — see H-5 in the audit. With public signup
-- disabled, the residual risk there is "either of you can cheat at your own
-- game", not a security boundary.
--
-- If you ADD a column to profiles later, grant it here or the client can't
-- write it.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  achievements,
  avatar_url,
  birthday,
  catchup_pushed_at,
  claimed_level,
  coins,
  last_action_notify,
  last_phase3_notify,
  level,
  memory_caught_up,
  memory_last_seen_at,
  memory_push_optin,
  mood_alert_optin,
  name,
  quiet_eren_optin,
  streak,
  timezone,
  updated_at,
  wish_push_optin,
  xp
) ON public.profiles TO authenticated;

-- ─── 2. join_household() — the only way into a household ──────────────────
-- SECURITY DEFINER so it can read households (RLS hides them from a user who
-- has no household yet) and write the household_id column the client can no
-- longer set directly.
--
-- Returns the household id on success, NULL when the code doesn't match, and
-- raises when the caller is already in a household — so the client can tell
-- "wrong code" apart from "network problem", which the old .maybeSingle()
-- path deliberately did too.
CREATE OR REPLACE FUNCTION public.join_household(p_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household uuid;
  v_current   uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'join_household: not authenticated';
  END IF;

  SELECT household_id INTO v_current
    FROM public.profiles WHERE id = auth.uid();

  IF v_current IS NOT NULL THEN
    RAISE EXCEPTION 'join_household: already in a household';
  END IF;

  SELECT id INTO v_household
    FROM public.households
   WHERE invite_code = upper(trim(p_invite_code));

  IF v_household IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
     SET household_id = v_household
   WHERE id = auth.uid();

  RETURN v_household;
END;
$$;

REVOKE ALL ON FUNCTION public.join_household(text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_household(text) TO authenticated;

-- ─── 3. Bind household-scoped inserts to the caller's own household ───────
-- These policy names are the ones actually in the schema. Getting a name
-- wrong here would be worse than doing nothing: permissive policies are OR'd,
-- so a surviving old policy would keep allowing what the new one forbids.
--
-- push_subscriptions shipped as FOR ALL with only a USING clause, which
-- Postgres also uses as the WITH CHECK — so an insert only had to claim your
-- own user_id and could name ANY household_id, pointing your device at
-- another couple's push stream. Replaced with the same FOR ALL (so reading,
-- updating and deleting your own rows is unchanged) plus a real WITH CHECK.
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND household_id = public.my_household_id()
  );

DROP POLICY IF EXISTS "Users can send journal messages" ON public.couple_journal;
CREATE POLICY "Users can send journal messages"
  ON public.couple_journal FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND household_id = public.my_household_id()
  );

-- ─── 4. Realtime publication for the two silent listeners ────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'eren_wishes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.eren_wishes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'memory_frames'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_frames;
  END IF;
END $$;
