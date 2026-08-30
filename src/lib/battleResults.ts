import type { SupabaseClient } from '@supabase/supabase-js'
import { format, subDays, startOfISOWeek, addDays, getISOWeek, getISOWeekYear } from 'date-fns'
import { withRetry } from '@/lib/supabaseRetry'
import type { Interaction } from '@/types'
import {
  twistForDate, scoreActions, isBattleAction,
  type TrophyTier, type TwistId,
} from '@/lib/dailyTwist'

// ═══════════════════════════════════════════════════════════════════════════════
// BATTLE RESULTS — daily + weekly scoreboard persistence
//
// Pure compute lives at the top; Supabase I/O at the bottom. Per-user rows so
// each partner only writes their own — RLS-friendly + no payout races.
// ═══════════════════════════════════════════════════════════════════════════════

// Weekly battle = weighted — mirrors `src/lib/couple.ts`. The DAILY point map
// used to live here too; it is now lib/dailyTwist.ts, because what an action is
// worth changes with the day's twist and three separate copies of that rule
// (here, the live hook, the realtime handler) is exactly how they drifted.
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
  // ── Trophy settlement (migration_trophy_battle.sql). All optional so a row
  // read from a pre-migration schema still decodes.
  /** Which twist was in play. Stored for the history view, not for scoring —
   *  scoring re-derives it from `date` so an old row can never mis-settle. */
  twist_id?: TwistId | null
  trophy_tier?: TrophyTier | null
  /** Trophies actually credited for this day, once settled. */
  trophies_awarded?: number
  /** CAS guard: flipped false→true by claim_daily_trophy, exactly once. */
  trophy_claimed?: boolean
  /** Guards the once-a-day verdict screen, the way `acknowledged` guards the
   *  weekly popup. Separate from trophy_claimed on purpose — the trophies land
   *  whether or not the screen was ever looked at. */
  verdict_seen?: boolean
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

function outcomeOf(me: number, them: number): Outcome {
  return me > them ? 'win' : them > me ? 'loss' : 'tie'
}

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
  return { myScore: me, partnerScore: them, outcome: outcomeOf(me, them) }
}

/**
 * A day's score for both people, under that day's twist.
 *
 * THE single daily scorer. The live hook, the realtime refetch and the nightly
 * backfill all come through here so they cannot disagree — which they used to,
 * in four separate ways (an unknown action was worth 1 live and 0 in the
 * snapshot, and the realtime tick rejected rows the snapshot accepted).
 *
 * Contextual twists care about the order a person did things in, so the rows
 * are sorted by `created_at` before they are split per person.
 *
 * @param dayKey the local 'yyyy-MM-dd' these interactions belong to. The twist
 *   is derived from it rather than passed in, so a caller cannot score
 *   yesterday's rows under today's rule.
 */
export function scoreDaily(
  interactions: Interaction[],
  myId: string,
  partnerId: string,
  dayKey: string,
): ScorePair {
  const twist = twistForDate(dayKey)
  const mine: string[] = []
  const theirs: string[] = []
  const ordered = [...interactions].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const i of ordered) {
    if (i.useful === false) continue
    if (!isBattleAction(i.action_type)) continue
    if (i.user_id === myId) mine.push(i.action_type)
    else if (i.user_id === partnerId) theirs.push(i.action_type)
  }
  const me = scoreActions(twist, mine)
  const them = scoreActions(twist, theirs)
  return { myScore: me, partnerScore: them, outcome: outcomeOf(me, them) }
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

// In-flight dedup for the same multi-mount reason as ensureLastWeekResult.
// The home page mounts 5+ useCouple instances at once and each one would
// otherwise duplicate the interactions fetch + the upsert round-trip.
const backfillInFlight = new Map<string, Promise<DailyBattleRow[]>>()

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
  const key = `${householdId}:${myId}:${daysBack}`
  const existing = backfillInFlight.get(key)
  if (existing) return existing
  const promise = doBackfillDailyResults(supabase, householdId, myId, partnerId, daysBack)
  backfillInFlight.set(key, promise)
  promise.finally(() => {
    if (backfillInFlight.get(key) === promise) backfillInFlight.delete(key)
  })
  return promise
}

async function doBackfillDailyResults(
  supabase: SupabaseClient,
  householdId: string,
  myId: string,
  partnerId: string,
  daysBack: number,
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
    const sp = scoreDaily(ints, myId, partnerId, date)
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
      twist_id: twistForDate(date).id,
    })
  }

  if (rowsToInsert.length === 0) return []

  const upsert = (rows: object[]) => supabase
    .from('daily_battle_results')
    .upsert(rows, {
      onConflict: 'household_id,user_id,date',
      ignoreDuplicates: true,
    })
    .select()

  let { data: inserted, error } = await upsert(rowsToInsert)
  // migration_trophy_battle.sql adds `twist_id`. Until it has been pasted the
  // column is absent and the whole batch 400s, which would take the lifetime
  // W-L-T panel down with it. Strip and retry — same shape as the `useful`
  // fallback in useErenStats.insertInteraction.
  if (error?.message?.toLowerCase().includes('twist_id')) {
    const stripped = rowsToInsert.map(r => {
      const copy: Record<string, unknown> = { ...r }
      delete copy.twist_id
      return copy
    })
    ;({ data: inserted } = await upsert(stripped))
  }

  return (inserted ?? []) as DailyBattleRow[]
}

// ── I/O: fetch lifetime W-L-T rows ─────────────────────────────────────────

export async function fetchLifetimeRows(
  supabase: SupabaseClient,
  myId: string,
  daysBack: number = LIFETIME_LOOKBACK_DAYS,
): Promise<DailyBattleRow[]> {
  const since = format(subDays(new Date(), daysBack), 'yyyy-MM-dd')
  const { data, error } = await withRetry(() => supabase
    .from('daily_battle_results')
    .select('*')
    .eq('user_id', myId)
    .gte('date', since)
    .order('date', { ascending: false }))
  // Deliberate throw on persistent failure: useCouple's try/catch leaves
  // lifetimeWLT null (panel hidden) instead of showing a false 0-0-0.
  if (error) throw new Error(`fetchLifetimeRows failed: ${error.message ?? error.code}`)
  return (data ?? []) as DailyBattleRow[]
}

// ── I/O: ensure last week's weekly row exists ──────────────────────────────

// Module-level in-flight dedup. The home page mounts 5+ `useCouple`
// instances on first load (ThoughtCloud, JealousEren, DailyBattleHUD,
// etc.), and each one calls fetchAll → ensureLastWeekResult. Without
// this, all of them race a SELECT-then-INSERT and N-1 hit the unique
// constraint with a 409. With it, the first call wins and the rest
// await the same promise.
const ensureLastWeekInFlight = new Map<string, Promise<WeeklyBattleRow | null>>()

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
  const { key } = lastIsoWeek()
  const inFlightKey = `${householdId}:${myId}:${key}`
  const existing = ensureLastWeekInFlight.get(inFlightKey)
  if (existing) return existing
  const promise = doEnsureLastWeekResult(supabase, householdId, myId, partnerId)
  ensureLastWeekInFlight.set(inFlightKey, promise)
  // Clear the latch when the work settles so a later refetch (e.g. on
  // window focus after midnight) can compute again.
  promise.finally(() => {
    if (ensureLastWeekInFlight.get(inFlightKey) === promise) {
      ensureLastWeekInFlight.delete(inFlightKey)
    }
  })
  return promise
}

async function doEnsureLastWeekResult(
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

  // Upsert with ignoreDuplicates — silently no-ops on a race instead of
  // returning 409, matching the daily-snapshot pattern. If the insert
  // happened we get the row back; if it was deduped, fall through to a
  // refetch so we still return the winning instance's data.
  const { data: inserted } = await supabase
    .from('weekly_battle_results')
    .upsert([row], {
      onConflict: 'household_id,user_id,iso_week',
      ignoreDuplicates: true,
    })
    .select()
  if (inserted && inserted.length > 0) return inserted[0] as WeeklyBattleRow

  // Conflict path: the row was just inserted by a sibling. Re-fetch it.
  const refetch = await supabase
    .from('weekly_battle_results')
    .select('*')
    .eq('user_id', myId)
    .eq('iso_week', key)
    .maybeSingle()
  return (refetch.data as WeeklyBattleRow | null) ?? row
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

// ── Trophy settlement ──────────────────────────────────────────────────────
//
// A finished day pays a trophy, not coins. The row that the backfill writes IS
// the "this day is over, here is the result" event, so settlement hangs off it:
//   fetchDailyRow(yesterday) → claimDailyTrophy(yesterday) → verdict screen
//
// The client never says how many trophies it earned. `claim_daily_trophy`
// derives the tier from the scores already stored on the row, adds the streak
// bonus from the rows before it, credits `profiles.trophies`, and CASes
// `trophy_claimed` false→true so a second call pays nothing. Same division of
// labour as purchase_skin_with_stardust, where the price is server-side.

export interface TrophySettlement {
  ok: boolean
  /** Why nothing was paid: 'already_claimed' | 'no_row' | 'unauthenticated'. */
  reason?: string
  tier: TrophyTier | null
  /** Trophies credited by THIS call. 0 on a repeat. */
  trophies: number
  /** Consecutive wins ending on this date, from my side. */
  streak: number
  /** My new balance after the credit. */
  balance: number
}

/**
 * Settle one finished day. Safe to call repeatedly and from both tabs — only
 * the first call credits anything.
 */
export async function claimDailyTrophy(
  supabase: SupabaseClient,
  date: string,
): Promise<TrophySettlement> {
  const { data, error } = await supabase.rpc('claim_daily_trophy', { p_date: date })
  if (error || !data) {
    return { ok: false, reason: error?.message ?? 'rpc_failed', tier: null, trophies: 0, streak: 0, balance: 0 }
  }
  const r = data as Record<string, unknown>
  return {
    ok: r.ok === true,
    reason: typeof r.reason === 'string' ? r.reason : undefined,
    tier: (r.tier as TrophyTier | null) ?? null,
    trophies: Number(r.trophies ?? 0),
    streak: Number(r.streak ?? 0),
    balance: Number(r.balance ?? 0),
  }
}

/** My snapshot row for one date, or null when the day was never settled. */
export async function fetchDailyRow(
  supabase: SupabaseClient,
  myId: string,
  date: string,
): Promise<DailyBattleRow | null> {
  const { data } = await supabase
    .from('daily_battle_results')
    .select('*')
    .eq('user_id', myId)
    .eq('date', date)
    .maybeSingle()
  return (data as DailyBattleRow | null) ?? null
}

/**
 * Stamp the verdict screen as shown so it doesn't reappear on another device.
 * Best-effort: the local one-shot key is what actually keeps it from flashing
 * twice in one session, this is only the cross-device half.
 */
export async function markVerdictSeen(
  supabase: SupabaseClient,
  myId: string,
  date: string,
): Promise<void> {
  await supabase
    .from('daily_battle_results')
    .update({ verdict_seen: true })
    .eq('user_id', myId)
    .eq('date', date)
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
