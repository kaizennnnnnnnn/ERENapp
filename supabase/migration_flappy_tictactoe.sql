-- ═══════════════════════════════════════════════════════════════════════════
-- Allow flappy_eren + tic_tac_toe in game_scores.game_type
-- Same pattern as migration_new_games.sql — the CHECK constraint must list
-- every game id, otherwise INSERTs for the new games are rejected (400 Bad
-- Request) and never show up on the leaderboard.
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
    'treat_tumble',
    'flappy_eren',
    'tic_tac_toe'
  ));
