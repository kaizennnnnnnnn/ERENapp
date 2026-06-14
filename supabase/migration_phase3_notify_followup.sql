-- ============================================================
-- Phase 3 follow-up — notify-favorite + notify-anniversary pg_cron schedules
-- Run once in Supabase Dashboard → SQL Editor → New query.
-- Idempotent: safe to re-run (each job is unscheduled then re-created).
-- ============================================================
--
-- Sets up two pg_cron jobs:
--   • eren_notify_favorite_weekly   — Mondays 09:00 UTC → /api/notify-favorite
--       crowns the week's top carer and tells both partners.
--   • eren_notify_anniversary_daily — daily 08:00 UTC → /api/notify-anniversary
--       checks each household's local day for Eren's birthday, the couple
--       anniversary (eve + day-of), and each partner's birthday.
--
-- NOTE on times: pg_cron schedules are in UTC. The anniversary route resolves
-- "today" per household.tz, so the calendar match is always correct; only the
-- delivery clock-time is fixed. Tune the hours below for your timezone if you
-- want the pings to land at a nicer local hour.
--
-- notify-catchup is NOT scheduled here — it's an event-driven POST fired by the
-- client (useCatchupGate) the first time the memory-wall backfill unlocks
-- frames. No cron needed.
--
-- Replace APP_BASE_URL below with your real Vercel host if it isn't
-- eren-care-app.vercel.app.
-- ============================================================

DO $$
DECLARE
  app_base text := 'https://eren-care-app.vercel.app';
BEGIN
  -- Unschedule any prior versions so re-running is safe.
  PERFORM cron.unschedule(jobid)
  FROM cron.job WHERE jobname IN ('eren_notify_favorite_weekly', 'eren_notify_anniversary_daily');

  -- Weekly "Eren's favourite" — Mondays 09:00 UTC.
  PERFORM cron.schedule(
    'eren_notify_favorite_weekly',
    '0 9 * * 1',
    format($cron$
      SELECT net.http_get(url := %L);
    $cron$, app_base || '/api/notify-favorite')
  );

  -- Daily birthday / anniversary check — 08:00 UTC.
  PERFORM cron.schedule(
    'eren_notify_anniversary_daily',
    '0 8 * * *',
    format($cron$
      SELECT net.http_get(url := %L);
    $cron$, app_base || '/api/notify-anniversary')
  );
END $$;

-- Verify with:
-- SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname LIKE 'eren_%';
