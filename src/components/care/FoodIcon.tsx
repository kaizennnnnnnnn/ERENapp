'use client'

import { FOOD_META, foodArt } from '@/lib/foodMeta'
import CanFx, { hasCanFx } from './CanFx'

// Shop, fridge, feeding and gifts share the same catalogue artwork. Legacy
// stock resolves through foodArt's aliases instead of losing its stored key.
export default function FoodIcon({ id, size = 32 }: { id: string; color?: string; size?: number }) {
  if (Object.prototype.hasOwnProperty.call(FOOD_META, id)) {
    const art = (
      <img src={foodArt(id)} alt="" draggable={false} width={size} height={size}
        style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />
    )
    if (!hasCanFx(id)) return art
    return (
      <span style={{ position: 'relative', display: 'block', width: size, height: size }}>
        {art}
        <CanFx id={id} />
      </span>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 10 10" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x={3} y={3} width={4} height={4} fill="#aaa" />
      <rect x={4} y={4} width={2} height={2} fill="#888" />
    </svg>
  )
}
