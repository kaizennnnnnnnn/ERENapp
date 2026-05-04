'use client'

// ─── BlinkingEren ──────────────────────────────────────────────────────────
// /erenGood.png is a flat raster — we can't animate just the eyes, so we
// overlay two tiny gray "eyelid" dots exactly where the eyes are. They're
// collapsed (scaleY 0) most of the time and briefly drop down (scaleY 1)
// every 5 s for a natural-looking blink.

import React from 'react'

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
  const lid: React.CSSProperties = {
    position: 'absolute',
    width: '6%',
    height: '4.5%',
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
        ...style,
      }}>
      <img src="/erenGood.png" alt={alt} draggable={false}
        {...imgProps}
        style={{
          width: '100%', height: '100%',
          objectFit: 'contain',
          imageRendering: 'pixelated',
        }} />

      {/* Left eyelid — pulled another 1% closer to center. New center
          41.5%, left = 38.5%. */}
      <div style={{
        ...lid,
        left: '38.5%', top: '32%',
        animation: 'erenBlink 5s infinite',
      }} />
      {/* Right eyelid — mirror of the left, centered at 58.5%. Tiny
          stagger so the two eyes don't blink in perfect lockstep. */}
      <div style={{
        ...lid,
        left: '55.5%', top: '32%',
        animation: 'erenBlink 5s 0.03s infinite',
      }} />

      <style jsx global>{`
        @keyframes erenBlink {
          0%, 96%   { transform: scaleY(0); }
          97%       { transform: scaleY(1); }
          98.5%     { transform: scaleY(1); }
          100%      { transform: scaleY(0); }
        }
      `}</style>
    </div>
  )
}
