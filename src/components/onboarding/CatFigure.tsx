'use client'

// The cat standing in an onboarding scene. A household with a look gets the
// live recolour (CatPortrait); `null` is the classic cat, and that is the real
// /erenGood.png art, the same file home shows for it. The recolour's own take
// on the classic coat comes out greyer than the art (see the Welcome board),
// so it is not used as a stand-in here.
//
// Framed exactly like CatPortrait: the cat's box cropped out of the 848x1264
// sprite (CAT_CROP), feet on the bottom edge. Smooth scaling, never pixelated.

import type { CSSProperties } from 'react'
import CatPortrait from '@/components/cat/CatPortrait'
import { CAT_CANVAS, CAT_CROP } from '@/lib/catRecolour'
import type { CatLook } from '@/lib/catIdentity'

interface Props {
  look: CatLook | null
  width: number
  height: number
  alt: string
  /** Drawn as a shadow: the joiner hasn't met this cat yet. */
  silhouette?: boolean
  quality?: 'full' | 'thumb'
  style?: CSSProperties
}

export default function CatFigure({ look, width, height, alt, silhouette, quality, style }: Props) {
  const shade: CSSProperties = silhouette ? { filter: 'brightness(0)', opacity: 0.85 } : {}
  if (look) {
    return <CatPortrait look={look} width={width} height={height} quality={quality} alt={alt} style={{ ...style, ...shade }} />
  }
  const sx = width / CAT_CROP.w
  const sy = height / CAT_CROP.h
  return (
    <div
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={{ width, height, overflow: 'hidden', ...style, ...shade }}
    >
      <img
        src="/erenGood.png"
        alt=""
        draggable={false}
        style={{
          display: 'block', maxWidth: 'none', width: CAT_CANVAS.w * sx, height: CAT_CANVAS.h * sy,
          marginLeft: -CAT_CROP.x * sx, marginTop: -CAT_CROP.y * sy,
        }}
      />
    </div>
  )
}
