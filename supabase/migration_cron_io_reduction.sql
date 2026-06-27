-- ============================================================================
-- Disk IO reduction — cron + pg_net churn
-- ============================================================================
-- Why: pg_stat_statements showed `INSERT INTO cron.job_run_details` as the #1
-- WAL generator (~45 MB), and `http_request_queue` (pg_net) as a high-autovacuum
-- table. Both are driven by how OFTEN cron jobs run. `fire-reminders` ran every
-- 5 minutes (288×/day); most runs do nothing. This migration:
--   1. Slows fire-reminders to every 15 min (96×/day) — 3× less cron WAL +
--      pg_net queue churn. Reminders still fire within ~15 min of schedule,
--      which the feature already tolerates.
--   2. Adds a daily prune of cron.job_run_details so the log table stops
--      growing unbounded (bloat -> more autovacuum IO over time).
--
-- Idempotent: unschedules prior versions first, so re-running is safe.
-- Run this in the Supabase SQL Editor.
-- ============================================================================

-- ── 1. fire-reminders: every 5 min -> every 15 min ──────────────────────────
SELECT cron.unschedule('fire-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fire-reminders');

SELECT cron.schedule(
  'fire-reminders',
  '*/15 * * * *',
  $$ SELECT net.http_get(url := 'https://eren-care-app.vercel.app/api/fire-reminders') $$
);

-- ── 2. Prune cron run history daily (keep last 2 days) ──────────────────────
SELECT cron.unschedule('prune-cron-history')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-cron-history');

SELECT cron.schedule(
  'prune-cron-history',
  '17 3 * * *',                       -- 03:17 UTC daily, off-peak
  $$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '2 days' $$
);

-- ── 3. One-time cleanup of the existing backlog ─────────────────────────────
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '2 days';

-- Verify afterwards:
--   SELECT jobname, schedule, active FROM cron.job ORDER BY jobid;
--   SELECT count(*) FROM cron.job_run_details;
