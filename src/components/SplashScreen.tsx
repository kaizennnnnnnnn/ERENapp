'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import AnimatedEren from './AnimatedEren'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { M } from './meadow/tokens'

const PUBLIC_DOCS = ['/privacy', '/terms', '/delete-account']
const MIN_VISIBLE_MS = 1200
const MAX_VISIBLE_MS = 8000
const CLAIM_GRACE_MS = 400

export default function SplashScreen() {
  const pathname = usePathname()
  const reducedMotion = useReducedMotion()
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
  return <div role="status" aria-label="Loading Eren" className="meadow-root eren-boot-splash" data-phase={phase} style={{ opacity: phase === 'fading' ? 0 : 1, pointerEvents: phase === 'fading' ? 'none' : 'auto' }}>
    <div className="eren-boot-content">
      <div className="eren-boot-mascot" aria-hidden="true">
        <AnimatedEren px={6} glow={false} animate={!reducedMotion} />
      </div>
      <h1 className="eren-boot-title">Eren</h1>
      <div className="eren-boot-progress" aria-hidden="true"><span /></div>
    </div>
    <p className="eren-boot-status" aria-hidden="true">Getting ready</p>
    <style>{`
      .eren-boot-splash { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: max(32px, env(safe-area-inset-top, 0px)) 24px max(32px, env(safe-area-inset-bottom, 0px)); overflow: hidden; background: #111714; color: #F5F7F3; transition: opacity 400ms ease-out; }
      .eren-boot-content { display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 280px; margin-top: -28px; animation: erenBootArrive 500ms ease-out both; }
      .eren-boot-mascot { display: flex; align-items: center; justify-content: center; width: 150px; height: 120px; }
      .eren-boot-title { margin: 20px 0 0; font-size: 34px; font-weight: 800; line-height: 1.15; letter-spacing: 0; color: inherit; }
      .eren-boot-progress { width: 120px; height: 3px; margin-top: 30px; border-radius: 999px; overflow: hidden; background: rgba(245,247,243,.12); }
      .eren-boot-progress span { display: block; width: 36%; height: 100%; border-radius: inherit; background: ${M.tuft}; animation: erenBootSweep 1.8s cubic-bezier(.4,0,.2,1) infinite; }
      .eren-boot-splash[data-phase="fading"] .eren-boot-progress span { width: 100%; transform: none; animation: none; transition: width 160ms ease-out; }
      .eren-boot-status { position: absolute; bottom: max(42px, calc(env(safe-area-inset-bottom, 0px) + 24px)); left: 24px; right: 24px; margin: 0; text-align: center; font-size: 13px; font-weight: 500; line-height: 1.4; letter-spacing: 0; color: #A9B4AC; }
      @keyframes erenBootArrive { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes erenBootSweep { from { transform: translateX(-110%); } to { transform: translateX(390%); } }
      @media (min-width: 481px) {
        .eren-boot-splash { inset: auto; left: 50%; top: 50%; width: 430px; height: min(100dvh, 932px); transform: translate(-50%, -50%); border-radius: 28px; }
      }
      @media (prefers-reduced-motion: reduce) { .eren-boot-splash { transition: none; } .eren-boot-content { animation: none; } .eren-boot-progress span { animation: none; transform: none; } }
    `}</style>
  </div>
}
