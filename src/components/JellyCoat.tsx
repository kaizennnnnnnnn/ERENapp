'use client'

// ─── JellyCoat ──────────────────────────────────────────────────────────────
// The gloss on Eren Jelly. Mounted by BlinkingEren whenever a skin declares
// `coat: 'jelly'`, which means it follows the look everywhere the sprite goes —
// every room, the closet mirror, the gacha podium, the unlock cinematic — off
// one flag instead of seven call sites remembering to add it.
//
// The art is already a jelly cat; the coat's job is to make it act like one.
// Three layers, all cheap:
//
//   WOBBLE  a slow squash-stretch on the whole box, pivoting at his feet so he
//           settles like something poured into a mould rather than bouncing.
//   SHEEN   one soft highlight sliding across him on a long loop — the single
//           strongest "this is wet" cue, and it's one gradient on the GPU.
//   DRIPS   two syrup beads that swell, run, and vanish, offset in time so the
//           pair never reads as a metronome.
//
// Deliberately NOT a particle field: a jelly is glossy and slow, and forty
// twinkles would read as magic sparkle, which every other rarity effect in the
// app already owns. Everything animates on transform/opacity, and
// prefers-reduced-motion drops to the sheen alone, held still.

import { memo } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/** Strawberry, to match the skin's art. */
const TINT = 'rgba(255,120,140,'

const DRIPS = [
  { left: '31%', top: '46%', delay: '0s', dur: '5.2s', size: 7 },
  { left: '66%', top: '38%', delay: '2.6s', dur: '6.1s', size: 5 },
]

function JellyCoat() {
  const reduced = useReducedMotion()

  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
      // Sits above the sprite but inside its box, so it scales with him.
      zIndex: 3,
      transformOrigin: 'bottom center',
      animation: reduced ? undefined : 'jellyCoatWobble 3.4s ease-in-out infinite',
    }}>
      {/* SHEEN — a wide soft band travelling across the body. Clipped to the
          box; the sprite's own transparency does the shaping, so a rough band
          still reads as light on his surface rather than a floating rectangle. */}
      <span style={{
        position: 'absolute', inset: '4% 0 12% 0', overflow: 'hidden', borderRadius: '46% 46% 40% 40%',
      }}>
        <span style={{
          position: 'absolute', top: '-20%', bottom: '-20%', left: 0, width: '46%',
          background: `linear-gradient(104deg, ${TINT}0) 0%, rgba(255,255,255,0.42) 46%, ${TINT}0) 100%)`,
          animation: reduced ? undefined : 'jellyCoatSheen 4.6s ease-in-out infinite',
          transform: reduced ? 'translateX(60%)' : undefined,
        }} />
      </span>

      {/* RIM — a faint strawberry glow hugging the silhouette's lower half,
          the way light pools at the bottom of a set jelly. */}
      <span style={{
        position: 'absolute', left: '12%', right: '12%', bottom: '8%', height: '34%',
        borderRadius: '50%',
        background: `radial-gradient(60% 70% at 50% 80%, ${TINT}0.30) 0%, ${TINT}0) 72%)`,
      }} />

      {/* DRIPS — syrup beads that swell, run down, and go. */}
      {!reduced && DRIPS.map((d, i) => (
        <span key={i} style={{
          position: 'absolute', left: d.left, top: d.top,
          width: d.size, height: d.size * 1.35, borderRadius: '50% 50% 60% 60%',
          background: 'linear-gradient(180deg, rgba(255,190,205,0.95), rgba(226,70,110,0.85))',
          boxShadow: '0 0 4px rgba(255,120,150,0.7)',
          opacity: 0,
          animation: `jellyCoatDrip ${d.dur} ease-in ${d.delay} infinite`,
        }} />
      ))}
    </div>
  )
}

export default memo(JellyCoat)
