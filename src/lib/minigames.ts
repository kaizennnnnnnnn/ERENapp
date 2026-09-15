// ═════════════════════════════════════════════════════════════════════════════
// Minigame completion signal — Phase 3.
//
// Every minigame page calls fireMinigameDone() right after writing the
// game_scores row, so the Daily Wish system can match wishes like
// "i wanna play some mini games" and "lets play the X O".
//
// MINIGAME_IDS mirrors the GameType union from src/types/index.ts — these
// strings are the canonical, snake-cased ids used everywhere (game_scores
// rows, wish.match grammar 'play:<id>', Memory Wall high-score frames).
// ═════════════════════════════════════════════════════════════════════════════

import type { GameType } from '@/types'

export const MINIGAME_IDS = {
  CATCH_MOUSE:  'catch_mouse',
  PAW_TAP:      'paw_tap',
  MEMORY_MATCH: 'memory_match',
  TREAT_TUMBLE: 'treat_tumble',
  FLAPPY_EREN:  'flappy_eren',
  TIC_TAC_TOE:  'tic_tac_toe',
  EREN_STACK:   'eren_stack',
  YARN_POP:     'yarn_pop',
  EREN_SAYS:    'eren_says',
  LANE_RUNNER:  'lane_runner',
  PAW_DOKU:     'paw_doku',
  YARN_SORT:    'yarn_sort',
  GONE_FISHIN:  'gone_fishin',
  DEFEND_BOWL:  'defend_bowl',
  PURR_BEAT:    'purr_beat',
} as const satisfies Record<string, GameType>

/**
 * The games a player can actually open, and the ONLY list an "all games"
 * unlock may be measured against.
 *
 * MINIGAME_IDS above is deliberately wider: it is the id vocabulary, and
 * retired ids stay in it because `game_scores` rows written before they were
 * pulled are still in the database and the wish grammar still parses
 * `play:<id>`. Four of its entries are not playable — `catch_mouse` and
 * `paw_tap` were removed from the arcade on 2026-06-25, and `gone_fishin` and
 * `defend_bowl` have an id and a coin curve but no route, no catalogue entry
 * and no game.
 *
 * That difference was not cosmetic. Both "play everything" unlocks in the app
 * measured against a hardcoded copy of the old list, so the `rare-all-minigames`
 * memory frame and the `all_games` achievement required two games that cannot
 * be played and ignored two that can. Neither was winnable by ANY account,
 * solo or paired, since June.
 *
 * Keep in step with the GAMES catalogue in app/(app)/games/page.tsx, which is
 * what the arcade actually renders.
 */
export const PLAYABLE_MINIGAME_IDS: GameType[] = [
  MINIGAME_IDS.MEMORY_MATCH,
  MINIGAME_IDS.TREAT_TUMBLE,
  MINIGAME_IDS.FLAPPY_EREN,
  MINIGAME_IDS.TIC_TAC_TOE,
  MINIGAME_IDS.EREN_STACK,
  MINIGAME_IDS.YARN_POP,
  MINIGAME_IDS.EREN_SAYS,
  MINIGAME_IDS.LANE_RUNNER,
  MINIGAME_IDS.PAW_DOKU,
  MINIGAME_IDS.YARN_SORT,
  MINIGAME_IDS.PURR_BEAT,
]

/** Fire-and-forget signal that the user just completed a minigame.
 *  useDailyWish picks this up and grants any matching wish. */
export function fireMinigameDone(id: GameType, score?: number, win?: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('eren:minigame-done', {
      detail: { id, score, win },
    }))
  } catch { /* SSR / unsupported */ }
}
