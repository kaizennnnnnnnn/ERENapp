'use client'

// A wearable on a shop card. Same grid the cat wears, boxed to a square and
// centred, so what you buy is unmistakably what you saw.

import { memo } from 'react'
import { AccessorySvg, aspectOf } from '@/components/care/accessoryArt'
import type { AccessoryItem } from '@/lib/trophyShop'

export default memo(function AccessoryThumb({
  art, size = 40,
}: { art: AccessoryItem['art']; size?: number }) {
  const a = aspectOf(art)
  // Fit the grid inside the square by its longer side.
  const w = a > 1 ? size / a : size
  return (
    <div style={{
      width: size, height: size,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: w, height: w * a, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }}>
        <AccessorySvg art={art} />
      </div>
    </div>
  )
})
