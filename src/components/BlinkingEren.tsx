'use client'

// ─── BlinkingEren ──────────────────────────────────────────────────────────
// /erenGood.png is a flat raster — we can't animate just the eyes, so we
// overlay two tiny gray "eyelid" dots exactly where the eyes are. They're
// collapsed (scaleY 0) most of the time and briefly drop down (scaleY 1)
// every 5 s for a natural-looking blink.

import React from 'react'
import { useIsDark } from '@/hooks/useIsDark'

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  size?: number
  className?: string
  // Subtle idle breathing sway. On by default so Eren feels alive in every
  // room; pass false where a perfectly static sprite is wanted.
  breathe?: boolean
}

export default function BlinkingEren({
  size = 200,
  className = '',
  style,
  alt = 'Eren',
  breathe = true,
  ...imgProps
}: Props) {
  const isDark = useIsDark()
  // Drop brightness and a touch of saturation at night so the sprite
  // doesn't look weirdly lit-up against the dark room backgrounds.
  // Applied to the wrapper so the eyelid overlays darken in lockstep.
  const nightFilter = isDark ? 'brightness(0.7) saturate(0.85)' : undefined
  const lid: React.CSSProperties = {
    position: 'absolute',
    // Width widened by 1% (≈2px at size=200) so each lid reaches a touch
    // further left over the iris — pairs with the left offset shift below
    // so the extra pixels land on the inner edge of each eye.
    width: '7%',
    height: '5.5%',
    background: '#6B6B6B',
    borderRadius: 1,
    transform: 'scaleY(0)',
    transformOrigin: 'top',
    pointerEvents: 'none',
  }
  // Eye-shaped clip mask — sits over each iris (bounds measured off the
  // sprite) so the glint's twinkle/scale can never spill onto the eyelid or
  // fur. Ellipse-rounded to follow the eye outline.
  const eyeMask: React.CSSProperties = {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: '50%',
    pointerEvents: 'none',
  }
  // Animated eye glint — sits directly on top of the catchlight already
  // painted into the sprite and twinkles in place (erenEyeShine) so it looks
  // like that existing shine coming alive rather than a second dot. Sized as
  // a share of its eye mask; aspect-ratio keeps it circular. Clipped by the
  // mask, so it stays inside the eye. Rendered before the eyelids so a blink
  // paints over it.
  const glint: React.CSSProperties = {
    position: 'absolute',
    width: '39%',
    aspectRatio: '1',
    borderRadius: '50%',
    background:
      'radial-gradient(circle at 42% 38%, #ffffff 0%, #ffffff 30%, rgba(225,240,255,0.78) 54%, rgba(190,220,255,0) 80%)',
    willChange: 'transform, opacity',
  }

  return (
    <div className={`relative ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        filter: nightFilter,
        ...style,
      }}>
      {/* Breathing wrapper — gentle scaleY sway anchored at the feet so
          the upper body rises while the feet stay planted. willChange +
          backfaceVisibility force a dedicated GPU layer so the scale is
          composited smoothly (no pixel-seam lines). */}
      <div style={{
        position: 'relative',
        width: '100%', height: '100%',
        transformOrigin: 'bottom center',
        willChange: breathe ? 'transform' : undefined,
        backfaceVisibility: 'hidden',
        animation: breathe ? 'erenBreathe 4s ease-in-out infinite' : undefined,
      }}>
        <img src="/erenGood.png" alt={alt} draggable={false}
          {...imgProps}
          style={{
            width: '100%', height: '100%',
            objectFit: 'contain',
            imageRendering: 'pixelated',
          }} />

        {/* Eye glints — each clipped to an eye-shaped mask over the iris
            (measured iris bounds), centered on the baked catchlight inside,
            twinkling together (eyes track as one) so they share one keyframe. */}
        <div style={{ ...eyeMask, left: '39.3%', top: '32.8%', width: '5.7%', height: '5.4%' }}>
          <div style={{ ...glint, left: '49.4%', top: '2.9%', animation: 'erenEyeShine 5s ease-in-out infinite' }} />
        </div>
        <div style={{ ...eyeMask, left: '53.8%', top: '32.8%', width: '5.7%', height: '5.4%' }}>
          <div style={{ ...glint, left: '10.3%', top: '3.3%', animation: 'erenEyeShine 5s ease-in-out infinite' }} />
        </div>

        {/* Left eyelid — left edge nudged 1% (≈2px) further left so the
            widened lid covers the inner corner of the eye cleanly. */}
        <div style={{
          ...lid,
          left: '38%', top: '32.5%',
          animation: 'erenBlink 6s infinite',
        }} />
        {/* Right eyelid — same 1% leftward shift, and the prior 0.03s
            stagger is gone: cats blink with both lids together, and the
            tiny offset read as "left eye blinks first" on the sticker. */}
        <div style={{
          ...lid,
          left: '54%', top: '32.5%',
          animation: 'erenBlink 6s infinite',
        }} />
      </div>
    </div>
  )
}
