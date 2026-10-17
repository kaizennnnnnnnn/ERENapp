-- ============================================================
--  POTION MIXER  —  the Lab's potions
--
--  Paste this whole file into the Supabase SQL editor. Safe to re-run.
--
--    1. eren_stats.potion          the potion he's on (household)
--    2. eren_stats.potions_found   every potion found (household)
--
--  Household-wide, like donut_effect: there is one cat, so a potion she gives
--  him shows on your phone too, and a potion either of you finds goes in the
--  one shared book. Written by the client the same no-decay-bump way
--  donut_effect is, under the existing eren_stats RLS.
--
--  Until this is pasted the mixer still works, but keeps the book and the
--  potion on each phone on its own.
-- ============================================================

-- ── 1. The potion he's on ───────────────────────────────────
-- { id, color, sparkle, by, until } (lib/potions ActivePotion). Never cleared:
-- a potion whose `until` has passed simply reads as none.

alter table public.eren_stats
  add column if not exists potion jsonb;

-- ── 2. The potion book ──────────────────────────────────────
-- Potion ids (lib/potions POTIONS), in the order they were found.

alter table public.eren_stats
  add column if not exists potions_found text[] not null default '{}';
