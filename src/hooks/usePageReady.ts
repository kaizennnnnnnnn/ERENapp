'use client'

// ═════════════════════════════════════════════════════════════════════════════
// usePageReady — signal that the current page has finished loading every asset
// it needs to render without a flash. Fires a `eren:app-ready` window event on
// the next paint tick after `ready` flips true, which the SplashScreen listens
// for to know when it's safe to dismiss itself. Without this, the splash
// disappears on a hardcoded timer and you see a half-painted home for a beat
// (no Eren / no background) before the images decode.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect } from 'react'

export function usePageReady(ready: boolean) {
  useEffect(() => {
    if (!ready) return
    if (typeof window === 'undefined') return
    // rAF + microtask wait — guarantees the new paint has committed before we
    // tell the splash it's safe to fade. Belt-and-braces; on its own onload
    // doesn't, and React's commit can land just before the browser paints.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('eren:app-ready'))
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [ready])
}
