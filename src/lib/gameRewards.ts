// ═══════════════════════════════════════════════════════════════════════════
// GAME REWARDS — pure coin economy for the arcade.
//
// One source of truth for: how many coins a finished run is worth, the
// "exhausted" energy gate, and the weekly games-won competition scoring.
// Kept dependency-light (types only) so it's trivially testable and reusable
// by both useGameRewards (per-run payout) and gameWeekly (weekly settlement).
//
// Design notes:
//   * Every COMPLETED run pays at least PARTICIPATION_COINS so a loss/crash is
//     never "played for nothing" — you always see a positive coin reward.
//   * On top of that, a per-game score bonus rewards skill, capped per game so
//     the wildly different score scales (tic-tac-toe streak vs paw-doku 1000s)
//     can't unbalance the shared wallet.
//   * Coins are gated on Eren's energy (see EXHAUSTED_ENERGY): a tired cat
//     can't cheer. High scores still save regardless — the gate is coins-only.
// ═══════════════════════════════════════════════════════════════════════════

import type { GameType } from '@/types'
import { MINIGAME_IDS } from '@/lib/minigames'

/** Block coin payouts while Eren's energy is below this (0–100). Resumes at ≥30. */
export const EXHAUSTED_ENERGY = 30

/** Floor paid for finishing any run, before the score bonus. */
export const PARTICIPATION_COINS = 3

// Per-game score → bonus coins (added on top of PARTICIPATION_COINS), then
// clamped to the per-game cap. Mirrors each game's previously-tuned formula.
const SCORE_BONUS: Record<GameType, (score: number) => number> = {
  catch_mouse:  s => Math.floor(s / 2),
  paw_tap:      s => s,
  memory_match: s => Math.floor(s / 8),
  treat_tumble: s => Math.floor(s / 5),
  flappy_eren:  s => s * 2,
  tic_tac_toe:  () => 0, // win/loss handled in coinsForGame via the `won` flag
  eren_stack:   s => s,
  yarn_pop:     s => Math.floor(s / 25),
  eren_says:    s => s * 2,
  lane_runner:  s => Math.floor(s / 8),
  paw_doku:     s => Math.floor(s / 60),
}

const COIN_CAP: Record<GameType, number> = {
  catch_mouse: 30, paw_tap: 50, memory_match: 30, treat_tumble: 40,
  flappy_eren: 50, tic_tac_toe: 8,  eren_stack: 60, yarn_pop: 60,
  eren_says: 40,  lane_runner: 60, paw_doku: 80,
}

/**
 * Coins for one finished run, BEFORE the energy gate. Always ≥ PARTICIPATION_COINS
 * for a completed run so the player never walks away with nothing.
 * Tic-tac-toe is win/loss based (no continuous score): a win pays the cap,
 * a loss/draw pays the participation floor.
 */
export function coinsForGame(gameType: GameType, score: number, won?: boolean): number {
  if (gameType === 'tic_tac_toe') {
    return won ? COIN_CAP.tic_tac_toe : PARTICIPATION_COINS
  }
  const bonus = Math.max(0, SCORE_BONUS[gameType](Math.max(0, score)))
  return Math.min(COIN_CAP[gameType], PARTICIPATION_COINS + bonus)
}

// ── Weekly competition ──────────────────────────────────────────────────────

export type Outcome = 'win' | 'loss' | 'tie'

/** All 11 canonical game ids (derived from MINIGAME_IDS to avoid drift). */
export const ALL_GAME_TYPES: GameType[] = Object.values(MINIGAME_IDS)

export const WEEKLY_CHAMPION_COINS = 100 // most games won that week
export const WEEKLY_TIE_COINS      = 100 // equal games won — both get the prize
export const WEEKLY_LOSER_COINS    = 25  // fewer games won, but still showed up

/** Coins owed to a user for the week given their outcome + whether they played. */
export function weeklyPayoutFor(outcome: Outcome, played: boolean): number {
  if (outcome === 'win') return WEEKLY_CHAMPION_COINS
  if (outcome === 'tie') return WEEKLY_TIE_COINS
  return played ? WEEKLY_LOSER_COINS : 0
}

/**
 * The headline metric: who got the higher score in MORE individual games.
 * For each game type, whoever's weekly-best is strictly higher wins that game;
 * the champion is whoever won more games (NOT the sum of raw scores).
 */
export function countGamesWon(
  myBest: Partial<Record<GameType, number>>,
  partnerBest: Partial<Record<GameType, number>>,
): { myWins: number; partnerWins: number; outcome: Outcome } {
  let myWins = 0
  let partnerWins = 0
  for (const g of ALL_GAME_TYPES) {
    const mine = myBest[g] ?? 0
    const theirs = partnerBest[g] ?? 0
    if (mine > theirs) myWins++
    else if (theirs > mine) partnerWins++
  }
  return {
    myWins,
    partnerWins,
    outcome: myWins > partnerWins ? 'win' : partnerWins > myWins ? 'loss' : 'tie',
  }
}
