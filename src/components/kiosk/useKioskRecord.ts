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
import { useAuth, PROFILE_UPDATED_EVENT } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { dateKey } from '@/lib/wishes'
import { menuFor, type MenuState, type Regulars, type WeatherId } from './kioskShift'
import type { Grade } from './kioskEconomy'
import type { ShiftReport } from './useKioskShift'
import { startKioskShift, prepareKioskClose, pendingKioskSaves, saveKioskClose, validKioskSettlement, kioskSaveError,
  type KioskSession, type KioskSettlement } from '@/lib/kioskSaves'
import type { PendingSavedRequest } from '@/lib/savedRpc'
import { notifyRewardIndicators } from '@/lib/rewardIndicators'

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
  /** Kept for rows written before the weather was a system rather than a
   *  boolean. Nothing reads it any more; the column stays so an old row and a
   *  new one are the same shape. */
  rained: boolean
  weather: WeatherId
  note: string | null
  closed_at: string
}

/** What somebody left at the till, and when. */
export interface TillNote {
  text: string
  /** Your own handwriting reads back to you differently. */
  mine: boolean
  /** "tonight", "last night", "tuesday". */
  when: string
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
  /** The front board is known. Starting a shift separately confirms eligibility. */
  loaded: boolean
  /** My paid shift for tonight is already in the book. */
  workedTonight: boolean
  /** The most recent shift anyone worked — the board out front. */
  lastShift: ShiftRow | null
  /** The board out front: who's had the better week. */
  week: WeekTally
  /** Wraps the household has served tonight, on anybody's shift. The shared
   *  goal counts from here. */
  tonight: number
  /** The most recent note either of you left at the till, if it's recent
   *  enough to still be about something. */
  note: TillNote | null
  lifetimeWraps: number
  menu: MenuState
  regulars: Regulars
  session: KioskSession | null
  settlement: KioskSettlement | null
  starting: boolean
  startError: string | null
  saving: boolean
  saveError: string | null
  pending: number
  beginShift: () => Promise<boolean>
  retrySave: () => Promise<void>
  /** Confirm the whole finished night, including unpaid practice memory. */
  closeShift: (opts: {
    report: ShiftReport
    regulars: Regulars
  }) => Promise<boolean>
  /** The note is typed on the receipt, after the row already exists. */
  saveNote: (note: string) => Promise<boolean>
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

/** How long a note stays up on the wall. Anything older is a note about a
 *  night neither of you remembers. */
const NOTE_DAYS = 4

/** How to refer to a shift date, from today. */
function whenWord(date: string): string {
  for (let i = 0; i < NOTE_DAYS; i++) {
    if (dayKey(i) !== date) continue
    if (i === 0) return 'tonight'
    if (i === 1) return 'last night'
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toLocaleDateString(undefined, { weekday: 'long' })
  }
  return ''
}

export function useKioskRecord(): KioskRecord {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const hh = profile?.household_id ?? null
  const { stats, refetch } = useErenStats()

  const [loaded, setLoaded] = useState(false)
  const [workedTonight, setWorkedTonight] = useState(false)
  const [lastShift, setLastShift] = useState<ShiftRow | null>(null)
  const [week, setWeek] = useState<WeekTally>(EMPTY_WEEK)
  const [tonight, setTonight] = useState(0)
  const [note, setNote] = useState<TillNote | null>(null)
  /** The row we just wrote, so saveNote knows what to edit. */
  const myDate = useRef<string | null>(null)
  const [session, setSession] = useState<KioskSession | null>(null)
  const [settlement, setSettlement] = useState<KioskSettlement | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const scope = useRef({ actor: user?.id, hh }); scope.current = { actor: user?.id, hh }
  const epoch = useRef(0), mounted = useRef(true), readVersion = useRef(0)
  const startLock = useRef<symbol | null>(null), recoveryLock = useRef<symbol | null>(null)
  useEffect(() => {
    mounted.current = true; startLock.current = null; recoveryLock.current = null; myDate.current = null
    setSession(null); setSettlement(null); setLoaded(false); setWorkedTonight(false); setLastShift(null)
    setWeek(EMPTY_WEEK); setTonight(0); setNote(null); setStarting(false); setSaving(false); setStartError(null); setSaveError(null)
    return () => { mounted.current = false; epoch.current++; readVersion.current++ }
  }, [user?.id, hh])

  // Regulars and the lifetime count ride on the shared stats row, so a
  // partner's night is already in here by the time you walk in.
  const regulars = (stats?.kiosk_regulars ?? {}) as Regulars
  const lifetimeWraps = stats?.kiosk_wraps ?? 0

  const load = useCallback(async () => {
    if (!hh || !user?.id) return
    const version = ++readVersion.current
    const { data, error } = await withRetry(() =>
      supabase.from('kiosk_shifts')
        .select('user_id, shift_date, served, wrong, walked, missed_calls, best_streak, base, tips, grade, rained, weather, note, closed_at')
        .eq('household_id', hh)
        .order('closed_at', { ascending: false })
        // Enough for both of you to have worked every night of the last week
        // and then some — the board wants seven days, not eight rows.
        .limit(24))
    // A failed board read is unknown; the start RPC decides paid eligibility.
    if (!mounted.current || scope.current.actor !== user.id || scope.current.hh !== hh || version !== readVersion.current || error) return
    const rows = ((data ?? []) as ShiftRow[]).map(row => ({ ...row,
      weather: row.rained && (!row.weather || row.weather === 'clear') ? 'rain' as const : row.weather ?? 'clear' as const }))
    setLastShift(rows[0] ?? null)
    setWorkedTonight(rows.some(r => r.user_id === user.id && r.shift_date === today()))

    // Tonight and the six before it. Keyed on the player's own dates, so a
    // week means the last seven nights you lived through.
    const recent = new Set(Array.from({ length: 7 }, (_, i) => dayKey(i)))
    const tally = { ...EMPTY_WEEK }
    const now = today()
    let served = 0
    for (const r of rows) {
      if (r.shift_date === now) served += r.served
      if (!recent.has(r.shift_date)) continue
      if (r.user_id === user.id) { tally.mine += r.served; tally.myNights += 1 }
      else { tally.theirs += r.served; tally.theirNights += 1 }
    }
    setWeek(tally)
    setTonight(served)

    // The note on the wall: the newest one anybody wrote, while it's still
    // recent enough to be about a night either of you remembers. Rows arrive
    // newest first, so the first hit is the right one.
    const fresh = rows.find(r => r.note && r.note.trim() && whenWord(r.shift_date))
    setNote(fresh
      ? { text: fresh.note as string, mine: fresh.user_id === user.id, when: whenWord(fresh.shift_date) }
      : null)
    setLoaded(true)
  }, [hh, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])
  useEffect(() => onForeground(load), [load])

  const performClose = useCallback(async (request: PendingSavedRequest) => {
    const actor = user?.id, generation = epoch.current
    const active = () => mounted.current && epoch.current === generation && scope.current.actor === actor && scope.current.hh === hh
    if (!actor || !hh || !active()) return false
    setSaving(true); setSaveError(null)
    try {
      const result = await saveKioskClose(supabase, actor, request)
      if (!active()) return false
      if (!result.ok || !validKioskSettlement(result as KioskSettlement, actor, request)) {
        setSaveError(kioskSaveError(result.reason)); return false
      }
      const saved = result as KioskSettlement
      setSettlement(saved)
      if (saved.paid) myDate.current = saved.shift_date
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { id: actor, patch: { coins: saved.coins } } }))
      notifyRewardIndicators()
      void refetch(); void load()
      return true
    } finally {
      if (active()) { setSaving(false); setPending(pendingKioskSaves(actor, hh).length) }
    }
  }, [hh, user?.id, load, refetch]) // eslint-disable-line react-hooks/exhaustive-deps

  const retrySave = useCallback(async () => {
    const actor = user?.id, generation = epoch.current
    if (!actor || !hh || recoveryLock.current) return
    const token = Symbol('kiosk-recovery'); recoveryLock.current = token
    try {
      for (const request of pendingKioskSaves(actor, hh)) {
        if (!mounted.current || epoch.current !== generation || scope.current.actor !== actor || scope.current.hh !== hh) break
        await performClose(request)
      }
    } finally { if (recoveryLock.current === token) recoveryLock.current = null }
  }, [hh, user?.id, performClose])
  const retryLatest = useRef(retrySave); retryLatest.current = retrySave
  useEffect(() => {
    setPending(user?.id && hh ? pendingKioskSaves(user.id, hh).length : 0)
    void retryLatest.current()
    return onForeground(() => { void retryLatest.current() })
  }, [hh, user?.id])

  const beginShift = useCallback(async () => {
    const actor = user?.id, generation = epoch.current
    const active = () => mounted.current && epoch.current === generation && scope.current.actor === actor && scope.current.hh === hh
    if (!actor || !hh || !active() || startLock.current) return false
    if (pendingKioskSaves(actor, hh).length) { setStartError('Recover your finished shift before starting another.'); void retrySave(); return false }
    const token = Symbol('kiosk-start'); startLock.current = token
    setStarting(true); setStartError(null)
    try {
      const result = await startKioskShift(supabase, actor, hh)
      if (!active()) return false
      if (!result.ok) { setStartError(result.reason === 'not_ready'
        ? 'The shop needs its saving update before a shift can open.' : kioskSaveError(result.reason)); return false }
      setSession(result as KioskSession); setSettlement(null); setSaveError(null); myDate.current = null
      return true
    } catch { if (active()) setStartError('Could not open the shift. Try again; nothing has been spent.'); return false }
    finally { if (startLock.current === token) { startLock.current = null; if (active()) setStarting(false) } }
  }, [hh, user?.id, retrySave]) // eslint-disable-line react-hooks/exhaustive-deps

  const closeShift = useCallback(async ({ report, regulars: next }: { report: ShiftReport; regulars: Regulars }): Promise<boolean> => {
    if (!hh || !user?.id || session?.user_id !== user.id || session.household_id !== hh
      || !mounted.current || scope.current.actor !== user.id || scope.current.hh !== hh) return false
    const request = prepareKioskClose(user.id, hh, session, report, next)
    setPending(pendingKioskSaves(user.id, hh).length)
    return performClose(request)
  }, [hh, user?.id, session, performClose])

  const saveNote = useCallback(async (note: string) => {
    if (!hh || !user?.id || !myDate.current || scope.current.actor !== user.id || scope.current.hh !== hh) return false
    const { error } = await withRetry(() => supabase.from('kiosk_shifts')
      .update({ note: note.slice(0, 90) })
      .eq('household_id', hh)
      .eq('user_id', user.id)
      .eq('shift_date', myDate.current as string))
    if (!error) void load()
    return !error
  }, [hh, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable while the count is: the shift hook holds onto this, and a fresh
  // object every render would churn its callbacks.
  const menu = useMemo(() => menuFor(lifetimeWraps), [lifetimeWraps])

  return {
    loaded,
    workedTonight,
    lastShift,
    week,
    tonight,
    note,
    lifetimeWraps,
    menu,
    regulars,
    session: session?.user_id === user?.id && session?.household_id === hh ? session : null,
    settlement: settlement?.user_id === user?.id && settlement?.household_id === hh ? settlement : null,
    starting, startError, saving, saveError, pending, beginShift, retrySave,
    closeShift,
    saveNote,
  }
}
