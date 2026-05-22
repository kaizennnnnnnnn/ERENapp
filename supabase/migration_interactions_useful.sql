-- 2026-05-22 — interactions.useful flag
--
-- Mark a care action as "useful" only when the relevant stat was
-- below ~90 (or, for medicine, Eren was actually sick). Feeding when
-- full or washing when already clean still inserts a row for history,
-- but the daily-battle scoreboard and the floating action bar skip
-- non-useful rows so the competition can't be gamed by spam-clicking
-- already-maxed stats.
--
-- Defaults to true so existing rows + any code path that doesn't yet
-- pass the flag still counts as before.

ALTER TABLE public.interactions
  ADD COLUMN IF NOT EXISTS useful BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS interactions_household_useful_idx
  ON public.interactions (household_id, useful, created_at DESC);
