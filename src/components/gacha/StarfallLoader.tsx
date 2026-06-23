'use client'

// ─── StarfallLoader ───────────────────────────────────────────────────────
// Magical sprinkles raining from the sky, shown while a gacha opening video
// buffers so the load gap reads as part of the spell instead of a black screen.
// The page fades this out the instant the video can render its first frame.
//
// Same seeded-PRNG + palette language as CurtainGlitter, but the particles
// FALL (transform only) and TWINKLE (opacity only) — kept on separate CSS
// properties so the two animations compose on a single compositor-friendly
// element. Positions come from a seeded PRNG (no Math.random) so a remount is
// stable; negative delays pre-fill the sky so it's never empty on the first
// frame.

import { useMemo } from 'react'

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// Pink → lilac → gold → white: the gacha machine's own magical palette.
const COLORS = ['#FFE9F4', '#F9A8D4', '#C4B5FD', '#F5C842', '#FFFFFF']

interface Star {
  x: number; size: number; dur: number; delay: number
  drift: number; spin: number; tw: number
}

function makeStars(n: number, seed: number): Star[] {
  const rand = rng(seed)
  return Array.from({ length: n }, () => ({
    x: rand() * 100,                   // % across the sky
    size: 5 + Math.round(rand() * 7),  // 5–12px
    dur: 2.4 + rand() * 2.0,           // seconds to fall the full height
    delay: -rand() * 4,                // negative → field already mid-fall on mount
    drift: (rand() - 0.5) * 60,        // ±30px horizontal sway as it falls
    spin: 120 + rand() * 360,          // degrees of slow tumble
    tw: 0.7 + rand() * 0.8,            // twinkle period (s)
  }))
}

export default function StarfallLoader({ count = 44, seed = 909090 }: { count?: number; seed?: number }) {
  const stars = useMemo(() => makeStars(count, seed), [count, seed])
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <style>{`
        @keyframes sfFall {
          0%   { transform: translate3d(0, -12vh, 0) rotate(0deg); }
          100% { transform: translate3d(var(--drift), 112vh, 0) rotate(var(--spin)); }
        }
        @keyframes sfTwinkle {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
      `}</style>
      {stars.map((s, i) => {
        const color = COLORS[i % COLORS.length]
        return (
          <div key={i} style={{
            position: 'absolute', top: 0, left: `${s.x}%`,
            width: s.size, height: s.size, willChange: 'transform, opacity',
            ['--drift' as string]: `${s.drift}px`,
            ['--spin' as string]: `${s.spin}deg`,
            animation: `sfFall ${s.dur}s linear ${s.delay}s infinite, sfTwinkle ${s.tw}s steps(2, jump-none) infinite`,
          }}>
            <svg width={s.size} height={s.size} viewBox="0 0 12 12"
              style={{ display: 'block', filter: `drop-shadow(0 0 4px ${color})` }}>
              {/* 4-point sparkle */}
              <path d="M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6 Z" fill={color} />
            </svg>
          </div>
        )
      })}
    </div>
  )
}
