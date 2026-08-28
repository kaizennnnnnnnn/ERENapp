-- ============================================================
-- Send the shared secret with every cron-driven API call.
--
-- /api/notify-*, /api/decay and /api/fire-reminders all run on the SERVICE
-- ROLE client and shipped with no auth whatsoever, so anyone who learned a
-- household UUID could POST arbitrary text to /api/notify-message and have it
-- delivered to both partners' phones looking like it came from each other.
-- CRON_SECRET was already provisioned in the environment and read by nothing.
--
-- Job names and schedules below are the REAL ones, read from cron.job on the
-- production project — not guesses. The decay job (eren-decay-hourly) was
-- created by hand in the dashboard and appears in no other migration; this
-- file is now its source of truth.
--
-- ⚠️  RUN THIS **BEFORE** DEPLOYING THE MATCHING CODE.
--     Sending the header early is harmless while the routes still ignore it.
--     Deploying first would leave every cron job rejected with 401 until you
--     get here — no decay, no reminders, no pushes.
--
-- ⚠️  REPLACE  __CRON_SECRET__  with the exact value of CRON_SECRET from your
--     Vercel environment. It must match byte for byte. One occurrence.
--
-- prune-cron-history is deliberately untouched: it is a plain SQL DELETE
-- against cron.job_run_details and never calls the API, so it needs no header.
--
-- Safe to re-run.
-- ============================================================

DO $$
DECLARE
  v_base   text := 'https://eren-care-app.vercel.app';
  v_secret text := '__CRON_SECRET__';
  v_hdr    jsonb;
  v_job    record;
BEGIN
  IF v_secret = '__CRON' || '_SECRET__' THEN
    RAISE EXCEPTION 'Replace __CRON_SECRET__ with the real CRON_SECRET value first';
  END IF;

  v_hdr := jsonb_build_object('x-cron-secret', v_secret);

  FOR v_job IN
    SELECT * FROM (VALUES
      ('eren-decay-hourly',             '0 * * * *',          '/api/decay'),
      ('fire-reminders',                '*/15 * * * *',       '/api/fire-reminders'),
      ('eren_notify_memory_6h',         '0 */6 * * *',        '/api/notify-memory'),
      ('eren_notify_favorite_weekly',   '0 9 * * 1',          '/api/notify-favorite'),
      ('eren_notify_anniversary_daily', '0 8 * * *',          '/api/notify-anniversary'),
      ('eren_notify_streak_sos',        '0 16,18,20 * * *',   '/api/notify-streak')
    ) AS t(jobname, schedule, path)
  LOOP
    PERFORM cron.unschedule(v_job.jobname)
      WHERE EXISTS (SELECT 1 FROM cron.job j WHERE j.jobname = v_job.jobname);

    PERFORM cron.schedule(v_job.jobname, v_job.schedule, format(
      $q$ SELECT net.http_get(url := %L, headers := %L::jsonb); $q$,
      v_base || v_job.path, v_hdr));
  END LOOP;
END $$;

-- Verify: all six commands below should contain x-cron-secret, and
-- prune-cron-history should still be the plain DELETE.
--
--   SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
