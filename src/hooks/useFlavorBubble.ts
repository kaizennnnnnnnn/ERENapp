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
import type { FoodKey } from '@/types'

const IDLE_CYCLE_MIN_MS = 60_000
const IDLE_CYCLE_MAX_MS = 90_000
const BUBBLE_VISIBLE_MS = 5_500
const TRIGGER_DELAY_MIN_MS = 4_000
const TRIGGER_DELAY_MAX_MS = 8_000
const GAP_24H_MS = 24 * 60 * 60 * 1000
const LAST_SEEN_KEY = 'eren:flavor:last-seen'
const RARE_INTRO_CHANCE = 0.04
const NEEDS_LEADER_CHANCE = 0.25
const RECENT_HISTORY_CAP = 4

const range = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min))
const pickRand = <T,>(arr: T[]): T | null => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null)

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
  useEffect(() => { enabledRef.current = opts.enabled }, [opts.enabled])
  useEffect(() => { suppressedRef.current = opts.suppressed }, [opts.suppressed])
  useEffect(() => { leaderRef.current = opts.leaderName }, [opts.leaderName])
  useEffect(() => { viewerRef.current = opts.viewerName }, [opts.viewerName])
  useEffect(() => { partnerRef.current = opts.partnerName }, [opts.partnerName])

  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recentIdsRef = useRef<string[]>([])
  const lastFoodRef = useRef<FoodKey | null>(null)

  const dismiss = useCallback(() => {
    setLine(null)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }, [])

  // Substitute {leader} / {other} — returns null if substitution can't resolve
  // so the caller silently drops the line and tries the next pick.
  const renderLine = useCallback((tpl: FlavorLine): FlavorBubble | null => {
    let text = tpl.text
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
        pool = FLAVOR_LINES.filter(l => l.trigger === 'idle')
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

  // ── Idle cycle: schedules the next bubble 60–90s out (or 120–180s when
  // quiet_eren_optin is on), recurses forever.
  useEffect(() => {
    if (!opts.enabled) return
    const multiplier = opts.quietEren ? 2 : 1
    const tick = () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current)
      cycleTimerRef.current = setTimeout(() => {
        pickAndShow('idle-pool')
        tick()
      }, range(IDLE_CYCLE_MIN_MS * multiplier, IDLE_CYCLE_MAX_MS * multiplier))
    }
    tick()
    return () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current)
    }
  }, [opts.enabled, opts.quietEren, pickAndShow])

  // ── gap_24h: fires once on first eligible tick of the session if the last
  // seen stamp is 24h+ old. The stamp updates continuously below, so a normal
  // session never trips this.
  useEffect(() => {
    if (!opts.enabled) return
    try {
      const last = localStorage.getItem(LAST_SEEN_KEY)
      const gap = last ? Date.now() - Number(last) : Infinity
      if (gap >= GAP_24H_MS) {
        // Delay 2.5s so the bubble doesn't clash with the post-mood toast.
        const t = setTimeout(() => pickAndShow('gap_24h'), 2_500)
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
