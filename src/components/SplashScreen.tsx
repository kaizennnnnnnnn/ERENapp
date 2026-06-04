'use client'

import { useState, useEffect, useRef } from 'react'
import AnimatedEren from './AnimatedEren'

// The splash holds the user's eye while the underlying page mounts, fetches,
// and decodes its assets. It hides only when:
//   1. the active page has dispatched `eren:app-ready` (set by usePageReady
//      once its critical assets are decoded and committed to paint),
//   2. AND a minimum visible time has elapsed so the splash never
//      blinks out mid-animation,
//   3. OR a maximum visible time has elapsed as a safety net so a broken
//      page can't strand the user on the splash forever.
const MIN_VISIBLE_MS = 1200
const MAX_VISIBLE_MS = 8000

export default function SplashScreen() {
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing')
  const mountedAtRef = useRef(Date.now())
  const fadedRef = useRef(false)

  useEffect(() => {
    const beginFade = () => {
      if (fadedRef.current) return
      fadedRef.current = true
      const elapsed = Date.now() - mountedAtRef.current
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)
      window.setTimeout(() => setPhase('fading'), wait)
    }

    const onReady = () => beginFade()
    window.addEventListener('eren:app-ready', onReady)
    const safety = window.setTimeout(beginFade, MAX_VISIBLE_MS)

    return () => {
      window.removeEventListener('eren:app-ready', onReady)
      window.clearTimeout(safety)
    }
  }, [])

  useEffect(() => {
    if (phase === 'fading') {
      const t = setTimeout(() => setPhase('done'), 400)
      return () => clearTimeout(t)
    }
  }, [phase])

  if (phase === 'done') return null

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
