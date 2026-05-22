import type { Interaction } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════════
// COUPLE FEATURES — Love meter, anniversary
// ═══════════════════════════════════════════════════════════════════════════════

// ── Love Meter (competition!) ────────────────────────────────────────────────
// Scores based on care interactions during the CURRENT calendar week
// (Monday 00:00 → Sunday 23:59 local). The window resets every
// Monday so each week is a fresh race rather than a 30-day grind.

const ACTION_POINTS: Record<string, number> = {
  feed: 3,
  play: 4,
  sleep: 2,
  wash: 3,
  medicine: 5,
}

export interface LoveMeterResult {
  user1: { id: string; name: string; score: number; pct: number }
  user2: { id: string; name: string; score: number; pct: number }
  total: number
  leader: string | null  // user_id of the leader, null if tied
  /** ISO time the week window started — useful for the countdown UI. */
  weekStart: string
}

/** Local Monday 00:00 of the week containing `now`. */
export function startOfWeek(now: Date = new Date()): Date {
  const d = new Date(now)
  const day = d.getDay() // 0=Sun … 6=Sat
  // Anchor on Monday: day=1 → diff=0, day=0/Sun → diff=-6 (last Mon)
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Time remaining until the next weekly reset (next Monday 00:00). */
export function timeUntilWeekReset(now: Date = new Date()): {
  days: number; hours: number; minutes: number; ms: number
} {
  const next = startOfWeek(now)
  next.setDate(next.getDate() + 7)
  const ms = next.getTime() - now.getTime()
  return {
    days:    Math.floor(ms / 86400000),
    hours:   Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    ms,
  }
}

export function computeLoveMeter(
  interactions: Interaction[],
  user1Id: string, user1Name: string,
  user2Id: string, user2Name: string,
): LoveMeterResult {
  const weekStart = startOfWeek().toISOString()
  const recent = interactions.filter(i => i.created_at >= weekStart)

  let s1 = 0, s2 = 0
  for (const i of recent) {
    const pts = ACTION_POINTS[i.action_type] ?? 1
    if (i.user_id === user1Id) s1 += pts
    else if (i.user_id === user2Id) s2 += pts
  }

  const total = s1 + s2 || 1
  return {
    user1: { id: user1Id, name: user1Name, score: s1, pct: Math.round((s1 / total) * 100) },
    user2: { id: user2Id, name: user2Name, score: s2, pct: Math.round((s2 / total) * 100) },
    total: s1 + s2,
    leader: s1 > s2 ? user1Id : s2 > s1 ? user2Id : null,
    weekStart,
  }
}

// ── Anniversary ──────────────────────────────────────────────────────────────

export interface AnniversaryInfo {
  days: number
  milestone: string | null
  nextMilestone: { name: string; daysLeft: number } | null
}

const MILESTONES = [
  { days: 1,    name: 'First Day Together!' },
  { days: 7,    name: 'One Week!' },
  { days: 14,   name: 'Two Weeks!' },
  { days: 30,   name: 'One Month!' },
  { days: 50,   name: '50 Days!' },
  { days: 100,  name: '100 Days!' },
  { days: 150,  name: '150 Days!' },
  { days: 200,  name: '200 Days!' },
  { days: 365,  name: 'One Year!' },
  { days: 500,  name: '500 Days!' },
  { days: 730,  name: 'Two Years!' },
  { days: 1000, name: '1000 Days!' },
]

export function getAnniversaryInfo(householdCreatedAt: string): AnniversaryInfo {
  const created = new Date(householdCreatedAt)
  const now = new Date()
  const days = Math.floor((now.getTime() - created.getTime()) / 86400000)

  // Check current milestone
  let milestone: string | null = null
  for (const m of MILESTONES) {
    if (days === m.days) { milestone = m.name; break }
  }

  // Find next milestone
  let nextMilestone: AnniversaryInfo['nextMilestone'] = null
  for (const m of MILESTONES) {
    if (m.days > days) {
      nextMilestone = { name: m.name, daysLeft: m.days - days }
      break
    }
  }

  return { days, milestone, nextMilestone }
}
