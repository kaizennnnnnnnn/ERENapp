// ─── The Us page's view model ────────────────────────────────────────────────
// Plain shapes the presentational Us view takes. The page (/couple) builds them
// from useCouple / useTasks / useErenStats; the preview route builds them from
// the board's example data. Nothing in here touches Supabase or React state.

import type { AnniversaryInfo } from '@/lib/couple'
import type { CatLook } from '@/lib/catIdentity'
import type { UserMood } from '@/types'

/** A person as the page draws them: first name + household colour. */
export interface UsPerson {
  name: string
  /** personColor(profile.heart): brown, pink, or Eren's gold for the cat's seat. */
  color: string
}

export interface UsCat {
  name: string
  look: CatLook | null
}

// ─── Together for N days ─────────────────────────────────────────────────────

export interface TogetherInfo {
  days: number
  /** The day the household began. Null until read, and the stamp waits for it. */
  since: Date | null
  /** Today's milestone, e.g. "100 Days". Null on most days. */
  milestoneToday: string | null
  /** The walk from the last milestone to the next. Null past the last one. */
  walk: { from: number; to: number; daysLeft: number } | null
}

// lib/couple's MILESTONES, days only: it keeps the list private and exposes
// just the NEXT one, and the progress bar also needs the one it started from.
// 0 is the start line. If the two lists ever drift, `from` falls back to 0,
// which still draws a sane (if longer) bar.
const MILESTONE_DAYS = [0, 1, 7, 14, 30, 50, 100, 150, 200, 365, 500, 730, 1000]

export function togetherInfo(a: AnniversaryInfo, since: Date | null): TogetherInfo {
  const next = a.nextMilestone
  let walk: TogetherInfo['walk'] = null
  if (next) {
    const to = a.days + next.daysLeft
    let from = 0
    for (const d of MILESTONE_DAYS) if (d < to && d <= a.days) from = d
    walk = { from, to, daysLeft: next.daysLeft }
  }
  return {
    days: a.days,
    since,
    // "100 Days!" -> "100 Days": one quiet tag, not a shout.
    milestoneToday: a.milestone ? a.milestone.replace(/!+$/, '') : null,
    walk,
  }
}

// ─── Partner today ───────────────────────────────────────────────────────────

export interface MoodDay {
  /** yyyy-MM-dd, the mood day (moodDateKey). */
  date: string
  mood: UserMood | null
}

// ─── The love tray ───────────────────────────────────────────────────────────

/** The four NUDGE_DEFS ids, in tray order. */
export type NudgeId = 'loveyou' | 'kiss' | 'miss' | 'think'

export interface LoveTrayState {
  /** Nudges sent during this visit. Their tiles keep the check. */
  sent: Partial<Record<NudgeId, boolean>>
  /** The nudge in flight, if any: its tile dims and ignores taps. */
  busy: NudgeId | null
  /** A failed send, shown under whichever control asked for it. */
  error: { from: 'cta' | 'tray'; message: string } | null
}

// ─── Note board ──────────────────────────────────────────────────────────────

export interface NotePreview {
  id: string
  /** The food id of a gift, or null for a written note. */
  gift: string | null
  /** From my partner and newer than my last visit to the board. */
  unread: boolean
}

export interface NotesInfo {
  count: number
  unread: number
  /** Up to three, newest first. */
  preview: NotePreview[]
}

// ─── Care battle ─────────────────────────────────────────────────────────────

export interface BattleSide extends UsPerson {
  score: number
  /** Share of the week's points, 0..100. */
  pct: number
}

export interface SeasonInfo {
  /** Daily battles over the lookback window. Null when there is no history. */
  record: { mine: number; ties: number; theirs: number } | null
  /** Care streaks. `theirs` is null solo: the cat keeps no streak of its own. */
  streak: { mine: number; myBest: number; theirs: number | null; theirBest: number | null } | null
}

export interface BattleInfo {
  me: BattleSide
  them: BattleSide
  /** Both scores added; 0 means nobody has cared yet this week. */
  total: number
  season: SeasonInfo | null
}

// ─── Journal ─────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string
  text: string
  mine: boolean
  /** Sender's first name ("You" is decided by the view). */
  name: string
  color: string
  /** ISO timestamp. */
  at: string
}
