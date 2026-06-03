-- ============================================================
-- Phase 3 PR 9 — notify-memory pg_cron schedule
-- Run once in Supabase Dashboard → SQL Editor → New query.
-- Idempotent: safe to re-run.
-- ============================================================
--
-- Sets up:
--   • pg_cron job that pings /api/notify-memory every 6h to drain the
--     memory_unlocks queue and send batched pushes.
--
-- Replace APP_BASE_URL below with your real Vercel host if it isn't
-- eren-care-app.vercel.app.
-- ============================================================

DO $$
DECLARE
  app_base text := 'https://eren-care-app.vercel.app';
BEGIN
  -- Unschedule any prior version of this job so re-running is safe.
  PERFORM cron.unschedule(jobid)
  FROM cron.job WHERE jobname = 'eren_notify_memory_6h';

  PERFORM cron.schedule(
    'eren_notify_memory_6h',
    '0 */6 * * *',   -- every 6 hours at minute 0
    format($cron$
      SELECT net.http_get(url := %L);
    $cron$, app_base || '/api/notify-memory')
  );
END $$;

-- Verify with:
-- SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname LIKE 'eren_%';
