'use client'

// The Erlenmeyer flask on Eren's bench. Fills as the order gets filled, in the
// day's potion colour, with bubbles drifting up through the liquid.
//
// Everything is one SVG so the liquid and the bubbles can share a clip path
// shaped like the glass — a rectangular overflow clip would let bubbles escape
// through the sloped shoulders.

import { useId } from 'react'

interface Props {
  /** 0–1. Drives the liquid height. */
  fill: number
  deep: string
  light: string
  ink: string
  /** Empty-glass tint. Theme-aware: a fixed white wash turns into a grey slab
   *  on the dark palette, which reads as a filled flask rather than an empty
   *  one. Pass the theme's faint foreground. */
  glass?: string
  /** Everything's in — glow, and fizz harder. */
  done?: boolean
  /** Wrong ingredient just went in — puff of soot over the mouth. */
  soot?: boolean
  width?: number
}

// Inside of the glass, in viewBox units. Liquid and bubbles clip to this.
const BODY = 'M42,32 L15,101 Q13,110 22,110 L78,110 Q87,110 85,101 L58,32 Z'
const FLOOR = 110
const CEILING = 34

const BUBBLES = [
  { cx: 36, r: 3.4, delay: '0s',    dur: '2.0s' },
  { cx: 50, r: 2.6, delay: '0.5s',  dur: '2.4s' },
  { cx: 62, r: 3.0, delay: '1.1s',  dur: '1.7s' },
  { cx: 44, r: 2.2, delay: '1.6s',  dur: '2.2s' },
]

const SOOT = [
  { cx: 42, cy: 16, r: 6, delay: '0s' },
  { cx: 54, cy: 11, r: 7, delay: '0.06s' },
  { cx: 62, cy: 18, r: 5, delay: '0.12s' },
]

export default function BrewFlask({ fill, deep, light, ink, glass = 'rgba(255,255,255,0.30)', done, soot, width = 132 }: Props) {
  const uid = useId().replace(/:/g, '')
  const clipId = `brewclip-${uid}`
  // Liquid surface: empty sits on the floor, full stops just under the neck.
  const level = FLOOR - (FLOOR - CEILING) * Math.max(0, Math.min(1, fill))

  return (
    <svg
      width={width}
      height={width * (128 / 100)}
      viewBox="0 0 100 128"
      style={{
        overflow: 'visible',
        filter: done ? `drop-shadow(0 0 12px ${light})` : undefined,
        transition: 'filter 400ms ease',
      }}
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}><path d={BODY} /></clipPath>
      </defs>

      {/* neck + lip */}
      <rect x="40" y="10" width="20" height="24" fill={glass} stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
      <rect x="35" y="4" width="30" height="9" rx="3" fill={glass} stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />

      {/* glass body */}
      <path d={BODY} fill={glass} stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />

      <g clipPath={`url(#${clipId})`}>
        {/* liquid — animates its own height as slots fill */}
        <rect x="0" y={level} width="100" height={FLOOR - level + 4} fill={deep}
          style={{ transition: 'y 520ms cubic-bezier(0.34,1.3,0.64,1), height 520ms cubic-bezier(0.34,1.3,0.64,1)' }} />
        {/* lighter meniscus band so the surface reads as liquid, not a block */}
        {fill > 0 && (
          <rect x="0" y={level} width="100" height="5" fill={light}
            style={{ transition: 'y 520ms cubic-bezier(0.34,1.3,0.64,1)' }} />
        )}
        {/* bubbles, only once there's something to bubble through */}
        {fill > 0 && BUBBLES.map((b, i) => (
          <circle key={i} cx={b.cx} cy={FLOOR - 8} r={b.r} fill={light} fillOpacity="0.9"
            style={{
              animation: `brewBubble ${done ? '1.1s' : b.dur} linear ${b.delay} infinite`,
              // Each bubble climbs from the floor to the current surface.
              ['--brew-rise' as string]: `${-(FLOOR - level - 6)}px`,
            }} />
        ))}
      </g>

      {/* glass shine, over the liquid */}
      <path d="M46,40 L34,72" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />

      {/* soot puff when a wrong ingredient goes in */}
      {soot && SOOT.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#6B7280" fillOpacity="0.85"
          style={{ animation: `brewSoot 620ms ease-out ${s.delay} both` }} />
      ))}
    </svg>
  )
}
