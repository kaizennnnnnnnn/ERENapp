'use client'

// ─── SliceFlyer ─────────────────────────────────────────────────────────────
// One thing in the air in Jelly Slice, drawn by KIND.
//
// The four kinds have to be told apart in the half second a jelly is inside
// reach, at arm's length, mid-flick. So each one differs in more than colour:
//
//   JELLY    the flavour art, plain. The baseline.
//   SOUR     do NOT cut. Dark, desaturated, X for eyes, and a lime warning ring
//            that pulses — three separate tells, because a hazard that reads as
//            "just another jelly" is a cheap death rather than a mistake.
//   SHELLED  a sugar crust over the art. Two cuts: the first cracks it.
//   GOLDEN   small, fast, gold, sparking. Worth five of anything else.
//
// Cut jellies keep their art and part down the middle (two clipped copies) so
// the slice reads as a slice and not as a puff of particles.

import { memo } from 'react'
import type { JellyDef } from '@/lib/jellies'

export type FlyerKind = 'jelly' | 'sour' | 'shelled' | 'golden'

interface Props {
  kind: FlyerKind
  jelly: JellyDef
  /** Hit radius in px — the box is 2r. */
  r: number
  sliced: boolean
  /** SHELLED only: the crust is already off, so it's one cut from splitting. */
  cracked: boolean
}

const art: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  objectFit: 'contain', imageRendering: 'auto',
}

const SliceFlyer = memo(function SliceFlyer({ kind, jelly, r, sliced, cracked }: Props) {
  // A cut jelly: the same art split down the middle, halves parting.
  if (sliced) {
    return (
      <>
        <img src={jelly.art} alt="" draggable={false}
          style={{ ...art, clipPath: 'inset(0 50% 0 0)', transform: 'translateX(-7px)', filter: kindFilter(kind) }} />
        <img src={jelly.art} alt="" draggable={false}
          style={{ ...art, clipPath: 'inset(0 0 0 50%)', transform: 'translateX(7px)', filter: kindFilter(kind) }} />
      </>
    )
  }

  if (kind === 'sour') {
    return (
      <>
        {/* Warning ring — the tell you catch first, from the corner of the eye. */}
        <span style={{
          position: 'absolute', inset: '4%', borderRadius: '50%',
          border: '3px solid #B6FF3D', boxShadow: '0 0 10px rgba(182,255,61,0.75)',
          animation: 'sourPulse 700ms ease-in-out infinite',
        }} />
        <img src={jelly.art} alt="" draggable={false} style={{ ...art, filter: kindFilter('sour') }} />
        {/* Two X eyes, drawn as pixel bars so they survive at 24px. */}
        {[-0.13, 0.13].map(dx => (
          <span key={dx} style={{
            position: 'absolute', left: `calc(50% + ${dx * r * 2}px - 5px)`, top: '46%',
            width: 10, height: 10,
          }}>
            <span style={{ position: 'absolute', inset: 0, borderTop: '2.5px solid #B6FF3D', transform: 'rotate(45deg)', top: 4 }} />
            <span style={{ position: 'absolute', inset: 0, borderTop: '2.5px solid #B6FF3D', transform: 'rotate(-45deg)', top: 4 }} />
          </span>
        ))}
      </>
    )
  }

  if (kind === 'golden') {
    return (
      <>
        <span style={{
          position: 'absolute', inset: '-14%', borderRadius: '50%',
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,222,120,0.5) 0%, rgba(255,222,120,0) 70%)',
        }} />
        <img src={jelly.art} alt="" draggable={false} style={{ ...art, filter: kindFilter('golden') }} />
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            position: 'absolute', left: `${18 + i * 30}%`, top: `${14 + (i % 2) * 46}%`,
            width: 5, height: 5, background: '#FFF6D2', borderRadius: 1,
            animation: `goldSpark 900ms ease-in-out ${i * 260}ms infinite`,
          }} />
        ))}
      </>
    )
  }

  if (kind === 'shelled' && !cracked) {
    return (
      <>
        <img src={jelly.art} alt="" draggable={false} style={{ ...art, filter: 'saturate(0.55) brightness(1.1)' }} />
        {/* Sugar crust — a frosted shell over the flavour, not a coloured tint,
            so "there is something ON it" survives at speed. */}
        <span style={{
          position: 'absolute', inset: '2%', borderRadius: '46% 46% 34% 34%',
          background: 'linear-gradient(150deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.3) 46%, rgba(214,232,255,0.5) 100%)',
          border: '2.5px solid rgba(255,255,255,0.9)',
        }} />
        <span style={{
          position: 'absolute', inset: '2%', borderRadius: '46% 46% 34% 34%',
          background: 'repeating-linear-gradient(58deg, rgba(255,255,255,0.5) 0 2px, transparent 2px 7px)',
        }} />
      </>
    )
  }

  return <img src={jelly.art} alt="" draggable={false} style={{ ...art, filter: kindFilter(kind) }} />
})

export default SliceFlyer

function kindFilter(kind: FlyerKind): string | undefined {
  if (kind === 'sour') return 'grayscale(0.72) brightness(0.42) contrast(1.25)'
  if (kind === 'golden') return 'sepia(1) saturate(3.4) hue-rotate(-14deg) brightness(1.12)'
  return undefined
}
