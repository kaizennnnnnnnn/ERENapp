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
} as const satisfies Record<string, GameType>

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
