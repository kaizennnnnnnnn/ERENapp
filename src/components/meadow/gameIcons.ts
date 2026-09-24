// Each playable game's Meadow icon and the tint of its icon tile, from the
// Arcade board (A5). Keyed by the canonical GameType ids (lib/minigames.ts
// PLAYABLE_MINIGAME_IDS), so the arcade grid, the wish card and the Me page's
// achievements all draw a game the same way.

import type { MeadowIconName } from '@/components/PixelIcons'
import type { GameType } from '@/types'
import { TINT } from './tokens'

type Playable =
  | 'memory_match' | 'treat_tumble' | 'flappy_eren' | 'tic_tac_toe' | 'eren_stack' | 'yarn_pop'
  | 'eren_says' | 'lane_runner' | 'paw_doku' | 'yarn_sort' | 'purr_beat'

export const GAME_ICON: Record<Playable, MeadowIconName> & Partial<Record<GameType, MeadowIconName>> = {
  memory_match: 'memoryMatch',
  treat_tumble: 'treatTumble',
  flappy_eren: 'flappyEren',
  tic_tac_toe: 'ticTacToe',
  eren_stack: 'erenStack',
  yarn_pop: 'yarnPop',
  eren_says: 'erenSays',
  lane_runner: 'laneRunner',
  paw_doku: 'pawDoku',
  yarn_sort: 'yarnSort',
  purr_beat: 'purrBeat',
}

export const GAME_TINT: Record<Playable, string> & Partial<Record<GameType, string>> = {
  memory_match: TINT.love,
  treat_tumble: TINT.amber,
  flappy_eren: TINT.blue,
  tic_tac_toe: TINT.soft,
  eren_stack: TINT.leaf,
  yarn_pop: TINT.love,
  eren_says: TINT.soft,
  lane_runner: TINT.orange,
  paw_doku: TINT.lilac,
  yarn_sort: TINT.soft,
  purr_beat: TINT.lilac,
}
