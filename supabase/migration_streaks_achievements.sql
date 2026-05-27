-- Streak tracking + achievement badges on profiles
-- Run once in Supabase SQL editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak jsonb NOT NULL DEFAULT '{"current":0,"best":0,"lastDate":null}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS achievements jsonb NOT NULL DEFAULT '{}';
