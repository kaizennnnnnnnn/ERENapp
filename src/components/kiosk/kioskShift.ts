// ═══════════════════════════════════════════════════════════════════════════
// KIOSK SHIFT — the data behind serving shawarma.
// ──────────────────────────────────────────────────────────────────────────
// Everything here is pure: the art geometry (measured off the 768×1376 walls,
// see the comments per table), the order roll, and the order/build comparison.
// The moving parts live in useKioskShift.
// ═══════════════════════════════════════════════════════════════════════════

import { SKIN_DATA } from '@/lib/skinsData'

export type ToppingId = 'tomato' | 'onion' | 'cheese' | 'lettuce'

/** Uses per full tray, and per full spit. Both deplete one step at a time. */
export const MAX_USES = 5

// ── Toppings ──────────────────────────────────────────────────────────────
// `well` is the pan's inner quad as [topLeft, topRight, bottomRight, bottomLeft]
// in % of the picture box, traced off KioskLeftSide. The pans sit in
// perspective — the outer two lean away from the centre — so these are real
// quads, not rectangles, and the fill is clipped to them.
export interface ToppingDef {
  id: ToppingId
  label: string
  fill: string      // seamless texture that fills the pan
  sprite: string    // single item, for the fridge and the order ticket
  well: [number, number][]
}

export const TOPPINGS: ToppingDef[] = [
  { id: 'tomato',  label: 'Tomato',  fill: '/fill_tomato.webp',  sprite: '/fr_tomato.webp',
    well: [[14.06, 48.55], [28.39, 48.55], [26.95, 58.14], [11.46, 58.14]] },
  { id: 'onion',   label: 'Onion',   fill: '/fill_onion.webp',   sprite: '/fr_onion.webp',
    well: [[32.81, 48.55], [47.14, 48.55], [45.83, 58.14], [31.25, 58.14]] },
  { id: 'cheese',  label: 'Cheese',  fill: '/fill_cheese.webp',  sprite: '/fr_cheese.webp',
    well: [[52.08, 48.55], [66.41, 48.55], [67.97, 58.14], [52.60, 58.14]] },
  { id: 'lettuce', label: 'Lettuce', fill: '/fill_lettuce.webp', sprite: '/fr_lettuce.webp',
    well: [[71.35, 48.55], [85.68, 48.55], [88.54, 58.14], [73.18, 58.14]] },
]

export const TOPPING_BY_ID: Record<ToppingId, ToppingDef> =
  Object.fromEntries(TOPPINGS.map(t => [t.id, t])) as Record<ToppingId, ToppingDef>

export const PEPSI_SPRITE = '/fr_pepsi.webp'

// ── The spit ──────────────────────────────────────────────────────────────
// All five meat PNGs were drawn on canvases of the same 1536 height with the
// meat centred, so rendering each canvas at ONE height with the same top and
// centre lands every carve exactly where the artist put it. Crop them and the
// shrink falls apart.
export const MEAT_FRAMES = ['/meat1.webp', '/meat2.webp', '/meat3.webp', '/meat4.webp', '/meat5.webp']
/** Meat canvas box on KioskRightSide, % of the picture. */
export const SPIT_BOX = { left: 50, top: 14.10, height: 50.15 }
/** Tap/hold target over the roasting machine, % of the picture. */
export const SPIT_HIT = { left: 30, top: 22, width: 40, height: 40 }

// ── The fridge ────────────────────────────────────────────────────────────
// Shelf standing-lines and the headroom above each, measured off FridgeOpen.
// One item per shelf, top to bottom: the four toppings, then the Pepsi.
export const FRIDGE_SHELVES = [
  { base: 32.56, gap: 12.21 },
  { base: 44.70, gap: 10.90 },
  { base: 53.78, gap:  7.99 },
  { base: 63.95, gap:  9.08 },
  { base: 75.22, gap: 10.17 },
]
/** Tap target over the closed fridge on BackOffTheKiosk, % of the picture. */
export const FRIDGE_HIT = { left: 7, top: 22, width: 46, height: 56 }

// ── The window ────────────────────────────────────────────────────────────
/** The sill the customer is cut off by, % of InsideOfKiosk's height. */
export const SILL_PCT = 61.63
/** Customer box as % of the picture WIDTH, and how much of it clears the sill. */
export const CUSTOMER_W = 48
export const CUSTOMER_SHOW = 0.5

// ── Orders ────────────────────────────────────────────────────────────────
export interface Order {
  toppings: ToppingId[]
  pepsi: boolean
  /** Sprite for whoever walked up — a costume from the closet set. */
  skin: string
  name: string
}

export interface Build {
  meat: boolean
  toppings: ToppingId[]
  pepsi: boolean
}

export const EMPTY_BUILD: Build = { meat: false, toppings: [], pepsi: false }

/** Customers are drawn from the animal costumes — the food ones would be odd
 *  company for a shawarma. */
const CUSTOMER_SKINS = SKIN_DATA.filter(s => s.set === 'animal')

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/** One to three toppings, plus a coin-flip Pepsi. Meat is never asked for —
 *  every shawarma has it, which is why the spit is a step and not a choice. */
export function rollOrder(): Order {
  const want = 1 + Math.floor(Math.random() * 3)
  const pool = [...TOPPINGS]
  const toppings: ToppingId[] = []
  for (let i = 0; i < want; i++) {
    toppings.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id)
  }
  const skin = pick(CUSTOMER_SKINS)
  return {
    toppings,
    pepsi: Math.random() < 0.45,
    skin: skin.thumb,
    name: skin.name,
  }
}

/** Set equality on toppings — order of assembly doesn't matter, contents do.
 *  Meat is required on every wrap even though nobody asks for it. */
export function orderMatches(order: Order, build: Build): boolean {
  if (!build.meat) return false
  if (build.pepsi !== order.pepsi) return false
  if (build.toppings.length !== order.toppings.length) return false
  return order.toppings.every(t => build.toppings.includes(t))
}

/** Base wrap, a little per topping, a little for the drink. */
export function payout(order: Order): number {
  return 6 + order.toppings.length * 2 + (order.pepsi ? 3 : 0)
}

/** What the customer says when the wrap is wrong — kept vague on purpose, so
 *  you have to read your own ticket rather than being told the answer. */
export const REFUSALS = [
  'this isn’t what i ordered',
  'that’s not my order',
  'hey — wrong one',
  'nope, not mine',
]
