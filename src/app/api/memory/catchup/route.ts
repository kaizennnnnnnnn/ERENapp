// ═════════════════════════════════════════════════════════════════════════════
// /api/memory/catchup — Phase 3 PR 8
//
// One-shot per profile: walks the household's history (interactions, journal,
// game scores, granted wishes, profiles, households) and figures out the
// historical moment each catalogue frame first crossed its threshold. Then
// either inserts the frame with that historical unlocked_at, or updates an
// existing memory_frames row backwards in time when it was previously stamped
// "now" by the on-event check.
//
// memory_caught_up flips client-side after the CatchupCarousel is dismissed,
// not here — so a user who triggers catchup but closes the app before reading
// the carousel still sees it next session. catchup_pushed_at gets stamped so
// the partner-notify push (PR 9) doesn't re-fire.
// ═════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  MEMORY_FRAMES, type ActionType, type MemoryFrame, type Predicate,
} from '@/lib/memoryCatalogue'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CatchupRequest {
  user_id:      string
  household_id: string
}

interface BackfillEntry {
  historical_at: string
  unlocked_by:   string | null
  payload:       Record<string, unknown>
}

interface InteractionRow { user_id: string, action_type: string, created_at: string }
interface JournalRow     { sender_id: string, via_eren: boolean, created_at: string }
interface GameRow        { user_id: string, game_type: string, created_at: string }
interface WishRow        { wish_id: string, granted_at: string, granted_by: string | null }
interface ProfileRow     { id: string, created_at: string }
interface HouseholdRow   {
  created_at: string
  eren_birthday: string | null
  couple_anniversary: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000
function utcDayKey(iso: string): string { return iso.slice(0, 10) }
function utcDayDiff(a: string, b: string): number {
  return Math.round((new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime()) / DAY_MS)
}
function addDaysISO(dayKey: string, days: number): string {
  const d = new Date(dayKey + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10) + 'T12:00:00Z'
}

/** Most recent past occurrence of an anniversary, evaluated as of today and
 *  clamped to never predate `floorDay`. Returns null when the date hasn't
 *  reached its first occurrence yet, or if the anniversary has never been
 *  inside the household's lifetime.
 *
 *  Feb 29 anchors that land in non-leap years are snapped back to Feb 28 so
 *  Postgres doesn't get an invalid date and JS doesn't roll forward to Mar 1.
 */
function mostRecentPastAnniversary(
  anchorDate: string,
  todayKey: string,
  floorDay: string,
): string | null {
  const mm = anchorDate.slice(5, 7)
  let dd = anchorDate.slice(8, 10)
  const todayMmdd = todayKey.slice(5)
  const yearNow = Number(todayKey.slice(0, 4))
  const anchorYear = Number(anchorDate.slice(0, 4))
  const floorYear = Number(floorDay.slice(0, 4))
  let useYear = yearNow
  if (todayMmdd < `${mm}-${dd}`) useYear -= 1
  const minYear = Math.max(anchorYear, floorYear)
  if (useYear < minYear) return null
  // Feb 29 → Feb 28 in non-leap years.
  if (mm === '02' && dd === '29') {
    const isLeap = (useYear % 4 === 0 && useYear % 100 !== 0) || useYear % 400 === 0
    if (!isLeap) dd = '28'
  }
  const candidate = `${String(useYear).padStart(4, '0')}-${mm}-${dd}T12:00:00Z`
  // Final floor check at full-timestamp granularity (handles same-day boundary).
  if (candidate.slice(0, 10) < floorDay) return null
  return candidate
}

// ─── Backfill engine ─────────────────────────────────────────────────────────

interface Inputs {
  interactions: InteractionRow[]
  journal:      JournalRow[]
  games:        GameRow[]
  wishes:       WishRow[]
  profiles:     ProfileRow[]
  household:    HouseholdRow | null
  /** Earliest daily_moods row across the household, used for first:mood. Null
   *  when no member has ever logged a mood — the frame just stays empty until
   *  someone does. */
  earliestMood: { user_id: string, at: string } | null
  todayKey:     string
}

function computeBackfill(inputs: Inputs): Map<string, BackfillEntry> {
  const out = new Map<string, BackfillEntry>()
  const record = (frameId: string, at: string, by: string | null, payload: Record<string, unknown> = {}) => {
    if (out.has(frameId)) return
    out.set(frameId, { historical_at: at, unlocked_by: by, payload })
  }

  // Pre-index frames by predicate for fast lookup inside the inner loops.
  const firstByOf = new Map<string, MemoryFrame>()
  const caresMilestones: Array<{ f: MemoryFrame, n: number }> = []
  const metricMilestones: Record<ActionType, Array<{ f: MemoryFrame, n: number }>> = {
    feed: [], play: [], sleep: [], wash: [], medicine: [],
  }
  const nudgeMilestones: Array<{ f: MemoryFrame, n: number }> = []
  const minigameMilestones: Array<{ f: MemoryFrame, n: number }> = []
  const wishMilestones: Array<{ f: MemoryFrame, n: number }> = []
  const streakMilestones: Array<{ f: MemoryFrame, n: number }> = []
  const coupleNudgeMilestones: Array<{ f: MemoryFrame, target: number }> = []
  let coupleBothCaredFrame: MemoryFrame | null = null
  let couplePairedFrame: MemoryFrame | null = null
  const calendarFrames: MemoryFrame[] = []
  const seedFrames: MemoryFrame[] = []
  for (const f of MEMORY_FRAMES) {
    const p: Predicate = f.predicate
    switch (p.type) {
      case 'first':     firstByOf.set(p.of, f); break
      case 'cares':     caresMilestones.push({ f, n: p.count }); break
      case 'metric':    metricMilestones[p.metric].push({ f, n: p.count }); break
      case 'nudges':    nudgeMilestones.push({ f, n: p.count }); break
      case 'minigames': minigameMilestones.push({ f, n: p.count }); break
      case 'wishes':    wishMilestones.push({ f, n: p.count }); break
      case 'streak':    streakMilestones.push({ f, n: p.days }); break
      case 'calendar':  calendarFrames.push(f); break
      case 'seed':      seedFrames.push(f); break
      case 'couple':
        if (p.kind === 'both_cared_same_day')  coupleBothCaredFrame = f
        else if (p.kind === 'first_paired')    couplePairedFrame = f
        else if (p.kind === 'nudges_traded_10') coupleNudgeMilestones.push({ f, target: 10 })
        else if (p.kind === 'nudges_traded_50') coupleNudgeMilestones.push({ f, target: 50 })
        break
    }
  }

  // ── Walk interactions: firsts, cares, per-metric, couple:both_cared ──────
  let totalCares = 0
  const byType: Record<ActionType, number> = { feed: 0, play: 0, sleep: 0, wash: 0, medicine: 0 }
  const dayUsers = new Map<string, Set<string>>()
  const dayLastInteraction = new Map<string, InteractionRow>()
  const daysWithCare: string[] = []

  for (const i of inputs.interactions) {
    const at = i.action_type as ActionType
    const day = utcDayKey(i.created_at)
    if (!dayUsers.has(day)) { dayUsers.set(day, new Set()); daysWithCare.push(day) }
    dayUsers.get(day)!.add(i.user_id)
    dayLastInteraction.set(day, i)

    totalCares++
    if (at in byType) byType[at]++

    // first:day fires on the first interaction ever.
    if (totalCares === 1) {
      const dayFrame = firstByOf.get('day')
      if (dayFrame) record(dayFrame.id, i.created_at, i.user_id)
    }
    // first:<action_type>
    const firstFrame = firstByOf.get(at)
    if (firstFrame && !out.has(firstFrame.id)) record(firstFrame.id, i.created_at, i.user_id)
    // cares-N
    for (const { f, n } of caresMilestones) {
      if (totalCares === n) record(f.id, i.created_at, i.user_id)
    }
    // metric-N (per action_type)
    if (at in metricMilestones) {
      for (const { f, n } of metricMilestones[at]) {
        if (byType[at] === n) record(f.id, i.created_at, i.user_id)
      }
    }
    // couple:both_cared_same_day fires the moment a day has its second user.
    if (coupleBothCaredFrame && !out.has(coupleBothCaredFrame.id) && dayUsers.get(day)!.size >= 2) {
      record(coupleBothCaredFrame.id, i.created_at, i.user_id)
    }
  }

  // ── Walk journal: first:message + first:nudge + nudges-N + couple traded
  let nudgeTotal = 0
  const nudgesBySender = new Map<string, number>()
  for (const j of inputs.journal) {
    if (!j.via_eren) {
      const mFrame = firstByOf.get('message')
      if (mFrame && !out.has(mFrame.id)) record(mFrame.id, j.created_at, j.sender_id)
      continue
    }
    nudgeTotal++
    nudgesBySender.set(j.sender_id, (nudgesBySender.get(j.sender_id) ?? 0) + 1)

    const nFrame = firstByOf.get('nudge')
    if (nFrame && !out.has(nFrame.id)) record(nFrame.id, j.created_at, j.sender_id)
    for (const { f, n } of nudgeMilestones) {
      if (nudgeTotal === n) record(f.id, j.created_at, j.sender_id)
    }
    for (const { f, target } of coupleNudgeMilestones) {
      if (out.has(f.id)) continue
      if (nudgesBySender.size < 2) continue
      const counts = Array.from(nudgesBySender.values())
      if (counts.every(c => c >= target)) record(f.id, j.created_at, j.sender_id)
    }
  }

  // ── Walk minigames
  let gameTotal = 0
  for (const g of inputs.games) {
    gameTotal++
    const gFrame = firstByOf.get('minigame')
    if (gFrame && !out.has(gFrame.id)) record(gFrame.id, g.created_at, g.user_id)
    for (const { f, n } of minigameMilestones) {
      if (gameTotal === n) record(f.id, g.created_at, g.user_id)
    }
  }

  // ── Walk wishes
  let wishTotal = 0
  for (const w of inputs.wishes) {
    wishTotal++
    const wFrame = firstByOf.get('wish')
    if (wFrame && !out.has(wFrame.id)) record(wFrame.id, w.granted_at, w.granted_by)
    for (const { f, n } of wishMilestones) {
      if (wishTotal === n) record(f.id, w.granted_at, w.granted_by)
    }
  }

  // ── Streaks — walk daysWithCare in ascending order, track current run
  daysWithCare.sort()
  let streak = 0
  let prevDay: string | null = null
  for (const day of daysWithCare) {
    streak = (prevDay && utcDayDiff(day, prevDay) === 1) ? streak + 1 : 1
    prevDay = day
    for (const { f, n } of streakMilestones) {
      if (streak === n) {
        const last = dayLastInteraction.get(day)!
        record(f.id, last.created_at, last.user_id)
      }
    }
  }

  // ── Calendar — backdate to the day the offset was met / most recent past
  if (inputs.household) {
    const hhCreatedDay = utcDayKey(inputs.household.created_at)
    const daysSince = utcDayDiff(inputs.todayKey, hhCreatedDay)
    for (const f of calendarFrames) {
      if (f.predicate.type !== 'calendar') continue
      let at: string | null = null
      switch (f.predicate.when) {
        case 'app_week_1':   if (daysSince >= 7)   at = addDaysISO(hhCreatedDay, 7);   break
        case 'app_month_1':  if (daysSince >= 30)  at = addDaysISO(hhCreatedDay, 30);  break
        case 'app_month_3':  if (daysSince >= 90)  at = addDaysISO(hhCreatedDay, 90);  break
        case 'app_month_6':  if (daysSince >= 180) at = addDaysISO(hhCreatedDay, 180); break
        case 'app_year_1':   if (daysSince >= 365) at = addDaysISO(hhCreatedDay, 365); break
        case 'eren_birthday':
          if (inputs.household.eren_birthday)      at = mostRecentPastAnniversary(inputs.household.eren_birthday,      inputs.todayKey, hhCreatedDay)
          break
        case 'couple_anniversary':
          if (inputs.household.couple_anniversary) at = mostRecentPastAnniversary(inputs.household.couple_anniversary, inputs.todayKey, hhCreatedDay)
          break
      }
      if (at) record(f.id, at, null)
    }
  }

  // ── Couple paired — clamp to max(2nd profile's created_at, household's
  // created_at) so the frame never predates the household. profiles.created_at
  // is the signup time, which can be much earlier than the actual pairing.
  if (couplePairedFrame && inputs.profiles.length >= 2 && inputs.household) {
    const candidate = inputs.profiles[1].created_at
    const floor     = inputs.household.created_at
    const at = candidate > floor ? candidate : floor
    record(couplePairedFrame.id, at, inputs.profiles[1].id)
  }

  // ── First:mood — backfill from daily_moods. The on-event evaluator covers
  // mood frames from PR 6 forward; this catches anyone who'd already logged
  // moods before PR 6 deployed.
  if (inputs.earliestMood) {
    const f = firstByOf.get('mood')
    if (f && !out.has(f.id)) record(f.id, inputs.earliestMood.at, inputs.earliestMood.user_id)
  }

  // ── Welcome seeds — stamp at household creation
  if (inputs.household) {
    for (const f of seedFrames) {
      record(f.id, inputs.household.created_at, inputs.profiles[0]?.id ?? null)
    }
  }

  return out
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: CatchupRequest
  try { body = await req.json() as CatchupRequest } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  if (!body.user_id || !body.household_id) {
    return NextResponse.json({ error: 'user_id and household_id required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify membership. Admin client bypasses RLS so we have to re-check.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, memory_caught_up, household_id, catchup_pushed_at')
    .eq('id', body.user_id)
    .maybeSingle()
  if (!profile || profile.household_id !== body.household_id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Hard short-circuit once the user has explicitly dismissed the carousel.
  // catchup_pushed_at is NOT a re-entry gate (carousel needs to re-show until
  // dismissed) — only memory_caught_up is. The carousel stamps that on mount
  // in PR 8 so this branch covers nearly every re-fire after first sight.
  if (profile.memory_caught_up === true) {
    return NextResponse.json({ skipped: true, unlocked_count: 0, frames: [] })
  }

  // Load the household's member ids first so we can scope game_scores.
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, created_at')
    .eq('household_id', body.household_id)
    .order('created_at', { ascending: true })
  const profiles = (profileRows ?? []) as ProfileRow[]
  const memberIds = profiles.map(p => p.id)

  const [iRes, jRes, gRes, wRes, hRes, fRes, mRes] = await Promise.all([
    supabase.from('interactions')
      .select('user_id, action_type, created_at')
      .eq('household_id', body.household_id)
      .order('created_at', { ascending: true }),
    supabase.from('couple_journal')
      .select('sender_id, via_eren, created_at')
      .eq('household_id', body.household_id)
      .order('created_at', { ascending: true }),
    memberIds.length
      ? supabase.from('game_scores')
          .select('user_id, game_type, created_at')
          .in('user_id', memberIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as GameRow[] }),
    supabase.from('eren_wishes')
      .select('wish_id, granted_at, granted_by')
      .eq('household_id', body.household_id)
      .not('granted_at', 'is', null)
      .order('granted_at', { ascending: true }),
    supabase.from('households')
      .select('created_at, eren_birthday, couple_anniversary')
      .eq('id', body.household_id)
      .maybeSingle(),
    supabase.from('memory_frames')
      .select('frame_id, unlocked_at')
      .eq('household_id', body.household_id),
    // daily_moods has user_id, not household_id — scope via members.
    memberIds.length
      ? supabase.from('daily_moods')
          .select('user_id, created_at')
          .in('user_id', memberIds)
          .order('created_at', { ascending: true })
          .limit(1)
      : Promise.resolve({ data: [] as Array<{ user_id: string, created_at: string }> }),
  ])

  const moodRow = ((mRes.data ?? []) as Array<{ user_id: string, created_at: string }>)[0] ?? null

  const inputs: Inputs = {
    interactions: (iRes.data ?? []) as InteractionRow[],
    journal:      (jRes.data ?? []) as JournalRow[],
    games:        (gRes.data ?? []) as GameRow[],
    wishes:       (wRes.data ?? []) as WishRow[],
    profiles,
    household:    (hRes.data ?? null) as HouseholdRow | null,
    earliestMood: moodRow ? { user_id: moodRow.user_id, at: moodRow.created_at } : null,
    todayKey:     new Date().toISOString().slice(0, 10),
  }

  const backfill = computeBackfill(inputs)
  const existing = new Map<string, string>()  // frame_id → unlocked_at
  for (const row of (fRes.data ?? []) as Array<{ frame_id: string, unlocked_at: string }>) {
    existing.set(row.frame_id, row.unlocked_at)
  }

  const frameById = new Map<string, MemoryFrame>(MEMORY_FRAMES.map(f => [f.id, f] as [string, MemoryFrame]))
  const reported: Array<{ frame_id: string, unlocked_at: string }> = []

  const backfillEntries = Array.from(backfill.entries())

  // Split: missing frames get ONE bulk insert; already-present frames get
  // independent backdate updates. A frame_id is only ever in one bucket.
  const toInsert: Array<{ frameId: string, entry: BackfillEntry, frame: MemoryFrame }> = []
  const toBackdate: Array<{ frameId: string, entry: BackfillEntry }> = []
  for (const [frameId, entry] of backfillEntries) {
    const frame = frameById.get(frameId)
    if (!frame) continue
    const currentAt = existing.get(frameId)
    if (!currentAt) toInsert.push({ frameId, entry, frame })
    else if (new Date(entry.historical_at) < new Date(currentAt)) toBackdate.push({ frameId, entry })
  }

  if (toInsert.length) {
    const rows = toInsert.map(({ frameId, entry, frame }) => ({
      household_id: body.household_id,
      frame_id:     frameId,
      kind:         frame.kind,
      rarity:       frame.rarity,
      unlocked_at:  entry.historical_at,
      unlocked_by:  entry.unlocked_by,
      payload:      entry.payload,
    }))
    // ONE round trip instead of up to 58. ON CONFLICT DO NOTHING matches the
    // old per-row 23505 absorb: a concurrent partner catchup's row wins and
    // the frame is still reported as newly visible to this user.
    let bulkOk = false
    try {
      const { error } = await supabase
        .from('memory_frames')
        .upsert(rows, { onConflict: 'household_id,frame_id', ignoreDuplicates: true })
      bulkOk = !error
    } catch { /* fall through to per-row */ }
    if (bulkOk) {
      for (const { frameId, entry } of toInsert) {
        reported.push({ frame_id: frameId, unlocked_at: entry.historical_at })
      }
    } else {
      // Bulk write failed (transient 503s happen). The carousel stamps
      // memory_caught_up on first mount, so this pass is our only shot at
      // these rows — fall back to the old per-row loop so one blip can't
      // drop the whole backfill.
      for (const { frameId, entry, frame } of toInsert) {
        try {
          const { error } = await supabase.from('memory_frames').insert({
            household_id: body.household_id,
            frame_id:     frameId,
            kind:         frame.kind,
            rarity:       frame.rarity,
            unlocked_at:  entry.historical_at,
            unlocked_by:  entry.unlocked_by,
            payload:      entry.payload,
          })
          // 23505 = concurrent partner catchup beat us. We still surface the
          // frame in the carousel since it's newly visible to this user now.
          if (!error || error.code === '23505') {
            reported.push({ frame_id: frameId, unlocked_at: entry.historical_at })
          }
        } catch { /* swallow — one failed row shouldn't abort the pass */ }
      }
    }
  }

  // Backdates pull an existing stamp backwards. These are silent timestamp
  // corrections on distinct, independent rows — the frame is already on the
  // wall and the user has already seen it, so they never enter `reported`
  // (otherwise the carousel would parade frames the user already discovered
  // as if they were new). Run them concurrently, swallowing per-row failures
  // like before.
  await Promise.all(toBackdate.map(({ frameId, entry }) =>
    supabase
      .from('memory_frames')
      .update({ unlocked_at: entry.historical_at })
      .eq('household_id', body.household_id)
      .eq('frame_id',     frameId)
      .gt('unlocked_at',  entry.historical_at)
      .then(() => undefined, () => undefined)
  ))

  // Stamp catchup_pushed_at the FIRST time we run for this profile so PR 9's
  // notify-catchup doesn't re-nudge. First-write-wins — subsequent retries
  // never bump the timestamp forward (which would slide PR 9's notify window
  // every re-fire).
  if (!profile.catchup_pushed_at) {
    await supabase
      .from('profiles')
      .update({ catchup_pushed_at: new Date().toISOString() })
      .eq('id', body.user_id)
  }

  return NextResponse.json({
    skipped:        profile.memory_caught_up === true,
    unlocked_count: reported.length,
    frames:         reported,
  })
}
