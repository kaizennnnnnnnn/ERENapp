-- ═══════════════════════════════════════════════════════════════════════
-- COUPLE_JOURNAL: STOP MEMBERS REWRITING EACH OTHER'S MESSAGES
--
-- The policy is named "Users can mark messages read". What it actually says
-- (migration_gacha_couple_fortune.sql:75-76) is:
--
--   FOR UPDATE USING (household_id IN (SELECT household_id FROM profiles
--                                       WHERE id = auth.uid()))
--
-- Two things make that far wider than its name:
--
--   • No WITH CHECK. Postgres reuses the USING expression as the check, and
--     that expression names only household_id — so every other column is
--     unconstrained.
--   • No column-level grant. couple_journal still carries Supabase's default
--     table-wide UPDATE grant to `authenticated`; only profiles and households
--     have ever had theirs revoked and re-granted per column.
--
-- Together: either member can rewrite `message`, `sender_id` and `created_at`
-- on ANY row in their household. So a message can be edited after the fact,
-- and authorship can be forged — someone can compose a message, stamp their
-- partner's id on it, and it is indistinguishable from the real thing.
--
-- That is bad on its own. It is disqualifying for the reporting feature this
-- precedes, whose entire premise is that a reported message is evidence: an
-- abusive message could be quietly rewritten the moment it was reported, and
-- a report could be manufactured against someone who never wrote anything.
--
-- The fix is to remove the capability, not narrow it. NOTHING in the app has
-- ever updated this table: `is_read` is only ever set in local React state
-- (useCouple.ts:471), and unread counts are derived from timestamps, not from
-- that column. The policy has been granting a power no feature uses.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Drop the policy ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can mark messages read" ON public.couple_journal;

-- ─── 2. Drop the grant behind it ──────────────────────────────────────────
-- The policy alone is not the whole story: RLS filters rows, but the table
-- grant is what permits the statement at all. Leaving the grant would mean a
-- future policy written for one column silently re-opens all of them, which
-- is exactly how this one went wrong.
REVOKE UPDATE ON public.couple_journal FROM authenticated;

-- Note there is deliberately still no DELETE policy: a member cannot delete
-- messages, their own or anyone's. Moderation takedowns run service-side.

-- ─── 3. Verification ──────────────────────────────────────────────────────
-- Expect: policies = read (SELECT) + send (INSERT) only, no UPDATE row.
--         grants   = SELECT and INSERT for authenticated, no UPDATE.
select 'policy' as kind, policyname as name, cmd::text as detail
  from pg_policies
 where schemaname = 'public' and tablename = 'couple_journal'
union all
select 'grant', grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'couple_journal'
   and grantee = 'authenticated'
 order by kind, name, detail;
