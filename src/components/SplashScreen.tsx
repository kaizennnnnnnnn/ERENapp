'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { PageSkeleton } from './loading/LoadingSkeleton'

const PUBLIC_DOCS = ['/privacy', '/terms', '/delete-account']
const MAX_VISIBLE_MS = 8000
const CLAIM_GRACE_MS = 400

export default function SplashScreen() {
  const pathname = usePathname()
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing')
  const fadedRef = useRef(false)
  const claimedRef = useRef(false)

  useEffect(() => {
    const beginFade = () => {
      if (fadedRef.current) return
      fadedRef.current = true
      setPhase('fading')
    }
    const onBusy = () => { claimedRef.current = true }
    window.addEventListener('eren:app-ready', beginFade)
    window.addEventListener('eren:app-busy', onBusy)

    // Data-driven pages claim boot until ready. Synchronous pages need only
    // a settling tick for hydration, never an artificial minimum animation.
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
      window.removeEventListener('eren:app-ready', beginFade)
      window.removeEventListener('eren:app-busy', onBusy)
      window.removeEventListener('load', decide)
      window.clearTimeout(graceTimer)
      window.clearTimeout(safety)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'fading') return
    const timer = window.setTimeout(() => setPhase('done'), 180)
    return () => window.clearTimeout(timer)
  }, [phase])

  if (PUBLIC_DOCS.some(p => pathname?.startsWith(p)) || phase === 'done') return null
  return <div className="eren-boot-skeleton" style={{ opacity: phase === 'fading' ? 0 : 1, pointerEvents: phase === 'fading' ? 'none' : 'auto' }}>
    <PageSkeleton path={pathname ?? '/home'} />
    <style>{`
      .eren-boot-skeleton { position: fixed; inset: 0; z-index: 9999; overflow: hidden; transition: opacity 180ms ease-out; }
      @media (min-width: 481px) {
        .eren-boot-skeleton { inset: auto; left: 50%; top: 50%; width: 430px; height: min(100dvh, 932px); transform: translate(-50%, -50%); border-radius: 28px; }
      }
      @media (prefers-reduced-motion: reduce) { .eren-boot-skeleton { transition: none; } }
    `}</style>
  </div>
}
