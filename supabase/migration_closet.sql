-- ============================================================
--  CLOSET  —  favourite looks
--
--  Paste this whole file into the Supabase SQL editor. Safe to re-run.
--
--    1. eren_stats.closet_favorites   the looks you've hearted (household)
--
--  Household-wide, exactly like room_skins: there is one cat and one closet,
--  so a look one of you hearts is a favourite on both phones. Written by the
--  client the same no-decay-bump way room_skins is, under the existing
--  eren_stats RLS (household members may update their own row).
--
--  Until this is pasted the closet simply shows no hearts: the client only
--  offers them once the column is there.
-- ============================================================

-- ── 1. Favourite looks ──────────────────────────────────────
-- Skin ids, plus 'classic' for the Classic look. The Default look (no skin)
-- can't be a favourite: there is nothing to put on.

alter table public.eren_stats
  add column if not exists closet_favorites text[] not null default '{}';
