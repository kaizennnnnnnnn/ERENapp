import type { SupabaseClient } from '@supabase/supabase-js'
import { format, subDays, startOfISOWeek, addDays, getISOWeek, getISOWeekYear } from 'date-fns'
import type { Interaction } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════════
// BATTLE RESULTS — daily + weekly scoreboard persistence
//
// Pure compute lives at the top; Supabase I/O at the bottom. Per-user rows so
// each partner only writes their own — RLS-friendly + no payout races.
// ═══════════════════════════════════════════════════════════════════════════════

// Daily battle = unweighted, 1 pt per useful care action — mirrors
// `useDailyBattle.ts`. Actions NOT in this map are ignored entirely.
const DAILY_ACTION_POINTS: Record<string, number> = {
  feed: 1, play: 1, sleep: 1, wash: 1, medicine: 1,
}

// Weekly battle = weighted — mirrors `src/lib/couple.ts`.
const WEEKLY_ACTION_POINTS: Record<string, number> = {
  feed: 3, play: 4, sleep: 2, wash: 3, medicine: 5,
}

export const WEEKLY_PAYOUT_COINS  = 100
export const COMEBACK_BONUS_COINS = 10
/** How far back to backfill missing daily snapshots on first load. */
export const LIFETIME_LOOKBACK_DAYS = 30

export type Outcome = 'win' | 'loss' | 'tie'

export interface DailyBattleRow {
  household_id: string
  user_id: string
  date: string                // yyyy-MM-dd
  score: number
  partner_score: number
  outcome: Outcome
  comeback_claimed: boolean
  created_at?: string
}

export interface WeeklyBattleRow {
  household_id: string
  user_id: string
  iso_week: string            // e.g. "2026-W22"
  score: number
  partner_score: number
  outcome: Outcome
  payout_paid: boolean
  acknowledged: boolean
  created_at?: string
}

export interface ScorePair {
  myScore: number
  partnerScore: number
  outcome: Outcome
}

// ── Pure scoring ────────────────────────────────────────────────────────────

function score(
  interactions: Interaction[],
  myId: string,
  partnerId: string,
  pointMap: Record<string, number>,
): ScorePair {
  let me = 0, them = 0
  for (const i of interactions) {
    if (i.useful === false) continue
    const pts = pointMap[i.action_type]
    if (pts == null) continue
    if (i.user_id === myId) me += pts
    else if (i.user_id === partnerId) them += pts
  }
  return {
    myScore: me,
    partnerScore: them,
    outcome: me > them ? 'win' : them > me ? 'loss' : 'tie',
  }
}

export function scoreDaily(
  interactions: Interaction[],
  myId: string,
  partnerId: string,
): ScorePair {
  return score(interactions, myId, partnerId, DAILY_ACTION_POINTS)
}

export function scoreWeekly(
  interactions: Interaction[],
  myId: string,
  partnerId: string,
): ScorePair {
  return score(interactions, myId, partnerId, WEEKLY_ACTION_POINTS)
}

// ── Date helpers ────────────────────────────────────────────────────────────

export function dateStr(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}

/** yyyy-MM-dd strings for the last N days, excluding today, newest first. */
export function recentDates(n: number, now: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = 1; i <= n; i++) out.push(format(subDays(now, i), 'yyyy-MM-dd'))
  return out
}

export function isoWeekKey(d: Date): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`
}

/** Returns { key, start (Mon 00:00), end (next Mon 00:00) } of last ISO week. */
export function lastIsoWeek(now: Date = new Date()): { key: string; start: Date; end: Date } {
  const ref = subDays(now, 7)
  const start = startOfISOWeek(ref)
  const end = addDays(start, 7)
  return { key: isoWeekKey(ref), start, end }
}

// ── Lifetime aggregation ───────────────────────────────────────────────────

export interface LifetimeWLT {
  myWins: number
  partnerWins: number
  ties: number
  /** Days included in this aggregate. */
  days: number
  /** Consecutive most-recent wins from MY perspective. */
  myStreak: number
  /** Consecutive most-recent losses from MY perspective (= partner streak). */
  partnerStreak: number
}

export function computeLifetimeWLT(rows: DailyBattleRow[]): LifetimeWLT {
  let myWins = 0, partnerWins = 0, ties = 0
  for (const r of rows) {
    if (r.outcome === 'win') myWins++
    else if (r.outcome === 'loss') partnerWins++
    else ties++
  }
  // Streaks: newest-first scan, stop at first non-matching outcome.
  const newestFirst = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  let myStreak = 0
  for (const r of newestFirst) {
    if (r.outcome === 'win') myStreak++
    else break
  }
  let partnerStreak = 0
  for (const r of newestFirst) {
    if (r.outcome === 'loss') partnerStreak++
    else break
  }
  return { myWins, partnerWins, ties, days: rows.length, myStreak, partnerStreak }
}

// ── I/O: backfill missing daily snapshots ──────────────────────────────────

/**
 * Insert daily_battle_results rows for any past day in the lookback window
 * where my row is missing AND there was at least one tracked care action.
 * Safe to call repeatedly — uses ignoreDuplicates so re-runs are no-ops.
 *
 * Both partners can run this concurrently because each writes only their own
 * row (different user_id ⇒ no PK collision between them).
 */
export async function backfillDailyResults(
  supabase: SupabaseClient,
  householdId: string,
  myId: string,
  partnerId: string,
  daysBack: number = LIFETIME_LOOKBACK_DAYS,
): Promise<DailyBattleRow[]> {
  const targetDates = recentDates(daysBack)
  if (targetDates.length === 0) return []

  // Find the dates I already have.
  const oldest = targetDates[targetDates.length - 1]
  const { data: existing } = await supabase
    .from('daily_battle_results')
    .select('date')
    .eq('user_id', myId)
    .gte('date', oldest)
  const have = new Set((existing ?? []).map(r => r.date as string))
  const missing = targetDates.filter(d => !have.has(d))
  if (missing.length === 0) return []

  // Fetch all household interactions in the missing range in one query.
  const earliest = missing[missing.length - 1]
  const latest = missing[0]
  const startIso = new Date(earliest + 'T00:00:00').toISOString()
  const endDate = new Date(latest + 'T00:00:00')
  endDate.setDate(endDate.getDate() + 1)
  const endIso = endDate.toISOString()

  const { data: interactions } = await supabase
    .from('interactions')
    .select('*')
    .eq('household_id', householdId)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
  const all = (interactions ?? []) as Interaction[]

  // Bucket by local-date string so the date semantics match the snapshot key.
  const byDate = new Map<string, Interaction[]>()
  for (const i of all) {
    const d = format(new Date(i.created_at), 'yyyy-MM-dd')
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(i)
  }

  const rowsToInsert: Omit<DailyBattleRow, 'created_at'>[] = []
  for (const date of missing) {
    const ints = byDate.get(date) ?? []
    const sp = scoreDaily(ints, myId, partnerId)
    // Skip dead days — neither user did anything tracked.
    if (sp.myScore === 0 && sp.partnerScore === 0) continue
    rowsToInsert.push({
      household_id: householdId,
      user_id: myId,
      date,
      score: sp.myScore,
      partner_score: sp.partnerScore,
      outcome: sp.outcome,
      comeback_claimed: false,
    })
  }

  if (rowsToInsert.length === 0) return []

  const { data: inserted } = await supabase
    .from('daily_battle_results')
    .upsert(rowsToInsert, {
      onConflict: 'household_id,user_id,date',
      ignoreDuplicates: true,
    })
    .select()

  return (inserted ?? []) as DailyBattleRow[]
}

// ── I/O: fetch lifetime W-L-T rows ─────────────────────────────────────────

export async function fetchLifetimeRows(
  supabase: SupabaseClient,
  myId: string,
  daysBack: number = LIFETIME_LOOKBACK_DAYS,
): Promise<DailyBattleRow[]> {
  const since = format(subDays(new Date(), daysBack), 'yyyy-MM-dd')
  const { data } = await supabase
    .from('daily_battle_results')
    .select('*')
    .eq('user_id', myId)
    .gte('date', since)
    .order('date', { ascending: false })
  return (data ?? []) as DailyBattleRow[]
}

// ── I/O: ensure last week's weekly row exists ──────────────────────────────

/**
 * Returns my weekly_battle_results row for last ISO week, computing + writing
 * it on first call. Returns null if last week had no activity at all.
 */
export async function ensureLastWeekResult(
  supabase: SupabaseClient,
  householdId: string,
  myId: string,
  partnerId: string,
): Promise<WeeklyBattleRow | null> {
  const { key, start, end } = lastIsoWeek()

  // Already exists?
  const { data: existing } = await supabase
    .from('weekly_battle_results')
    .select('*')
    .eq('user_id', myId)
    .eq('iso_week', key)
    .maybeSingle()
  if (existing) return existing as WeeklyBattleRow

  // Compute from last-week interactions.
  const { data: interactions } = await supabase
    .from('interactions')
    .select('*')
    .eq('household_id', householdId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())

  const sp = scoreWeekly((interactions ?? []) as Interaction[], myId, partnerId)
  if (sp.myScore === 0 && sp.partnerScore === 0) return null

  const row: WeeklyBattleRow = {
    household_id: householdId,
    user_id: myId,
    iso_week: key,
    score: sp.myScore,
    partner_score: sp.partnerScore,
    outcome: sp.outcome,
    payout_paid: false,
    acknowledged: false,
  }

  // Insert if missing — if a concurrent call beat us, re-fetch.
  const ins = await supabase
    .from('weekly_battle_results')
    .insert(row)
    .select()
    .maybeSingle()
  if (ins.data) return ins.data as WeeklyBattleRow
  if (ins.error?.code === '23505') {
    const refetch = await supabase
      .from('weekly_battle_results')
      .select('*')
      .eq('user_id', myId)
      .eq('iso_week', key)
      .maybeSingle()
    return (refetch.data as WeeklyBattleRow | null) ?? null
  }
  return row // best-effort fallback for the UI
}

/**
 * Atomically claim the weekly payout. Updates payout_paid=true ONLY when it
 * was false — returns true exactly once for this user/week pair. Caller is
 * responsible for crediting WEEKLY_PAYOUT_COINS coins on success.
 */
export async function claimWeeklyPayout(
  supabase: SupabaseClient,
  myId: string,
  isoWeek: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('weekly_battle_results')
    .update({ payout_paid: true })
    .eq('user_id', myId)
    .eq('iso_week', isoWeek)
    .eq('payout_paid', false)
    .select('user_id')
  return !!data && data.length > 0
}

/** Stamp the popup as seen so it doesn't re-fire on the next page load. */
export async function acknowledgeWeeklyResult(
  supabase: SupabaseClient,
  myId: string,
  isoWeek: string,
): Promise<void> {
  await supabase
    .from('weekly_battle_results')
    .update({ acknowledged: true })
    .eq('user_id', myId)
    .eq('iso_week', isoWeek)
}

// ── Comeback eligibility ───────────────────────────────────────────────────

/**
 * True if I was behind yesterday AND I'm currently ahead today AND
 * the comeback bonus hasn't been claimed yet for yesterday's row.
 */
export function isComebackEligible(
  yesterdayRow: DailyBattleRow | null,
  myTodayScore: number,
  partnerTodayScore: number,
): boolean {
  if (!yesterdayRow) return false
  if (yesterdayRow.outcome !== 'loss') return false
  if (yesterdayRow.comeback_claimed) return false
  return myTodayScore > partnerTodayScore
}

/** Atomically claim the comeback bonus on yesterday's row. */
export async function claimComebackBonus(
  supabase: SupabaseClient,
  myId: string,
  date: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('daily_battle_results')
    .update({ comeback_claimed: true })
    .eq('user_id', myId)
    .eq('date', date)
    .eq('comeback_claimed', false)
    .select('user_id')
  return !!data && data.length > 0
}
