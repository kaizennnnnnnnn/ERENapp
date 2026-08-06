'use client'

// ═══════════════════════════════════════════════════════════════════════════
// SPARKLE FIELD — scattered, twinkling 4-point stars for atmospheric
// backdrops (the mood gate's sky, the onboarding night).
//
// Two things it deliberately is NOT:
//   · a repeating radial-gradient background-size lattice. A perfect grid of
//     dots reads as wallpaper, not sky — it was the single loudest "cheap"
//     signal on both of those screens.
//   · a "✦" text glyph. Those render in whatever font is around and can't be
//     sized or coloured reliably.
//
// Placement comes from a seeded PRNG, so the server and the client agree on
// the layout; Math.random() here would hydrate-mismatch on every load.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react'

/** Concave 4-point star. Shared so ornaments elsewhere can match the field. */
export const SPARKLE_CLIP =
  'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)'

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Props {
  /** Hues to draw from. Pick ones that survive the backdrop behind them. */
  colors: string[]
  count?: number
  seed?: number
  /** Change to reshuffle without touching the seed of another field. */
  minSize?: number
  maxSize?: number
  /**
   * 0 = spread evenly, 1 = push everything to the left/right margins. Use a
   * high value when a character or a card owns the middle of the screen.
   */
  edgeBias?: number
  className?: string
}

export default function SparkleField({
  colors, count = 34, seed = 0x5eed,
  minSize = 3, maxSize = 8, edgeBias = 0.72, className,
}: Props) {
  const sparkles = useMemo(() => {
    const rnd = mulberry32(seed)
    return Array.from({ length: count }, () => {
      const margin = rnd() < 0.5 ? rnd() * 26 : 74 + rnd() * 26
      return {
        left: rnd() < edgeBias ? margin : rnd() * 100,
        top: rnd() * 100,
        size: minSize + rnd() * (maxSize - minSize),
        color: colors[Math.floor(rnd() * colors.length)],
        delay: rnd() * 4,
        dur: 2.2 + rnd() * 2.6,
        opacity: 0.45 + rnd() * 0.55,
      }
    })
  }, [colors, count, seed, minSize, maxSize, edgeBias])

  return (
    <div aria-hidden className={className ?? 'absolute inset-0 pointer-events-none overflow-hidden'}>
      {sparkles.map((s, i) => (
        <span key={i} style={{
          position: 'absolute',
          left: `${s.left}%`, top: `${s.top}%`,
          width: s.size, height: s.size,
          background: s.color,
          clipPath: SPARKLE_CLIP,
          opacity: s.opacity,
          animation: `mgTwinkle ${s.dur}s ease-in-out infinite`,
          animationDelay: `-${s.delay}s`,
        }} />
      ))}
    </div>
  )
}
