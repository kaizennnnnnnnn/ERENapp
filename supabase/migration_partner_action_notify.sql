-- Per-tag cooldown for the partner-action push (POST /api/notify-action).
-- A user feeding Eren 10 times in a row should only buzz the partner's
-- phone once per 30 min — without a server-side counter we'd spam them.
alter table public.profiles
  add column if not exists last_action_notify jsonb;
