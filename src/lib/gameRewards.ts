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
// weak score) up to `cap`, hitting the cap at `greatScore`. Coins rise
// monotonically with score: a weak run, a good run and a great run each pay
// CLEARLY more than the last — no flat ceiling where every decent run pays the
// same.
//
// `greatScore` is CALIBRATED TO REAL HOUSEHOLD SCORES (the game_scores table) so
// the curve has resolution in the band actually played: a near-best real run
// earns ~the cap, a typical run earns a fair middle amount. Each comment shows
// how that game's score is built + the observed median/best. For barely-played
// games (gone-fishin, defend-bowl, yarn-sort) greatScore comes from the code's
// realistic ceiling instead, since the few samples are too low to trust.
//
// `cap` is tiered by run effort: quick reflex 30, medium 40, long/endless 45-55.
// Anchored to the wallet (a single gacha pull is 50): a great run ≈ half-to-a
// full pull. Sample payouts are in the commit message / the curve check.
const COIN_CURVE: Record<GameType, { greatScore: number; cap: number }> = {
  // Quick reflex games — cap 30.
  flappy_eren:  { greatScore: 40,    cap: 30 }, // +1/pipe. real median 11, p90 32, best 44 → 11≈10c · 24≈19c · 40+→30c
  paw_tap:      { greatScore: 55,    cap: 30 }, // +1 fish / +3 bonus / combos, 20s. real median 20, best 57
  catch_mouse:  { greatScore: 38,    cap: 30 }, // +1/catch, 30s. real median 31, best 37 (tight & high)
  eren_says:    { greatScore: 15,    cap: 30 }, // +1/round survived. real best 12, ceiling ~20; tiny score band
  // Medium games — cap 40.
  memory_match: { greatScore: 255,   cap: 40 }, // 12/match + combo + time bonus, 60s. real median 166, best 250
  treat_tumble: { greatScore: 340,   cap: 40 }, // item values × combo (x2/x3), 45s. real median 239, best 323
  eren_stack:   { greatScore: 78,    cap: 40 }, // +5 perfect / +1 trim, ends ~22px wide. real best 68-73, ceiling ~78
  yarn_sort:    { greatScore: 16,    cap: 40 }, // +1/level solved; ~22-26 levels possible (real plays stopped at 6)
  // Long / endless games — cap 45-55.
  lane_runner:  { greatScore: 1300,  cap: 45 }, // distance + coins×5, endless. real median 159, p90 1338, best 1564
  yarn_pop:     { greatScore: 4400,  cap: 45 }, // cascades × level, 30 moves (~900 floor). real median ~3000, best 4090
  paw_doku:     { greatScore: 28000, cap: 50 }, // 10/cell + 100×clears×combo + streak bonus. real ~23-24k typical
  gone_fishin:  { greatScore: 300,   cap: 50 }, // sum of fish value, 10 bait (rares refund). strong haul ~300 (epic+rares)
  defend_bowl:  { greatScore: 2200,  cap: 55 }, // waves×100 + kills×3. real best 1573 (~wave 15); ~wave 20 ≈ 2200
  purr_beat:    { greatScore: 60000, cap: 55 }, // hit pts × combo mult (→4×). real ~52k strong, 12k casual
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
