// ═══════════════════════════════════════════════════════════════════════════
// THE TROPHY SHOP — the only place trophies are worth anything, and the only
// place these things can be got. Nothing here is buyable with coins, ever;
// that is the whole reason winning a day means something now.
//
// Three shelves:
//   machine    — the four parts of the weather machine in the Lab, for BOTH of you
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
import { MACHINE_PARTS, type MachinePartId } from '@/lib/weatherMachine'

export type ShopKind = 'machine' | 'privilege' | 'prestige'

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

export interface MachinePartItem extends ShopItem {
  kind: 'machine'
  part: MachinePartId
  /** Build order. The shelf and the rack in the Lab both sort by it. */
  order: number
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

export type AnyShopItem = MachinePartItem | PrivilegeItem | PrestigeItem

// ─── The machine ─────────────────────────────────────────────────────────────
// One shelf that sells one thing four times. Skies used to be ten separate
// cards here; what the household actually wants to own is the machine that
// makes them, so the shelf sells the parts and lib/weatherMachine owns what
// each part looks like once it is bolted on. Derived rather than restated, for
// the same reason the skies were: the shop, the prop in the Lab and the SQL
// price list must not be able to drift.

export const PARTS: MachinePartItem[] = MACHINE_PARTS.map((p, i) => ({
  id: p.itemId,
  kind: 'machine' as const,
  part: p.id,
  order: i,
  name: p.name,
  blurb: p.blurb,
  price: p.price,
  rarity: p.rarity,
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
  ...PARTS, ...PRIVILEGES, ...PRESTIGE,
]

const BY_ID = new Map<string, AnyShopItem>(SHOP_ITEMS.map(i => [i.id, i]))

export function shopItem(id: string): AnyShopItem | undefined {
  return BY_ID.get(id)
}

/**
 * The two powers that spend themselves on a second person.
 *
 * `eren_says` puts a line in the OTHER member's bubble and `point_steal` takes
 * a point off whoever is leading, and both self-filter to somebody who is not
 * you. Bought by a household of one they take the trophies and do nothing:
 * Eren Says shows "Eren will say this to them" with `them` a literal fallback
 * string and no `them` to say it to, and Point Steal is only blocked when
 * there is no leader at all, so it happily charges 18 trophies to steal from
 * an empty seat.
 *
 * Hidden from the shelf rather than made to work. Pointing them at Eren would
 * mean either letting a player steal from the pace-setter (the same printing
 * press the whole opponent design exists to avoid) or dropping the self-filter
 * in trophyEffects, which would let a PAIRED player target themselves.
 *
 * The caller keeps anything already OWNED on the shelf, so a household that
 * bought one while paired can still see and spend it.
 */
export const PARTNER_ONLY_PRIVILEGES = new Set(['priv_eren_says', 'priv_point_steal'])

export function itemsOfKind(kind: ShopKind): AnyShopItem[] {
  return SHOP_ITEMS.filter(i => i.kind === kind)
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
