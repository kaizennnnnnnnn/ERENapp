-- ═══════════════════════════════════════════════════════════════════════
-- TERMS ACCEPTANCE
--
-- Google Play's User Generated Content policy requires an app carrying user
-- content to define objectionable content and behaviour AND to have users
-- agree to it. /terms is the definition; this is the record of agreement.
--
-- One column, not two. The terms document carries its own "Last updated"
-- date, so an acceptance is stale exactly when its timestamp predates that
-- date — a separate version column would be a second source of truth for the
-- same fact. The app compares against TERMS_LAST_UPDATED in
-- src/components/legal/TermsGate.tsx.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'When this account last accepted /terms. Set only by accept_terms(). NULL means never — TermsGate blocks the app until it is set.';

-- Deliberately NOT backfilled. Existing accounts have genuinely never seen
-- these rules, and stamping a date on them would fabricate a consent that
-- never happened. They meet TermsGate on next launch, which is the point.

-- ─────────────────────────────────────────────────────────────────────
-- accept_terms()
-- ─────────────────────────────────────────────────────────────────────
-- An RPC rather than a column grant. migration_household_takeover_fix.sql
-- revoked table-wide UPDATE on profiles and re-granted a fixed column list;
-- adding terms_accepted_at to that list would let the client write any value
-- it liked, including a backdated one. The whole worth of this column is that
-- it is a record of when something happened, so now() is taken server-side
-- and the client only gets to trigger it.
CREATE OR REPLACE FUNCTION public.accept_terms()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'accept_terms: not authenticated';
  END IF;

  UPDATE public.profiles
     SET terms_accepted_at = now()
   WHERE id = auth.uid()
   RETURNING terms_accepted_at INTO v_at;

  RETURN v_at;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_terms() FROM public;
GRANT EXECUTE ON FUNCTION public.accept_terms() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- Expect one row per account, all with accepted_at NULL until each person
-- next opens the app and agrees.
select id, name, terms_accepted_at
  from public.profiles
 order by created_at;
