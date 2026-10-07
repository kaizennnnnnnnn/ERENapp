'use client'

// ─── How a reward looks ──────────────────────────────────────────────────────
// One reward item as a tile (real art for food, an icon on its tint for the
// rest), its name, a line about it, and the small tokens for whatever rides
// along with a level's headline item. Shared by the road and the "claimed"
// sheet so a reward reads the same in both.

import type { CSSProperties } from 'react'
import FoodIcon from '@/components/care/FoodIcon'
import { MeadowIcon, M, RARITY_TAG, TINT, type MeadowIconName } from '@/components/meadow'
import { FOOD_META } from '@/lib/foodMeta'
import { DONUTS } from '@/lib/donuts'
import { DRINK_UNLOCK_SKINS, getSkin } from '@/lib/skins'
import { swapCatName, type CatWords } from '@/lib/catWords'
import type { RewardItem, SkinBoxRarity } from '@/lib/levelRewards'
import type { FoodKey } from '@/types'

/** Stardust reads violet next to the gold coin. */
const STARDUST_INK = '#9A73D6'

const ICON_LOOK: Record<'coins' | 'stardust' | 'tickets', { icon: MeadowIconName; tint: string; color?: string }> = {
  coins:    { icon: 'coin',    tint: TINT.amber },
  stardust: { icon: 'sparkle', tint: TINT.lilac, color: STARDUST_INK },
  tickets:  { icon: 'ticket',  tint: TINT.love },
}

export const RARITY_NAME: Record<SkinBoxRarity, string> = { rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

const GACHA_ONLY = new Set<string>(DONUTS.filter(d => d.source === 'gacha').map(d => d.id))

export const fmt = (n: number) => n.toLocaleString('en-US')

export const foodName = (key: FoodKey) => FOOD_META[key]?.name ?? key

/** A food named on its own: a donut whose name doesn't say so ("Arcade",
 *  "Tiger Tail") gets the word, so the road never reads as a riddle. */
export function foodTitle(key: FoodKey): string {
  const name = foodName(key)
  const donut = key === 'donut' || key.startsWith('donut_')
  return donut && !/donut/i.test(name) ? `${name} donut` : name
}

/** The tile behind an item: its art or icon on a soft tint. */
export function RewardTile({ item, size = 44, style }: { item: RewardItem; size?: number; style?: CSSProperties }) {
  const box: CSSProperties = {
    width: size, height: size, flexShrink: 0, borderRadius: size <= 44 ? 14 : 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', ...style,
  }
  if (item.kind === 'food') {
    return (
      <span aria-hidden style={{ ...box, background: TINT.orange }}>
        <FoodIcon id={item.foods[0]} size={Math.round(size * 0.8)} />
      </span>
    )
  }
  if (item.kind === 'skin') {
    return (
      <span aria-hidden style={{ ...box, background: RARITY_TAG[item.rarity].bg }}>
        <MeadowIcon name="gift" size={Math.round(size * 0.55)} />
      </span>
    )
  }
  const look = ICON_LOOK[item.kind]
  return (
    <span aria-hidden style={{ ...box, background: look.tint }}>
      <MeadowIcon name={look.icon} size={Math.round(size * 0.55)} color={look.color} />
    </span>
  )
}

/** "450 coins", "Gold Purrbolt", "World dishes ×6", "Epic skin". */
export function itemTitle(item: RewardItem): string {
  switch (item.kind) {
    case 'coins': return `${fmt(item.amount)} coins`
    case 'stardust': return `${fmt(item.amount)} stardust`
    case 'tickets': return item.amount === 1 ? '1 gacha ticket' : `${item.amount} gacha tickets`
    case 'skin': return `${RARITY_NAME[item.rarity]} skin`
    case 'food': {
      const same = item.foods.every(f => f === item.foods[0])
      if (same) return item.foods.length > 1 ? `${foodTitle(item.foods[0])} ×${item.foods.length}` : foodTitle(item.foods[0])
      return `${item.pack ?? 'Food'} ×${item.foods.length}`
    }
  }
}

/** A line about the headline item, when there's something worth saying. */
export function itemNote(item: RewardItem, cat: CatWords): string | null {
  if (item.kind === 'skin') return "A look your home doesn't have yet"
  if (item.kind !== 'food') return null
  const first = item.foods[0]
  const unlocks = DRINK_UNLOCK_SKINS[first]
  if (unlocks && item.foods.length === 1) {
    const look = getSkin(unlocks)
    return look ? `First pour unlocks ${swapCatName(look.name, cat)}` : null
  }
  if (GACHA_ONLY.has(first) && item.foods.length === 1) return 'Only the gacha has these'
  if (item.foods.every(f => f === first)) return null
  const names = item.foods.map(foodName)
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.join(', ')
}

/** The small tokens for everything after a level's headline item. */
export function ExtraTokens({ items }: { items: RewardItem[] }) {
  if (items.length === 0) return null
  return (
    <span aria-hidden style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px' }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>
          <ExtraIcon item={item} />
          {item.kind === 'tickets' ? `×${item.amount}`
            : item.kind === 'coins' || item.kind === 'stardust' ? fmt(item.amount)
            : itemTitle(item)}
        </span>
      ))}
    </span>
  )
}

function ExtraIcon({ item }: { item: RewardItem }) {
  if (item.kind === 'food') return <FoodIcon id={item.foods[0]} size={18} />
  if (item.kind === 'skin') return <MeadowIcon name="gift" size={16} />
  const look = ICON_LOOK[item.kind]
  return <MeadowIcon name={look.icon} size={16} color={look.color} />
}
