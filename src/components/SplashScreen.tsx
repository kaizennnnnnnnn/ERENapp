'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import AnimatedEren from './AnimatedEren'

const PUBLIC_DOCS = ['/privacy', '/terms', '/delete-account']
const MIN_VISIBLE_MS = 1200
const MAX_VISIBLE_MS = 8000
const CLAIM_GRACE_MS = 400

export default function SplashScreen() {
  const pathname = usePathname()
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing')
  const claimedRef = useRef(false)

  useEffect(() => {
    const startedAt = Date.now()
    let fadeTimer = 0
    let fading = false
    const beginFade = () => {
      if (fading) return
      fading = true
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt))
      if (remaining === 0) setPhase('fading')
      else fadeTimer = window.setTimeout(() => setPhase('fading'), remaining)
    }
    const onBusy = () => { claimedRef.current = true }
    window.addEventListener('eren:app-ready', beginFade)
    window.addEventListener('eren:app-busy', onBusy)

    // The branded opening plays once per app boot. Page navigation keeps its
    // own skeletons; data-driven pages can hold boot until they are ready.
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
      window.clearTimeout(fadeTimer)
      window.clearTimeout(safety)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'fading') return
    const timer = window.setTimeout(() => setPhase('done'), 400)
    return () => window.clearTimeout(timer)
  }, [phase])

  if (PUBLIC_DOCS.some(p => pathname?.startsWith(p)) || phase === 'done') return null
  return <div role="status" aria-label="Loading Eren" className="eren-boot-splash" style={{ opacity: phase === 'fading' ? 0 : 1, pointerEvents: phase === 'fading' ? 'none' : 'auto' }}>
    <AnimatedEren px={4} />
    <h1 className="font-pixel" style={{ color: '#FFFFFF', fontSize: 11, letterSpacing: 0, opacity: .85, margin: 0 }}>EREN</h1>
    <div aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
      {[0, 1, 2].map(i => <span key={i} className="eren-boot-dot" style={{ animationDelay: `${i * .15}s` }} />)}
    </div>
    <style>{`
      .eren-boot-splash { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; overflow: hidden; background: #0F0A1E; transition: opacity 400ms ease-out; }
      .eren-boot-dot { display: block; width: 4px; height: 4px; border-radius: 50%; background: #A78BFA; animation: erenBootDot 1s ease-in-out infinite; }
      @keyframes erenBootDot { 0%,100% { opacity: .2; } 50% { opacity: 1; } }
      @media (min-width: 481px) {
        .eren-boot-splash { inset: auto; left: 50%; top: 50%; width: 430px; height: min(100dvh, 932px); transform: translate(-50%, -50%); border-radius: 28px; }
      }
      @media (prefers-reduced-motion: reduce) { .eren-boot-splash { transition: none; } .eren-boot-dot { animation: none; opacity: .6; } }
    `}</style>
  </div>
}
