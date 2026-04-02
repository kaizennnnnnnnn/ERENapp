-- Migration v2: Add coins and food_inventory to eren_stats
-- Run this in your Supabase SQL editor

ALTER TABLE eren_stats
  ADD COLUMN IF NOT EXISTS coins          integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS food_inventory jsonb   NOT NULL DEFAULT '{}';
