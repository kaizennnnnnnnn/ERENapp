'use client'

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THE KIOSK REMEMBERS between nights.
// ──────────────────────────────────────────────────────────────────────────
//   * Whether you've already worked your paid shift tonight. One each per
//     night, per person — the second one is practice, and pays nothing. This
//     is the whole reason the kiosk can't quietly out-earn the arcade.
//   * The last shift anybody worked, for the board on the kiosk front, and
//     the note they left at the till.
//   * The household's regulars: which costume ordered what, and how many
//     times they've been served right. Two, and they start asking for "the
//     usual".
//   * Lifetime wraps, which is what puts new things on the menu.
//
// Regulars and the lifetime count live on the shared eren_stats row (same
// place room_skins does) so both of you build the same regulars. Shifts get
// their own append-only table.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { dateKey } from '@/lib/wishes'
import { menuFor, type MenuState, type Regulars } from './kioskShift'
import type { Grade, Takings } from './kioskEconomy'

export interface ShiftRow {
  user_id: string
  shift_date: string
  served: number
  wrong: number
  walked: number
  missed_calls: number
  best_streak: number
  base: number
  tips: number
  grade: Grade
  rained: boolean
  note: string | null
  closed_at: string
}

/** The last seven nights, split between the two of you. */
export interface WeekTally {
  /** Wraps served this week. */
  mine: number
  theirs: number
  /** And how many nights each of you worked. */
  myNights: number
  theirNights: number
}

export interface KioskRecord {
  /** False until the first fetch lands. An empty record and a failed fetch
   *  look identical otherwise, and the difference decides whether tonight is
   *  a paid shift. */
  loaded: boolean
  /** My paid shift for tonight is already in the book. */
  workedTonight: boolean
  /** The most recent shift anyone worked — the board out front. */
  lastShift: ShiftRow | null
  /** The board out front: who's had the better week. */
  week: WeekTally
  lifetimeWraps: number
  menu: MenuState
  regulars: Regulars
  /** Bank a finished night. Returns false if it couldn't be recorded (an
   *  outage, or a practice shift), so the receipt can say so. */
  closeShift: (opts: {
    takings: Takings
    grade: Grade
    rained: boolean
    regulars: Regulars
    paid: boolean
  }) => Promise<boolean>
  /** The note is typed on the receipt, after the row already exists. */
  saveNote: (note: string) => Promise<void>
}

/** Today, in the player's own timezone — a night that starts at 23:50 belongs
 *  to the day it started in. */
function today(): string {
  return dayKey(0)
}

/** A date key `back` days ago, in the player's own timezone. */
function dayKey(back: number): string {
  const tz = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC'
  const d = new Date()
  d.setDate(d.getDate() - back)
  return dateKey(d, tz)
}

const EMPTY_WEEK: WeekTally = { mine: 0, theirs: 0, myNights: 0, theirNights: 0 }

export function useKioskRecord(): KioskRecord {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const hh = profile?.household_id ?? null
  const { stats } = useErenStats()

  const [loaded, setLoaded] = useState(false)
  const [workedTonight, setWorkedTonight] = useState(false)
  const [lastShift, setLastShift] = useState<ShiftRow | null>(null)
  const [week, setWeek] = useState<WeekTally>(EMPTY_WEEK)
  /** The row we just wrote, so saveNote knows what to edit. */
  const myDate = useRef<string | null>(null)

  // Regulars and the lifetime count ride on the shared stats row, so a
  // partner's night is already in here by the time you walk in.
  const regulars = (stats?.kiosk_regulars ?? {}) as Regulars
  const lifetimeWraps = stats?.kiosk_wraps ?? 0

  const load = useCallback(async () => {
    if (!hh || !user?.id) return
    const { data, error } = await withRetry(() =>
      supabase.from('kiosk_shifts')
        .select('user_id, shift_date, served, wrong, walked, missed_calls, best_streak, base, tips, grade, rained, note, closed_at')
        .eq('household_id', hh)
        .order('closed_at', { ascending: false })
        // Enough for both of you to have worked every night of the last week
        // and then some — the board wants seven days, not eight rows.
        .limit(24))
    // An error is NOT "no shifts" — leaving `loaded` false keeps tonight
    // payable rather than silently marking it already worked.
    if (error) return
    const rows = (data ?? []) as ShiftRow[]
    setLastShift(rows[0] ?? null)
    setWorkedTonight(rows.some(r => r.user_id === user.id && r.shift_date === today()))

    // Tonight and the six before it. Keyed on the player's own dates, so a
    // week means the last seven nights you lived through.
    const recent = new Set(Array.from({ length: 7 }, (_, i) => dayKey(i)))
    const tally = { ...EMPTY_WEEK }
    for (const r of rows) {
      if (!recent.has(r.shift_date)) continue
      if (r.user_id === user.id) { tally.mine += r.served; tally.myNights += 1 }
      else { tally.theirs += r.served; tally.theirNights += 1 }
    }
    setWeek(tally)
    setLoaded(true)
  }, [hh, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])
  useEffect(() => onForeground(load), [load])

  const closeShift = useCallback(async ({ takings, grade, rained, regulars: next, paid }: {
    takings: Takings; grade: Grade; rained: boolean; regulars: Regulars; paid: boolean
  }): Promise<boolean> => {
    if (!hh || !user?.id) return false

    // The kiosk's memory grows on every shift, paid or not — a regular you
    // learned on a practice night is still a regular.
    const wraps = lifetimeWraps + takings.served
    void withRetry(() => supabase.from('eren_stats')
      .update({ kiosk_regulars: next, kiosk_wraps: wraps })
      .eq('household_id', hh))

    if (!paid) return false

    const date = today()
    const { error } = await withRetry(() => supabase.from('kiosk_shifts').insert({
      household_id: hh,
      user_id: user.id,
      shift_date: date,
      served: takings.served,
      wrong: takings.wrong,
      walked: takings.walked,
      missed_calls: takings.missedCalls,
      best_streak: takings.bestStreak,
      base: takings.base,
      tips: takings.tips,
      grade,
      rained,
    }))
    if (error) return false
    myDate.current = date
    setWorkedTonight(true)
    void load()
    return true
  }, [hh, user?.id, lifetimeWraps]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveNote = useCallback(async (note: string) => {
    if (!hh || !user?.id || !myDate.current) return
    await withRetry(() => supabase.from('kiosk_shifts')
      .update({ note: note.slice(0, 90) })
      .eq('household_id', hh)
      .eq('user_id', user.id)
      .eq('shift_date', myDate.current as string))
    void load()
  }, [hh, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable while the count is: the shift hook holds onto this, and a fresh
  // object every render would churn its callbacks.
  const menu = useMemo(() => menuFor(lifetimeWraps), [lifetimeWraps])

  return {
    loaded,
    workedTonight,
    lastShift,
    week,
    lifetimeWraps,
    menu,
    regulars,
    closeShift,
    saveNote,
  }
}
