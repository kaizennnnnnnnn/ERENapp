'use client'

// ─── PixelPoof ──────────────────────────────────────────────────────────────
// A quick cartoon poof cloud — white/grey pixel puffs with a few gold stars —
// that bursts over Eren to MASK a pose-sticker swap. AI-generated pose art
// won't line up pixel-for-pixel with the standing sprite, so the scene flips
// the sticker underneath at the poof's peak (~halfway) and the swap is hidden
// inside the cloud. ~450ms, then it unmounts itself.
//
// Pure presentational: the parent mounts it (keyed so each poof restarts the
// keyframes) and removes it via onDone, while flipping its own `pose` state at
// poof peak. Everything is crispEdges SVG / CSS — no emojis, no blur.

import { useEffect } from 'react'

const DURATION_MS = 450

interface Props {
  /** px size of the cloud box. */
  size?: number
  /** Called after the poof finishes so the parent can unmount it. */
  onDone?: () => void
}

// Eight puff rects + three stars arranged around the centre. Fixed layout (no
// randomness) so it's deterministic and SSR-safe.
const PUFFS = [
  { x: 14, y: 22, s: 18, c: '#FFFFFF' },
  { x: 40, y: 12, s: 22, c: '#F2F2F7' },
  { x: 64, y: 20, s: 18, c: '#FFFFFF' },
  { x: 10, y: 46, s: 20, c: '#F2F2F7' },
  { x: 70, y: 46, s: 20, c: '#FFFFFF' },
  { x: 22, y: 62, s: 18, c: '#FFFFFF' },
  { x: 48, y: 66, s: 20, c: '#F2F2F7' },
  { x: 60, y: 60, s: 16, c: '#FFFFFF' },
]
const STARS = [
  { x: 30, y: 30, d: 0 },
  { x: 66, y: 36, d: 60 },
  { x: 38, y: 58, d: 120 },
]

export default function PixelPoof({ size = 120, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), DURATION_MS + 40)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: '50%', top: '50%',
        width: size, height: size,
        transform: 'translate(-50%, -50%)',
        zIndex: 24,
      }}
    >
      <svg
        width="100%" height="100%" viewBox="0 0 100 100"
        shapeRendering="crispEdges"
        style={{ animation: `erenPoof ${DURATION_MS}ms steps(4, end) forwards` }}
      >
        {PUFFS.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={p.s} height={p.s} rx={2} fill={p.c} />
        ))}
        {STARS.map((s, i) => (
          // 4-point pixel star: centre + 4 arms.
          <g key={`s${i}`} fill="#F5C842">
            <rect x={s.x} y={s.y - 3} width={3} height={3} />
            <rect x={s.x - 3} y={s.y} width={3} height={3} />
            <rect x={s.x + 3} y={s.y} width={3} height={3} />
            <rect x={s.x} y={s.y + 3} width={3} height={3} />
            <rect x={s.x} y={s.y} width={3} height={3} fill="#FFFBEB" />
          </g>
        ))}
      </svg>
    </div>
  )
}

export const POOF_PEAK_MS = DURATION_MS / 2
export const POOF_DURATION_MS = DURATION_MS
