'use client'

// ─── SpriteStrip ─────────────────────────────────────────────────────────────
// Plays a baked frame strip: one row of N equal frames, frame 0 first, baked
// from the sprite PNGs by scripts/anim_*.py (see src/lib/erenAnim.ts).
//
// The window is sized and placed from the strip's `rect` — percentages of the
// FULL sprite canvas — so a layer drops exactly onto the body PNG underneath
// with no letterbox math. The frames advance by sliding the row with a stepped
// transform, NOT by animating background-position: transform is the only
// property that stays on the compositor, and translateX(-100%) on a row that is
// N windows wide lands on frame k for every k with no off-by-one (a percentage
// background-position would step to k/N of the way along the row, which is not
// where frame k starts).

import type { CSSProperties } from 'react'
import type { ErenAnim } from '@/lib/erenAnim'

interface Props {
  anim: ErenAnim
  /** Extra styles on the window (z-index, opacity). */
  style?: CSSProperties
  /** Pause on the resting frame — for reduced motion, or while a reaction
   *  beat owns the sprite. */
  paused?: boolean
}

export default function SpriteStrip({ anim, style, paused = false }: Props) {
  const { src, frames, durationMs, kind, rect } = anim
  // 'blink' holds frame 0 for most of the cycle and flicks through 0-1-2-1-0
  // twice, on the same beat the old CSS erenBlink used; step-end makes each
  // keyframe stop a hard cut. 'loop' walks every frame evenly.
  const animation = paused
    ? undefined
    : kind === 'blink'
      ? `erenBlinkSlide ${durationMs}ms step-end infinite`
      : `erenStripSlide ${durationMs}ms steps(${frames}) infinite`

  return (
    <div aria-hidden="true" style={{
      position: 'absolute',
      left: `${rect.left}%`,
      top: `${rect.top}%`,
      width: `${rect.width}%`,
      height: `${rect.height}%`,
      overflow: 'hidden',
      pointerEvents: 'none',
      ...style,
    }}>
      <div style={{
        width: `${frames * 100}%`,
        height: '100%',
        backgroundImage: `url(${src})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        // Same smooth downscale as every other Eren sprite: these are hi-res
        // frames shrunk ~7x, and nearest-neighbour would alias them (and make
        // the step read as a crawling seam). See project_sprite_rendering.
        imageRendering: 'auto',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        animation,
      }} />
    </div>
  )
}
