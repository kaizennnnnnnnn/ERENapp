'use client'

// ═════════════════════════════════════════════════════════════════════════════
// useWishLinger — single source of truth for whether the daily-wish bubble
// belongs on screen.
//
// Pending wishes show all day. Granted wishes linger for two minutes per
// viewer, anchored at the FIRST moment this viewer could actually see the
// bubble: tab visible AND `eligible` (home past its loading/mood gates, no
// care-scene overlay covering the room, Eren awake). Without the eligibility
// gate, the one-shot window would burn behind MoodGate or a care room and
// the viewer would never see the granted bubble at all.
//
// The anchor persists in localStorage so a remount (route change, PWA
// relaunch, refresh) resumes the same countdown instead of restarting it.
// Without that, every reopen re-showed the stale bubble for another two
// minutes, which read as "it never goes away".
//
// Consumed by home/page.tsx both to mount/unmount WishCloud and to suppress
// the ambient flavor bubble while the wish bubble owns the anchor spot.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'

const GRANTED_LINGER_MS = 120_000

// Single fixed key holding { period, armedAt } — overwritten on day flip, so
// it never accumulates the way the per-period wish session keys do.
const LS_KEY = 'eren:wish:granted-seen'

function readArmedAt(periodKey: string | null): number | null {
  if (!periodKey) return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { period?: string; armedAt?: number }
    return parsed.period === periodKey && typeof parsed.armedAt === 'number'
      ? parsed.armedAt
      : null
  } catch { return null }
}

function writeArmedAt(periodKey: string, armedAt: number): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ period: periodKey, armedAt }))
  } catch { /* quota or disabled */ }
}

export function useWishLinger(
  status: 'loading' | 'pending' | 'granted',
  periodKey: string | null,
  /** True only while the bubble could actually render — home past its
   *  gates, no care scene covering the room, Eren awake. The countdown
   *  never starts while this is false. */
  eligible: boolean,
): boolean {
  // Starts false so a granted-and-already-elapsed wish never flashes for a
  // frame on mount — the effect flips it true only when time remains.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status === 'pending') { setVisible(true); return }
    if (status !== 'granted') { setVisible(false); return }

    const stored = readArmedAt(periodKey)
    if (stored != null && Date.now() - stored >= GRANTED_LINGER_MS) {
      setVisible(false)
      return
    }
    setVisible(true)

    // Not viewable yet (mood gate, loader, care room) — leave the window
    // un-armed. When eligibility flips, the dep change re-runs this effect
    // and arming resumes from the stored anchor, if any.
    if (!eligible) return

    let timer: ReturnType<typeof setTimeout> | null = null
    let armed = false

    // Schedule the hide for the wall-clock end of the window. Re-used on
    // every visibility return because a backgrounded PWA suspends timers —
    // the leftover delay would otherwise fire late and overshoot the window.
    const schedule = (armedAt: number) => {
      if (timer) clearTimeout(timer)
      const remaining = GRANTED_LINGER_MS - (Date.now() - armedAt)
      if (remaining <= 0) { setVisible(false); return }
      timer = setTimeout(() => setVisible(false), remaining)
    }

    // Arm only while the tab is actually visible: if the partner is away when
    // the grant lands, their countdown starts when they come back, not when
    // the realtime UPDATE arrived. Re-reads the anchor at arm time (not
    // effect time) — another live instance (browser tab + installed PWA)
    // may have armed and persisted while this one was hidden.
    const arm = () => {
      if (armed || document.visibilityState !== 'visible') return
      armed = true
      const current = readArmedAt(periodKey)
      const armedAt = current ?? Date.now()
      if (current == null && periodKey) writeArmedAt(periodKey, armedAt)
      schedule(armedAt)
    }

    arm()
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (!armed) { arm(); return }
      // Already armed: reschedule from the persisted wall clock so the
      // suspended timer's leftover delay can't outlive the window.
      const armedAt = readArmedAt(periodKey)
      if (armedAt != null) schedule(armedAt)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer) clearTimeout(timer)
    }
  }, [status, periodKey, eligible])

  return visible
}
