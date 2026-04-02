-- Migration: Add cleanliness and is_sick to eren_stats
-- Run this in your Supabase SQL editor

ALTER TABLE eren_stats
  ADD COLUMN IF NOT EXISTS cleanliness numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_sick     boolean NOT NULL DEFAULT false;

-- Update existing rows to have max cleanliness
UPDATE eren_stats SET cleanliness = 100, is_sick = false WHERE cleanliness IS NULL;
