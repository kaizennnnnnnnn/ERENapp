-- ============================================================
--  CLOSET  —  favourite looks, and who dressed each room
--
--  Paste this whole file into the Supabase SQL editor. Safe to re-run.
--
--    1. eren_stats.closet_favorites   the looks you've hearted (household)
--    2. eren_stats.room_skins_by      who last dressed each room
--
--  Household-wide, exactly like room_skins: there is one cat and one closet,
--  so a look one of you hearts is a favourite on both phones. Written by the
--  client the same no-decay-bump way room_skins is, under the existing
--  eren_stats RLS (household members may update their own row).
--
--  Until this is pasted the closet simply shows no hearts and no "who
--  dressed it": the client only uses each column once it's there.
-- ============================================================

-- ── 1. Favourite looks ──────────────────────────────────────
-- Skin ids, plus 'classic' for the Classic look. The Default look (no skin)
-- can't be a favourite: there is nothing to put on.

alter table public.eren_stats
  add column if not exists closet_favorites text[] not null default '{}';

-- ── 2. Who dressed each room ────────────────────────────────
-- Room id → the user id of whoever last changed that room's look (put one on,
-- took it off, Surprise me, Undo). Written in the same update as room_skins,
-- so the two never disagree. The closet shows the partner's picks on the room
-- tiles: "Jovan dressed the Kitchen".

alter table public.eren_stats
  add column if not exists room_skins_by jsonb not null default '{}'::jsonb;
