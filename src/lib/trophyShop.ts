// ═══════════════════════════════════════════════════════════════════════════
// THE TROPHY SHOP — the only place trophies are worth anything, and the only
// place these things can be got. Nothing here is buyable with coins, ever;
// that is the whole reason winning a day means something now.
//
// Four shelves:
//   weather    — the sky outside a room's window, for BOTH of you
//   privilege  — consumable powers that change the next battle
//   prestige   — a title and a nameplate frame beside your name
//
// Every `id` here must have a matching row in `trophy_shop_items`
// (supabase/migration_trophy_battle.sql) — the price the player is charged
// comes from THERE, not from here. The `price` field below is for the card
// only. If the two ever disagree, the server wins and the card is a lie, so
// when you add an item, add both.
// ═══════════════════════════════════════════════════════════════════════════

import type { BattleAction } from '@/lib/dailyTwist'
import { WEATHER_FOR_SALE, weatherItemId, type WeatherId } from '@/lib/weather'

export type ShopKind = 'weather' | 'privilege' | 'prestige'

export type ShopRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface ShopItem {
  id: string
  kind: ShopKind
  name: string
  /** One line on the card. Say what it DOES, not what it is. */
  blurb: string
  price: number
  rarity: ShopRarity
  /** True for privileges — buy the same one again. */
  stackable?: boolean
}

export interface WeatherItem extends ShopItem {
  kind: 'weather'
  weather: WeatherId
}

export type PrivilegeId =
  | 'eren_says' | 'double_hour' | 'point_steal' | 'streak_shield' | 'decay_freeze'

export interface PrivilegeItem extends ShopItem {
  kind: 'privilege'
  privilege: PrivilegeId
  /** Minutes it stays live. 0 = instant, one-shot. */
  minutes: number
}

export interface PrestigeItem extends ShopItem {
  kind: 'prestige'
  /** A title sits next to your name; a frame wraps it. */
  slot: 'title' | 'frame'
  /** Titles: the text. Frames: the palette key. */
  value: string
  /** Titles only — the action it brags about, for the icon. */
  focus?: BattleAction | null
}

export type AnyShopItem = WeatherItem | PrivilegeItem | PrestigeItem

// ─── Weather ─────────────────────────────────────────────────────────────────
// Built from lib/weather rather than restated here, so the shop, the machine
// in the Lab and the SQL price list cannot drift apart. The `wx_` prefix is
// derivable both ways (weatherItemId / weatherFromItemId).

export const WEATHERS: WeatherItem[] = WEATHER_FOR_SALE.map(w => ({
  id: weatherItemId(w.id),
  kind: 'weather' as const,
  weather: w.id,
  name: w.name,
  blurb: w.blurb,
  price: w.price,
  rarity: w.rarity,
}))

// ─── Privileges ──────────────────────────────────────────────────────────────
// The half of the shop that is not a picture. These change the NEXT battle,
// which is what stops the shop from being a wardrobe with extra steps.

export const PRIVILEGES: PrivilegeItem[] = [
  {
    id: 'priv_eren_says', kind: 'privilege', privilege: 'eren_says', minutes: 24 * 60,
    name: 'Eren Says', rarity: 'epic', price: 20, stackable: true,
    blurb: 'Write one line. Eren says it to them, all day, in his own bubble.',
  },
  {
    id: 'priv_double_hour', kind: 'privilege', privilege: 'double_hour', minutes: 60,
    name: 'Double Hour', rarity: 'rare', price: 15, stackable: true,
    blurb: 'For 60 minutes your care actions are worth double.',
  },
  {
    id: 'priv_point_steal', kind: 'privilege', privilege: 'point_steal', minutes: 0,
    name: 'Point Steal', rarity: 'epic', price: 18, stackable: true,
    blurb: 'Take one point off whoever is leading. Right now.',
  },
  {
    id: 'priv_streak_shield', kind: 'privilege', privilege: 'streak_shield', minutes: 0,
    name: 'Streak Shield', rarity: 'rare', price: 12, stackable: true,
    blurb: 'Survive one missed day without losing your care streak.',
  },
  {
    id: 'priv_decay_freeze', kind: 'privilege', privilege: 'decay_freeze', minutes: 180,
    name: 'Decay Freeze', rarity: 'common', price: 10, stackable: true,
    blurb: 'His stats hold still for three hours. Good before a long shift.',
  },
]

// ─── Prestige ────────────────────────────────────────────────────────────────

export const PRESTIGE: PrestigeItem[] = [
  {
    id: 'title_bath_boss', kind: 'prestige', slot: 'title', value: 'BATH BOSS', focus: 'wash',
    name: 'Bath Boss', rarity: 'common', price: 9,
    blurb: 'Sits beside your name everywhere your name appears.',
  },
  {
    id: 'title_night_shift', kind: 'prestige', slot: 'title', value: 'NIGHT SHIFT', focus: 'sleep',
    name: 'Night Shift', rarity: 'common', price: 9,
    blurb: 'For the one who always does the tuck-in.',
  },
  {
    id: 'title_head_chef', kind: 'prestige', slot: 'title', value: 'HEAD CHEF', focus: 'feed',
    name: 'Head Chef', rarity: 'common', price: 9,
    blurb: 'Runs the kitchen. Runs the bowl.',
  },
  {
    id: 'title_the_menace', kind: 'prestige', slot: 'title', value: 'THE MENACE', focus: 'play',
    name: 'The Menace', rarity: 'rare', price: 13,
    blurb: 'Wound the cat up and left the room.',
  },
  {
    id: 'title_undefeated', kind: 'prestige', slot: 'title', value: 'UNDEFEATED', focus: null,
    name: 'Undefeated', rarity: 'legendary', price: 45,
    blurb: 'The expensive one. Everyone knows what it cost.',
  },
  {
    id: 'frame_bronze', kind: 'prestige', slot: 'frame', value: 'bronze',
    name: 'Bronze Nameplate', rarity: 'common', price: 8,
    blurb: 'A worked bronze border around your name.',
  },
  {
    id: 'frame_silver', kind: 'prestige', slot: 'frame', value: 'silver',
    name: 'Silver Nameplate', rarity: 'rare', price: 16,
    blurb: 'Cold, clean and a little smug.',
  },
  {
    id: 'frame_gold', kind: 'prestige', slot: 'frame', value: 'gold',
    name: 'Gold Nameplate', rarity: 'epic', price: 28,
    blurb: 'It shines. There is a moving highlight and everything.',
  },
  {
    id: 'frame_champion', kind: 'prestige', slot: 'frame', value: 'champion',
    name: 'Champion Plate', rarity: 'legendary', price: 50,
    blurb: 'Gold, laurels, and a pulse. Absolutely too much.',
  },
]

// ─── Lookup ──────────────────────────────────────────────────────────────────

export const SHOP_ITEMS: AnyShopItem[] = [
  ...WEATHERS, ...PRIVILEGES, ...PRESTIGE,
]

const BY_ID = new Map<string, AnyShopItem>(SHOP_ITEMS.map(i => [i.id, i]))

export function shopItem(id: string): AnyShopItem | undefined {
  return BY_ID.get(id)
}

export function itemsOfKind(kind: ShopKind): AnyShopItem[] {
  return SHOP_ITEMS.filter(i => i.kind === kind)
}

export function weatherItem(id: string | null | undefined): WeatherItem | null {
  if (!id) return null
  const it = BY_ID.get(id)
  return it && it.kind === 'weather' ? it : null
}

export function prestigeDef(id: string | null | undefined): PrestigeItem | null {
  if (!id) return null
  const it = BY_ID.get(id)
  return it && it.kind === 'prestige' ? it : null
}

export const SHOP_RARITY_COLORS: Record<ShopRarity, { border: string; glow: string; text: string; bg: string }> = {
  common:    { border: 'rgba(160,160,170,0.5)', glow: 'rgba(160,160,170,0.20)', text: '#B0B0BA', bg: 'rgba(160,160,170,0.06)' },
  rare:      { border: 'rgba(96,165,250,0.5)',  glow: 'rgba(96,165,250,0.25)',  text: '#93C5FD', bg: 'rgba(96,165,250,0.06)' },
  epic:      { border: 'rgba(192,132,252,0.5)', glow: 'rgba(192,132,252,0.30)', text: '#D8B4FE', bg: 'rgba(192,132,252,0.06)' },
  legendary: { border: 'rgba(251,191,36,0.6)',  glow: 'rgba(251,191,36,0.35)',  text: '#FDE68A', bg: 'rgba(251,191,36,0.08)' },
}
