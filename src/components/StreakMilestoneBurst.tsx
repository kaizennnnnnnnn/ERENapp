'use client'

// ═════════════════════════════════════════════════════════════════════════════
// StreakMilestoneBurst — flame-gold spark burst when a streak milestone lands.
// Listens for `eren:streak-milestone` (dispatched by TaskContext) and blooms
// where the AchievementToast appears, so toast + burst read as one celebration.
//
// Structural sibling of ErenGrantBurst (same re-key + auto-clear pattern);
// mounted once in (app)/layout.tsx. Pure presentational.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'

const SPARK_COUNT = 18
const RADIUS = 130   // distance each spark travels outward, in px
const DURATION_MS = 1100

export default function StreakMilestoneBurst() {
  const [burstKey, setBurstKey] = useState(0)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onMilestone = () => {
      setBurstKey(k => k + 1)
      setActive(true)
      setTimeout(() => setActive(false), DURATION_MS + 100)
    }
    window.addEventListener('eren:streak-milestone', onMilestone)
    return () => window.removeEventListener('eren:streak-milestone', onMilestone)
  }, [])

  if (!active) return null

  const sparks = Array.from({ length: SPARK_COUNT }, (_, i) => {
    const angle = (i / SPARK_COUNT) * Math.PI * 2 - Math.PI / 2
    return {
      dx: Math.cos(angle) * RADIUS,
      dy: Math.sin(angle) * RADIUS,
      delay: (i % 3) * 40,
      large: i % 2 === 0,
      hot: i % 3 === 0,     // alternate deep-orange sparks between the golds
    }
  })

  return (
    <div
      key={burstKey}
      className="fixed pointer-events-none"
      style={{
        // Blooms where the AchievementToast lands (top-center under the HUD).
        top: 'calc(var(--safe-top) + 64px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 70,
        width: 0,
        height: 0,
      }}
    >
      {sparks.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: s.large ? 14 : 10,
            height: s.large ? 14 : 10,
            transform: 'translate(-50%, -50%) scale(0)',
            animation: `streakBurstSpark ${DURATION_MS}ms ease-out ${s.delay}ms forwards`,
            ['--tx' as string]: `${s.dx}px`,
            ['--ty' as string]: `${s.dy}px`,
          } as React.CSSProperties}
        >
          <svg width="100%" height="100%" viewBox="0 0 14 14" shapeRendering="crispEdges">
            <rect x="5" y="0" width="4" height="4" fill={s.hot ? '#FF6B00' : '#FFB347'} />
            <rect x="0" y="5" width="4" height="4" fill={s.hot ? '#FF6B00' : '#FFB347'} />
            <rect x="10" y="5" width="4" height="4" fill={s.hot ? '#FF6B00' : '#FFB347'} />
            <rect x="5" y="10" width="4" height="4" fill={s.hot ? '#FF6B00' : '#FFB347'} />
            <rect x="5" y="5" width="4" height="4" fill="#FFF7E6" />
          </svg>
        </div>
      ))}

      {/* Warm haze bloom behind the sparks. */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: 190, height: 190,
          transform: 'translate(-50%, -50%) scale(0)',
          background: 'radial-gradient(closest-side, rgba(255,140,50,0.45), rgba(255,140,50,0) 75%)',
          animation: `streakBurstGlow ${DURATION_MS}ms ease-out forwards`,
        }}
      />

      <style jsx global>{`
        @keyframes streakBurstSpark {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          15%  { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          60%  { transform: translate(
                   calc(-50% + var(--tx) * 0.75),
                   calc(-50% + var(--ty) * 0.75)
                 ) scale(1.3); opacity: 1; }
          100% { transform: translate(
                   calc(-50% + var(--tx)),
                   calc(-50% + var(--ty))
                 ) scale(0); opacity: 0; }
        }
        @keyframes streakBurstGlow {
          0%   { transform: translate(-50%, -50%) scale(0);    opacity: 0; }
          25%  { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.25); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
