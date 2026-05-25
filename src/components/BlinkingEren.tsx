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
}

export default function BlinkingEren({
  size = 200,
  className = '',
  style,
  alt = 'Eren',
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
        animation: 'erenBlink 3s infinite',
      }} />
      {/* Right eyelid — tiny stagger so they're not perfectly synced */}
      <div style={{
        ...lid,
        left: '55%', top: '32.5%',
        animation: 'erenBlink 3s 0.03s infinite',
      }} />

      <style jsx global>{`
        @keyframes erenBlink {
          0%, 90%   { transform: scaleY(0); }
          92%       { transform: scaleY(1); }
          94%       { transform: scaleY(0); }
          96%       { transform: scaleY(1); }
          98%       { transform: scaleY(0); }
        }
      `}</style>
    </div>
  )
}
