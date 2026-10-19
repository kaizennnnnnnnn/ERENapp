import type { CakeDef } from '@/lib/cakes'

/** SVG pixel-art cake in the cake's own palette (the menu, the sell fly-up). */
export default function CakeSprite({ cake, size }: { cake: CakeDef; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated', display: 'block' }}>
      <rect x="6" y="0" width="1" height="1" fill="#FBBF24" />
      <rect x="6" y="1" width="1" height="1" fill={cake.dark} />
      <rect x="3" y="2" width="6" height="1" fill={cake.main} />
      <rect x="2" y="3" width="8" height="1" fill={cake.main} />
      <rect x="3" y="3" width="2" height="1" fill={cake.light} />
      <rect x="6" y="3" width="2" height="1" fill={cake.light} />
      <rect x="1" y="4" width="10" height="1" fill={cake.dark} />
      <rect x="1" y="5" width="10" height="1" fill="#FDE68A" />
      <rect x="1" y="6" width="10" height="1" fill={cake.dark} />
      <rect x="1" y="7" width="10" height="1" fill="#FDE68A" />
      <rect x="1" y="8" width="10" height="1" fill={cake.dark} />
      <rect x="0" y="9" width="12" height="1" fill="#525252" />
      <rect x="0" y="9" width="12" height="1" fill="#9CA3AF" opacity="0.6" />
      <rect x="3" y="2" width="1" height="1" fill={cake.accent} />
      <rect x="7" y="2" width="1" height="1" fill={cake.accent} />
      <rect x="5" y="3" width="1" height="1" fill={cake.accent} />
    </svg>
  )
}
