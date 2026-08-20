'use client'

import { foodArt } from '@/lib/foodMeta'

// Every food's art, in ONE place. The kitchen shop/fridge/tray and the
// couple gift picker both render food through here, so a dish can never look
// like a real plate on one surface and a coloured block on the other.
//
// Dishes whose art is a real pixel-art PNG rather than a hand-drawn SVG below.
// Also re-arts four staples that shipped as SVGs (sardine / steak / chicken /
// egg — the chicken plate is the drumstick its description always promised,
// and the egg is the fried one), so their old SVG branches in FoodIcon are
// gone: this map is checked first. A picture of a food the shop ALREADY sells
// becomes that item's art; it never earns a second shop entry.
const FOOD_IMAGE_IDS = new Set([
  'pizza', 'carbonara', 'lasagna', 'risotto',
  'nigiri', 'temaki', 'maki',
  'ramen', 'pad_thai', 'gyoza', 'xiaolongbao',
  'cevapi', 'sarma', 'doner',
  'tacos', 'wrap', 'paella', 'stew', 'meatballs', 'roast_chicken',
  'sardine', 'steak', 'chicken', 'egg',
  // Second art drop: the staples and sweets that were still hand-drawn SVGs.
  // Biscuit is the fish-SHAPED one (paw-stamped cat biscuit, not a fresh fish —
  // `fish` has no art yet and keeps its SVG).
  'kibble', 'biscuit', 'tuna', 'salmon', 'shrimp', 'cake', 'jelly_caka',
  // Monsta cans. The normaliser clamps tall art to the box height, so every
  // can ends up the same 124px height — they line up as a set.
  'monsta_original', 'monsta_white', 'monsta_mango', 'monsta_loco',
  'monsta_pipeline', 'monsta_punch', 'monsta_rosa', 'monsta_peachy',
  'monsta_rainbow', 'monsta_gold',
])

// The whole donut case is real art (scripts/build_donuts.py), and every id in it
// starts `donut` — including the bare `donut`, whose hand-drawn SVG this
// replaced. Matched by prefix so adding a twenty-eighth donut needs no edit here.
const isDonut = (id: string) => id === 'donut' || id.startsWith('donut_')

export default function FoodIcon({ id, size = 32 }: { id: string; color?: string; size?: number }) {
  const S = size
  const V = '0 0 10 10'
  const base: React.CSSProperties = { imageRendering: 'pixelated' }
  const r = (x: number, y: number, w: number, h: number, f: string) =>
    <rect x={x} y={y} width={w} height={h} fill={f} />

  // Pixel-art plates. These are hi-res sources downscaled to 128px, so they
  // render SMOOTH (image-rendering auto) — `pixelated` would alias the
  // non-integer downscale into a shimmering mess. Same rule as the Eren body
  // sprites; only the true 10×10 SVGs below are pixel-snapped.
  //
  // Every PNG is a square canvas with the dish centred and scaled to one
  // visual size (`scripts/normalize_food_art.py`), so `contain` centres the
  // food itself and no dish outweighs another. foodArt() carries the cache-bust
  // and is shared with the gacha's item art.
  if (FOOD_IMAGE_IDS.has(id) || isDonut(id)) return (
    <img src={foodArt(id)} alt="" draggable={false} width={S} height={S}
      style={{ width: S, height: S, objectFit: 'contain', display: 'block' }} />
  )

  if (id === 'treat') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,2,4,1,'#FF85A2')}{r(2,3,6,4,'#FF6B9D')}{r(3,7,4,1,'#FF6B9D')}
      {r(4,4,2,2,'#FFB6CC')}{r(3,3,1,1,'rgba(255,255,255,0.4)')}
      {r(2,3,1,4,'#E05580')}{r(8,3,0,0,'transparent')}
    </svg>
  )
  if (id === 'fish') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,4,5,3,'#5BA3D9')}{r(3,3,3,1,'#6BB5E8')}{r(3,7,3,1,'#4A8ABB')}
      {r(7,3,1,2,'#4A8ABB')}{r(7,6,1,2,'#4A8ABB')}{r(8,4,1,1,'#4A8ABB')}
      {r(8,6,1,1,'#4A8ABB')}{r(3,4,1,1,'#222')}{r(3,4,1,1,'#fff')}
      {r(4,5,1,1,'#222')}{r(2,5,1,1,'#6BB5E8')}
      {r(5,5,1,1,'#74C0F0')}{r(4,4,1,1,'#74C0F0')}
    </svg>
  )
  if (id === 'sushi') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,4,6,3,'#fff')}{r(2,3,6,1,'#E8735A')}{r(3,2,4,1,'#F08060')}
      {r(2,7,6,1,'#1A1A2A')}{r(3,5,4,1,'#E8E4E0')}
      {r(3,3,1,1,'rgba(255,255,255,0.3)')}{r(2,8,6,1,'#2D9B6A')}
      {r(3,8,4,1,'#3AB87A')}
    </svg>
  )
  if (id === 'sausage') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,4,6,2,'#A0522D')}{r(3,3,4,1,'#B8633A')}{r(3,6,4,1,'#8B4020')}
      {r(1,4,1,2,'#C87850')}{r(8,4,1,2,'#8B4020')}
      {r(3,4,1,1,'#D09060')}{r(5,4,1,1,'#D09060')}{r(7,5,1,1,'#D09060')}
    </svg>
  )
  if (id === 'cream') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,5,4,3,'#A78BFA')}{r(2,6,1,2,'#A78BFA')}{r(7,6,1,2,'#A78BFA')}
      {r(3,8,4,1,'#8B6BDA')}{r(3,3,4,2,'#fff')}{r(4,2,2,1,'#fff')}
      {r(3,3,1,1,'rgba(200,180,255,0.4)')}{r(5,4,1,1,'rgba(200,180,255,0.3)')}
    </svg>
  )
  if (id === 'milk') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,3,4,5,'#E8E4E0')}{r(4,2,2,1,'#D0CCC8')}{r(3,8,4,1,'#C8C4C0')}
      {r(4,1,2,1,'#5BA3D9')}{r(3,2,1,1,'#D8D4D0')}{r(6,2,1,1,'#D8D4D0')}
      {r(4,4,1,2,'rgba(255,255,255,0.5)')}{r(5,5,1,1,'rgba(255,255,255,0.3)')}
    </svg>
  )
  if (id === 'cheese') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(1,4,7,4,'#F5C842')}{r(1,3,5,1,'#F5D060')}{r(8,7,1,1,'#F5C842')}
      {r(6,3,1,1,'#F5D060')}{r(7,4,1,2,'#E8B830')}{r(8,5,1,2,'#E8B830')}
      {r(3,5,2,2,'#E8B020')}{r(5,6,1,1,'#E8B020')}
      {r(2,4,1,1,'rgba(255,255,255,0.3)')}{r(1,8,7,1,'#D4A020')}
    </svg>
  )
  if (id === 'yogurt') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,4,4,4,'#FFB6C1')}{r(2,5,1,3,'#FFB6C1')}{r(7,5,1,3,'#FFB6C1')}
      {r(3,3,4,1,'#E8A0B0')}{r(4,2,2,1,'#C8C4C0')}{r(3,2,1,1,'#D8D4D0')}
      {r(6,2,1,1,'#D8D4D0')}{r(3,8,4,1,'#E898A8')}
      {r(4,5,2,1,'rgba(255,255,255,0.4)')}{r(4,4,1,1,'rgba(255,255,255,0.3)')}
    </svg>
  )
  if (id === 'cookie') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,3,6,4,'#C89A6B')}{r(3,2,4,1,'#D8AA7B')}{r(3,7,4,1,'#A07A4B')}
      {r(2,4,1,2,'#B88858')}{r(7,4,1,2,'#B88858')}
      {r(3,4,1,1,'#4A2A1A')}{r(5,3,1,1,'#4A2A1A')}
      {r(6,5,1,1,'#4A2A1A')}{r(4,5,1,1,'#4A2A1A')}
      {r(3,3,1,1,'rgba(255,255,255,0.3)')}
    </svg>
  )
  // fallback
  return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,3,4,4,'#aaa')}{r(4,4,2,2,'#888')}
    </svg>
  )
}
