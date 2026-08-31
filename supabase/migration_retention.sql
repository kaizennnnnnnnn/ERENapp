-- ============================================================================
-- Retention — bound the tables that grow forever
-- ============================================================================
-- From the 2026-08-31 disk-IO audit: no application table had any retention
-- policy, and the only scheduled DELETE in the repo prunes Postgres's own cron
-- log. Unbounded tables are the multiplier under every scan cost — once a table
-- outgrows shared_buffers its reads become physical.
--
-- ONLY THE TABLES BELOW ARE SAFE TO PRUNE ON A TIMER. Four others were checked
-- and deliberately EXCLUDED, because deleting from them silently changes what
-- the user sees. Read the "DO NOT PRUNE" section before adding to this file.
--
-- Run once in the Supabase SQL editor. Idempotent — unschedules first.
-- ============================================================================


-- ── SAFE: gacha_pull_log ────────────────────────────────────────────────────
-- Written by useGacha (two insert sites) and read by nothing in src/. A pure
-- audit log. A year is generous for anything you'd ever want to inspect.
--
-- ── SAFE: reminder_fires ────────────────────────────────────────────────────
-- Two readers, both narrow: /api/fire-reminders dedups within its 15-minute
-- window, and getRecentFires (lib/reminders.ts) surfaces "missed reminders"
-- over a hardcoded 48-hour cutoff, capped at 40 rows. 14 days is 7x the widest
-- thing that reads it.
--
-- ── SAFE: eren_chat_messages ────────────────────────────────────────────────
-- useErenChat loads PAGE = 60 most-recent messages and there is no older-page
-- fetch, so anything below that per user is already unreachable in the UI.
-- The prompt itself replays only HISTORY_LIMIT = 30. 180 days is far beyond
-- both. Note this is the table whose *global* daily-ceiling count has no index
-- to stand on (fixed in migration_disk_io_indexes.sql) — pruning compounds it.

SELECT cron.unschedule('prune-app-history')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-app-history');

SELECT cron.schedule(
  'prune-app-history',
  '41 4 1 * *',                      -- 04:41 UTC on the 1st, off-peak
  $$
    DELETE FROM public.gacha_pull_log     WHERE created_at < now() - interval '365 days';
    DELETE FROM public.reminder_fires     WHERE fired_at   < now() - interval '14 days';
    DELETE FROM public.eren_chat_messages WHERE created_at < now() - interval '180 days';
  $$
);

-- One-time cleanup of the existing backlog (the job only runs monthly).
DELETE FROM public.gacha_pull_log     WHERE created_at < now() - interval '365 days';
DELETE FROM public.reminder_fires     WHERE fired_at   < now() - interval '14 days';
DELETE FROM public.eren_chat_messages WHERE created_at < now() - interval '180 days';


-- ============================================================================
-- DO NOT PRUNE — these four look prunable and are not
-- ============================================================================
--
-- couple_journal
--   These are the actual messages and notes the two of you send each other.
--   Deleting them destroys the thing the app exists for. Never put this on a
--   timer. If it ever needs bounding, that is a product decision with an
--   export first, not a maintenance job.
--
-- interactions
--   The memory catalogue counts LIFETIME cares — the ceiling is 500 (see
--   memoryCatalogue.ts). A household playing lightly at 2 actions/day takes
--   250 days to reach it. Any retention window shorter than that silently
--   makes a frame permanently unreachable. Fixing this properly means keeping
--   durable counters, and the obvious version of that — a trigger maintaining
--   a column on households — is worse than the problem, because it rewrites
--   one hot row on every care action. Left alone for now; the two new indexes
--   in migration_disk_io_indexes.sql make its scans cheap enough that growth
--   is no longer urgent.
--
-- time_spent
--   profile/page.tsx sums duration_seconds with no date filter to show
--   lifetime "time with Eren" for both partners. Pruning would visibly shrink
--   a number they have watched go up. Aggregate into a per-user total first,
--   then prune the rows — a separate change, not this one.
--
-- game_scores
--   Feeds lifetime achievement progress (achievements.ts) and the minigame
--   counter in the memory catalogue. Same problem as interactions.
--
-- ============================================================================
-- Verify afterwards:
--   SELECT jobname, schedule, active FROM cron.job ORDER BY jobid;
--   SELECT relname, n_live_tup FROM pg_stat_user_tables
--    WHERE relname IN ('gacha_pull_log','reminder_fires','eren_chat_messages');
