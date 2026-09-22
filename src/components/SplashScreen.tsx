'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import AnimatedEren from './AnimatedEren'

// The published documents are not the app booting. They render from the root
// layout, never mount the app shell, and so never call usePageReady — which
// left them under the splash for the whole 8s MAX_VISIBLE_MS safety net. A
// Play reviewer opening the policy URL from the Console got eight seconds of
// a black screen with a cat on it, and a curl probe of the same URL could not
// see it because the markup was there the whole time.
//
// Only these three. Roughly two dozen in-app routes also never dispatch
// `eren:app-ready` — every minigame, the arcade, the gacha, the bakery, the
// kiosk, the jelly parlour. They are not broken pages; they simply render
// synchronously and have nothing to wait for. They no longer pay the 8s for
// that: see the claim protocol below.
const PUBLIC_DOCS = ['/privacy', '/terms', '/delete-account']

// The splash holds the user's eye while the underlying page mounts, fetches,
// and decodes its assets. It hides only when:
//   1. the active page has dispatched `eren:app-ready` (set by usePageReady
//      once its critical assets are decoded and committed to paint),
//   2. AND a minimum visible time has elapsed so the splash never
//      blinks out mid-animation,
//   3. OR a maximum visible time has elapsed as a safety net so a broken
//      page can't strand the user on the splash forever.
//
// A page CLAIMS the splash by calling `usePageReady(false)` while it loads;
// usePageReady dispatches `eren:app-busy` for it. If nothing claims the boot
// by the time the document has loaded, there is nothing to wait for and the
// splash goes at the minimum. That inversion is what the two dozen silent
// routes needed: the old contract failed CLOSED, so a route that said nothing
// was indistinguishable from one still working, and a refresh on any minigame
// cost eight seconds of a cat on a black screen.
//
// The grace window is free. MIN_VISIBLE_MS already holds the splash for 1.2s,
// which is longer than the wait for `load` + a settling tick on any boot that
// was going to be fast anyway.
const MIN_VISIBLE_MS = 1200
const MAX_VISIBLE_MS = 8000
// After `load`, how long to let React's effects run before concluding that
// nobody is going to claim. Effects fire on the commit after mount, so this is
// generous; it exists so a slow hydration cannot lose a claim by a few ms.
const CLAIM_GRACE_MS = 400

export default function SplashScreen() {
  const pathname = usePathname()
  const isPublicDoc = PUBLIC_DOCS.some(p => pathname?.startsWith(p))
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing')
  const mountedAtRef = useRef(Date.now())
  const fadedRef = useRef(false)
  // A page has said it is still working, so the splash waits for its ready.
  const claimedRef = useRef(false)

  useEffect(() => {
    const beginFade = () => {
      if (fadedRef.current) return
      fadedRef.current = true
      const elapsed = Date.now() - mountedAtRef.current
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)
      window.setTimeout(() => setPhase('fading'), wait)
    }

    const onReady = () => beginFade()
    const onBusy  = () => { claimedRef.current = true }
    window.addEventListener('eren:app-ready', onReady)
    window.addEventListener('eren:app-busy', onBusy)

    // Nothing claimed the boot by the time the document finished loading, so
    // whatever route we came up on renders synchronously and is already on
    // screen behind this. Re-check after the grace window rather than deciding
    // at `load`, because on a slow hydration the claim can land just after it.
    let graceTimer = 0
    const decide = () => {
      graceTimer = window.setTimeout(() => {
        if (!claimedRef.current) beginFade()
      }, CLAIM_GRACE_MS)
    }
    if (document.readyState === 'complete') decide()
    else window.addEventListener('load', decide)

    const safety = window.setTimeout(beginFade, MAX_VISIBLE_MS)

    return () => {
      window.removeEventListener('eren:app-ready', onReady)
      window.removeEventListener('eren:app-busy', onBusy)
      window.removeEventListener('load', decide)
      window.clearTimeout(graceTimer)
      window.clearTimeout(safety)
    }
  }, [])

  useEffect(() => {
    if (phase === 'fading') {
      const t = setTimeout(() => setPhase('done'), 400)
      return () => clearTimeout(t)
    }
  }, [phase])

  // After every hook, so the hook order is identical on both kinds of route.
  if (isPublicDoc || phase === 'done') return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5"
      style={{
        background: '#0F0A1E',
        opacity: phase === 'fading' ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      <AnimatedEren px={4} />

      <h1 className="font-pixel text-white" style={{ fontSize: 11, letterSpacing: 2, opacity: 0.85 }}>
        EREN
      </h1>

      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-full" style={{
            width: 4, height: 4, background: '#A78BFA',
            animation: `splDot 1s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>

      <style jsx>{`
        @keyframes splDot {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
