'use client'

// One, two or three catnip leaves, overlapped, the middle one raised: the
// battle's prize drawn as the amount it pays (the battle sheet's ladder, the
// morning verdict's strike).

import { MeadowIcon } from '@/components/PixelIcons'

export default function CatnipPile({ n, size }: { n: number; size: number }) {
  return (
    <span aria-hidden className="flex items-end justify-center" style={{ height: size + Math.round(size / 6) }}>
      {Array.from({ length: n }, (_, i) => (
        <MeadowIcon key={i} name="catnip" size={size} style={{
          // Tight in a small tile, looser when large so each face still reads.
          marginLeft: i ? -Math.round(size * (size >= 40 ? 0.2 : 0.38)) : 0,
          marginBottom: n === 3 && i === 1 ? Math.round(size / 6) : 0,
          position: 'relative', zIndex: n === 3 && i === 1 ? 1 : 0,
        }} />
      ))}
    </span>
  )
}
