// ═══════════════════════════════════════════════════════════════════════════
// THE WEATHER MACHINE — four parts, one machine, one house.
//
// Skies used to be bought one at a time: ten shop cards, ten prices, and a
// picker that was mostly padlocks. That made the sky a wardrobe. What you
// actually want to own is the MACHINE — so the shelf now sells the four parts
// it is missing, and the moment the last one goes in, every sky in the game is
// yours forever. One long thing to work toward instead of ten short ones.
//
// TWO PEOPLE, ONE MACHINE. Ownership rows are per-user (user_trophy_items),
// but the machine is a thing standing in a room they share. So it is built
// when the HOUSEHOLD owns all four — she buys the dish, he buys the lever, and
// the lab has a working machine. That is what useTrophies.ours() is for; using
// mine() here would mean paying for the same machine twice.
//
// PRICES COME FROM THE SERVER. The numbers below are for the card. The row in
// trophy_shop_items is what the player is charged (see
// supabase/migration_weather_machine.sql) — if the two disagree, the server
// wins and the card is a lie, so change both together.
// ═══════════════════════════════════════════════════════════════════════════

import type { ShopRarity } from '@/lib/trophyShop'

export type MachinePartId = 'coil' | 'gauge' | 'dish' | 'lever'

export interface MachinePart {
  id: MachinePartId
  /** The shop item id. Derivable both ways — see partItemId / partFromItemId. */
  itemId: string
  name: string
  /** One line on the card. Say what you will SEE bolted on, not what it is. */
  blurb: string
  price: number
  rarity: ShopRarity
  /** The card's accent, and the colour that piece glows once it is in. */
  tone: string
}

export function partItemId(id: MachinePartId): string {
  return `wxm_${id}`
}

export function partFromItemId(itemId: string): MachinePartId | null {
  if (!itemId.startsWith('wxm_')) return null
  const id = itemId.slice(4) as MachinePartId
  return MACHINE_PARTS.some(p => p.id === id) ? id : null
}

// Build order is deliberate: each part hangs off a DIFFERENT side of the
// husk (up the left, on the face, on the roof, out the right), so a half-built
// machine reads as a machine growing rather than a box gaining stickers. The
// price ramp is gentle at the start so the first part lands inside a week of
// won days, and steepest at the lever, which is the one that turns it on.
export const MACHINE_PARTS: MachinePart[] = [
  {
    id: 'coil',
    itemId: 'wxm_coil',
    name: 'Condenser Coil',
    blurb: 'The pipe up the left side fills with something warm, and it hums.',
    price: 10,
    rarity: 'common',
    tone: '#FFB65E',
  },
  {
    id: 'gauge',
    itemId: 'wxm_gauge',
    name: 'Pressure Gauge',
    blurb: 'A brass face on the front with a needle that will not sit still.',
    price: 15,
    rarity: 'rare',
    tone: '#F5C842',
  },
  {
    id: 'dish',
    itemId: 'wxm_dish',
    name: 'Sky Dish',
    blurb: 'The saucer on the roof, turning all day to find the weather.',
    price: 15,
    rarity: 'rare',
    tone: '#8FE0FF',
  },
  {
    id: 'lever',
    itemId: 'wxm_lever',
    name: 'Ignition Lever',
    blurb: 'The red-topped handle. Pull it and the glass finally lights up.',
    price: 20,
    rarity: 'epic',
    tone: '#FF7E6B',
  },
]

export const MACHINE_PART_IDS: string[] = MACHINE_PARTS.map(p => p.itemId)

/** What the whole machine costs, for the one line that says so. */
export const MACHINE_TOTAL_PRICE: number =
  MACHINE_PARTS.reduce((n, p) => n + p.price, 0)

export function machinePart(itemId: string | null | undefined): MachinePart | null {
  if (!itemId) return null
  return MACHINE_PARTS.find(p => p.itemId === itemId) ?? null
}

// ─── Is it built? ───────────────────────────────────────────────────────────
// Takes the household-ownership predicate rather than the wallet itself, so
// this module stays free of hooks and can be called from anywhere — the shop
// counter, the shelf strip, the prop in the Lab and the panel's gate all read
// THIS function, and none of them can drift into their own idea of "built".

export type OwnsPredicate = (itemId: string) => boolean

/** Is this one part in? The ONLY place the testing flag is read, so the art,
 *  the rack, the shop shelf and the gate can never disagree about it. */
export function partFitted(ours: OwnsPredicate, itemId: string): boolean {
  return MACHINE_ALWAYS_BUILT || ours(itemId)
}

export function partsInstalled(ours: OwnsPredicate): number {
  return MACHINE_PARTS.filter(p => partFitted(ours, p.itemId)).length
}

export function machineBuilt(ours: OwnsPredicate): boolean {
  return partsInstalled(ours) === MACHINE_PARTS.length
}

/** Trophies still owed on the parts nobody has bought yet. */
export function machineRemaining(ours: OwnsPredicate): number {
  return MACHINE_PARTS
    .filter(p => !partFitted(ours, p.itemId))
    .reduce((n, p) => n + p.price, 0)
}

// ─── TESTING ────────────────────────────────────────────────────────────────
// The machine handed over already built, so the picker can be exercised
// without grinding out sixty trophies first. ONE flag, deliberately — flip it
// back to `false` and the build is exactly as the player will meet it.
export const MACHINE_ALWAYS_BUILT: boolean = false
