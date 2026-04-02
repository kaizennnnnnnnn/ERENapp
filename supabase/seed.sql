-- ============================================================
-- Pocket Eren — Seed Data
-- Run AFTER schema.sql. Use real UUIDs from your auth.users.
-- ============================================================

-- Create a household
insert into public.households (id, name, invite_code) values
  ('11111111-1111-1111-1111-111111111111', 'Eren''s Home', 'ERENHOME');

-- NOTE: Profiles are auto-created by the trigger on auth.users.
-- After registering, update your profile's household_id:
--
-- update public.profiles
-- set household_id = '11111111-1111-1111-1111-111111111111'
-- where id = auth.uid();

-- Seed Eren's starting stats for the household
insert into public.eren_stats (household_id, happiness, hunger, energy, sleep_quality, weight, mood) values
  ('11111111-1111-1111-1111-111111111111', 90, 75, 85, 80, 4.50, 'happy');

-- Sample reminders (replace created_by with a real user UUID)
-- insert into public.reminders (household_id, created_by, title, reminder_type, repeat_interval, next_due) values
--   ('11111111-1111-1111-1111-111111111111', '<your-user-id>', 'Feed Eren morning', 'feed', 'daily', now()),
--   ('11111111-1111-1111-1111-111111111111', '<your-user-id>', 'Clean litter box', 'litter', 'daily', now()),
--   ('11111111-1111-1111-1111-111111111111', '<your-user-id>', 'Vet checkup', 'vet', 'monthly', now() + interval '30 days');
