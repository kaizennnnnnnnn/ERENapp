'use client'

// ─── BlinkingEren ──────────────────────────────────────────────────────────
// The static /erenGood.png sticker is a flat raster, so we can't animate
// just the eyes the way an editor would. The trick here: overlay two tiny
// dark "eyelid" rectangles exactly where the eyes are (positioned by % so
// they scale with any size), keep them collapsed (scaleY 0) most of the
// cycle, and briefly drop them down (scaleY 1) for ~150 ms every 5 s. The
// eye visually disappears under the eyelid — reads as a natural blink.
//
// Eye coordinates were measured from /erenGood.png — the two big blue
// ovals sit at roughly (38%, 32%) and (62%, 32%) of the image.

import React from 'react'

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Pixel size — used for the wrapper width/height. */
  size?: number
  /** Override the wrapper class (the underlying <img> always fills it). */
  className?: string
}

export default function BlinkingEren({
  size = 200,
  className = '',
  style,
  alt = 'Eren',
  ...imgProps
}: Props) {
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

      {/* Two eyelids — collapsed (scaleY 0) most of the time, briefly
          dropped down to cover the eyes during the blink keyframe. The
          stagger between L and R eye is intentional (~30 ms) — real cats
          and humans don't blink in perfect lockstep. */}
      <div className="absolute pointer-events-none" style={{
        left: '30.5%', top: '30%', width: '15%', height: '7%',
        background: 'linear-gradient(180deg, #3A2A20 0%, #5A3F2E 100%)',
        borderRadius: '50%',
        transform: 'scaleY(0)',
        transformOrigin: 'top',
        animation: 'erenBlink 5s infinite',
        boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.45)',
      }} />
      <div className="absolute pointer-events-none" style={{
        left: '54.5%', top: '30%', width: '15%', height: '7%',
        background: 'linear-gradient(180deg, #3A2A20 0%, #5A3F2E 100%)',
        borderRadius: '50%',
        transform: 'scaleY(0)',
        transformOrigin: 'top',
        animation: 'erenBlink 5s 0.03s infinite',
        boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.45)',
      }} />

      <style jsx global>{`
        /* 5-second cycle. Eyes are open 96% of the time. From 96% → 97%
           the eyelid drops down (close), holds at full coverage for the
           next 1.5%, then snaps back open over the final 1.5%. ≈ 150 ms
           closed, which matches a natural cat blink. */
        @keyframes erenBlink {
          0%, 96%   { transform: scaleY(0); }
          97%       { transform: scaleY(1.05); }
          98.5%     { transform: scaleY(1); }
          100%      { transform: scaleY(0); }
        }
      `}</style>
    </div>
  )
}
