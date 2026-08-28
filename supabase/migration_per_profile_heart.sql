-- ============================================================
-- Per-profile heart colour — de-personalise the sender identity
--
-- The app picked each partner's heart colour by comparing their email to a
-- literal address baked into the source in three places:
--
--   src/lib/serverPush.ts:25       email === 'jocaspinjo@gmail.com' ? brown : pink
--   src/lib/memoryReactions.ts:19  same
--   src/lib/nudges.ts:26           const MY_EMAIL = 'jocaspinjo@gmail.com'
--
-- That was a deliberate, correct call for a two-person app (nudges.ts says as
-- much: "the alternative would be overkill"). It stops being correct the
-- moment strangers install this: every user on Earth except the original
-- owner falls into the `else` branch and is pink, forever, including both
-- partners in every new household — so the two-colour convention the whole
-- UI is built on collapses into one colour.
--
-- The colour now lives on the profile. Household creator gets brown, the
-- partner who joins gets pink; both are assigned in code at onboarding
-- (createHousehold / join_household).
--
-- Safe to re-run.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS heart text NOT NULL DEFAULT 'pink_heart';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_heart_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_heart_check
      CHECK (heart IN ('brown_heart', 'pink_heart', 'sparkle'));
  END IF;
END $$;

-- Backfill existing households: oldest profile in each household is the
-- creator and keeps brown, the other becomes pink. For the original couple
-- this reproduces exactly what the hardcoded email produced, so nothing
-- visibly changes for them.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY household_id ORDER BY created_at) AS rn
    FROM public.profiles
   WHERE household_id IS NOT NULL
)
UPDATE public.profiles p
   SET heart = CASE WHEN r.rn = 1 THEN 'brown_heart' ELSE 'pink_heart' END
  FROM ranked r
 WHERE r.id = p.id;

-- Let a user change their own colour later (the profile UPDATE grant is
-- column-scoped since migration_household_takeover_fix.sql, so a new column
-- is not writable until granted).
GRANT UPDATE (heart) ON public.profiles TO authenticated;

-- ─── create_household() ───────────────────────────────────────────────────
-- REQUIRED, not optional: migration_household_takeover_fix.sql revoked
-- household_id from the client's UPDATE grant, and createHousehold() in
-- src/lib/onboarding.ts still set it directly — so creating a household would
-- fail for every new user. This is the other half of that revoke.
--
-- Also lets the DB generate invite_code (8 hex from gen_random_uuid) instead
-- of the client's Math.random().toString(36), which is both weaker and can
-- produce a short string when the fraction has leading zeros.
CREATE OR REPLACE FUNCTION public.create_household(
  p_household_name text,
  p_display_name   text
)
RETURNS TABLE (household_id uuid, invite_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id      uuid;
  v_code    text;
  v_current uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'create_household: not authenticated';
  END IF;

  SELECT p.household_id INTO v_current
    FROM public.profiles p WHERE p.id = auth.uid();

  IF v_current IS NOT NULL THEN
    RAISE EXCEPTION 'create_household: already in a household';
  END IF;

  INSERT INTO public.households (name)
       VALUES (COALESCE(NULLIF(trim(p_household_name), ''), 'Our Home'))
    RETURNING households.id, households.invite_code INTO v_id, v_code;

  UPDATE public.profiles
     SET household_id = v_id,
         name         = COALESCE(NULLIF(trim(p_display_name), ''), name),
         heart        = 'brown_heart'
   WHERE id = auth.uid();

  INSERT INTO public.eren_stats (household_id) VALUES (v_id)
    ON CONFLICT (household_id) DO NOTHING;

  RETURN QUERY SELECT v_id, v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_household(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_household(text, text) TO authenticated;

-- join_household() now stamps the joining partner's colour. Brown is taken by
-- whoever created the household, so a joiner is pink unless brown is somehow
-- free (a household whose creator left).
CREATE OR REPLACE FUNCTION public.join_household(p_invite_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household uuid;
  v_current   uuid;
  v_heart     text;
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
