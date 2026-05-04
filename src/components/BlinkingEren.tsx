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
    width: '5%',
    height: '3%',
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

      {/* Left eyelid — centered on left eye (~38% horizontal). */}
      <div style={{
        ...lid,
        left: '35.5%', top: '32%',
        animation: 'erenBlink 5s infinite',
      }} />
      {/* Right eyelid — centered on right eye (~62% horizontal). Tiny
          stagger so the two eyes don't blink in perfect lockstep. */}
      <div style={{
        ...lid,
        left: '59.5%', top: '32%',
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
