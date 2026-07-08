'use client'

// ═════════════════════════════════════════════════════════════════════════════
// useFlavorBubble — Phase 3 PR 5
//
// Drives the ErenSpeechBubble: picks a flavor line, manages the 60–90s ambient
// cycle, layers contextual one-shots (after_positive, gap_24h, duplicate_feed),
// and stays silent when suppressed (wish bubble is up) or when the tab is
// hidden.
//
// Caller wires it up from home/page.tsx and supplies the suppression boolean.
// Pure event-driven — no Supabase calls, no realtime. State that needs to
// survive a refresh (last-seen timestamp) lives in localStorage.
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { FLAVOR_LINES, type FlavorLine, type FlavorTrigger } from '@/lib/flavorLines'
import { getDaypart, type Daypart } from '@/lib/timeOfDay'
import { quipOfTheDay } from '@/lib/erenQuips'
import { dateKey } from '@/lib/wishes'
import type { FoodKey } from '@/types'

const IDLE_CYCLE_MIN_MS = 60_000
const IDLE_CYCLE_MAX_MS = 90_000
// The first idle line of a session fires fast (a few seconds after Eren
// settles in) so even a short home visit catches one — with only the 60–90s
// gap, most visits ended before Eren ever "thought" anything out loud.
const FIRST_LINE_MIN_MS = 6_000
const FIRST_LINE_MAX_MS = 12_000
const BUBBLE_VISIBLE_MS = 5_500
const TRIGGER_DELAY_MIN_MS = 4_000
const TRIGGER_DELAY_MAX_MS = 8_000
const GAP_24H_MS = 24 * 60 * 60 * 1000
const LAST_SEEN_KEY = 'eren:flavor:last-seen'
const RARE_INTRO_CHANCE = 0.04
const NEEDS_LEADER_CHANCE = 0.25
const RECENT_HISTORY_CAP = 4
const GREETING_DELAY_MS = 3_000
const QUIP_SHOWN_KEY = 'eren:quip:lastShownDate'

const range = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min))
const pickRand = <T,>(arr: T[]): T | null => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null)

/** Idle line eligible for the current daypart? Lines with no daypart always are. */
function daypartOk(l: FlavorLine, dp: Daypart): boolean {
  if (!l.daypart) return true
  return Array.isArray(l.daypart) ? l.daypart.includes(dp) : l.daypart === dp
}

export interface UseFlavorBubbleOptions {
  /** True when the home page is mounted and Eren is awake. */
  enabled: boolean
  /** True when the wish bubble (or any higher-priority surface) is visible —
   *  flavor stays silent until this flips back. */
  suppressed: boolean
  leaderName: string | null
  viewerName: string
  partnerName: string | null
  /** Phase 3 PR 10: when the viewer opted into quiet_eren_optin we double
   *  the idle cycle (60–90s → 120–180s) so Eren chatters about half as
   *  often. Memory pushes are silenced server-side; this is the client
   *  half of the same vibe. */
  quietEren?: boolean
  /** For the per-viewer greeting stamp + deterministic daily quip. */
  userId?: string | null
  householdId?: string | null
  tz?: string | null
}

export interface FlavorBubble {
  /** Stable per-line id; used as React key + recent-history tracker. */
  id: string
  text: string
  trigger: FlavorTrigger
}

export function useFlavorBubble(opts: UseFlavorBubbleOptions): {
  line: FlavorBubble | null
  dismiss: () => void
} {
  const [line, setLine] = useState<FlavorBubble | null>(null)

  // setTimeout/event handlers registered once but fired seconds later need
  // the LATEST opts, not the snapshot at registration time. Mirror every
  // option into a ref so handlers consult current values when they fire.
  const enabledRef = useRef(opts.enabled)
  const suppressedRef = useRef(opts.suppressed)
  const leaderRef = useRef(opts.leaderName)
  const viewerRef = useRef(opts.viewerName)
  const partnerRef = useRef(opts.partnerName)
  const userIdRef = useRef(opts.userId)
  const householdIdRef = useRef(opts.householdId)
  const tzRef = useRef(opts.tz)
  useEffect(() => { enabledRef.current = opts.enabled }, [opts.enabled])
  useEffect(() => { suppressedRef.current = opts.suppressed }, [opts.suppressed])
  useEffect(() => { leaderRef.current = opts.leaderName }, [opts.leaderName])
  useEffect(() => { viewerRef.current = opts.viewerName }, [opts.viewerName])
  useEffect(() => { partnerRef.current = opts.partnerName }, [opts.partnerName])
  useEffect(() => { userIdRef.current = opts.userId }, [opts.userId])
  useEffect(() => { householdIdRef.current = opts.householdId }, [opts.householdId])
  useEffect(() => { tzRef.current = opts.tz }, [opts.tz])

  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recentIdsRef = useRef<string[]>([])
  const lastFoodRef = useRef<FoodKey | null>(null)
  // greeting fires once/session; when it does it mutes the gap_24h line.
  const greetedRef = useRef(false)
  const gapSuppressedRef = useRef(false)

  const dismiss = useCallback(() => {
    setLine(null)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }, [])

  // Substitute {leader} / {other} — returns null if substitution can't resolve
  // so the caller silently drops the line and tries the next pick.
  const renderLine = useCallback((tpl: FlavorLine): FlavorBubble | null => {
    let text = tpl.text
    if (text.includes('{viewer}')) {
      if (!viewerRef.current) return null
      text = text.replace(/\{viewer\}/g, viewerRef.current)
    }
    if (text.includes('{leader}')) {
      if (!leaderRef.current) return null
      text = text.replace(/\{leader\}/g, leaderRef.current)
    }
    if (text.includes('{other}')) {
      const other = leaderRef.current === viewerRef.current ? partnerRef.current : viewerRef.current
      if (!other) return null
      text = text.replace(/\{other\}/g, other)
    }
    return { id: tpl.id, text, trigger: tpl.trigger }
  }, [])

  const show = useCallback((bubble: FlavorBubble) => {
    if (!enabledRef.current || suppressedRef.current || document.hidden) return
    setLine(bubble)
    recentIdsRef.current.push(bubble.id)
    if (recentIdsRef.current.length > RECENT_HISTORY_CAP) recentIdsRef.current.shift()
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setLine(null), BUBBLE_VISIBLE_MS)
  }, [])

  // Pick a line for the given pool (specific trigger) or the "idle-pool"
  // composite that occasionally splices in needs_leader / rare_intro.
  const pickAndShow = useCallback((source: FlavorTrigger | 'idle-pool') => {
    let pool: FlavorLine[]
    if (source === 'idle-pool') {
      const hasLeader = !!leaderRef.current && leaderRef.current !== viewerRef.current
      const r = Math.random()
      if (hasLeader && r < RARE_INTRO_CHANCE) {
        pool = FLAVOR_LINES.filter(l => l.trigger === 'rare_intro')
      } else if (hasLeader && r < NEEDS_LEADER_CHANCE) {
        pool = FLAVOR_LINES.filter(l => l.trigger === 'needs_leader')
      } else {
        const dp = getDaypart()
        pool = FLAVOR_LINES.filter(l => l.trigger === 'idle' && daypartOk(l, dp))
      }
    } else {
      pool = FLAVOR_LINES.filter(l => l.trigger === source)
    }
    // Prefer lines we haven't shown recently; fall back to the full pool if
    // they've all been used in the recent window.
    const fresh = pool.filter(l => !recentIdsRef.current.includes(l.id))
    const tpl = pickRand(fresh.length ? fresh : pool)
    if (!tpl) return
    const rendered = renderLine(tpl)
    if (rendered) show(rendered)
  }, [renderLine, show])

  // Greeting: pick the band whose [minHours, maxHours) contains hoursSince.
  const showGreeting = useCallback((hoursSince: number) => {
    const pool = FLAVOR_LINES.filter(l =>
      l.trigger === 'greeting' &&
      hoursSince >= (l.minHours ?? 0) &&
      (l.maxHours === undefined || hoursSince < l.maxHours))
    const tpl = pickRand(pool)
    if (!tpl) return
    const rendered = renderLine(tpl)
    if (rendered) show(rendered)
  }, [renderLine, show])

  // Daily quip: the same deterministic quirk for both partners, shown once per
  // local day. Returns true if it displayed (so the idle tick skips its random
  // line). Won't consume the day's quip while suppressed/hidden.
  const maybeShowDailyQuip = useCallback((): boolean => {
    if (!enabledRef.current || suppressedRef.current || document.hidden) return false
    const hid = householdIdRef.current
    if (!hid) return false
    const today = dateKey(new Date(), tzRef.current)
    try {
      if (localStorage.getItem(QUIP_SHOWN_KEY) === today) return false
    } catch { return false }
    const quip = quipOfTheDay({ date: new Date(), householdId: hid, tz: tzRef.current })
    show({ id: quip.id, text: quip.text, trigger: 'idle' })
    try { localStorage.setItem(QUIP_SHOWN_KEY, today) } catch { /* ignore */ }
    return true
  }, [show])

  // ── Idle cycle: schedules the next bubble 60–90s out (or 120–180s when
  // quiet_eren_optin is on), recurses forever.
  useEffect(() => {
    if (!opts.enabled) return
    const multiplier = opts.quietEren ? 2 : 1
    let first = true
    const tick = () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current)
      const delay = first
        ? range(FIRST_LINE_MIN_MS * multiplier, FIRST_LINE_MAX_MS * multiplier)
        : range(IDLE_CYCLE_MIN_MS * multiplier, IDLE_CYCLE_MAX_MS * multiplier)
      first = false
      cycleTimerRef.current = setTimeout(() => {
        if (!maybeShowDailyQuip()) pickAndShow('idle-pool')
        tick()
      }, delay)
    }
    tick()
    return () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current)
    }
  }, [opts.enabled, opts.quietEren, pickAndShow, maybeShowDailyQuip])

  // ── greeting: once per session, named, keyed to hours since THIS viewer last
  // cared. Suppresses gap_24h when it fires so a returning partner gets one
  // warm line, not two.
  useEffect(() => {
    if (!opts.enabled || greetedRef.current) return
    const uid = opts.userId
    if (!uid) return
    let hoursSince = Infinity
    try {
      const stamp = localStorage.getItem(`eren:last-care-by:${uid}`)
      if (!stamp) return // no history yet → let idle / gap handle it
      hoursSince = (Date.now() - Number(stamp)) / 3_600_000
    } catch { return }
    if (hoursSince < 10) return // too soon to remark
    greetedRef.current = true
    gapSuppressedRef.current = true
    const t = setTimeout(() => showGreeting(hoursSince), GREETING_DELAY_MS)
    return () => clearTimeout(t)
  }, [opts.enabled, opts.userId, showGreeting])

  // ── gap_24h: fires once on first eligible tick of the session if the last
  // seen stamp is 24h+ old (and the greeting didn't already welcome them). The
  // stamp updates continuously below, so a normal session never trips this.
  useEffect(() => {
    if (!opts.enabled) return
    try {
      const last = localStorage.getItem(LAST_SEEN_KEY)
      const gap = last ? Date.now() - Number(last) : Infinity
      if (gap >= GAP_24H_MS && !gapSuppressedRef.current) {
        // Delay 2.5s so the bubble doesn't clash with the post-mood toast.
        const t = setTimeout(() => { if (!gapSuppressedRef.current) pickAndShow('gap_24h') }, 2_500)
        return () => clearTimeout(t)
      }
    } catch { /* localStorage disabled / quota — silently skip */ }
  }, [opts.enabled, pickAndShow])

  // ── Stamp last-seen continuously so the 24h gap check above can detect a
  // real absence rather than a tab reload.
  useEffect(() => {
    if (!opts.enabled) return
    try { localStorage.setItem(LAST_SEEN_KEY, String(Date.now())) } catch { /* ignore */ }
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        try { localStorage.setItem(LAST_SEEN_KEY, String(Date.now())) } catch { /* ignore */ }
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [opts.enabled])

  // ── Hard-hide the bubble when wish (or anything else) suppresses us.
  useEffect(() => {
    if (opts.suppressed && line) {
      setLine(null)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [opts.suppressed, line])

  // ── Contextual triggers: after_positive + duplicate_feed.
  useEffect(() => {
    if (!opts.enabled) return

    const schedule = (trigger: FlavorTrigger) => {
      setTimeout(() => pickAndShow(trigger), range(TRIGGER_DELAY_MIN_MS, TRIGGER_DELAY_MAX_MS))
    }

    const onPet = () => schedule('after_positive')
    const onMyAction = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { action_type?: string } | undefined
      if (!detail?.action_type) return
      if (['feed', 'play', 'sleep', 'wash', 'medicine'].includes(detail.action_type)) {
        const uid = userIdRef.current
        if (uid) { try { localStorage.setItem(`eren:last-care-by:${uid}`, String(Date.now())) } catch { /* ignore */ } }
        schedule('after_positive')
      }
    }
    const onFedFood = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { food?: FoodKey } | undefined
      if (!detail?.food) return
      if (lastFoodRef.current && lastFoodRef.current === detail.food) {
        schedule('duplicate_feed')
      }
      lastFoodRef.current = detail.food
    }

    window.addEventListener('eren:pet', onPet)
    window.addEventListener('eren:my-action', onMyAction)
    window.addEventListener('eren:fed-food', onFedFood)
    return () => {
      window.removeEventListener('eren:pet', onPet)
      window.removeEventListener('eren:my-action', onMyAction)
      window.removeEventListener('eren:fed-food', onFedFood)
    }
  }, [opts.enabled, pickAndShow])

  return { line, dismiss }
}
