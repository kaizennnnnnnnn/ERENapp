'use client'

// ─── JellyCoat ──────────────────────────────────────────────────────────────
// The gloss on Eren Jelly. Mounted by BlinkingEren whenever a skin declares
// `coat: 'jelly'`, which means it follows the look everywhere the sprite goes —
// every room, the closet mirror, the gacha podium, the unlock cinematic — off
// one flag instead of seven call sites remembering to add it.
//
// EVERYTHING here is clipped to the sprite's own alpha: the same PNG is used as
// a CSS mask, at `contain`/`center` so it lands exactly where the <img> does.
// That's the whole trick. Painting into the square box instead — which is what
// this did first — lets a highlight keep its rectangular edge and slide across
// the cat as an obvious band, and lets a drip run out into empty air. Masked,
// the same cheap gradients read as light and syrup ON him.
//
// Two layers, deliberately restrained:
//
//   GLAZE  one soft highlight resting on his chest, breathing very slowly. It
//          does not travel: a moving light is what made the first pass look
//          like a foil sticker, and a jelly's shine sits still while the jelly
//          does. A matching strawberry weight pools toward his feet so he reads
//          as translucent gel with depth rather than a flat pink cut-out.
//   DRIPS  three syrup beads that swell, run, and fade, on long staggered loops
//          so the pair never reads as a metronome. Sized and travelled in % of
//          the sprite box, not px, so they stay proportional at every room's
//          sprite size.
//
// Deliberately NOT a particle field: forty twinkles would read as magic
// sparkle, which every other rarity effect in the app already owns. Everything
// animates on transform/opacity, and prefers-reduced-motion keeps the glaze,
// held still, and drops the drips.

import { memo } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/** Strawberry, to match the skin's art. */
const TINT = 'rgba(255,120,140,'

// Positions are in sprite-BOX percentages, measured against the silhouette:
// the body is solid from y≈40% to y≈90% across x≈26–60%, so each bead has room
// to run its full length without reaching the outline (where the mask would cut
// it off mid-fall instead of letting it fade).
const DRIPS = [
  { left: '27%', top: '45%', w: '2.6%', delay: '0s',   dur: '6.4s' },
  { left: '56%', top: '38%', w: '2.2%', delay: '2.9s', dur: '7.8s' },
  { left: '36%', top: '59%', w: '1.9%', delay: '5.2s', dur: '9.1s' },
]

function JellyCoat({ src }: { src: string }) {
  const reduced = useReducedMotion()

  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
      zIndex: 3,
      // The silhouette clip. `contain`/`center` mirrors the sprite <img>'s
      // object-fit exactly, so the mask is pixel-aligned with the art at any
      // box size. Nothing below can cross his outline.
      WebkitMaskImage: `url("${src}")`,
      maskImage: `url("${src}")`,
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
    }}>
      {/* GLAZE — a still highlight on the chest, and strawberry weight pooling
          toward the feet. Centred low enough to stay off his face. */}
      <span style={{
        position: 'absolute', inset: 0,
        background:
          'radial-gradient(34% 22% at 36% 52%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.09) 48%, rgba(255,255,255,0) 76%)',
        animation: reduced ? undefined : 'jellyCoatGlaze 7.5s ease-in-out infinite',
      }} />
      <span style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, ${TINT}0) 48%, ${TINT}0.13) 80%, ${TINT}0.24) 100%)`,
      }} />

      {/* DRIPS — syrup beads that swell, run down, and go. The child is the
          thread of syrup the bead leaves behind it: it hangs above the bead and
          rides the same transform, which is what separates a running drip from
          a bubble sliding down the glass. */}
      {!reduced && DRIPS.map(d => (
        <span key={d.left} style={{
          position: 'absolute', left: d.left, top: d.top,
          width: d.w, aspectRatio: '0.72',
          borderRadius: '50% 50% 58% 58%',
          background: 'linear-gradient(180deg, rgba(255,238,244,0.85) 0%, rgba(232,96,140,0.9) 38%, rgba(178,34,80,0.92) 100%)',
          opacity: 0,
          animation: `jellyCoatDrip ${d.dur} ease-in ${d.delay} infinite`,
        }}>
          <span style={{
            position: 'absolute', bottom: '58%', left: '30%', width: '40%', height: '260%',
            background: 'linear-gradient(180deg, rgba(200,52,98,0) 0%, rgba(200,52,98,0.5) 100%)',
            borderRadius: '50%',
          }} />
        </span>
      ))}
    </div>
  )
}

export default memo(JellyCoat)
