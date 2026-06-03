'use client'

// ═════════════════════════════════════════════════════════════════════════════
// ErenGrantBurst — celebratory gold-sparkle burst centered on Eren when a
// daily wish is granted. Listens for the `eren:wish-granted` window event
// and re-keys the burst so the keyframes restart for every grant.
//
// Lives on home alongside the Eren sprite. Pure presentational.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'

const SPARK_COUNT = 14
const RADIUS = 110   // distance each spark travels outward, in px
const DURATION_MS = 1000

export default function ErenGrantBurst() {
  const [burstKey, setBurstKey] = useState(0)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onGranted = () => {
      setBurstKey(k => k + 1)
      setActive(true)
      // Auto-clear so the layer disappears from the DOM after the animation
      // ends — keeps the home tree tiny and avoids accidental pointer hits.
      setTimeout(() => setActive(false), DURATION_MS + 100)
    }
    window.addEventListener('eren:wish-granted', onGranted)
    return () => window.removeEventListener('eren:wish-granted', onGranted)
  }, [])

  if (!active) return null

  // Each spark gets a unique outward direction. Alternating sizes + tiny
  // start delays so the burst reads as a tumble, not a uniform ring.
  const sparks = Array.from({ length: SPARK_COUNT }, (_, i) => {
    const angle = (i / SPARK_COUNT) * Math.PI * 2 - Math.PI / 2
    return {
      dx: Math.cos(angle) * RADIUS,
      dy: Math.sin(angle) * RADIUS,
      delay: (i % 3) * 40,
      large: i % 2 === 0,
    }
  })

  return (
    <div
      key={burstKey}
      className="fixed pointer-events-none"
      style={{
        // Centered on Eren's sticker (bottom 10%, left 50% in home/page.tsx).
        // We offset up by ~90px so the burst origin lands on Eren's mid-body
        // rather than under his paws.
        bottom: 'calc(10% + 80px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5,
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
            animation: `erenBurstSpark ${DURATION_MS}ms ease-out ${s.delay}ms forwards`,
            ['--tx' as string]: `${s.dx}px`,
            ['--ty' as string]: `${s.dy}px`,
          } as React.CSSProperties}
        >
          <svg width="100%" height="100%" viewBox="0 0 14 14" shapeRendering="crispEdges">
            <rect x="5" y="0" width="4" height="4" fill="#F5C842" />
            <rect x="0" y="5" width="4" height="4" fill="#F5C842" />
            <rect x="10" y="5" width="4" height="4" fill="#F5C842" />
            <rect x="5" y="10" width="4" height="4" fill="#F5C842" />
            <rect x="5" y="5" width="4" height="4" fill="#FFFBEB" />
          </svg>
        </div>
      ))}

      {/* Inner haze ring — radial-gradient glow blooming behind the sparks
          for a beat of warm light on Eren himself. */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: 180, height: 180,
          transform: 'translate(-50%, -50%) scale(0)',
          background: 'radial-gradient(closest-side, rgba(255,215,90,0.55), rgba(255,215,90,0) 75%)',
          animation: `erenBurstGlow ${DURATION_MS}ms ease-out forwards`,
        }}
      />

      <style jsx global>{`
        @keyframes erenBurstSpark {
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
        @keyframes erenBurstGlow {
          0%   { transform: translate(-50%, -50%) scale(0);    opacity: 0; }
          25%  { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.25); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
