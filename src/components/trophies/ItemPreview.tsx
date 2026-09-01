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
//   weather    running live inside a little window pane
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
  AnyShopItem, WeatherItem, AccessoryItem, PrivilegeItem, PrestigeItem,
} from '@/lib/trophyShop'
import { WEATHER_BY_ID } from '@/lib/weather'
import WeatherFx from '@/components/weather/WeatherFx'
import PowerArt from './PowerArt'
import { TitlePlate, FramePlate } from './prestigeArt'

// ─── Weather: the sky, running, in a little window ───────────────────────────
// A still swatch cannot tell rain from a grey wash, so the card runs the real
// effect at thumbnail size. That is also the honest preview: these are sized in
// container units, so what a 76px pane shows is what a 76px window will show.

export const WeatherThumb = memo(function WeatherThumb({ item, width = 76 }: {
  item: WeatherItem; width?: number
}) {
  const def = WEATHER_BY_ID[item.weather]
  return (
    <div className="relative" style={{
      width, height: Math.round(width * 0.86),
      background: '#7A5A34',
      border: '2px solid #3A2614',
      borderRadius: 3,
      padding: 3,
      boxShadow: `0 0 10px ${def.tone}33, inset 0 1px 0 rgba(255,214,160,0.4)`,
    }}>
      <div className="relative w-full h-full overflow-hidden" style={{
        containerType: 'size',
        background: '#0B0F1E',
        boxShadow: 'inset 0 0 6px rgba(0,0,0,0.8)',
      }}>
        <WeatherFx id={item.weather} />
      </div>
      {/* A cross of glazing bars, so it reads as a window and not a swatch. */}
      <span aria-hidden className="absolute" style={{
        left: '50%', top: 3, bottom: 3, width: 2, marginLeft: -1,
        background: '#5C3F22', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
      }} />
      <span aria-hidden className="absolute" style={{
        top: '50%', left: 3, right: 3, height: 2, marginTop: -1,
        background: '#5C3F22', boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
      }} />
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
  if (item.kind === 'weather') return <WeatherThumb item={item as WeatherItem} width={size} />
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
