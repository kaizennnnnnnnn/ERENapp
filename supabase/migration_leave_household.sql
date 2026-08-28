-- ============================================================
-- leave_household() + invite-code rotation + a member cap
--
-- migration_household_takeover_fix.sql revoked profiles.household_id from the
-- client to stop an account relocating into a stranger's home. That was right,
-- but it removed the ONLY way anyone could ever move out — and there was no
-- leave path before it either. The result is a one-way door: a user who joins
-- the wrong household (mistyped code, curiosity, an ex) is permanently inside
-- someone else's journal, notes, moods and memory wall with no exit and no
-- account deletion. For a couples app that is a safety problem, not just a UX
-- one.
--
-- Also closes three things the same trust boundary depends on:
--   • invite codes never rotated, so one screenshot grants access forever
--   • no member cap, so a code leak means unlimited strangers in one home
--   • households UPDATE had no WITH CHECK and no column grants, letting any
--     member rewrite another household's row
--
-- Safe to re-run.
-- ============================================================

-- ─── 1. Member cap ────────────────────────────────────────────────────────
-- A household is two people. Enforced in the DB so no client path can exceed
-- it, and so join_household can report a full home instead of silently
-- creating a third wheel who can read everything.
CREATE OR REPLACE FUNCTION public.enforce_household_member_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.household_id IS NOT NULL
     AND NEW.household_id IS DISTINCT FROM OLD.household_id
     AND (SELECT count(*) FROM public.profiles
           WHERE household_id = NEW.household_id) >= 2 THEN
    RAISE EXCEPTION 'household_full';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_household_cap ON public.profiles;
CREATE TRIGGER profiles_household_cap
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_household_member_cap();

-- ─── 2. leave_household() ─────────────────────────────────────────────────
-- Detaches the caller. Shared history (journal, memories, the cat) belongs to
-- the household and deliberately stays with it — this is "move out", not
-- "delete our life together". The leaver's own rows that are meaningless
-- without them (push subscriptions) are cleaned up so a departed partner
-- cannot keep receiving that household's notifications.
--
-- Rotating the code on the way out is the important part: whoever is left
-- gets a fresh code, so the person who just left cannot walk back in with the
-- one they memorised.
CREATE OR REPLACE FUNCTION public.leave_household()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household uuid;
  v_remaining int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'leave_household: not authenticated';
  END IF;

  SELECT household_id INTO v_household
    FROM public.profiles WHERE id = auth.uid();

  IF v_household IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.push_subscriptions
   WHERE user_id = auth.uid() AND household_id = v_household;

  UPDATE public.profiles
     SET household_id = NULL,
         heart        = 'pink_heart'
   WHERE id = auth.uid();

  SELECT count(*) INTO v_remaining
    FROM public.profiles WHERE household_id = v_household;

  IF v_remaining = 0 THEN
    -- Nobody left: the household and its cascade (stats, journal, memories)
    -- go with it rather than lingering as an orphan a code could still reach.
    DELETE FROM public.households WHERE id = v_household;
  ELSE
    -- Someone stayed: rotate the code so the leaver can't rejoin silently,
    -- and hand brown to whoever remains so a solo home isn't colourless.
    UPDATE public.households
       SET invite_code = upper(substring(gen_random_uuid()::text FROM 1 FOR 8))
     WHERE id = v_household;

    UPDATE public.profiles
       SET heart = 'brown_heart'
     WHERE household_id = v_household
       AND NOT EXISTS (
         SELECT 1 FROM public.profiles
          WHERE household_id = v_household AND heart = 'brown_heart'
       );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_household() FROM public;
GRANT EXECUTE ON FUNCTION public.leave_household() TO authenticated;

-- ─── 2b. join_household(): report a full home distinctly ─────────────────
-- Without this the member-cap trigger raises a raw 'household_full' that the
-- client can only render as a generic network error. Checking first lets the
-- onboarding screen say what actually happened.
CREATE OR REPLACE FUNCTION public.join_household(p_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household uuid;
  v_current   uuid;
  v_count     int;
  v_heart     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'join_household: not authenticated';
  END IF;

  SELECT household_id INTO v_current
    FROM public.profiles WHERE id = auth.uid();

  IF v_current IS NOT NULL THEN
    RAISE EXCEPTION 'already_in_household';
  END IF;

  SELECT id INTO v_household
    FROM public.households
   WHERE invite_code = upper(trim(p_invite_code));

  IF v_household IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.profiles WHERE household_id = v_household;

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'household_full';
  END IF;

  SELECT CASE
           WHEN EXISTS (
             SELECT 1 FROM public.profiles
              WHERE household_id = v_household AND heart = 'brown_heart'
           ) THEN 'pink_heart'
           ELSE 'brown_heart'
         END
    INTO v_heart;

  UPDATE public.profiles
     SET household_id = v_household,
         heart        = v_heart
   WHERE id = auth.uid();

  RETURN v_household;
END;
$$;

REVOKE ALL ON FUNCTION public.join_household(text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_household(text) TO authenticated;

-- ─── 3. rotate_invite_code() ──────────────────────────────────────────────
-- Lets a household invalidate a code that leaked (screenshot, old phone,
-- shoulder-surf) without anyone having to leave.
CREATE OR REPLACE FUNCTION public.rotate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household uuid;
  v_code      text;
BEGIN
  SELECT household_id INTO v_household
    FROM public.profiles WHERE id = auth.uid();

  IF v_household IS NULL THEN
    RAISE EXCEPTION 'rotate_invite_code: not in a household';
  END IF;

  UPDATE public.households
     SET invite_code = upper(substring(gen_random_uuid()::text FROM 1 FOR 8))
   WHERE id = v_household
   RETURNING invite_code INTO v_code;

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_invite_code() FROM public;
GRANT EXECUTE ON FUNCTION public.rotate_invite_code() TO authenticated;

-- ─── 4. Close the households UPDATE hole ──────────────────────────────────
-- The policy had USING but no WITH CHECK and no column restriction, so a
-- member could rewrite any column — including setting their own invite_code
-- to a guess and using the unique-index failure as an oracle to confirm
-- another household's code exists.
DROP POLICY IF EXISTS "Household members can update household" ON public.households;
CREATE POLICY "Household members can update household"
  ON public.households FOR UPDATE
  USING (id = public.my_household_id())
  WITH CHECK (id = public.my_household_id());

REVOKE UPDATE ON public.households FROM authenticated;
GRANT UPDATE (name, tz, eren_birthday, couple_anniversary)
  ON public.households TO authenticated;
