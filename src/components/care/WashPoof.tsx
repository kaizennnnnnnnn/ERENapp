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

// SplashPoof — the rinse-off transition. NO covering water mass: it's the same
// pixel droplet as the finishing shake-off (ReactionFx `Droplets`, erenDroplet),
// just a lot more of them, in two layers:
//   1. SPRAY — droplets flung radially off his body (golden-angle fan, three
//      size/distance tiers) that snap-vanish at full extent. The "water flying
//      off" detail the user wanted to see.
//   2. MID — a tighter cluster packed over his core, launched LATE (peaking with
//      the pose swap) and travelling only a short way, so a dense flicker of
//      droplets breaks up the swap without blotting him out.
// Each droplet starts at (sx,sy) in % of the box and flies by (--tx,--ty) px.
// erenDroplet holds it at its origin during the stagger delay (`both`), so the
// late MID droplets sit over his body through the swap, then spray off.

interface Drop { sx: number; sy: number; a: number; dist: number; sz: number; d: number }

const GA = 137.508 * Math.PI / 180  // golden angle → even, non-clumping fan

// Outward spray — starts just off his body center, three tiers (5/4/3 px, flying
// 0.34 / 0.46 / 0.58 of the box), staggered 0–80ms so the burst reads layered.
const SPRAY: Drop[] = Array.from({ length: 26 }, (_, i) => {
  const a = i * GA, tier = i % 3
  return {
    sx: 50 + Math.cos(a) * (6 + tier * 4),
    sy: 45 + Math.sin(a) * (8 + tier * 4),
    a, dist: 0.34 + tier * 0.12, sz: 5 - tier, d: (i % 6) * 16,
  }
})

// Central mask cluster — droplets scattered across his whole body (an ellipse
// over head + torso), launched right around the swap peak (150–260ms) and only
// hopping a tiny way, so a dense flurry of droplets sits over him exactly when
// the pose flips, breaking it up without ever becoming a solid sheet.
const MID: Drop[] = Array.from({ length: 22 }, (_, i) => {
  const a = i * GA
  const rr = 0.5 + (i % 5) * 0.12           // 0.5–0.98 → fills the body ellipse
  return {
    sx: 50 + Math.cos(a) * 17 * rr,         // ±~17% across his body
    sy: 46 + Math.sin(a) * 22 * rr,         // ±~22% over head→lower torso
    a, dist: 0.06 + (i % 4) * 0.035, sz: 5 - (i % 3), d: 150 + (i % 6) * 22,
  }
})

function Droplet({ p, k, size }: { p: Drop; k: string; size: number }) {
  const tx = Math.cos(p.a) * p.dist * size
  const ty = Math.sin(p.a) * p.dist * size
  return (
    <div key={k} className="absolute" style={{
      left: `${p.sx}%`, top: `${p.sy}%`,
      width: p.sz, height: p.sz * 1.4,
      marginLeft: -p.sz / 2, marginTop: -p.sz / 2,
      background: 'linear-gradient(180deg, #DCF2FD 0%, #9FD8F5 45%, #6EBCE8 100%)',
      borderRadius: '50% 50% 55% 55% / 35% 35% 85% 85%',
      boxShadow: '0 0 2px rgba(150,205,240,0.85)',
      ['--tx']: `${tx}px`, ['--ty']: `${ty}px`,
      animation: `erenDroplet ${DURATION_MS}ms cubic-bezier(0.2,0.6,0.4,1) ${p.d}ms both`,
    } as React.CSSProperties} />
  )
}

export function SplashPoof({ size = 150, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), DURATION_MS + 240 + 40)
    return () => clearTimeout(t)
  }, [onDone])

  // Centered on his body; droplet coords are % of this box.
  return (
    <div className="absolute pointer-events-none" style={{
      left: '50%', top: '50%', width: size, height: size,
      transform: 'translate(-50%, -50%)', zIndex: 24,
    }}>
      {SPRAY.map((p, i) => <Droplet key={`s${i}`} k={`s${i}`} p={p} size={size} />)}
      {MID.map((p, i) => <Droplet key={`m${i}`} k={`m${i}`} p={p} size={size} />)}
    </div>
  )
}

export const WASH_POOF_PEAK_MS = Math.round(DURATION_MS / 2)
export const WASH_POOF_DURATION_MS = DURATION_MS
