-- ═══════════════════════════════════════════════════════════════════════════
-- GRANT_WISH — a SECURITY DEFINER function that believed whatever it was told
--
-- migration_phase3_spine.sql:163 defines grant_wish as SECURITY DEFINER, which
-- means it runs as the owner and RLS does not apply inside it. It then takes
-- p_household_id, p_user_id and p_coins FROM THE CALLER and never once calls
-- auth.uid().
--
-- Its authorization check is real but answers the wrong question. It verifies
-- that p_user_id is a member of p_household_id — not that the person calling
-- IS p_user_id. Anyone signed in can pass someone else's ids and:
--
--   • burn that household's daily wish (it is once per household per day, and
--     the CAS means the real owner then gets granted=false),
--   • write arbitrary text into their action_taken,
--   • bump their households.wishes_granted_count, which drives Memory Wall
--     frames — minting progress toward a collectible in a home they are not in.
--
-- It needs the target uuids, which RLS hides, so it is not trivially
-- exploitable and it is NOT a launch blocker. It is still a cross-tenant write
-- on a table RLS otherwise protects, and the fix is small.
--
-- Three changes:
--
-- 1. THE CALLER IS THE ACTOR. p_user_id and p_household_id are now VALIDATED
--    against auth.uid() rather than trusted. Validated, not ignored: silently
--    substituting the right values would turn a client bug into a wrong-row
--    write that nobody ever sees. The signature is unchanged so the existing
--    client keeps working without a coordinated deploy.
--
-- 2. SET search_path = public. Required on any SECURITY DEFINER function —
--    without it the resolution of `public.profiles` and friends depends on the
--    caller's search_path. Supabase's own linter flags this as
--    function_search_path_mutable. The other definers in this project
--    (report_content, accept_terms, purchase_trophy_item) all set it; this one
--    was written before that became the habit.
--
-- 3. COINS ARE CLAMPED. p_coins is credited straight to profiles.coins, and
--    the caller picks it. The catalogue's highest wish pays 25
--    (src/lib/wishes.ts — 5, 10, 15, 25), so anything above that is not a
--    wish being granted.
--
--    Be honest about what this is worth: `coins` is currently IN the
--    GRANT UPDATE column list on profiles (migration_household_takeover_fix),
--    so a client can already write its own balance directly and this clamp
--    stops nothing today. It matters when that is closed — the economy
--    hardening item — and it costs one line now instead of being the thing
--    everyone forgets then. It is a CEILING, not a mirror of the catalogue: a
--    new wish paying more than 25 must raise it, or grants will silently
--    underpay.
--
-- And the UPDATE policy on eren_wishes is dropped. Nothing in the app has ever
-- updated that table from the client — every call site is a SELECT except one
-- INSERT that seeds the day's row, and the notify route uses the service role.
-- The grant itself happens inside this function, which bypasses RLS anyway. So
-- the capability is removed rather than narrowed, which is what was done to the
-- journal's forgeable UPDATE policy for the same reason.
--
-- Idempotent. Safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.grant_wish(
  p_household_id uuid,
  p_period_key   text,
  p_user_id      uuid,
  p_action_taken text,
  p_coins        int
)
RETURNS TABLE (granted boolean, coins_paid int, wish_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wish_id   text;
  v_uid       uuid := auth.uid();
  v_household uuid;
  v_coins     int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'grant_wish: not signed in' USING ERRCODE = '28000';
  END IF;

  -- The caller is the actor. Anything else is someone granting a wish in a
  -- home they are not in.
  IF p_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'grant_wish: you can only grant your own wish'
      USING ERRCODE = '42501';
  END IF;

  SELECT household_id INTO v_household
    FROM public.profiles WHERE id = v_uid;

  IF v_household IS NULL THEN
    RAISE EXCEPTION 'grant_wish: you are not in a household'
      USING ERRCODE = '42501';
  END IF;

  IF p_household_id IS DISTINCT FROM v_household THEN
    RAISE EXCEPTION 'grant_wish: % is not your household', p_household_id
      USING ERRCODE = '42501';
  END IF;

  -- Ceiling, not a mirror. See note 3 in the header.
  v_coins := least(greatest(coalesce(p_coins, 0), 0), 25);

  -- CAS: only one partner wins the grant.
  UPDATE public.eren_wishes
     SET granted_at   = now(),
         granted_by   = v_uid,
         action_taken = p_action_taken,
         coins_paid   = v_coins
   WHERE household_id = v_household
     AND period_key   = p_period_key
     AND granted_at IS NULL
  RETURNING eren_wishes.wish_id INTO v_wish_id;

  -- Either already granted, or row missing — both paths return granted=false.
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, NULL::text;
    RETURN;
  END IF;

  -- Household lifetime counter — drives Memory Wall cumulative frames.
  UPDATE public.households
     SET wishes_granted_count = wishes_granted_count + 1
   WHERE id = v_household;

  -- Credit the granter's coins in the same transaction.
  UPDATE public.profiles
     SET coins = COALESCE(coins, 0) + v_coins
   WHERE id = v_uid;

  RETURN QUERY SELECT true, v_coins, v_wish_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_wish(uuid, text, uuid, text, int) TO authenticated;

-- Nothing in the app updates this table from the client. See the header.
DROP POLICY IF EXISTS "Household members update wishes" ON public.eren_wishes;


-- ── Verify ────────────────────────────────────────────────────────────────
-- Both rows must read 'ok'.
select 'grant_wish pins search_path' as check,
       case when exists (
         select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'grant_wish'
            and 'search_path=public' = any(coalesce(p.proconfig, array[]::text[]))
       ) then 'ok' else '** still mutable **' end as status
union all
select 'eren_wishes has no client UPDATE policy',
       case when exists (
         select 1 from pg_policies
          where schemaname = 'public' and tablename = 'eren_wishes' and cmd = 'UPDATE'
       ) then '** an UPDATE policy still exists **' else 'ok' end;
