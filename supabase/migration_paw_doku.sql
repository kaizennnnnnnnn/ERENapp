-- ═══════════════════════════════════════════════════════════════════════════
-- Allow paw_doku in game_scores.game_type.
-- Same pattern as every prior game addition — the CHECK constraint must
-- whitelist every id, otherwise INSERT 400s and the leaderboard never sees
-- the score.
--
-- Two retired ids (yarn_chase + pawket_pinball) are KEPT in the whitelist
-- here even though both games have been removed from the app. The reason:
-- existing rows in game_scores still reference them, and Postgres will
-- refuse to add a CHECK constraint that's violated by existing data
-- (error 23514). If you want to drop them, run the DELETE block first
-- (commented out below), then remove them from the IN-list.
-- ═══════════════════════════════════════════════════════════════════════════

-- Optional cleanup: uncomment to scrap legacy rows for removed games.
-- DELETE FROM public.game_scores
--   WHERE game_type IN ('yarn_chase','pawket_pinball');

ALTER TABLE public.game_scores
  DROP CONSTRAINT IF EXISTS game_scores_game_type_check;

ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_game_type_check
  CHECK (game_type IN (
    'catch_mouse',
    'yarn_chase',       -- retired but kept for legacy rows
    'paw_tap',
    'memory_match',
    'treat_tumble',
    'flappy_eren',
    'tic_tac_toe',
    'eren_stack',
    'yarn_pop',
    'eren_says',
    'pawket_pinball',   -- retired but kept for legacy rows
    'lane_runner',
    'paw_doku'
  ));
