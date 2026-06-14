'use client'

// ─── CurtainGlitter ───────────────────────────────────────────────────────
// The shared "magical seam" glitter you swipe through — between care rooms
// (CareSceneHost) and between gacha machines. A dense field of tiny glowing
// pixel particles that twinkle at their own pace. Positions are generated
// from a seeded PRNG (no Math.random) so server and client render
// identically; pass different `seed`s to give two curtains distinct
// patterns.
//
// Drop it inside a positioned band element — the particles are absolutely
// positioned by percentage of that band.

import { useMemo } from 'react'

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const COLORS = ['#FFE9F4', '#F9A8D4', '#C4B5FD', '#F5C842', '#FFFFFF']

interface Spark { x: number; y: number; size: number; dur: number; delay: number }

function makeSparks(n: number, seed: number): Spark[] {
  const rand = rng(seed)
  return Array.from({ length: n }, () => {
    const r = rand()
    return {
      x: 4 + rand() * 92,                 // % across the band
      y: 1 + rand() * 98,                 // % down the band
      size: r > 0.85 ? 7 : r > 0.6 ? 6 : r > 0.3 ? 5 : 4,
      dur: 1.1 + rand() * 1.0,            // seconds per twinkle
      delay: rand() * 1.2,
    }
  })
}

export default function CurtainGlitter({ count = 32, seed = 424242 }: { count?: number; seed?: number }) {
  const sparks = useMemo(() => makeSparks(count, seed), [count, seed])
  return (
    <>
      <style>{`@keyframes cgTwinkle {
        0%, 100% { opacity: 1;    transform: scale(1);   }
        50%      { opacity: 0.25; transform: scale(0.6); }
      }`}</style>
      {sparks.map((s, i) => {
        const color = COLORS[i % COLORS.length]
        return (
          <div key={i} className="absolute" style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            background: color,
            boxShadow: `0 0 ${s.size + 4}px ${color}`,
            animation: `cgTwinkle ${s.dur}s steps(2, jump-none) ${s.delay}s infinite`,
          }} />
        )
      })}
    </>
  )
}
