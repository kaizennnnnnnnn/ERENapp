'use client'

// ─── WashPoof ────────────────────────────────────────────────────────────────
// Two bathroom-flavoured pose-swap masks, drop-in alternatives to PixelPoof:
//   • BubblePoof — a burst of soap bubbles that pop + rise. Used when SOAPING UP
//     (stand → Eren1 → Eren2 → Eren3), so each swap reads as "more lather".
//   • SplashPoof — water droplets flung outward from a quick ring. Used when
//     RINSING OFF (Eren3 → Eren2 → Eren1 → stand) and on the final wet-shake,
//     so each swap reads as "water washing it away".
//
// Same contract as PixelPoof: the parent mounts it keyed (so the keyframes
// restart), flips the underlying pose at WASH_POOF_PEAK_MS, and unmounts on
// onDone. Pure CSS/SVG — snap keyframes, hard look, no blur.

import { useEffect } from 'react'

const DURATION_MS = 470

interface Props {
  /** px size of the effect box. */
  size?: number
  /** Called after the effect finishes so the parent can unmount it. */
  onDone?: () => void
}

// Fixed bubble layout (no randomness → deterministic + SSR-safe). x/y are % of
// the box; r is a fraction of `size`. d is the stagger delay in ms.
const BUBBLES = [
  { x: 50, y: 60, r: 0.16, d: 0 },
  { x: 32, y: 50, r: 0.12, d: 40 },
  { x: 68, y: 52, r: 0.13, d: 60 },
  { x: 44, y: 38, r: 0.11, d: 90 },
  { x: 60, y: 34, r: 0.10, d: 120 },
  { x: 24, y: 66, r: 0.10, d: 70 },
  { x: 76, y: 64, r: 0.11, d: 100 },
  { x: 38, y: 70, r: 0.09, d: 140 },
  { x: 56, y: 72, r: 0.10, d: 50 },
  { x: 50, y: 24, r: 0.08, d: 160 },
  { x: 18, y: 44, r: 0.07, d: 130 },
  { x: 82, y: 46, r: 0.08, d: 110 },
]

export function BubblePoof({ size = 150, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), DURATION_MS + 40)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="absolute pointer-events-none" style={{
      left: '50%', top: '50%', width: size, height: size,
      transform: 'translate(-50%, -50%)', zIndex: 24,
    }}>
      {BUBBLES.map((b, i) => {
        const d = b.r * size
        return (
          <div key={i} className="absolute rounded-full" style={{
            left: `${b.x}%`, top: `${b.y}%`, width: d, height: d,
            marginLeft: -d / 2, marginTop: -d / 2,
            background: 'radial-gradient(circle at 35% 32%, rgba(255,255,255,0.97), rgba(196,228,255,0.7))',
            border: '1px solid rgba(150,200,255,0.6)',
            boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.85)',
            animation: `erenBubblePoof ${DURATION_MS}ms ease-out ${b.d}ms forwards`,
            opacity: 0,
          }} />
        )
      })}
    </div>
  )
}

// Droplets fired radially in a full 360° burst. Each carries its own outward
// vector via CSS vars. Upward/sideways throws reach a bit farther than the
// downward ones so it reads as a splash, not a fountain.
const DROPS = [
  { a: 0,   dist: 0.42, s: 0.09, d: 10 },
  { a: 30,  dist: 0.46, s: 0.08, d: 0 },
  { a: 60,  dist: 0.44, s: 0.09, d: 20 },
  { a: 90,  dist: 0.48, s: 0.10, d: 0 },
  { a: 120, dist: 0.44, s: 0.09, d: 20 },
  { a: 150, dist: 0.46, s: 0.08, d: 10 },
  { a: 180, dist: 0.42, s: 0.09, d: 30 },
  { a: 210, dist: 0.34, s: 0.07, d: 40 },
  { a: 240, dist: 0.36, s: 0.08, d: 30 },
  { a: 270, dist: 0.30, s: 0.07, d: 50 },
  { a: 300, dist: 0.36, s: 0.08, d: 30 },
  { a: 330, dist: 0.34, s: 0.07, d: 40 },
]

export function SplashPoof({ size = 150, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), DURATION_MS + 40)
    return () => clearTimeout(t)
  }, [onDone])

  const ring = size * 0.5
  return (
    <div className="absolute pointer-events-none" style={{
      left: '50%', top: '50%', width: size, height: size,
      transform: 'translate(-50%, -50%)', zIndex: 24,
    }}>
      {/* Expanding splash ring */}
      <div className="absolute rounded-full" style={{
        left: '50%', top: '50%', width: ring, height: ring,
        marginLeft: -ring / 2, marginTop: -ring / 2,
        border: '3px solid rgba(120,195,240,0.85)',
        animation: `erenSplashRing ${DURATION_MS}ms ease-out forwards`,
        opacity: 0,
      }} />
      {DROPS.map((p, i) => {
        const rad = (p.a * Math.PI) / 180
        const dx = Math.cos(rad) * p.dist * size
        const dy = -Math.sin(rad) * p.dist * size
        const d = p.s * size
        return (
          <div key={i} className="absolute" style={{
            left: '50%', top: '55%', width: d, height: d * 1.4,
            marginLeft: -d / 2, marginTop: -d / 2,
            background: 'linear-gradient(180deg, rgba(190,228,248,0.9), rgba(96,176,224,0.98))',
            borderRadius: '50% 50% 55% 55% / 38% 38% 80% 80%',
            boxShadow: '0 0 2px rgba(110,180,230,0.7)',
            ['--dx' as string]: `${dx}px`,
            ['--dy' as string]: `${dy}px`,
            animation: `erenSplashDrop ${DURATION_MS}ms cubic-bezier(0.25,0.6,0.4,1) ${p.d}ms forwards`,
            opacity: 0,
          } as React.CSSProperties} />
        )
      })}
    </div>
  )
}

export const WASH_POOF_PEAK_MS = Math.round(DURATION_MS / 2)
export const WASH_POOF_DURATION_MS = DURATION_MS
