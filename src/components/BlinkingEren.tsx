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
    width: '6%',
    height: '5.5%',
    background: '#6B6B6B',
    borderRadius: 1,
    transform: 'scaleY(0)',
    transformOrigin: 'top',
    pointerEvents: 'none',
  }
  // Animated eye glint — sits directly on top of the catchlight already
  // painted into the sprite, sized to match it, and twinkles in place
  // (erenEyeShine) so it looks like that existing shine coming alive rather
  // than a second dot. Rendered before the eyelids so a blink paints over it.
  const glint: React.CSSProperties = {
    position: 'absolute',
    width: '2.2%',
    height: '2.2%',
    borderRadius: '50%',
    background:
      'radial-gradient(circle at 42% 38%, #ffffff 0%, #ffffff 30%, rgba(225,240,255,0.78) 54%, rgba(190,220,255,0) 80%)',
    willChange: 'transform, opacity',
    pointerEvents: 'none',
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

        {/* Eye glints — centered on the sprite's baked catchlights
            (measured at 43.2%/55.5% x, 34.1% y) and twinkling together
            (eyes track as one), so they share one keyframe with no stagger. */}
        <div style={{ ...glint, left: '42.1%', top: '33%', animation: 'erenEyeShine 5s ease-in-out infinite' }} />
        <div style={{ ...glint, left: '54.4%', top: '33%', animation: 'erenEyeShine 5s ease-in-out infinite' }} />

        {/* Left eyelid */}
        <div style={{
          ...lid,
          left: '39%', top: '32.5%',
          animation: 'erenBlink 6s infinite',
        }} />
        {/* Right eyelid — tiny stagger so they're not perfectly synced */}
        <div style={{
          ...lid,
          left: '55%', top: '32.5%',
          animation: 'erenBlink 6s 0.03s infinite',
        }} />
      </div>
    </div>
  )
}
