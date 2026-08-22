'use client'

// ─── SuperJelly ─────────────────────────────────────────────────────────────
// What a full tray of five becomes.
//
// It is NOT a sixth drawing. The Super Jelly is the five real flavours banded
// together in one mould — five copies of the actual art, each clipped to its
// own vertical fifth. That's the whole idea made visible: you can point at the
// stripe you won this morning. A newly drawn rainbow jelly would have said
// "here is another item"; this says "here is your day".
//
// The bands line up because every copy is stretched to the SAME box
// (objectFit: fill) instead of letterboxed — the five source PNGs differ by
// about 3% in aspect, which is invisible as a stretch but very visible as five
// silhouettes that don't quite agree along the seams.
//
// The gold rim is a drop-shadow on the wrapper, so it traces the composited
// alpha rather than a rounded rectangle — no mask, no second silhouette asset.

import { memo } from 'react'
import { JELLIES } from '@/lib/jellies'

/** Source arts average ~1.18:1. Matching it keeps each band's stretch tiny. */
const ASPECT = 1.18

interface Props {
  /** Width. A number is px; a string is used verbatim as a CSS length. */
  size?: number | string
  /** Gold rim + halo. Off for the small tray/HUD uses where it would smear. */
  glow?: boolean
  /** Slow set-gelatin wobble. Off for reduced motion and for static rows. */
  wobble?: boolean
  className?: string
}

const SuperJelly = memo(function SuperJelly({
  size = 96, glow = true, wobble = true, className = '',
}: Props) {
  const band = 100 / JELLIES.length

  return (
    <div aria-hidden className={`relative ${className}`} style={{
      width: size,
      aspectRatio: String(ASPECT),
      // drop-shadow twice: a tight gold edge, then a wider warm halo.
      filter: glow
        ? 'drop-shadow(0 0 2px rgba(255,226,120,0.95)) drop-shadow(0 0 10px rgba(255,180,60,0.55))'
        : undefined,
      animation: wobble ? 'superJellyWobble 3.6s ease-in-out infinite' : undefined,
      transformOrigin: 'bottom center',
    }}>
      {JELLIES.map((j, i) => (
        <img key={j.id} src={j.art} alt="" draggable={false} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'fill', imageRendering: 'auto',
          // Each flavour keeps only its own fifth of the mould.
          clipPath: `inset(0 ${100 - band * (i + 1)}% 0 ${band * i}%)`,
        }} />
      ))}

      {/* One highlight travelling across the whole mould, which is what makes
          five separate stripes read as a single piece of jelly rather than a
          colour chart. Clipped to the box; the arts' own alpha shapes it. */}
      <span style={{
        position: 'absolute', inset: '6% 8% 10% 8%', overflow: 'hidden', borderRadius: '46% 46% 22% 22%',
      }}>
        <span style={{
          position: 'absolute', top: '-30%', bottom: '-30%', left: 0, width: '34%',
          background: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
          animation: wobble ? 'superJellyShine 4.8s ease-in-out infinite' : undefined,
        }} />
      </span>
    </div>
  )
})

export default SuperJelly
