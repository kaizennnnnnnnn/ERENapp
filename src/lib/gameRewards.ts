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
//   * On top of that, coins ramp LINEARLY with the run's score up to a per-game
//     cap — good play clearly beats a weak run, a great run clearly beats a good
//     one. The cap is tiered by effort and reachable only by excellent play, so
//     the wildly different score scales (eren-says' 5-18 vs purr-beat's 80k)
//     stay balanced against the shared wallet (a single gacha pull is 50 coins).
//   * Coins are gated on Eren's energy (see EXHAUSTED_ENERGY): a tired cat
//     can't cheer. High scores still save regardless — the gate is coins-only.
// ═══════════════════════════════════════════════════════════════════════════

import type { GameType } from '@/types'
import { MINIGAME_IDS } from '@/lib/minigames'

/** Block coin payouts while Eren's energy is below this (0–100). Resumes at ≥30. */
export const EXHAUSTED_ENERGY = 30

/** Floor paid for finishing ANY run regardless of score — a loss/crash is never
 *  "played for nothing". Also the tic-tac-toe loss/draw payout. */
export const PARTICIPATION_COINS = 3

/** Coins for beating Eren at tic-tac-toe (a loss/draw pays the floor). */
const TTT_WIN_COINS = 20

// Per-game coin curve. A finished run ramps LINEARLY from PARTICIPATION_COINS (a
// weak score) up to `cap`, hitting the cap at `greatScore` — set to each game's
// realistic human ceiling, so the cap is reachable but only by excellent play.
// Coins rise monotonically with score: a good run clearly beats a weak one and a
// great run clearly beats a good one (no more flat 15 ceiling for everyone).
//
// `cap` is tiered by how much one run costs you: quick reflex games ~30, medium
// games 40-45, long/hard games 50-55. Anchored to the wallet (a single gacha
// pull is 50 coins): a great run is worth ~half a pull, a near-perfect run ~a
// full pull. `greatScore` values come from a per-game analysis of how each
// game's score is built (time limits, point values, combos, level counts).
const COIN_CURVE: Record<GameType, { greatScore: number; cap: number }> = {
  // Quick reflex games — cap 30.
  catch_mouse:  { greatScore: 36,    cap: 30 }, // +1/catch in ~30s
  paw_tap:      { greatScore: 85,    cap: 30 }, // taps with combo/danger in ~20s
  flappy_eren:  { greatScore: 55,    cap: 30 }, // +1/pipe; 100 is aspirational
  eren_says:    { greatScore: 17,    cap: 30 }, // +1/round; tiny 5-18 band, every point is real recall
  // Medium games — cap 40-45.
  memory_match: { greatScore: 220,   cap: 40 }, // combos + all-or-nothing time bonus
  treat_tumble: { greatScore: 380,   cap: 40 }, // catcher with combo multipliers, ~45s
  eren_stack:   { greatScore: 170,   cap: 40 }, // +5 perfect / +1 trim; perfect-chaining for the cap
  yarn_sort:    { greatScore: 26,    cap: 40 }, // +1/level solved, ~26 levels is near-optimal
  lane_runner:  { greatScore: 1400,  cap: 45 }, // endless; distance+pickups, 5-7min flawless = cap
  yarn_pop:     { greatScore: 6500,  cap: 45 }, // match-3, 30-move budget (has a ~900 score floor)
  // Long / hard games — cap 50-55.
  paw_doku:     { greatScore: 8500,  cap: 50 }, // block-blast; uncapped compounding combos/streaks
  gone_fishin:  { greatScore: 800,   cap: 55 }, // bait-budget fishing; rare/legendary catches spike the top
  defend_bowl:  { greatScore: 4200,  cap: 55 }, // endless TD; ~wave 20 is the practical human ceiling
  purr_beat:    { greatScore: 75000, cap: 55 }, // rhythm; combo-multiplier driven, wide dynamic range
  // Win/loss only — the ramp is bypassed in coinsForGame (see TTT_WIN_COINS).
  tic_tac_toe:  { greatScore: 1,     cap: TTT_WIN_COINS },
}

/**
 * Coins for one finished run, BEFORE the energy gate. Always ≥ PARTICIPATION_COINS
 * for a completed run so the player never walks away with nothing, scaling up to
 * the game's `cap` as the score approaches `greatScore`. Tic-tac-toe is win/loss
 * based (no continuous score): a win pays TTT_WIN_COINS, a loss/draw pays the floor.
 */
export function coinsForGame(gameType: GameType, score: number, won?: boolean): number {
  if (gameType === 'tic_tac_toe') {
    return won ? TTT_WIN_COINS : PARTICIPATION_COINS
  }
  const { greatScore, cap } = COIN_CURVE[gameType]
  const t = Math.min(1, Math.max(0, score / greatScore)) // 0 = weak, 1 = great-or-better
  return Math.min(cap, Math.max(PARTICIPATION_COINS, PARTICIPATION_COINS + Math.round(t * (cap - PARTICIPATION_COINS))))
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
