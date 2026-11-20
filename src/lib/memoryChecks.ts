// ═════════════════════════════════════════════════════════════════════════════
// MEMORY CHECKS — Phase 3 PR 6
//
// Two entry points:
//
//   • createMemoryEventCheck(supabase, householdId, userId)
//       Called inside the app whenever an action fires (care, nudge, minigame,
//       wish-grant, pet, message, mood). Reads only the counters relevant to
//       that batch of events. tryUnlock's CAS dedupes matching unlocks.
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
import { createMemoryCounterReader, memoryRead, type MemoryCounter } from './memoryCounters'
import { PLAYABLE_MINIGAME_IDS } from '@/lib/minigames'

// ─── Event-context inputs ────────────────────────────────────────────────────

export type UnlockEvent =
  | { type: 'action', actionType: ActionType }
  | { type: 'wish', by?: string }
  | { type: 'pet' | 'nudge' | 'delivery' | 'minigame' | 'message' | 'mood' }

const FRAME_REFRESH_MS = 60_000

async function fetchUnlockedFrameIds(
  supabase: SupabaseClient,
  householdId: string,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const query = () => supabase.from('memory_frames').select('frame_id').eq('household_id', householdId)
  const { data, error } = signal ? await memoryRead(signal, s => query().abortSignal(s)) : await query()
  if (error) throw new Error('Could not read unlocked memories')
  return new Set((data ?? []).map(row => row.frame_id as string))
}

function relevantCounter(p: Predicate, events: UnlockEvent[]): MemoryCounter | null {
  const has = (type: UnlockEvent['type']) => events.some(event => event.type === type)
  switch (p.type) {
    case 'cares': return has('action') ? 'cares' : null
    case 'metric': return events.some(e => e.type === 'action' && e.actionType === p.metric) ? p.metric : null
    case 'wishes': return has('wish') ? 'wishes' : null
    case 'minigames': return has('minigame') ? 'games' : null
    case 'nudges': return has('nudge') || has('delivery') ? 'nudges' : null
    case 'couple':
      if (p.kind === 'both_cared_same_day') return has('action') ? 'both-care' : null
      if (p.kind === 'nudges_traded_10' || p.kind === 'nudges_traded_50') {
        return has('nudge') || has('delivery') ? 'traded' : null
      }
  }
  return null
}

function threshold(p: Predicate): number {
  if ('count' in p) return p.count
  if (p.type === 'couple') {
    if (p.kind === 'both_cared_same_day') return 2
    if (p.kind === 'nudges_traded_10') return 10
    if (p.kind === 'nudges_traded_50') return 50
  }
  return Infinity
}

export function createMemoryEventCheck(supabase: SupabaseClient, householdId: string, userId: string) {
  const counters = createMemoryCounterReader(supabase, householdId)
  let unlocked = new Set<string>()
  let refreshedAt = -Infinity

  return async (events: UnlockEvent[], signal: AbortSignal): Promise<void> => {
    const candidates = MEMORY_FRAMES.flatMap<{ frame: typeof MEMORY_FRAMES[number]; key: MemoryCounter | null; by: string }>(frame => {
      if (unlocked.has(frame.id)) return []
      const p = frame.predicate
      if (p.type === 'first') {
        const event = events.find(e => (p.of === 'day' && e.type !== 'delivery') || p.of === (e.type === 'action' ? e.actionType : e.type))
        return event ? [{ frame, key: null, by: event.type === 'wish' ? event.by ?? userId : userId }] : []
      }
      const key = relevantCounter(p, events)
      const wish = key === 'wishes' ? events.find(e => e.type === 'wish') : undefined
      return key ? [{ frame, key, by: wish?.type === 'wish' ? wish.by ?? userId : userId }] : []
    })
    if (!candidates.length) return
    if (Date.now() - refreshedAt >= FRAME_REFRESH_MS) {
      unlocked = await fetchUnlockedFrameIds(supabase, householdId, signal)
      refreshedAt = Date.now()
    }

    const remaining = candidates.filter(({ frame }) => !unlocked.has(frame.id))
    const unlock = async (frame: typeof MEMORY_FRAMES[number], by: string) => {
      await memoryRead(signal, s => tryUnlock(supabase, {
        householdId, frameId: frame.id, kind: frame.kind, rarity: frame.rarity, unlockedBy: by,
      }, s))
      unlocked.add(frame.id)
    }
    // Firsts are supported by the saved event itself, even if a counter read fails.
    for (const { frame, key, by } of remaining) if (!key) await unlock(frame, by)
    const keys = Array.from(new Set(remaining.flatMap(({ key }) => key ? [key] : [])))
    const counts = await counters(keys, signal)
    for (const { frame, key, by } of remaining) {
      if (key && (counts[key] ?? 0) >= threshold(frame.predicate)) await unlock(frame, by)
    }
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
  let already = new Set<string>()

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

    const [iRes, hRes, alreadySet] = await Promise.all([
      supabase.from('interactions')
        .select('user_id, action_type, created_at')
        .eq('household_id', householdId)
        .gte('created_at', windowStart),
      supabase.from('households')
        .select('id, created_at, eren_birthday, couple_anniversary')
        .eq('id', householdId)
        .maybeSingle(),
      fetchUnlockedFrameIds(supabase, householdId),
    ])
    interactions = (iRes.data ?? []) as typeof interactions
    household    = (hRes.data ?? null) as HouseholdSweepRow | null
    already      = alreadySet

    // game_scores feeds ONLY the rare-all-minigames check; once that frame is
    // unlocked the loop skips it, so don't pay the unbounded scan.
    if (memberIds.length && !already.has('rare-all-minigames')) {
      const gRes = await supabase.from('game_scores')
        .select('game_type')
        .in('user_id', memberIds)
      games = (gRes.data ?? []) as typeof games
    }
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
          // Read from PLAYABLE_MINIGAME_IDS, never a copy. The copy that used
          // to live here still named catch_mouse and paw_tap, pulled from the
          // arcade in June, and had never gained yarn_sort or purr_beat — so
          // this frame required two games nobody can open and was unwinnable
          // for every account in the app.
          eligible = PLAYABLE_MINIGAME_IDS.every(k => distinctGames.has(k))
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
