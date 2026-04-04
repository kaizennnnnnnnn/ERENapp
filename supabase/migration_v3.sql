-- Migration v3: Add missing eren_stats columns + fix interactions constraint
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- 1. Add missing columns to eren_stats
ALTER TABLE public.eren_stats
  ADD COLUMN IF NOT EXISTS cleanliness   numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_sick       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_decay_at timestamptz;

-- 2. Fix interactions action_type constraint to include 'wash'
ALTER TABLE public.interactions
  DROP CONSTRAINT IF EXISTS interactions_action_type_check;

ALTER TABLE public.interactions
  ADD CONSTRAINT interactions_action_type_check
    CHECK (action_type IN ('feed','play','sleep','wash','clean','pet','medicine','brush'));

-- 3. Add missing columns to profiles (xp, level, coins) if not already present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level  integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS coins  integer NOT NULL DEFAULT 0;
