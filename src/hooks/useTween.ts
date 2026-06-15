'use client'

import { useEffect, useRef, useState } from 'react'

// ─── useTween ───────────────────────────────────────────────────────────────
// Animate a number toward `target` with an ease-out curve, returning the
// in-flight value each frame (rAF-driven). Used by the HUD so XP and coins
// roll up smoothly instead of snapping.
//
// It deliberately SNAPS — no animation — on mount and on the initial hydration
// from 0 (the page-load / profile-load case), so opening the app doesn't replay
// the whole fill from zero. Real in-session gains (X → X+delta) animate. A
// retarget mid-flight continues from the current value, so chained gains chain
// smoothly. Respects prefers-reduced-motion.

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function useTween(target: number, duration = 800): number {
  const [value, setValue] = useState(target)
  const valueRef = useRef(target)
  const mountedRef = useRef(false)

  useEffect(() => {
    const from = valueRef.current

    // Snap on first run, on the 0→real hydration, or when motion is reduced.
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!mountedRef.current || from === 0 || reduce) {
      mountedRef.current = true
      valueRef.current = target
      setValue(target)
      return
    }
    if (from === target) return

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const v = from + (target - from) * easeOutCubic(t)
      valueRef.current = v
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(tick)
      else { valueRef.current = target; setValue(target) }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
