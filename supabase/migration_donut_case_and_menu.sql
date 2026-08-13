-- Donut collection + the daily food menu.
--
-- Both live on eren_stats because both belong to the CAT, not to a person:
-- which donuts he has tasted is his palate, and what he wants to eat today is
-- his appetite. Being on eren_stats also means they ride the realtime channel
-- that row already has, so the partner's screen updates with no extra plumbing.
--
--   donuts_tasted — every donut id he's actually been fed. Append-only.
--   menu_state    — { day, done: [foodKey], claimed_at } for today's 3-food
--                   menu. Progress lives in the DB rather than localStorage so
--                   the two of you share one list: feed the salmon on your
--                   phone and it ticks on theirs. One object, replaced when the
--                   day rolls over, so it can't grow without bound.
--
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).

alter table public.eren_stats
  add column if not exists donuts_tasted jsonb not null default '[]'::jsonb,
  add column if not exists menu_state    jsonb;
