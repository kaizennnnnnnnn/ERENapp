-- ═══════════════════════════════════════════════════════════════════════════
-- Allow paw_doku in game_scores.game_type.
-- Same pattern as every prior game addition — the CHECK constraint must
-- whitelist every id, otherwise INSERT 400s and the leaderboard never sees
-- the score. Also drops two retired ids (yarn_chase + pawket_pinball)
-- since both games have been removed from the app.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.game_scores
  DROP CONSTRAINT IF EXISTS game_scores_game_type_check;

ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_game_type_check
  CHECK (game_type IN (
    'catch_mouse',
    'paw_tap',
    'memory_match',
    'treat_tumble',
    'flappy_eren',
    'tic_tac_toe',
    'eren_stack',
    'yarn_pop',
    'eren_says',
    'lane_runner',
    'paw_doku'
  ));
