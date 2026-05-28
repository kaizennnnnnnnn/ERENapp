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
          the eyelids and outfits move in lockstep with the body. */}
      <div style={{
        position: 'relative',
        width: '100%', height: '100%',
        transformOrigin: 'bottom center',
        animation: breathe ? 'erenBreathe 4s ease-in-out infinite' : undefined,
      }}>
        <img src="/erenGood.png" alt={alt} draggable={false}
          {...imgProps}
          style={{
            width: '100%', height: '100%',
            objectFit: 'contain',
            imageRendering: 'pixelated',
          }} />

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

      <style jsx global>{`
        @keyframes erenBlink {
          0%, 28%   { transform: scaleY(0); }
          30%       { transform: scaleY(1); }
          32%       { transform: scaleY(0); }
          60%, 62%  { transform: scaleY(0); }
          64%       { transform: scaleY(1); }
          66%       { transform: scaleY(0); }
          100%      { transform: scaleY(0); }
        }
        @keyframes erenBreathe {
          0%, 100% { transform: scaleY(1) translateY(0); }
          50%      { transform: scaleY(1.012) translateY(-1px); }
        }
      `}</style>
    </div>
  )
}
