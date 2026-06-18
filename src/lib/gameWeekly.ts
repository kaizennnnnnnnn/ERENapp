import type { SupabaseClient } from '@supabase/supabase-js'
import { startOfISOWeek, addDays } from 'date-fns'
import { isoWeekKey, lastIsoWeek } from '@/lib/battleResults'
import { countGamesWon, weeklyPayoutFor, type Outcome } from '@/lib/gameRewards'
import type { GameType } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════
// GAME WEEKLY — the minigame weekly competition (mirrors battleResults.ts).
//
// The metric is GAMES WON, not summed score: for each game type, whoever has
// the higher best score that ISO week wins that game; the champion is whoever
// won more individual games. Settled per-user, client-side on load (no cron) —
// each partner only ever writes their own weekly_game_results row.
// ═══════════════════════════════════════════════════════════════════════════

export interface WeeklyGameRow {
  household_id: string
  user_id: string
  iso_week: string             // e.g. "2026-W22"
  games_won: number
  partner_games_won: number
  outcome: Outcome
  payout_coins: number         // coins this user is owed for the week
  payout_paid: boolean
  acknowledged: boolean
  created_at?: string
}

export type PerGameBest = Partial<Record<GameType, number>>

export interface WeeklyStandings {
  myBest: PerGameBest
  partnerBest: PerGameBest
  myWins: number
  partnerWins: number
  outcome: Outcome
  /** Next Monday 00:00 (local) — when this week's board resets. */
  resetAt: Date
}

/** { key, start (Mon 00:00), end (next Mon 00:00) } of the CURRENT ISO week. */
export function thisIsoWeek(now: Date = new Date()): { key: string; start: Date; end: Date } {
  const start = startOfISOWeek(now)
  const end = addDays(start, 7)
  return { key: isoWeekKey(now), start, end }
}

// ── Pure: best score per (user, game) from a flat score list ────────────────

function bestsFromRows(
  rows: Array<{ user_id: string; game_type: GameType; score: number }>,
  userIds: string[],
): Record<string, PerGameBest> {
  const bests: Record<string, PerGameBest> = {}
  for (const id of userIds) bests[id] = {}
  for (const r of rows) {
    const bucket = bests[r.user_id]
    if (!bucket) continue
    if (r.score > (bucket[r.game_type] ?? 0)) bucket[r.game_type] = r.score
  }
  return bests
}

async function fetchWeekBests(
  supabase: SupabaseClient,
  userIds: string[],
  start: Date,
  end: Date,
): Promise<Record<string, PerGameBest>> {
  const { data } = await supabase
    .from('game_scores')
    .select('user_id, game_type, score')
    .in('user_id', userIds)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
  return bestsFromRows((data ?? []) as Array<{ user_id: string; game_type: GameType; score: number }>, userIds)
}

// ── Live this-week standings (for the leaderboard) ──────────────────────────

export async function weeklyStandings(
  supabase: SupabaseClient,
  myId: string,
  partnerId: string | null,
): Promise<WeeklyStandings> {
  const { start, end } = thisIsoWeek()
  const ids = partnerId ? [myId, partnerId] : [myId]
  const bests = await fetchWeekBests(supabase, ids, start, end)
  const myBest = bests[myId] ?? {}
  const partnerBest = partnerId ? bests[partnerId] ?? {} : {}
  const { myWins, partnerWins, outcome } = countGamesWon(myBest, partnerBest)
  return { myBest, partnerBest, myWins, partnerWins, outcome, resetAt: end }
}

// ── Settle last week (idempotent, dedup'd) ──────────────────────────────────

const ensureInFlight = new Map<string, Promise<WeeklyGameRow | null>>()

/**
 * Returns my weekly_game_results row for LAST ISO week, computing + writing it
 * on first call. Returns null if nobody in the household played last week.
 */
export async function ensureLastWeekGameResult(
  supabase: SupabaseClient,
  householdId: string,
  myId: string,
  partnerId: string,
): Promise<WeeklyGameRow | null> {
  const { key } = lastIsoWeek()
  const inFlightKey = `${householdId}:${myId}:${key}`
  const existing = ensureInFlight.get(inFlightKey)
  if (existing) return existing
  const promise = doEnsureLastWeekGameResult(supabase, householdId, myId, partnerId)
  ensureInFlight.set(inFlightKey, promise)
  promise.finally(() => {
    if (ensureInFlight.get(inFlightKey) === promise) ensureInFlight.delete(inFlightKey)
  })
  return promise
}

async function doEnsureLastWeekGameResult(
  supabase: SupabaseClient,
  householdId: string,
  myId: string,
  partnerId: string,
): Promise<WeeklyGameRow | null> {
  const { key, start, end } = lastIsoWeek()

  const { data: existing } = await supabase
    .from('weekly_game_results')
    .select('*')
    .eq('user_id', myId)
    .eq('iso_week', key)
    .maybeSingle()
  if (existing) return existing as WeeklyGameRow

  const bests = await fetchWeekBests(supabase, [myId, partnerId], start, end)
  const myBest = bests[myId] ?? {}
  const partnerBest = bests[partnerId] ?? {}

  // Nobody played last week — no competition, no settlement.
  const iPlayed = Object.keys(myBest).length > 0
  const partnerPlayed = Object.keys(partnerBest).length > 0
  if (!iPlayed && !partnerPlayed) return null

  const { myWins, partnerWins, outcome } = countGamesWon(myBest, partnerBest)
  const row: WeeklyGameRow = {
    household_id: householdId,
    user_id: myId,
    iso_week: key,
    games_won: myWins,
    partner_games_won: partnerWins,
    outcome,
    payout_coins: weeklyPayoutFor(outcome, iPlayed),
    payout_paid: false,
    acknowledged: false,
  }

  // ignoreDuplicates: silently no-op on a race instead of a 409, matching the
  // Care Battle pattern; fall through to a refetch if our insert was deduped.
  const { data: inserted } = await supabase
    .from('weekly_game_results')
    .upsert([row], { onConflict: 'household_id,user_id,iso_week', ignoreDuplicates: true })
    .select()
  if (inserted && inserted.length > 0) return inserted[0] as WeeklyGameRow

  const refetch = await supabase
    .from('weekly_game_results')
    .select('*')
    .eq('user_id', myId)
    .eq('iso_week', key)
    .maybeSingle()
  return (refetch.data as WeeklyGameRow | null) ?? row
}

/**
 * Atomically claim this user's weekly payout. CAS on payout_paid (false→true);
 * returns the coins to credit (the row's payout_coins) exactly once, else 0.
 */
export async function claimWeeklyGamePayout(
  supabase: SupabaseClient,
  myId: string,
  isoWeek: string,
): Promise<number> {
  const { data } = await supabase
    .from('weekly_game_results')
    .update({ payout_paid: true })
    .eq('user_id', myId)
    .eq('iso_week', isoWeek)
    .eq('payout_paid', false)
    .select('payout_coins')
  if (data && data.length > 0) return (data[0].payout_coins as number) ?? 0
  return 0
}

/** Stamp the champion popup as seen so it doesn't re-fire next load. */
export async function acknowledgeWeeklyGameResult(
  supabase: SupabaseClient,
  myId: string,
  isoWeek: string,
): Promise<void> {
  await supabase
    .from('weekly_game_results')
    .update({ acknowledged: true })
    .eq('user_id', myId)
    .eq('iso_week', isoWeek)
}
