import { cakeArt, type CakeDef } from '@/lib/cakes'

/** The same individual pastry artwork in the menu and sell fly-up. */
export default function CakeSprite({ cake, size }: { cake: CakeDef; size: number }) {
  return (
    <img src={cakeArt(cake.id)} alt="" width={size} height={size} draggable={false}
      style={{ width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', display: 'block' }} />
  )
}
