-- ═══════════════════════════════════════════════════════════════════════════
-- Level-reward claim tracking
-- Adds a `claimed_level` column to profiles that records the highest level
-- for which the user has claimed their reward. The /rewards page lets the
-- user claim one level at a time (sequentially) up to their current `level`.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS claimed_level integer NOT NULL DEFAULT 0;
