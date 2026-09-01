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
//   privilege  its own drawing (PowerArt)
//   prestige   your own name, already wearing it
//
// One component so those never drift apart again.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import type {
  AnyShopItem, WeatherItem, PrivilegeItem, PrestigeItem,
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

// ─── The dispatcher ──────────────────────────────────────────────────────────

export default function ItemPreview({ item, size = 76, name = 'YOU' }: {
  item: AnyShopItem
  /** Box width. Each kind fills it in its own aspect. */
  size?: number
  /** Whose name a frame should wrap. */
  name?: string
}) {
  if (item.kind === 'weather') return <WeatherThumb item={item as WeatherItem} width={size} />
  if (item.kind === 'privilege') {
    return <PowerArt id={(item as PrivilegeItem).privilege} width={Math.round(size * 0.6)} />
  }
  const p = item as PrestigeItem
  return p.slot === 'title'
    ? <TitlePlate value={p.value} focus={p.focus} scale={6} glory={p.rarity === 'legendary'} />
    : <FramePlate tone={p.value} name={name} scale={6} />
}
