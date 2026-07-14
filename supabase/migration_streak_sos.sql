-- ============================================================
-- Streak SOS — evening at-risk-streak sweep via pg_cron.
--
-- Runs 16/18/20 UTC; /api/notify-streak itself only acts when
-- the household's LOCAL hour is 17–23, so tz spread and DST are
-- absorbed in-route, and the per-user last_phase3_notify dayKey
-- stamp guarantees at most one push per user per local day.
--
-- Idempotent: unschedules any prior version first. Replace
-- app_base if your deployment isn't eren-care-app.vercel.app.
-- Run once in the Supabase SQL editor.
-- ============================================================
DO $$
DECLARE
  app_base text := 'https://eren-care-app.vercel.app';
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job WHERE jobname = 'eren_notify_streak_sos';

  PERFORM cron.schedule(
    'eren_notify_streak_sos',
    '0 16,18,20 * * *',
    format($cron$
      SELECT net.http_get(url := %L);
    $cron$, app_base || '/api/notify-streak')
  );
END $$;

-- Verify: SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname LIKE 'eren_%';
