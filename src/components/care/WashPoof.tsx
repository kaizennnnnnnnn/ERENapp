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

// SplashPoof has two parts:
//  1. A big central WATER mass — overlapping translucent blobs that swell to
//     cover his whole body (and head, which pokes above the box) right at the
//     swap peak, so the pose change is hidden inside the water.
//  2. A scatter of small DROPLETS flung outward (golden-angle spread → even
//     360° coverage, three distance tiers). Small now — they read as spray, not
//     blobs. GRAVITY drags the burst down a touch so it arcs like real water.

// Central blobs, positioned in % of the (tall) effect box. Biased upward so the
// cluster covers his head. rw/rh are fractions of `size`; o = peak opacity.
const WATER = [
  { x: 50, y: 52, rw: 0.98, rh: 1.22, d: 0,  o: 0.92 },  // main mass, taller than wide
  { x: 38, y: 40, rw: 0.58, rh: 0.66, d: 30, o: 0.85 },
  { x: 63, y: 42, rw: 0.58, rh: 0.66, d: 40, o: 0.85 },
  { x: 50, y: 18, rw: 0.74, rh: 0.64, d: 60, o: 0.82 },  // up high → covers the head + ears
  { x: 44, y: 66, rw: 0.6,  rh: 0.56, d: 20, o: 0.85 },
  { x: 58, y: 64, rw: 0.56, rh: 0.54, d: 50, o: 0.85 },
]

const DROP_COUNT = 30
const GRAVITY = 0.14
const DROPS = Array.from({ length: DROP_COUNT }, (_, i) => ({
  a:    (i * 137.508) % 360,                 // golden angle → even, non-clumping spread
  dist: 0.55 + (i % 4) * 0.12,               // 0.55 … 0.91 of the box
  s:    0.024 + ((i * 3) % 4) * 0.007,       // SMALL droplets (was ~2× this)
  d:    (i % 6) * 12,                         // staggered launch
}))

export function SplashPoof({ size = 150, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), DURATION_MS + 40)
    return () => clearTimeout(t)
  }, [onDone])

  // Taller than wide and shifted up so it blankets the upright sitting pose
  // (whose head sits above the sprite box).
  return (
    <div className="absolute pointer-events-none" style={{
      left: '50%', top: '35%', width: size, height: size * 1.35,
      transform: 'translate(-50%, -50%)', zIndex: 24,
    }}>
      {WATER.map((b, i) => {
        const bw = b.rw * size, bh = b.rh * size
        return (
          <div key={`w${i}`} className="absolute" style={{
            left: `${b.x}%`, top: `${b.y}%`, width: bw, height: bh,
            marginLeft: -bw / 2, marginTop: -bh / 2,
            borderRadius: '50%',
            background: `radial-gradient(ellipse at 42% 34%, rgba(228,245,253,${b.o}), rgba(126,198,236,${b.o * 0.95}) 52%, rgba(86,170,222,0) 100%)`,
            animation: `erenWaterBurst ${DURATION_MS}ms ease-out ${b.d}ms forwards`,
            opacity: 0,
          }} />
        )
      })}
      {DROPS.map((p, i) => {
        const rad = (p.a * Math.PI) / 180
        const dx = Math.cos(rad) * p.dist * size
        const dy = -Math.sin(rad) * p.dist * size + GRAVITY * size
        const d = p.s * size
        return (
          <div key={`d${i}`} className="absolute" style={{
            left: '50%', top: '50%', width: d, height: d * 1.5,
            marginLeft: -d / 2, marginTop: -d / 2,
            background: 'linear-gradient(180deg, rgba(220,242,253,0.98), rgba(110,188,232,1))',
            borderRadius: '50% 50% 55% 55% / 38% 38% 80% 80%',
            boxShadow: '0 0 2px rgba(150,205,240,0.9)',
            ['--dx' as string]: `${dx}px`,
            ['--dy' as string]: `${dy}px`,
            animation: `erenSplashDrop ${DURATION_MS}ms cubic-bezier(0.2,0.7,0.35,1) ${p.d}ms forwards`,
            opacity: 0,
          } as React.CSSProperties} />
        )
      })}
    </div>
  )
}

export const WASH_POOF_PEAK_MS = Math.round(DURATION_MS / 2)
export const WASH_POOF_DURATION_MS = DURATION_MS
