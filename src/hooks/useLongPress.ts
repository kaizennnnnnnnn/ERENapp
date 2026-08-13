'use client'

import { useCallback, useRef } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// LONG PRESS — hold a thing to inspect it.
// ──────────────────────────────────────────────────────────────────────────
// Press-and-hold is the only spare gesture left on a food tile: tap already
// picks it up and drag already carries it to Eren. So "what does this actually
// do?" hangs off the hold.
//
// The two things that make a hold feel right rather than fussy:
//   - a little finger drift is still a hold, but a real drag or a scroll is not
//   - the click the browser fires when you let go belongs to the HOLD, not to a
//     tap, so whatever the tap would have done must be skipped exactly once
// ═══════════════════════════════════════════════════════════════════════════

/** Long enough not to fire on a clumsy tap, short enough not to feel broken. */
const HOLD_MS = 420

/** Finger drift still counted as holding still. */
const SLOP = 10

export function useLongPress<T>(onLongPress: (item: T) => void) {
  const timer = useRef<number | null>(null)
  const origin = useRef({ x: 0, y: 0 })
  const fired = useRef(false)

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const bind = useCallback((item: T) => ({
    onPointerDown: (e: React.PointerEvent) => {
      // Clearing the flag here is what keeps a hold from poisoning the NEXT
      // tap: a hold that nobody consumed would otherwise still be pending.
      fired.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      cancel()
      timer.current = window.setTimeout(() => {
        timer.current = null
        fired.current = true
        onLongPress(item)
      }, HOLD_MS)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (timer.current === null) return
      if (Math.abs(e.clientX - origin.current.x) > SLOP ||
          Math.abs(e.clientY - origin.current.y) > SLOP) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // Otherwise a hold on mobile raises the OS "copy / share" menu over the card
    // we just opened.
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault() },
  }), [cancel, onLongPress])

  /** True once per fired hold — call it from the tap handler and bail if set. */
  const consumed = useCallback(() => {
    const f = fired.current
    fired.current = false
    return f
  }, [])

  return { bind, consumed }
}
