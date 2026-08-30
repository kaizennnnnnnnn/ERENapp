'use client'

// ═══════════════════════════════════════════════════════════════════════════
// ITEM PREVIEW — one drawing per shop item, used everywhere the item appears.
//
// The shop card, the buy sheet and the loadout strip all showed the item
// differently, and the card version was the weakest of the three: a wall
// fixture floating on black with nothing to give it scale, or a hat lying on
// its own with nothing to wear it. Both are fixed by showing the item WHERE
// IT GOES —
//
//   decor      inside a lit diorama of the room it hangs in
//   accessory  on a cat's head, at the anchor it will really ride
//   privilege  its own drawing (PowerArt)
//   prestige   your own name, already wearing it
//
// One component so those never drift apart again.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { pixelRects, gridAspect, type PixelArt } from '@/components/pixelGrid'
import { accessoryArt } from '@/components/care/accessoryArt'
import type {
  AnyShopItem, DecorItem, DecorRoom, AccessoryItem, PrivilegeItem, PrestigeItem,
} from '@/lib/trophyShop'
import DecorArt from './DecorArt'
import PowerArt from './PowerArt'
import { TitlePlate, FramePlate } from './prestigeArt'

// ─── Decor: a lit room, at doll's-house scale ────────────────────────────────

const ROOM_TILE: Record<DecorRoom, {
  wall: string; floor: string; rail: string; lamp: string
}> = {
  feed: {
    wall: 'linear-gradient(180deg, #46311A 0%, #2A1B0C 100%)',
    floor: '#5A3D1B', rail: '#7A5426', lamp: 'rgba(255,178,85,0.22)',
  },
  play: {
    wall: 'linear-gradient(180deg, #14402E 0%, #08231A 100%)',
    floor: '#1C5138', rail: '#2E7A54', lamp: 'rgba(99,240,148,0.20)',
  },
  sleep: {
    wall: 'linear-gradient(180deg, #271847 0%, #120A26 100%)',
    floor: '#33215C', rail: '#503484', lamp: 'rgba(187,120,255,0.20)',
  },
  wash: {
    wall: 'linear-gradient(180deg, #13374C 0%, #081E2C 100%)',
    floor: '#1B4A62', rail: '#2C6B8C', lamp: 'rgba(79,216,255,0.20)',
  },
}

/** Where the prop sits inside the tile — tuned for the tile, not the room. */
const TILE_AT: Record<DecorItem['art'], { left: number; top: number; width: number }> = {
  trophy_shelf:  { left: 16, top: 20, width: 68 },
  neon_champ:    { left: 12, top: 24, width: 76 },
  string_lights: { left: 2,  top: 8,  width: 96 },
  rosette:       { left: 34, top: 14, width: 32 },
  pennants:      { left: 1,  top: 12, width: 98 },
}

const SHELF_STOCK = { gold: 2, silver: 2, bronze: 3 }

export const DecorTile = memo(function DecorTile({ item, width = 76 }: {
  item: DecorItem; width?: number
}) {
  const t = ROOM_TILE[item.room]
  const at = TILE_AT[item.art]
  return (
    <div className="relative overflow-hidden" style={{
      width, height: Math.round(width * 0.8),
      background: t.wall,
      border: '1.5px solid rgba(0,0,0,0.7)',
      boxShadow: `inset 0 0 14px rgba(0,0,0,0.65), inset 0 0 0 1px ${t.rail}44`,
      borderRadius: 2,
    }}>
      {/* the light the prop hangs in */}
      <div aria-hidden className="absolute" style={{
        inset: '-20% -10% 30% -10%',
        background: `radial-gradient(ellipse at 50% 30%, ${t.lamp} 0%, transparent 70%)`,
      }} />
      {/* floor + skirting, so the wall has a bottom */}
      <div aria-hidden className="absolute left-0 right-0 bottom-0" style={{
        height: '22%', background: t.floor,
        borderTop: `2px solid ${t.rail}`,
      }} />
      <div className="absolute" style={{
        left: `${at.left}%`, top: `${at.top}%`, width: `${at.width}%`,
      }}>
        {/* A catalogue photo, so the shelf comes stocked. The real one reads
            your own history — see RoomDecor and the case. */}
        <DecorArt art={item.art} counts={SHELF_STOCK}
          px={Math.round(width * at.width / 100)} />
      </div>
    </div>
  )
})

// ─── Accessory: worn, not floating ───────────────────────────────────────────
// A front-on head, drawn once here rather than borrowed from the real sprite:
// the real one is a 512px PNG and the thumbnail has to stay pixel art. The
// anchor maths mirrors ErenAccessory — head line, eye midline, chest below the
// chin — so what the card shows is where it lands.

const HEAD: PixelArt = {
  grid: [
    '.KK.........KK.',
    'KMMK.......KMMK',
    'KMCK.......KCMK',
    'KMCCK.....KCCMK',
    '.KCCCCCCCCCCCK.',
    'KCCCCCCCCCCCCCK',
    'KCCEEPCCCEEPCCK',
    'KCCEWPCCCEWPCCK',
    'KCCCCCCCCCCCCCK',
    'KCCCCCNNCCCCCCK',
    'KCCCCKKKKCCCCCK',
    '.KCCCCCCCCCCCK.',
    '..KKCCCCCCCKK..',
    '....KKKKKKK....',
  ],
  palette: {
    K: '#2A2030', M: '#7E7272', C: '#F5F3EF',
    E: '#4898D4', P: '#1A1A2E', W: '#FFFFFF', N: '#F28898',
  },
}
const HEAD_W = 15
const SKULL_TOP = 4     // top of the skull, ears excluded
const EYE_MID = 7       // eye centre line
const CHIN = 12.4       // where a neck piece starts, tucked under the fur
const VIEW_W = 21       // room for a wide hat
const VIEW_H = 24       // room for a medal to hang below the chin
const HEAD_X = (VIEW_W - HEAD_W) / 2
const HEAD_Y = 2
// This head is a 15px stand-in, not the measured sprite: its neck is implied
// rather than drawn, so a chest piece scaled off the real head width comes out
// too small to read. Only the neck anchor needs the correction.
const NECK_THUMB_BOOST = 1.5

export const WornThumb = memo(function WornThumb({ item, size = 52 }: {
  item: AccessoryItem; size?: number
}) {
  const art = accessoryArt(item.art)
  const w = HEAD_W * item.scale * (item.anchor === 'neck' ? NECK_THUMB_BOOST : 1)
  const h = w * gridAspect(art.grid)
  const offX = (item.offset?.x ?? 0) * HEAD_W
  const offY = (item.offset?.y ?? 0) * HEAD_W

  const top =
    item.anchor === 'head' ? SKULL_TOP - h + offY
    : item.anchor === 'eyes' ? EYE_MID - h / 2 + offY
    : CHIN + offY
  const left = HEAD_X + (HEAD_W - w) / 2 + offX

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      shapeRendering="crispEdges"
      style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
      aria-hidden
    >
      <g transform={`translate(${HEAD_X} ${HEAD_Y})`} opacity={0.92}>
        {pixelRects(HEAD, 'h')}
      </g>
      <g transform={`translate(${left} ${top + HEAD_Y}) scale(${w / Math.max(...art.grid.map(r => r.length))})`}>
        {pixelRects(art, 'a')}
      </g>
    </svg>
  )
})

// ─── The dispatcher ──────────────────────────────────────────────────────────

export default function ItemPreview({ item, size = 76, name = 'YOU' }: {
  item: AnyShopItem
  /** Box width. Each kind fills it in its own aspect. */
  size?: number
  /** Whose name a frame should wrap. */
  name?: string
}) {
  if (item.kind === 'decor') return <DecorTile item={item as DecorItem} width={size} />
  if (item.kind === 'accessory') {
    return <WornThumb item={item as AccessoryItem} size={Math.round(size * 0.82)} />
  }
  if (item.kind === 'privilege') {
    return <PowerArt id={(item as PrivilegeItem).privilege} width={Math.round(size * 0.6)} />
  }
  const p = item as PrestigeItem
  return p.slot === 'title'
    ? <TitlePlate value={p.value} focus={p.focus} scale={6} glory={p.rarity === 'legendary'} />
    : <FramePlate tone={p.value} name={name} scale={6} />
}
