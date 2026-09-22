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
    if (typeof window === 'undefined') return
    // Not ready yet: CLAIM the splash. Without this the splash cannot tell a
    // page that is still fetching from a page that was never going to signal
    // at all, so it had to assume the former and wait out the full 8s safety
    // net for both. Claiming makes the quiet case the cheap one — see
    // SplashScreen, which now dismisses on load when nothing has claimed it.
    if (!ready) {
      window.dispatchEvent(new Event('eren:app-busy'))
      return
    }
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
