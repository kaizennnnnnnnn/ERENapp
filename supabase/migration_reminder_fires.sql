-- 2026-05-22 — reminder_fires + server-side scheduling
--
-- Why this exists:
--   The old scheduler used the service-worker's setTimeout, which dies
--   the moment the browser idles the SW (~30 s on most engines). That
--   means scheduled reminders never fired unless the user happened to
--   have the PWA open at the exact time. Once the SW was killed, the
--   in-memory schedule was gone, so reminders were essentially a
--   best-effort foreground-only feature.
--
-- What this does:
--   1. reminder_fires logs every time a reminder actually fires, so
--      missed reminders survive across phone restarts and the user
--      can see what they slept through.
--   2. pg_cron pings /api/fire-reminders every minute to actually
--      deliver server-side web pushes — same pattern /api/decay uses.

CREATE TABLE IF NOT EXISTS public.reminder_fires (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id   uuid NOT NULL REFERENCES public.household_reminders(id) ON DELETE CASCADE,
  household_id  uuid NOT NULL,
  user_id       uuid,                       -- NULL = shared (both members)
  text          text NOT NULL,
  fired_at      timestamptz NOT NULL DEFAULT now(),
  dismissed_by  uuid[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminder_fires_household_fired_idx
  ON public.reminder_fires (household_id, fired_at DESC);

ALTER TABLE public.reminder_fires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminder_fires_read"  ON public.reminder_fires;
DROP POLICY IF EXISTS "reminder_fires_update" ON public.reminder_fires;

CREATE POLICY "reminder_fires_read"
  ON public.reminder_fires FOR SELECT
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "reminder_fires_update"
  ON public.reminder_fires FOR UPDATE
  TO authenticated
  USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- pg_cron job. Requires the `pg_cron` and `pg_net` extensions, the same
-- ones used by the /api/decay schedule. If you don't already have that
-- one configured, enable both in Database → Extensions first.
--
-- Drops then re-creates so re-running this migration is idempotent.
SELECT cron.unschedule('fire-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fire-reminders');

-- Every 5 minutes (not every minute). Reminders firing within ~5 min of
-- their scheduled time is fine for a household to-do app, and this cuts
-- the endpoint's load by 5× — meaningful given the Disk IO budget is
-- already tight from realtime traffic.
SELECT cron.schedule(
  'fire-reminders',
  '*/5 * * * *',
  $$ SELECT net.http_get(url := 'https://eren-care-app.vercel.app/api/fire-reminders') $$
);
