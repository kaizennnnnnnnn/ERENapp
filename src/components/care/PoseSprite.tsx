'use client'

// ─── PoseSprite ──────────────────────────────────────────────────────────────
// A flat full-body POSE sticker (curled-asleep, head-down-eating) shown in place
// of the standing BlinkingEren during a care action. Unlike BlinkingEren it
// carries NO eye overlays — the eyes are painted into the pose art — and no tail
// split. The PNGs are halo-cleaned and trimmed to their content (see
// scripts/process_poses.py), so the image's BOTTOM edge is Eren's contact line:
// the caller anchors the wrapper's bottom and centers by width, and he sits
// right on the surface with no object-fit letterbox math.
//
// It reuses the rooms' night-dim so it doesn't glow against a dark background,
// and the subtle erenBreathe scale so he still looks alive at rest.

import React from 'react'
import { useIsDark } from '@/hooks/useIsDark'

interface Props {
  src: string
  // On-screen width in px; height follows the art's aspect. Fixed px to match
  // the other room sprites (which also size in fixed px).
  width: number
  // Gentle breathing sway. On by default; pass false where a separate motion
  // (e.g. the eating chew bob) already carries the life.
  breathe?: boolean
  breatheDur?: number
  style?: React.CSSProperties
}

export default function PoseSprite({ src, width, breathe = true, breatheDur = 5, style }: Props) {
  const isDark = useIsDark()
  // The breathing scale lives on this WRAPPER, never on the <img>. The image is
  // `image-rendering: pixelated`, and animating a scale ON a pixelated element
  // re-samples it nearest-neighbour every frame, so a hard horizontal seam line
  // crawls up and down the sprite. Scaling a plain wrapper instead lets the
  // compositor scale the already-rasterised (sharp) image bilinearly — smooth,
  // no seam. (Same split BlinkingEren uses for its breathe.)
  return (
    <div style={{
      width,
      transformOrigin: 'bottom center',
      backfaceVisibility: 'hidden',
      willChange: breathe ? 'transform' : undefined,
      animation: breathe ? `erenBreathe ${breatheDur}s ease-in-out infinite` : undefined,
      ...style,
    }}>
      <img src={src} alt="Eren" draggable={false}
        style={{
          width: '100%', height: 'auto', display: 'block',
          // Tailwind's preflight sets `img { max-width: 100% }`; opt out so the
          // sprite is never capped below its intended width.
          maxWidth: 'none',
          imageRendering: 'pixelated',
          backfaceVisibility: 'hidden',
          filter: isDark ? 'brightness(0.7) saturate(0.85)' : undefined,
        }} />
    </div>
  )
}
