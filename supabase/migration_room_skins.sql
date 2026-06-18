-- Closet: per-household room → skin assignment.
-- Shared between partners (the cat is shared) and realtime-synced via the
-- existing eren_stats row. Keys are room ids (home, feed, play, sleep, wash,
-- chemistry, vet), values are skin ids from lib/skins.ts. A missing key means
-- the room shows its built-in default look.
--
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).

alter table public.eren_stats
  add column if not exists room_skins jsonb not null default '{}'::jsonb;
