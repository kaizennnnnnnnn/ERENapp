-- Donut machine: one free spin per user every 24 hours.
--
-- Lives on user_gacha_state next to last_free_fortune because it's the same
-- kind of thing — a per-user cooldown stamp — and that row already exists for
-- everyone who has ever opened the gacha.
--
-- Rolling 24h, NOT a calendar day like the fortune: the machine says "FREE SPIN
-- IN 6H 12M", so the stamp has to be an instant, not a date.
--
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).

alter table public.user_gacha_state
  add column if not exists last_free_donut timestamptz;
