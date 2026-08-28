-- ============================================================
-- Send the shared secret with every cron-driven API call.
--
-- The /api/notify-*, /api/decay and /api/fire-reminders routes all run on the
-- SERVICE ROLE client and shipped with no auth whatsoever, so anyone who
-- learned a household UUID could POST arbitrary text to /api/notify-message
-- and have it delivered to both partners' phones looking like it came from
-- each other. CRON_SECRET was already provisioned in the environment and read
-- by nothing.
--
-- The routes now accept either this header OR a logged-in session cookie
-- (which the in-app safety-net pings already send), so both callers keep
-- working.
--
-- ⚠️  RUN THIS **BEFORE** DEPLOYING THE MATCHING CODE.
--     Sending the header early is harmless while the routes still ignore it.
--     Deploying the code first would leave every cron job rejected with 401
--     until you get here — no decay, no reminders, no pushes.
--
-- ⚠️  REPLACE  __CRON_SECRET__  BELOW with the exact value of CRON_SECRET
--     from your Vercel environment. It must match byte for byte.
--     Find/replace all 6 occurrences before running.
--
-- Safe to re-run.
-- ============================================================

DO $$
DECLARE
  v_base   text := 'https://eren-care-app.vercel.app';
  v_secret text := '__CRON_SECRET__';
  v_hdr    jsonb;
BEGIN
  IF v_secret = '__CRON' || '_SECRET__' THEN
    RAISE EXCEPTION 'Replace __CRON_SECRET__ with the real CRON_SECRET value first';
  END IF;

  v_hdr := jsonb_build_object('x-cron-secret', v_secret);

  -- fire-reminders — every 15 min (cadence from migration_cron_io_reduction)
  PERFORM cron.unschedule('fire-reminders')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fire-reminders');
  PERFORM cron.schedule('fire-reminders', '*/15 * * * *', format(
    $q$ SELECT net.http_get(url := %L, headers := %L::jsonb); $q$,
    v_base || '/api/fire-reminders', v_hdr));

  -- notify-memory — every 6 h
  PERFORM cron.unschedule('eren_notify_memory_6h')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eren_notify_memory_6h');
  PERFORM cron.schedule('eren_notify_memory_6h', '0 */6 * * *', format(
    $q$ SELECT net.http_get(url := %L, headers := %L::jsonb); $q$,
    v_base || '/api/notify-memory', v_hdr));

  -- notify-favorite — Mondays 09:00 UTC
  PERFORM cron.unschedule('eren_notify_favorite_weekly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eren_notify_favorite_weekly');
  PERFORM cron.schedule('eren_notify_favorite_weekly', '0 9 * * 1', format(
    $q$ SELECT net.http_get(url := %L, headers := %L::jsonb); $q$,
    v_base || '/api/notify-favorite', v_hdr));

  -- notify-anniversary — daily 08:00 UTC
  PERFORM cron.unschedule('eren_notify_anniversary_daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eren_notify_anniversary_daily');
  PERFORM cron.schedule('eren_notify_anniversary_daily', '0 8 * * *', format(
    $q$ SELECT net.http_get(url := %L, headers := %L::jsonb); $q$,
    v_base || '/api/notify-anniversary', v_hdr));

  -- streak SOS — 16:00 / 18:00 / 20:00 UTC. Only rescheduled if it already
  -- exists; if it's absent, paste migration_streak_sos.sql first, then re-run
  -- this file.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eren_notify_streak_sos') THEN
    PERFORM cron.unschedule('eren_notify_streak_sos');
    PERFORM cron.schedule('eren_notify_streak_sos', '0 16,18,20 * * *', format(
      $q$ SELECT net.http_get(url := %L, headers := %L::jsonb); $q$,
      v_base || '/api/notify-streak', v_hdr));
  END IF;

  -- The /api/decay job was created by hand in the dashboard and is in no
  -- migration file, so its jobname is unknown here. Find and fix it with:
  --
  --   SELECT jobid, jobname, schedule, command
  --     FROM cron.job WHERE command LIKE '%/api/decay%';
  --
  -- then reschedule it the same way (keep its existing schedule):
  --
  --   SELECT cron.unschedule('<its jobname>');
  --   SELECT cron.schedule('<its jobname>', '<its schedule>', $q$
  --     SELECT net.http_get(
  --       url     := 'https://eren-care-app.vercel.app/api/decay',
  --       headers := '{"x-cron-secret":"<the secret>"}'::jsonb);
  --   $q$);
END $$;

-- Verify: every command below should now contain x-cron-secret.
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
