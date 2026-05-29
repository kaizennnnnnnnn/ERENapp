-- Partner mood alerts: recipient's opt-in for "tell me when my partner
-- is having a tough day" low-mood push notifications.
-- Run once in Supabase SQL editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mood_alert_optin boolean NOT NULL DEFAULT true;
