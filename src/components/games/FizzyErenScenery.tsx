'use client'

// ═══════════════════════════════════════════════════════════════════════════
// FIZZY EREN — art direction and parallax scenery.
//
// The old field had five themed sky gradients, a static cloud layer, a static
// star layer and a 12px stripe of ground. Everything except the pipes was
// nailed down, so flying felt like drifting past a mural. This file gives the
// world depth the cheap way: the same scroll offset applied at four different
// rates. Clouds barely move, the far ridge creeps, the near ridge slides, the
// ground races with the pipes — and the eye reads those differences as
// distance without being told.
//
// Stars deliberately do NOT scroll. They are infinitely far away, and holding
// them still while five layers move underneath is what sells the depth.
//
// Everything here is memoised. The game force-renders at 60fps and none of
// this changes per frame — only the ParallaxRow wrapper transforms do, so the
// tiles themselves must bail out of reconciliation.
// ═══════════════════════════════════════════════════════════════════════════

import { memo, type ReactNode } from 'react'

// Ground is 20px, not the old 12px, so the can lands ON it instead of sinking
// into it. The game reads this for collision — visual and hitbox agree.
export const GROUND_H    = 20
export const TILE        = 256   // ridge tile width
export const CLOUD_TILE  = 320
export const GROUND_TILE = 32    // period of both ground stripe patterns
export const FAR_H       = 120
export const NEAR_H      = 78

export type ThemeName = 'day' | 'sunset' | 'night' | 'forest' | 'desert'
export type Ridge     = 'hills' | 'peaks' | 'city' | 'trees' | 'dunes'

interface Orb {
  size: number; top: string; left: string
  core: string; mid: string; edge: string; glow: string
}

export interface Theme {
  name: ThemeName
  sky: string
  ridge: Ridge
  farTone: string
  nearTone: string
  /** Colour the ridges fade into at the horizon — atmospheric perspective. */
  haze: string
  /** Lit windows, only meaningful when ridge === 'city'. */
  windowTone?: string
  groundTop: string
  groundTopDark: string
  groundBody: string
  groundBodyDark: string
  groundBorder: string
  pipeShadow: string
  pipeColor1: string
  pipeColor2: string
  pipeColor3: string
  cloudOpacity: number
  starOpacity: number
  orb: Orb | null
}

export const THEMES: Theme[] = [
  {
    name: 'day',
    sky: 'linear-gradient(180deg, #4A9FE0 0%, #7BC0EC 42%, #B4DCEB 72%, #F6E3BC 100%)',
    ridge: 'hills',
    farTone: '#84B995', nearTone: '#4C9367',
    haze: 'rgba(190,222,233,0.9)',
    groundTop: '#41C062', groundTopDark: '#2E9C4A',
    groundBody: '#8B5A2B', groundBodyDark: '#6B4423',
    groundBorder: '#123D1E',
    pipeShadow: '#064e3b', pipeColor1: '#14a052', pipeColor2: '#16a34a', pipeColor3: '#4ADE80',
    cloudOpacity: 1, starOpacity: 0,
    orb: { size: 46, top: '15%', left: '80%', core: '#FFFFFF', mid: '#FFF4C4', edge: '#FDE68A', glow: 'rgba(255,240,190,0.55)' },
  },
  {
    name: 'sunset',
    sky: 'linear-gradient(180deg, #6B2A5E 0%, #C7455C 24%, #FF7A47 48%, #FFB070 72%, #FFDFAE 100%)',
    ridge: 'peaks',
    farTone: '#9A5A82', nearTone: '#5E3159',
    haze: 'rgba(255,186,132,0.92)',
    groundTop: '#C2703A', groundTopDark: '#9C4F26',
    groundBody: '#7A3B1C', groundBodyDark: '#5A2A12',
    groundBorder: '#3A1806',
    pipeShadow: '#78350F', pipeColor1: '#D97706', pipeColor2: '#F59E0B', pipeColor3: '#FCD34D',
    cloudOpacity: 0.85, starOpacity: 0,
    // Big and low — the sun sitting on the ridgeline is the whole mood.
    orb: { size: 104, top: '54%', left: '30%', core: '#FFF8E4', mid: '#FFC97C', edge: '#FF8A4C', glow: 'rgba(255,150,90,0.5)' },
  },
  {
    name: 'night',
    sky: 'linear-gradient(180deg, #070B24 0%, #16174A 42%, #2D1B5E 76%, #4C1D95 100%)',
    ridge: 'city',
    farTone: '#2B2456', nearTone: '#14113A',
    haze: 'rgba(76,29,149,0.75)',
    windowTone: '#F2C86B',
    groundTop: '#2B3550', groundTopDark: '#1E2740',
    groundBody: '#151C30', groundBodyDark: '#0D1220',
    groundBorder: '#05070F',
    pipeShadow: '#2E0F5C', pipeColor1: '#5B21B6', pipeColor2: '#7C3AED', pipeColor3: '#C4B5FD',
    cloudOpacity: 0, starOpacity: 1,
    orb: null,   // the moon lives in StarField
  },
  {
    name: 'forest',
    sky: 'linear-gradient(180deg, #05372B 0%, #116237 36%, #3AAE68 72%, #8FE0AE 100%)',
    ridge: 'trees',
    farTone: '#1F6B4A', nearTone: '#0C4530',
    haze: 'rgba(158,226,182,0.45)',
    groundTop: '#2F7D46', groundTopDark: '#1F5C32',
    groundBody: '#2A4A2E', groundBodyDark: '#1A331F',
    groundBorder: '#08210F',
    pipeShadow: '#451A03', pipeColor1: '#78350F', pipeColor2: '#92400E', pipeColor3: '#C77A32',
    cloudOpacity: 0.45, starOpacity: 0,
    orb: { size: 54, top: '18%', left: '24%', core: '#F6FFEC', mid: '#DDF6C8', edge: '#A8D890', glow: 'rgba(190,240,180,0.22)' },
  },
  {
    name: 'desert',
    sky: 'linear-gradient(180deg, #F2B33C 0%, #F98F72 34%, #FBC3B0 66%, #FEF3C7 100%)',
    ridge: 'dunes',
    farTone: '#E2A96F', nearTone: '#C1803E',
    haze: 'rgba(254,238,190,0.9)',
    groundTop: '#E3B368', groundTopDark: '#C89144',
    groundBody: '#B0762F', groundBodyDark: '#8A5A20',
    groundBorder: '#4A2C08',
    pipeShadow: '#451A03', pipeColor1: '#854D0E', pipeColor2: '#A16207', pipeColor3: '#E0B44B',
    cloudOpacity: 0.6, starOpacity: 0,
    orb: { size: 58, top: '13%', left: '70%', core: '#FFFFFF', mid: '#FFFBEA', edge: '#FDE68A', glow: 'rgba(255,246,200,0.6)' },
  },
]

// ─── Ridge silhouettes ───────────────────────────────────────────────────────
// Each entry is a run of cell heights as a % of the band height. Rendered as a
// stepped clip-path polygon: ONE element per ridge instead of thirty rects,
// and the steps stay hard-edged at any size, which is what keeps it reading as
// pixel art rather than a smoothed vector curve.
//
// Any array tiles seamlessly — the shape is a silhouette, so the seam between
// the last cell and the first is just one more step among many.

const RIDGES: Record<Ridge, { far: number[]; near: number[] }> = {
  hills: {
    far:  [38, 44, 52, 58, 62, 58, 50, 44, 40, 46, 54, 62, 68, 64, 56, 48, 42, 38, 42, 50, 58, 54, 46, 40],
    near: [30, 36, 44, 52, 58, 54, 46, 38, 32, 28, 34, 42, 50, 56, 60, 54, 44, 36, 30, 26, 32, 40, 48, 38],
  },
  peaks: {
    far:  [30, 46, 62, 78, 64, 48, 36, 52, 70, 86, 72, 56, 40, 30, 44, 60, 76, 60, 44, 34, 48, 64, 50, 36],
    near: [22, 38, 56, 44, 30, 46, 66, 50, 34, 26, 42, 60, 74, 58, 40, 28, 40, 56, 42, 28, 36, 52, 38, 26],
  },
  // Runs of equal values are single buildings.
  city: {
    far:  [34, 34, 34, 52, 52, 44, 44, 44, 66, 66, 66, 58, 58, 40, 40, 40, 72, 72, 50, 50, 50, 38, 38, 60],
    near: [46, 46, 60, 60, 60, 38, 38, 52, 52, 52, 70, 70, 44, 44, 56, 56, 56, 34, 34, 64, 64, 48, 48, 48],
  },
  // Twice the cell count of the other ridges, and only three or four trees per
  // tile. A conifer only reads as a triangle when its base is roughly as wide
  // as it is tall — a tall narrow one quantises into a tower and the forest
  // turns into a second city skyline. Each run is one symmetric tree, followed
  // by a single low cell of undergrowth.
  trees: {
    far: [
      14, 26, 38, 50, 62, 70, 62, 50, 38, 26, 14, 10,
      12, 21, 30, 39, 48, 56, 48, 39, 30, 21, 12, 10,
      16, 29, 42, 55, 68, 82, 68, 55, 42, 29, 16, 10,
      13, 23, 34, 44, 54, 62, 54, 44, 34, 23, 13, 10,
    ],
    near: [
      12, 23, 34, 45, 56, 67, 78, 92, 78, 67, 56, 45, 34, 23, 12, 10,
      10, 19, 28, 37, 46, 55, 64, 74, 64, 55, 46, 37, 28, 19, 10, 10,
      13, 25, 37, 49, 61, 73, 85, 100, 85, 73, 61, 49, 37, 25, 13, 10,
    ],
  },
  dunes: {
    far:  [40, 46, 52, 56, 58, 56, 52, 46, 40, 36, 34, 36, 40, 46, 52, 56, 58, 56, 50, 44, 38, 34, 36, 38],
    near: [28, 34, 42, 50, 56, 58, 56, 50, 42, 34, 28, 24, 26, 32, 40, 48, 54, 56, 52, 44, 36, 30, 26, 26],
  },
}

function stepClip(heights: number[]): string {
  const n = heights.length
  const pts: string[] = ['0% 100%']
  for (let i = 0; i < n; i++) {
    const x0 = ((i / n) * 100).toFixed(3)
    const x1 = (((i + 1) / n) * 100).toFixed(3)
    const y = (100 - heights[i]).toFixed(2)
    pts.push(`${x0}% ${y}%`, `${x1}% ${y}%`)
  }
  pts.push('100% 100%')
  return `polygon(${pts.join(',')})`
}

const CLIP: Record<Ridge, { far: string; near: string }> = {
  hills: { far: stepClip(RIDGES.hills.far), near: stepClip(RIDGES.hills.near) },
  peaks: { far: stepClip(RIDGES.peaks.far), near: stepClip(RIDGES.peaks.near) },
  city:  { far: stepClip(RIDGES.city.far),  near: stepClip(RIDGES.city.near) },
  trees: { far: stepClip(RIDGES.trees.far), near: stepClip(RIDGES.trees.near) },
  dunes: { far: stepClip(RIDGES.dunes.far), near: stepClip(RIDGES.dunes.near) },
}

/** Lit windows as two crossed background layers rather than ~40 divs: vertical
 *  window columns underneath, horizontal building-coloured bands on top to cut
 *  them into rows. The parent's clip-path erases everything that isn't inside a
 *  building, so no window can float in the sky. */
function CityWindows({ tone, win }: { tone: string; win: string }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage:
        `repeating-linear-gradient(180deg, transparent 0 4px, ${tone} 4px 12px),` +
        `repeating-linear-gradient(90deg, ${win} 0 3px, ${tone} 3px 12px)`,
    }} />
  )
}

// ─── Parallax plumbing ───────────────────────────────────────────────────────

/** Two nested transforms on purpose. The outer one is a slow CSS drift that
 *  runs in every state, so the idle title screen is alive; the inner one is the
 *  game's scroll offset. Composing them this way means tapping to start adds
 *  motion instead of snapping the layer back to zero. */
export function ParallaxRow({
  offset, drift, driftMs, reduced, top, bottom, height, children,
}: {
  offset: number
  drift: string
  driftMs: number
  reduced: boolean
  top?: number
  bottom?: number
  height: number
  children: ReactNode
}) {
  return (
    <div aria-hidden style={{
      position: 'absolute', left: 0, right: 0, top, bottom, height,
      overflow: 'hidden', pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        animation: reduced ? undefined : `${drift} ${driftMs}ms linear infinite`,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          transform: `translate3d(${-offset}px,0,0)`,
          willChange: 'transform',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/** +2 tiles, not +1: the row carries both the drift transform and the game
 *  offset, so the combined shift can reach two full tile widths. */
const tileCount = (fieldW: number, tile: number) => Math.ceil(fieldW / tile) + 2

export const FarRidge = memo(function FarRidge({ themeIndex, fieldW }: { themeIndex: number; fieldW: number }) {
  return (
    <>
      {Array.from({ length: tileCount(fieldW, TILE) }, (_, k) => (
        <div key={k} style={{ position: 'absolute', left: k * TILE, bottom: 0, width: TILE, height: FAR_H }}>
          {THEMES.map((t, i) => (
            <div key={t.name} style={{
              position: 'absolute', inset: 0,
              background: t.farTone,
              clipPath: CLIP[t.ridge].far,
              opacity: i === themeIndex ? 1 : 0,
              transition: 'opacity 1.4s ease',
            }}>
              {t.ridge === 'city' && t.windowTone && <CityWindows tone={t.farTone} win={t.windowTone} />}
            </div>
          ))}
        </div>
      ))}
    </>
  )
})

export const NearRidge = memo(function NearRidge({ themeIndex, fieldW }: { themeIndex: number; fieldW: number }) {
  return (
    <>
      {Array.from({ length: tileCount(fieldW, TILE) }, (_, k) => (
        <div key={k} style={{ position: 'absolute', left: k * TILE, bottom: 0, width: TILE, height: NEAR_H }}>
          {THEMES.map((t, i) => (
            <div key={t.name} style={{
              position: 'absolute', inset: 0,
              background: t.nearTone,
              clipPath: CLIP[t.ridge].near,
              opacity: i === themeIndex ? 1 : 0,
              transition: 'opacity 1.4s ease',
            }} />
          ))}
        </div>
      ))}
    </>
  )
})

const CLOUD_SPOTS = [
  { x: 18,  y: 26,  s: 1.00 },
  { x: 152, y: 74,  s: 0.75 },
  { x: 238, y: 16,  s: 0.85 },
  { x: 84,  y: 128, s: 1.15 },
  { x: 198, y: 158, s: 0.70 },
]

function Cloud({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${scale})`, transformOrigin: 'left top' }}>
      <svg width="48" height="22" viewBox="0 0 48 22" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated', display: 'block' }}>
        <rect x="6"  y="6"  width="36" height="10" fill="#FFFFFF" />
        <rect x="10" y="3"  width="10" height="3"  fill="#FFFFFF" />
        <rect x="22" y="2"  width="14" height="4"  fill="#FFFFFF" />
        <rect x="4"  y="10" width="40" height="6"  fill="#FFFFFF" />
        <rect x="8"  y="16" width="32" height="2"  fill="#E5E7EB" />
      </svg>
    </div>
  )
}

export const CloudBand = memo(function CloudBand({ themeIndex, fieldW }: { themeIndex: number; fieldW: number }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      opacity: THEMES[themeIndex].cloudOpacity,
      transition: 'opacity 1.4s ease',
    }}>
      {Array.from({ length: tileCount(fieldW, CLOUD_TILE) }, (_, k) => (
        <div key={k} style={{ position: 'absolute', left: k * CLOUD_TILE, top: 0, width: CLOUD_TILE, height: '100%' }}>
          {CLOUD_SPOTS.map((c, i) => <Cloud key={i} x={c.x} y={c.y} scale={c.s} />)}
        </div>
      ))}
    </div>
  )
})

/** Ground doesn't tile with elements — both stripe patterns are periodic, so
 *  one over-wide div per theme scrolled modulo GROUND_TILE is seamless and
 *  costs 5 layers instead of ~75. */
export const GroundBand = memo(function GroundBand({ themeIndex }: { themeIndex: number }) {
  return (
    <>
      {THEMES.map((t, i) => (
        <div key={t.name} style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, right: -GROUND_TILE * 2,
          opacity: i === themeIndex ? 1 : 0,
          transition: 'opacity 1.4s ease',
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: t.groundBorder }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 3, height: 1, background: 'rgba(255,255,255,0.30)' }} />
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 4, height: 6,
            background: `repeating-linear-gradient(90deg, ${t.groundTop} 0 8px, ${t.groundTopDark} 8px 16px)`,
          }} />
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 10, bottom: 0,
            background: `repeating-linear-gradient(90deg, ${t.groundBody} 0 16px, ${t.groundBodyDark} 16px 32px)`,
          }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'rgba(0,0,0,0.38)' }} />
        </div>
      ))}
    </>
  )
})

// ─── Sky furniture ───────────────────────────────────────────────────────────

export const SkyLayers = memo(function SkyLayers({ themeIndex }: { themeIndex: number }) {
  return (
    <>
      {THEMES.map((t, i) => (
        <div key={t.name} aria-hidden style={{
          position: 'absolute', inset: 0,
          background: t.sky,
          opacity: i === themeIndex ? 1 : 0,
          transition: 'opacity 1.4s ease',
          pointerEvents: 'none',
        }} />
      ))}
    </>
  )
})

/** An LCG, not Math.random: module-level Math.random runs once on the server
 *  and again on the client, and the two star fields disagree — a hydration
 *  mismatch. A seeded integer generator gives the same field on both. */
function prng(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

const STARS = (() => {
  const r = prng(0x5EED)
  return Array.from({ length: 42 }, () => ({
    left: `${(r() * 100).toFixed(2)}%`,
    top: `${(r() * 62).toFixed(2)}%`,
    size: 1 + Math.round(r() * 2),
    delay: `${(r() * 3).toFixed(2)}s`,
  }))
})()

export const StarField = memo(function StarField({ starOpacity, reduced }: { starOpacity: number; reduced: boolean }) {
  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0,
      opacity: starOpacity,
      transition: 'opacity 1.4s ease',
      pointerEvents: 'none',
    }}>
      {STARS.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: s.left, top: s.top,
          width: s.size, height: s.size,
          background: '#FFFFFF',
          animation: reduced ? undefined : `twinkle 2.4s ease-in-out ${s.delay} infinite`,
        }} />
      ))}
      <div style={{ position: 'absolute', top: '11%', right: '13%', width: 34, height: 34 }}>
        <div style={{
          position: 'absolute', inset: -20, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(226,232,255,0.42) 0%, transparent 68%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 34%, #FFFFFF 0 44%, #E8EAF6 44% 74%, #B6BCD4 74% 100%)',
        }} />
        {/* craters — without them it's a headlight, not a moon */}
        <div style={{ position: 'absolute', left: 9,  top: 18, width: 6, height: 5, background: 'rgba(140,148,180,0.55)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', left: 20, top: 9,  width: 4, height: 4, background: 'rgba(140,148,180,0.45)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', left: 21, top: 22, width: 3, height: 3, background: 'rgba(140,148,180,0.40)', borderRadius: '50%' }} />
      </div>
    </div>
  )
})

export const OrbLayer = memo(function OrbLayer({ themeIndex }: { themeIndex: number }) {
  return (
    <>
      {THEMES.map((t, i) => t.orb && (
        <div key={t.name} aria-hidden style={{
          position: 'absolute',
          left: t.orb.left, top: t.orb.top,
          width: t.orb.size, height: t.orb.size,
          marginLeft: -t.orb.size / 2, marginTop: -t.orb.size / 2,
          opacity: i === themeIndex ? 1 : 0,
          transition: 'opacity 1.4s ease',
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', inset: -t.orb.size * 0.6, borderRadius: '50%',
            background: `radial-gradient(circle, ${t.orb.glow} 0%, transparent 68%)`,
          }} />
          {/* hard colour stops, not a smooth blend — a banded disc reads as
              drawn, a smooth one reads as a CSS gradient */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `radial-gradient(circle, ${t.orb.core} 0 46%, ${t.orb.mid} 46% 74%, ${t.orb.edge} 74% 100%)`,
          }} />
        </div>
      ))}
    </>
  )
})

/** Atmospheric perspective: a wash of sky colour rising off the horizon so the
 *  ridges sink into the distance instead of being pasted on top of it. */
export const HazeBand = memo(function HazeBand({ themeIndex }: { themeIndex: number }) {
  return (
    <>
      {THEMES.map((t, i) => (
        <div key={t.name} aria-hidden style={{
          position: 'absolute', left: 0, right: 0, bottom: GROUND_H, height: 150,
          background: `linear-gradient(180deg, transparent 0%, ${t.haze} 100%)`,
          opacity: i === themeIndex ? 0.85 : 0,
          transition: 'opacity 1.4s ease',
          pointerEvents: 'none',
        }} />
      ))}
    </>
  )
})

/** Vignette + scanlines, the app's house CRT treatment. Rendered above the
 *  world and below the HUD by DOM order — deliberately no z-index, or it would
 *  cover the score. */
export const Atmosphere = memo(function Atmosphere() {
  return (
    <>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 46%, transparent 40%, rgba(6,4,16,0.26) 76%, rgba(6,4,16,0.52) 100%)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.26,
        background: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.16) 0 1px, transparent 1px 3px)',
      }} />
    </>
  )
})
