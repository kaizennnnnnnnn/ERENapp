-- "Send Eren" nudge: carry the SketchEren pose to the recipient's popup
-- Run once in Supabase SQL editor

ALTER TABLE public.couple_journal
  ADD COLUMN IF NOT EXISTS eren_state text;
