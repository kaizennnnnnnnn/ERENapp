'use client'

// ═══════════════════════════════════════════════════════════════════════════
// RESUMING A BEAT — how a one-shot survives being looked away from.
// ──────────────────────────────────────────────────────────────────────────
// The window wall's overlays are rendered only while you are FACING the
// window. Turn to the fridge and back and every one of them has been
// unmounted and mounted again, so any finite animation inside starts over: a
// customer climbs out of the sill a second time, a receipt prints again, a
// handful of coins is thrown at a jar that has already been paid, the sleeve
// sweeps a window you wiped a minute ago.
//
// The cure is to resume rather than to replay. Stamp the moment a beat began
// somewhere that SURVIVES the remount — KioskInterior, which is above the
// wall — and subtract the elapsed time from every animation-delay in the
// thing that doesn't. A negative delay starts an animation partway through,
// which is exactly the behaviour wanted and costs nothing.
//
// Two halves, because they live on opposite sides of the boundary:
// `useBeat` makes the stamp up where it is safe, `useResume` reads it down
// where it isn't.
//
// FREEZING IS THE POINT. These components re-render constantly while their
// animations run — the mist thickens, the patience meter drains, the jar
// fills. A delay recomputed from a live clock on each of those renders would
// rewrite the inline style and restart the very animation it was meant to
// preserve. Both hooks therefore sample the clock ONCE per beat and hold it.
//
// Safe to hold the end frame: every keyframe these drive was authored to
// finish at its resting state — kioskTipCoin and kioskTipLand end at
// opacity 0, kioskCustomerDuck and kioskCustomerWalk end gone, kioskCheer
// and kioskCustomerPop end square. So a delay pushed past the duration under
// a `both` fill lands on the right picture rather than freezing a coin in
// mid-air. Check this before adding a fourth caller.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'

/** A wall-clock stamp for the beat identified by `keys`, reset the moment any
 *  of them changes. Call it ABOVE whatever gets unmounted. */
export function useBeat(...keys: unknown[]): number {
  const [beat, setBeat] = useState(() => ({ keys, at: Date.now() }))
  if (beat.keys.length !== keys.length
    || beat.keys.some((k, i) => !Object.is(k, keys[i]))) {
    setBeat({ keys, at: Date.now() })
  }
  return beat.at
}

/** How far into the beat we already are, frozen. Subtract it from every
 *  animation-delay; skip any sound whose cue is already behind us. */
export function useResume(startedAt: number): number {
  const [seen, setSeen] = useState(startedAt)
  const [elapsed, setElapsed] = useState(() => Math.max(0, Date.now() - startedAt))
  if (seen !== startedAt) {
    setSeen(startedAt)
    setElapsed(Math.max(0, Date.now() - startedAt))
  }
  return elapsed
}
