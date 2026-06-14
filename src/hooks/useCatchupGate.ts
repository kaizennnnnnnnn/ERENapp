'use client'

// ═════════════════════════════════════════════════════════════════════════════
// useCatchupGate — Phase 3 PR 8
//
// Triggers the catchup endpoint exactly once per profile, returns the frames
// it discovered so home can mount the CatchupCarousel. The gate keys on
// profiles.memory_caught_up which the carousel itself stamps after dismissal —
// the endpoint never sets that flag, only catchup_pushed_at, so a user who
// closes the app mid-carousel still gets it next session.
//
// Idle behaviour: returns { frames: null } until the gate decides to fire,
// then transitions to { frames: [...] } when the API responds. After dismiss,
// the caller calls dismiss() which clears state and prevents re-fire within
// the same session.
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface CatchupFrame { frame_id: string, unlocked_at: string }

export function useCatchupGate(opts: {
  userId:      string | null
  householdId: string | null
  /** Set false to suspend (e.g. while auth is still loading). */
  ready:       boolean
}): {
  frames: CatchupFrame[] | null
  dismiss: () => void
} {
  const supabase = createClient()
  const [frames, setFrames] = useState<CatchupFrame[] | null>(null)
  const triedRef = useRef(false)
  const dismissedRef = useRef(false)

  const dismiss = useCallback(() => {
    dismissedRef.current = true
    setFrames(null)
  }, [])

  useEffect(() => {
    if (!opts.ready) return
    if (!opts.userId || !opts.householdId) return
    if (triedRef.current || dismissedRef.current) return
    triedRef.current = true

    let cancelled = false
    void (async () => {
      // Check the flag first — avoids a needless API hit for users who've
      // already been caught up. Errors here just fall through and trigger
      // the endpoint anyway (which is idempotent).
      let caughtUp = false
      try {
        const { data } = await supabase
          .from('profiles')
          .select('memory_caught_up')
          .eq('id', opts.userId!)
          .maybeSingle()
        caughtUp = data?.memory_caught_up === true
      } catch { /* ignore */ }
      if (cancelled) return
      if (caughtUp) return

      // Fire-and-forget the catchup. On success, frames flips and the
      // carousel mounts; on failure we silently bail so the rest of home
      // isn't blocked.
      try {
        const res = await fetch('/api/memory/catchup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ user_id: opts.userId, household_id: opts.householdId }),
        })
        if (!res.ok) return
        const body = await res.json() as { skipped: boolean, frames: CatchupFrame[] }
        if (cancelled) return
        if (body.skipped) return
        // Show the carousel even if frames is empty — the intro + outro alone
        // tell the user the wall is now their thing to fill up.
        setFrames(body.frames ?? [])
        // If the backfill actually populated the wall, ping the partner once
        // (fire-and-forget; the route is idempotent per recipient).
        if ((body.frames?.length ?? 0) > 0) {
          void fetch('/api/notify-catchup', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ user_id: opts.userId, household_id: opts.householdId }),
          }).catch(() => { /* best-effort */ })
        }
      } catch { /* network err — try again next mount */ triedRef.current = false }
    })()

    return () => { cancelled = true }
  }, [opts.ready, opts.userId, opts.householdId, supabase])

  return { frames, dismiss }
}
