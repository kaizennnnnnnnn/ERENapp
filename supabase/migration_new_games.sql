-- ═══════════════════════════════════════════════════════════════════════════
-- Allow memory_match + treat_tumble in game_scores.game_type
-- The original CHECK constraint only listed the first three game ids, so
-- INSERTs for the new games were being silently rejected (and never showed
-- up on the leaderboard).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.game_scores
  DROP CONSTRAINT IF EXISTS game_scores_game_type_check;

ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_game_type_check
  CHECK (game_type IN (
    'catch_mouse',
    'yarn_chase',
    'paw_tap',
    'memory_match',
    'treat_tumble'
  ));
