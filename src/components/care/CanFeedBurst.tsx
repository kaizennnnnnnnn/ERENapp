'use client'

// ═══════════════════════════════════════════════════════════════════════════
// CAN FEED BURST — the payoff when a SPECIAL EDITION can goes down.
//
// Geometry is ErenGrantBurst's, which is the shape this codebase already
// trusts: N shards on evenly-spaced angles, thrown out on transform + opacity,
// staggered in threes so the ring doesn't read as one mechanical pop. Gold
// throws coins-and-shards; rainbow throws the spectrum.
//
// One soft haze ring is the ONLY blurred thing here, and it is a single
// element rather than a filter on each of the sixteen shards — that
// distinction is what keeps the burst off the janky path the gacha
// cinematics documented.
// ═══════════════════════════════════════════════════════════════════════════

import type { CanVariant } from './CanAura'

const SHARDS = 16
const RADIUS = 104
const DURATION_MS = 900

const HUES: Record<CanVariant, string[]> = {
  gold:    ['#FFF6D2', '#F5C842', '#FFE878', '#D4A818'],
  rainbow: ['#FF4D6D', '#FF9A3D', '#FFE23D', '#4BE07A', '#35C7F5', '#A65CF6'],
}

const HAZE: Record<CanVariant, string> = {
  gold:    'rgba(255,215,90,0.55)',
  rainbow: 'rgba(180,120,255,0.5)',
}

export default function CanFeedBurst({ variant, left = '50%', bottom = '46%' }: {
  variant: CanVariant
  /** Anchor inside the Eren container — defaults to roughly his muzzle. */
  left?: string
  bottom?: string
}) {
  const hues = HUES[variant]

  return (
    <div aria-hidden className="absolute pointer-events-none"
      style={{ left, bottom, width: 0, height: 0, zIndex: 24 }}>

      <div className="can-burst-haze" style={{
        position: 'absolute', left: -90, top: -90, width: 180, height: 180,
        borderRadius: '50%',
        background: `radial-gradient(closest-side, ${HAZE[variant]}, transparent 75%)`,
      }} />

      {Array.from({ length: SHARDS }, (_, i) => {
        const angle = (i / SHARDS) * Math.PI * 2 - Math.PI / 2
        const dx = Math.cos(angle) * RADIUS
        const dy = Math.sin(angle) * RADIUS
        const big = i % 2 === 0
        const px = big ? 13 : 9
        return (
          <span
            key={i}
            className="can-burst-shard"
            style={{
              position: 'absolute',
              left: -px / 2, top: -px / 2,
              width: px, height: px,
              background: hues[i % hues.length],
              clipPath: 'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)',
              // Per-shard destination, read by the keyframes.
              ['--bx' as string]: `${dx.toFixed(1)}px`,
              ['--by' as string]: `${dy.toFixed(1)}px`,
              animationDelay: `${(i % 3) * 45}ms`,
            }}
          />
        )
      })}

      <style jsx>{`
        .can-burst-shard {
          opacity: 0;
          animation: canBurstThrow ${DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: transform, opacity;
        }
        @keyframes canBurstThrow {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.3) rotate(0deg); }
          14%  { opacity: 1; transform: translate(calc(var(--bx) * 0.22), calc(var(--by) * 0.22)) scale(1.15) rotate(40deg); }
          100% { opacity: 0; transform: translate(var(--bx), var(--by)) scale(0.5) rotate(190deg); }
        }
        .can-burst-haze {
          opacity: 0;
          animation: canBurstHaze ${DURATION_MS}ms ease-out forwards;
        }
        @keyframes canBurstHaze {
          0%   { opacity: 0;    transform: scale(0.35); }
          22%  { opacity: 0.95; transform: scale(1); }
          100% { opacity: 0;    transform: scale(1.5); }
        }
        @media (prefers-reduced-motion: reduce) {
          .can-burst-shard, .can-burst-haze { animation: none; opacity: 0; }
        }
      `}</style>
    </div>
  )
}
