-- ============================================================
--  CREATE HOUSEHOLD FIX  —  new accounts couldn't build a home
--
--  Paste this whole file into the Supabase SQL editor. Safe to re-run.
--
--  create_household() RETURNS TABLE (household_id uuid, invite_code text),
--  and in PL/pgSQL those output columns are variables too. So the last
--  statement's `ON CONFLICT (household_id)` could mean the eren_stats column
--  or the output variable, Postgres refused with
--      column reference "household_id" is ambiguous
--  and every new home failed ("Couldn't build the home. Try again?").
--  Homes that already exist were never touched by it.
--
--  The fix is one line: `#variable_conflict use_column` tells this function
--  that a bare name is the table's column. The output columns keep their
--  names, because the client reads them back as household_id / invite_code.
--  Everything else is the function exactly as migration_per_profile_heart.sql
--  left it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_household(
  p_household_name text,
  p_display_name   text
)
RETURNS TABLE (household_id uuid, invite_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
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
