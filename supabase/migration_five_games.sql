-- ═══════════════════════════════════════════════════════════════════════════
-- Allow eren_stack, yarn_pop, eren_says, pawket_pinball, lane_runner in
-- game_scores.game_type. Same drill as previous game additions — the CHECK
-- constraint must whitelist every id, otherwise INSERT 400s.
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
    'tic_tac_toe',
    'eren_stack',
    'yarn_pop',
    'eren_says',
    'pawket_pinball',
    'lane_runner'
  ));
