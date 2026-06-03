// ═════════════════════════════════════════════════════════════════════════════
// MEMORY CHECKS — Phase 3 PR 6
//
// Two entry points:
//
//   • checkOnEventUnlocks(supabase, evt)
//       Called inside the app whenever an action fires (care, nudge, minigame,
//       wish-grant, pet, message, mood). Pulls a small counter snapshot, runs
//       every on-event predicate against it, and attempts to unlock each
//       matching frame. tryUnlock's CAS dedupes.
//
//   • runMemorySweep(supabase, householdId, today)
//       Called from /api/decay per household. Owns sweep-only predicates:
//       streaks, calendar dates, couple's 7-day streak, rare aggregate frames.
//       Best-effort — a swallowed failure here just means a frame unlocks on
//       the next decay tick.
//
// Both entry points iterate MEMORY_FRAMES in catalogue order. They skip frames
// that don't belong to their evaluation context (sweep predicates inside the
// on-event entry point and vice versa), so adding a new predicate type means
// touching one switch in this file.
// ═════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import { MEMORY_FRAMES, type ActionType, type Predicate } from './memoryCatalogue'
import { tryUnlock } from './memoryUnlocks'

// ─── Event-context inputs ────────────────────────────────────────────────────

export type UnlockEvent =
  | { type: 'action',   householdId: string, userId: string, actionType: ActionType }
  | { type: 'pet',      householdId: string, userId: string }
  | { type: 'nudge',    householdId: string, userId: string }
  | { type: 'minigame', householdId: string, userId: string }
  | { type: 'wish',     householdId: string, userId: string }
  | { type: 'message',  householdId: string, userId: string }
  | { type: 'mood',     householdId: string, userId: string }

interface OnEventCounters {
  totalCares:    number
  caresByType:   Record<ActionType, number>
  caresByUser:   Record<string, number>
  /** Distinct user_ids who logged at least one interaction today. */
  todayUserIds:  Set<string>
  /** Lifetime nudges sent across the household (couple_journal via_eren). */
  nudgesTotal:   number
  /** Per-sender nudge counts, for couple:nudges_traded_* checks. */
  nudgesBySender: Record<string, number>
  /** Lifetime minigame completions. */
  minigamesTotal: number
  /** Lifetime wishes granted (households.wishes_granted_count). */
  wishesTotal:   number
}

// ─── Counter snapshot ────────────────────────────────────────────────────────

function todayStartISO(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Fetches the ids of every frame already unlocked for this household so the
 *  caller can skip them entirely. Without this pre-filter we POST to
 *  memory_frames for every matching predicate every action — every active
 *  household quickly piles up dozens of 23505 conflicts per care action,
 *  which Supabase's fetch returns as visible 409s in DevTools. The CAS is
 *  still the source of truth; this just keeps the wire quiet. */
async function fetchUnlockedFrameIds(
  supabase: SupabaseClient,
  householdId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('memory_frames')
    .select('frame_id')
    .eq('household_id', householdId)
  const set = new Set<string>()
  for (const row of (data ?? []) as Array<{ frame_id: string }>) set.add(row.frame_id)
  return set
}

async function fetchOnEventCounters(
  supabase: SupabaseClient,
  householdId: string,
): Promise<OnEventCounters> {
  const todayStart = todayStartISO()

  // game_scores has user_id, not household_id — so we need this household's
  // member ids first to filter the score count. Fetch the profile ids before
  // the parallel batch.
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id')
    .eq('household_id', householdId)
  const memberIds = (profileRows ?? []).map(p => (p as { id: string }).id)

  const [interactionsRes, journalRes, gamesRes, householdRes] = await Promise.all([
    supabase.from('interactions')
      .select('user_id, action_type, created_at')
      .eq('household_id', householdId),
    supabase.from('couple_journal')
      .select('sender_id, via_eren')
      .eq('household_id', householdId),
    memberIds.length
      ? supabase.from('game_scores')
          .select('id', { count: 'exact', head: true })
          .in('user_id', memberIds)
      : Promise.resolve({ count: 0 } as { count: number | null }),
    supabase.from('households')
      .select('wishes_granted_count')
      .eq('id', householdId)
      .maybeSingle(),
  ])

  const interactions = (interactionsRes.data ?? []) as Array<{ user_id: string, action_type: string, created_at: string }>
  const journal = (journalRes.data ?? []) as Array<{ sender_id: string, via_eren: boolean }>

  const caresByType: Record<ActionType, number> = { feed: 0, play: 0, sleep: 0, wash: 0, medicine: 0 }
  const caresByUser: Record<string, number> = {}
  const todayUserIds = new Set<string>()
  for (const i of interactions) {
    if (i.action_type in caresByType) caresByType[i.action_type as ActionType]++
    caresByUser[i.user_id] = (caresByUser[i.user_id] ?? 0) + 1
    if (i.created_at >= todayStart) todayUserIds.add(i.user_id)
  }

  const nudgesBySender: Record<string, number> = {}
  let nudgesTotal = 0
  for (const j of journal) {
    if (j.via_eren) {
      nudgesTotal++
      nudgesBySender[j.sender_id] = (nudgesBySender[j.sender_id] ?? 0) + 1
    }
  }

  return {
    totalCares:     interactions.length,
    caresByType,
    caresByUser,
    todayUserIds,
    nudgesTotal,
    nudgesBySender,
    minigamesTotal: gamesRes.count ?? 0,
    wishesTotal:    (householdRes.data?.wishes_granted_count as number | undefined) ?? 0,
  }
}

// ─── Predicate evaluation (on-event) ─────────────────────────────────────────

/** Returns true if this predicate is evaluated by the sweep instead of the
 *  on-event entry point. */
function isSweepPredicate(p: Predicate): boolean {
  return p.type === 'streak' || p.type === 'calendar' || p.type === 'rare'
    || (p.type === 'couple' && (p.kind === 'both_cared_7_streak' || p.kind === 'first_paired'))
}

function matchesOnEvent(
  p: Predicate,
  counters: OnEventCounters,
  evt: UnlockEvent,
): boolean {
  switch (p.type) {
    case 'first': {
      // First-of-its-kind frames fire on the event that introduces the kind.
      // The CAS on memory_frames PK prevents repeat unlocks, so we can be
      // permissive about firing and let the DB enforce uniqueness.
      switch (p.of) {
        case 'feed': case 'play': case 'sleep': case 'wash': case 'medicine':
          return evt.type === 'action' && evt.actionType === p.of
        case 'pet':      return evt.type === 'pet'
        case 'nudge':    return evt.type === 'nudge'
        case 'wish':     return evt.type === 'wish'
        case 'minigame': return evt.type === 'minigame'
        case 'message':  return evt.type === 'message'
        case 'mood':     return evt.type === 'mood'
        case 'day':      return true   // any first event qualifies; CAS dedupes after first unlock
      }
      return false
    }
    case 'cares':
      return counters.totalCares >= p.count
    case 'metric':
      return counters.caresByType[p.metric] >= p.count
    case 'nudges':
      return counters.nudgesTotal >= p.count
    case 'wishes':
      return counters.wishesTotal >= p.count
    case 'minigames':
      return counters.minigamesTotal >= p.count
    case 'couple': {
      if (p.kind === 'both_cared_same_day') return counters.todayUserIds.size >= 2
      if (p.kind === 'nudges_traded_10' || p.kind === 'nudges_traded_50') {
        const target = p.kind === 'nudges_traded_10' ? 10 : 50
        const senders = Object.values(counters.nudgesBySender)
        if (senders.length < 2) return false
        return senders.every(n => n >= target)
      }
      return false
    }
    // Sweep predicates — handled in runMemorySweep, never matched here.
    case 'streak':
    case 'calendar':
    case 'rare':
      return false
  }
}

// ─── Public entry point: on-event ────────────────────────────────────────────

export async function checkOnEventUnlocks(
  supabase: SupabaseClient,
  evt: UnlockEvent,
): Promise<void> {
  let counters: OnEventCounters
  let already: Set<string>
  try {
    [counters, already] = await Promise.all([
      fetchOnEventCounters(supabase, evt.householdId),
      fetchUnlockedFrameIds(supabase, evt.householdId),
    ])
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[memoryChecks] fetchOnEventCounters failed', err)
    }
    return
  }

  for (const frame of MEMORY_FRAMES) {
    if (already.has(frame.id)) continue
    if (isSweepPredicate(frame.predicate)) continue
    if (!matchesOnEvent(frame.predicate, counters, evt)) continue
    await tryUnlock(supabase, {
      householdId: evt.householdId,
      frameId:     frame.id,
      kind:        frame.kind,
      rarity:      frame.rarity,
      unlockedBy:  evt.userId,
    })
  }
}

// ─── Sweep entry point (server-side, from /api/decay) ────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

/** YYYY-MM-DD in UTC. We store created_at in UTC; sweep math uses UTC days too
 *  so cross-tz couples still converge on the same calendar bucket. */
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function utcDayDiff(aIso: string, bIso: string): number {
  const a = new Date(aIso + 'T00:00:00Z').getTime()
  const b = new Date(bIso + 'T00:00:00Z').getTime()
  return Math.round((a - b) / DAY_MS)
}

/** Walks distinct UTC-day timestamps and returns the length of the streak
 *  ending today (or 0 if today has no care). */
function currentStreakLength(daysWithCare: Set<string>, todayKey: string): number {
  if (!daysWithCare.has(todayKey)) return 0
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(todayKey + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - i)
    const key = utcDayKey(d)
    if (daysWithCare.has(key)) streak++
    else break
  }
  return streak
}

interface HouseholdSweepRow {
  id: string
  created_at: string
  eren_birthday: string | null
  couple_anniversary: string | null
}

/** Calendar-frame eligibility for a given household + today. Returns the
 *  set of frame_ids that should unlock if not already present. */
function eligibleCalendarFrames(hh: HouseholdSweepRow, todayKey: string): string[] {
  const ids: string[] = []
  const createdKey = utcDayKey(new Date(hh.created_at))
  const diff = utcDayDiff(todayKey, createdKey)
  if (diff === 7)              ids.push('app-week-1')
  if (diff === 30)             ids.push('app-month-1')
  if (diff === 90)             ids.push('app-month-3')
  if (diff === 180)            ids.push('app-month-6')
  if (diff === 365)            ids.push('app-year-1')

  const mmdd = todayKey.slice(5)
  if (hh.eren_birthday      && hh.eren_birthday.slice(5)      === mmdd) ids.push('eren-birthday')
  if (hh.couple_anniversary && hh.couple_anniversary.slice(5) === mmdd) ids.push('couple-anniversary')
  return ids
}

/** Returns true if days with care covered every UTC day in the last 7 days
 *  (today inclusive). */
function isPerfectWeek(daysWithCare: Set<string>, todayKey: string): boolean {
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayKey + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - i)
    if (!daysWithCare.has(utcDayKey(d))) return false
  }
  return true
}

/** Returns true if every day in the last 7 days saw care from BOTH users. */
function bothCaredEveryDay(byDayUsers: Map<string, Set<string>>, todayKey: string): boolean {
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayKey + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - i)
    const users = byDayUsers.get(utcDayKey(d))
    if (!users || users.size < 2) return false
  }
  return true
}

/** Per-household sweep. Pulls a window of interactions + minigame rows once,
 *  evaluates every sweep predicate, attempts unlocks. */
export async function runMemorySweep(
  supabase: SupabaseClient,
  householdId: string,
  now: Date = new Date(),
): Promise<void> {
  const todayKey = utcDayKey(now)

  // 35-day window covers every active sweep predicate (longest is streak-30).
  // Calendar frames and rare-all-rooms-day only need today; we slice them
  // off this same dataset.
  const windowStart = new Date(now.getTime() - 35 * DAY_MS).toISOString()

  let interactions: Array<{ user_id: string, action_type: string, created_at: string }> = []
  let games: Array<{ game_type: string }> = []
  let household: HouseholdSweepRow | null = null
  let pairedSince: string | null = null

  try {
    // Profiles first so we can scope game_scores to this household's members.
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, created_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })
    const profiles = (profileRows ?? []) as Array<{ id: string, created_at: string }>
    if (profiles.length >= 2) pairedSince = profiles[1].created_at
    const memberIds = profiles.map(p => p.id)

    const [iRes, gRes, hRes] = await Promise.all([
      supabase.from('interactions')
        .select('user_id, action_type, created_at')
        .eq('household_id', householdId)
        .gte('created_at', windowStart),
      memberIds.length
        ? supabase.from('game_scores')
            .select('game_type')
            .in('user_id', memberIds)
        : Promise.resolve({ data: [] as Array<{ game_type: string }> }),
      supabase.from('households')
        .select('id, created_at, eren_birthday, couple_anniversary')
        .eq('id', householdId)
        .maybeSingle(),
    ])
    interactions = (iRes.data ?? []) as typeof interactions
    games        = (gRes.data ?? []) as typeof games
    household    = (hRes.data ?? null) as HouseholdSweepRow | null
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[memoryChecks] sweep fetch failed', householdId, err)
    }
    return
  }

  // Bucket interactions by UTC day and by (day → users) for streak math.
  const daysWithCare = new Set<string>()
  const byDayUsers = new Map<string, Set<string>>()
  const todayActions = new Set<string>()
  for (const row of interactions) {
    const day = row.created_at.slice(0, 10)
    daysWithCare.add(day)
    if (!byDayUsers.has(day)) byDayUsers.set(day, new Set())
    byDayUsers.get(day)!.add(row.user_id)
    if (day === todayKey) todayActions.add(row.action_type)
  }

  const streakLen = currentStreakLength(daysWithCare, todayKey)
  const distinctGames = new Set(games.map(g => g.game_type))
  const calendarIds = household ? eligibleCalendarFrames(household, todayKey) : []
  // Skip frames already unlocked so the sweep doesn't POST 50 conflicts per
  // tick once a household has accumulated history.
  const already = await fetchUnlockedFrameIds(supabase, householdId)

  for (const frame of MEMORY_FRAMES) {
    if (already.has(frame.id)) continue
    let eligible = false
    const p = frame.predicate
    switch (p.type) {
      case 'streak':
        eligible = streakLen >= p.days
        break
      case 'calendar':
        eligible = calendarIds.includes(frame.id)
        break
      case 'couple':
        if (p.kind === 'both_cared_7_streak') eligible = bothCaredEveryDay(byDayUsers, todayKey)
        else if (p.kind === 'first_paired')   eligible = !!pairedSince
        break
      case 'rare':
        if (p.kind === 'perfect_week')      eligible = isPerfectWeek(daysWithCare, todayKey)
        else if (p.kind === 'all_rooms_in_day') {
          eligible = ['feed','play','sleep','wash','medicine'].every(a => todayActions.has(a))
        } else if (p.kind === 'all_minigames') {
          // Compared against the 11 published ids in src/lib/minigames.ts.
          // Authoritative list — keep in sync with MINIGAME_IDS when new
          // games ship. Currently: 11 minigames.
          const known = ['catch_mouse','paw_tap','memory_match','treat_tumble','flappy_eren','tic_tac_toe','eren_stack','yarn_pop','eren_says','lane_runner','paw_doku']
          eligible = known.every(k => distinctGames.has(k))
        }
        // 'all_foods_in_week' isn't implementable until food keys land in the
        // interactions schema; it stays in the catalogue but never unlocks.
        break
      default:
        continue
    }
    if (!eligible) continue
    await tryUnlock(supabase, {
      householdId,
      frameId:    frame.id,
      kind:       frame.kind,
      rarity:     frame.rarity,
      // Sweep unlocks aren't credited to a single partner — the trigger gave
      // the same gift to both of them.
      unlockedBy: null,
    })
  }
}
