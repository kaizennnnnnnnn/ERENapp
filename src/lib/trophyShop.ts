// ═══════════════════════════════════════════════════════════════════════════
// THE TROPHY SHOP — the only place trophies are worth anything, and the only
// place these things can be got. Nothing here is buyable with coins, ever;
// that is the whole reason winning a day means something now.
//
// Four shelves:
//   decor      — props that appear in a room for BOTH of you
//   accessory  — worn on Eren's head, over any skin, seen by both of you
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

export type ShopKind = 'decor' | 'accessory' | 'privilege' | 'prestige'

export type ShopRarity = 'common' | 'rare' | 'epic' | 'legendary'

/** Which room a decor prop hangs in. Matches the CareScene ids. */
export type DecorRoom = 'feed' | 'play' | 'sleep' | 'wash'

/** Where on the sprite an accessory rides. */
export type AccessoryAnchor = 'head' | 'eyes' | 'neck'

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

export interface DecorItem extends ShopItem {
  kind: 'decor'
  room: DecorRoom
  /** Which drawn prop renders it (components/decor/RoomDecor). */
  art: 'trophy_shelf' | 'neon_champ' | 'string_lights' | 'rosette' | 'pennants'
  /** Anchor inside the room box, as percentages. */
  at: { left: number; top: number; width: number }
}

export interface AccessoryItem extends ShopItem {
  kind: 'accessory'
  anchor: AccessoryAnchor
  /** Width as a fraction of the measured head width. */
  scale: number
  /** Nudge along the anchor, as a fraction of head width. +y is down. */
  offset?: { x?: number; y?: number }
  /** Which drawn accessory renders it (components/accessory/ErenAccessory). */
  art: 'crown' | 'party_hat' | 'medal' | 'shades' | 'bow' | 'flowers' | 'cans' | 'tophat'
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

export type AnyShopItem = DecorItem | AccessoryItem | PrivilegeItem | PrestigeItem

// ─── Decor ───────────────────────────────────────────────────────────────────
// Positions are percentages of the room box and were picked to sit on wall or
// shelf space, clear of Eren (who occupies roughly the middle third) and clear
// of the bottom action bar.

export const DECOR: DecorItem[] = [
  {
    id: 'decor_trophy_shelf', kind: 'decor', room: 'sleep', art: 'trophy_shelf',
    name: 'Trophy Shelf', rarity: 'legendary', price: 40,
    blurb: 'A real shelf. Every trophy you have ever won stands on it.',
    at: { left: 6, top: 17, width: 34 },
  },
  {
    id: 'decor_neon_champ', kind: 'decor', room: 'play', art: 'neon_champ',
    name: 'CHAMPION Sign', rarity: 'epic', price: 30,
    blurb: 'A neon sign that hums the winner\'s name at the playroom.',
    at: { left: 55, top: 12, width: 38 },
  },
  {
    id: 'decor_string_lights', kind: 'decor', room: 'feed', art: 'string_lights',
    name: 'String Lights', rarity: 'rare', price: 18,
    blurb: 'Warm bulbs strung across the kitchen. They blink out of sync.',
    at: { left: 4, top: 5, width: 92 },
  },
  {
    id: 'decor_rosette', kind: 'decor', room: 'wash', art: 'rosette',
    name: 'First Place Rosette', rarity: 'rare', price: 16,
    blurb: 'A prize ribbon pinned above the tub, where it will get damp.',
    at: { left: 72, top: 14, width: 20 },
  },
  {
    id: 'decor_pennants', kind: 'decor', room: 'play', art: 'pennants',
    name: 'Victory Pennants', rarity: 'common', price: 10,
    blurb: 'A row of little flags. One per bunting, no deeper meaning.',
    at: { left: 3, top: 6, width: 94 },
  },
]

// ─── Accessories ─────────────────────────────────────────────────────────────
// Worn over ANY skin — they sit on the measured head, not on a per-skin
// hand-placed point, so a new skin needs no accessory work at all.
// `scale` is a fraction of head WIDTH so a wide hood and a narrow cat get a
// crown of proportionate size rather than the same number of pixels.

export const ACCESSORIES: AccessoryItem[] = [
  {
    id: 'acc_crown', kind: 'accessory', art: 'crown', anchor: 'head', scale: 0.62,
    name: 'Winner\'s Crown', rarity: 'legendary', price: 35,
    blurb: 'Gold, slightly too big. Auto-worn all day after you win.',
    offset: { y: 0.04 },
  },
  {
    id: 'acc_party_hat', kind: 'accessory', art: 'party_hat', anchor: 'head', scale: 0.42,
    name: 'Party Hat', rarity: 'common', price: 8,
    blurb: 'Cone. Pompom. Elastic under the chin he keeps chewing.',
    offset: { x: 0.1, y: 0.02 },
  },
  {
    id: 'acc_tophat', kind: 'accessory', art: 'tophat', anchor: 'head', scale: 0.5,
    name: 'Tiny Top Hat', rarity: 'rare', price: 14,
    blurb: 'For a cat with somewhere formal to be.',
    offset: { y: 0.03 },
  },
  {
    id: 'acc_flowers', kind: 'accessory', art: 'flowers', anchor: 'head', scale: 0.78,
    name: 'Flower Crown', rarity: 'rare', price: 14,
    blurb: 'Daisies. He will eat one within the hour.',
    offset: { y: 0.14 },
  },
  {
    id: 'acc_cans', kind: 'accessory', art: 'cans', anchor: 'head', scale: 0.98,
    name: 'Headphones', rarity: 'epic', price: 22,
    blurb: 'He is not listening. He was never listening.',
    // Sunk further than anything else on purpose: the cans have to reach his
    // ears, which are most of the way down the head, or they hang beside his
    // eyes and read as two blue tears.
    offset: { y: 0.32 },
  },
  {
    id: 'acc_shades', kind: 'accessory', art: 'shades', anchor: 'eyes', scale: 0.72,
    name: 'Cool Shades', rarity: 'epic', price: 22,
    blurb: 'Worn indoors, at night, during a bath.',
  },
  {
    id: 'acc_medal', kind: 'accessory', art: 'medal', anchor: 'neck', scale: 0.34,
    name: 'Gold Medal', rarity: 'epic', price: 26,
    blurb: 'On a ribbon. Hangs at the chest and swings when he breathes.',
  },
  {
    id: 'acc_bow', kind: 'accessory', art: 'bow', anchor: 'neck', scale: 0.4,
    name: 'Bow Tie', rarity: 'common', price: 8,
    blurb: 'Clip-on. Nobody needs to know.',
  },
]

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
  ...DECOR, ...ACCESSORIES, ...PRIVILEGES, ...PRESTIGE,
]

const BY_ID = new Map<string, AnyShopItem>(SHOP_ITEMS.map(i => [i.id, i]))

export function shopItem(id: string): AnyShopItem | undefined {
  return BY_ID.get(id)
}

export function itemsOfKind(kind: ShopKind): AnyShopItem[] {
  return SHOP_ITEMS.filter(i => i.kind === kind)
}

export function accessoryDef(id: string | null | undefined): AccessoryItem | null {
  if (!id) return null
  const it = BY_ID.get(id)
  return it && it.kind === 'accessory' ? it : null
}

export function decorDef(id: string | null | undefined): DecorItem | null {
  if (!id) return null
  const it = BY_ID.get(id)
  return it && it.kind === 'decor' ? it : null
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
