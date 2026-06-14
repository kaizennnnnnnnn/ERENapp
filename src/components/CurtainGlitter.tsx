'use client'

// ─── CurtainGlitter ───────────────────────────────────────────────────────
// The shared "magical seam" glitter you swipe through — between care rooms
// (CareSceneHost) and between gacha machines. A dense column of 4-point
// sparkle stars with white-hot cores and a coloured glow that twinkle at
// their own pace. Positions are generated from a seeded PRNG (no
// Math.random) so server and client render identically; pass different
// `seed`s to give two curtains distinct patterns.
//
// Drop it inside a positioned band element — the stars are absolutely
// positioned by percentage of that band.

import { useMemo } from 'react'

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

// 4-point sparkle star — a concave diamond that reads as a glint of glitter.
const STAR =
  'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)'

const COLORS = ['#FFE9F4', '#F9A8D4', '#C4B5FD', '#FFD84D', '#FFFFFF', '#A78BFA', '#FF8FCF']

interface Spark { x: number; y: number; size: number; rot: number; dur: number; delay: number }

function makeSparks(n: number, seed: number): Spark[] {
  const rand = rng(seed)
  return Array.from({ length: n }, () => {
    const r = rand()
    return {
      x: 6 + rand() * 88,                 // % across the band
      y: 2 + rand() * 96,                 // % down the band
      // Weighted size mix — a few big hero glints among many small ones.
      size: r > 0.8 ? 18 : r > 0.55 ? 14 : r > 0.3 ? 11 : 8,
      rot: Math.round(rand() * 90),
      dur: 1.1 + rand() * 1.0,            // seconds per twinkle
      delay: rand() * 1.2,
    }
  })
}

export default function CurtainGlitter({ count = 28, seed = 424242 }: { count?: number; seed?: number }) {
  const sparks = useMemo(() => makeSparks(count, seed), [count, seed])
  return (
    <>
      <style>{`@keyframes cgTwinkle {
        0%, 100% { opacity: 1;    transform: scale(1);    }
        50%      { opacity: 0.25; transform: scale(0.55); }
      }`}</style>
      {sparks.map((s, i) => {
        const color = COLORS[i % COLORS.length]
        return (
          <div key={i} className="absolute" style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            transform: 'translate(-50%, -50%)',
          }}>
            {/* Twinkle (scale/opacity) on a middle layer so it never fights
                the star's static rotation on the inner one. */}
            <div style={{
              width: '100%', height: '100%',
              animation: `cgTwinkle ${s.dur}s steps(2, jump-none) ${s.delay}s infinite`,
            }}>
              <div style={{
                width: '100%', height: '100%',
                transform: `rotate(${s.rot}deg)`,
                background: `radial-gradient(circle, #fff 0%, #fff 20%, ${color} 55%, ${color} 70%)`,
                clipPath: STAR,
                filter: `drop-shadow(0 0 ${Math.round(s.size * 0.55)}px ${color})`,
              }} />
            </div>
          </div>
        )
      })}
    </>
  )
}
