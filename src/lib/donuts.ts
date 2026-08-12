import type { DonutKey } from '@/types'
import { hashString, mulberry32, shuffled } from './seededRng'

// ═══════════════════════════════════════════════════════════════════════════
// DONUTS — one catalogue, three storefronts.
// ──────────────────────────────────────────────────────────────────────────
// Twenty-seven pixel-art donuts (art built by scripts/build_donuts.py into
// public/food/<id>.png). They are ordinary fridge foods: you buy one, it lands
// in your pile, you drag it to Eren like anything else. What differs is WHERE
// you can get one, and that is the only thing `source` means:
//
//   kitchen — always on sale in the kitchen shop's DONUTS shelf.
//   bakery  — only from the bakery's donut case, and only on the day it is one
//             of the three on the tray (see dailyDonuts).
//   gacha   — not for sale anywhere. Snacks & Drinks pulls only, which is what
//             makes them worth chasing — same rule the Rainbow Monsta lives by.
//
// Every donut is a dessert, so unlike a plain meal they all carry real joy
// (see the happyD rule at the top of FeedScene's SHOP_ITEMS).
// ═══════════════════════════════════════════════════════════════════════════

export interface DonutDef {
  id: DonutKey
  name: string
  /** Coins. One price per donut wherever it's sold — the bakery is not a markup. */
  price: number
  hungerD: number
  happyD: number
  weightD: number
  /** One line under the name in the shop card. Keep it short and dry. */
  desc: string
  /** Swatch colour — the bowl, crumbs and buy button take it. Sampled off the glaze. */
  color: string
  source: 'kitchen' | 'bakery' | 'gacha'
}

export const DONUTS: DonutDef[] = [
  // ── Kitchen shelf ────────────────────────────────────────────────────────
  // `donut` predates the rest of this list (Phase 3 wishes ask for it by that
  // id, so it keeps the bare name) and is simply the pink one.
  { id: 'donut',        name: 'Donut',        price: 14, hungerD: 12, happyD: 22, weightD: 0.04, desc: 'Pink & sprinkled',      color: '#FF8FB0', source: 'kitchen' },
  { id: 'donut_choco',  name: 'Choco Donut',  price: 16, hungerD: 13, happyD: 24, weightD: 0.05, desc: 'Cocoa & rainbow bits',  color: '#6B3F2A', source: 'kitchen' },

  // ── Bakery case ──────────────────────────────────────────────────────────
  { id: 'donut_vanilla',      name: 'Vanilla Sprinkle', price: 22, hungerD: 12, happyD: 26, weightD: 0.04, desc: 'Snow glaze, confetti',   color: '#F2E6D6', source: 'bakery' },
  { id: 'donut_honey',        name: 'Honey Glazed',     price: 20, hungerD: 14, happyD: 24, weightD: 0.05, desc: 'The classic sugar shell', color: '#D9A05B', source: 'bakery' },
  { id: 'donut_caramel',      name: 'Salted Caramel',   price: 26, hungerD: 14, happyD: 28, weightD: 0.05, desc: 'Toffee & sea salt',      color: '#B5651D', source: 'bakery' },
  { id: 'donut_mint',         name: 'Mint Choc Chip',   price: 26, hungerD: 12, happyD: 28, weightD: 0.04, desc: 'Cool mint, dark chips',  color: '#8FD9BE', source: 'bakery' },
  { id: 'donut_matcha',       name: 'Matcha',           price: 28, hungerD: 12, happyD: 28, weightD: 0.04, desc: 'Stone-ground tea glaze', color: '#8FB93A', source: 'bakery' },
  { id: 'donut_blueberry',    name: 'Blueberry',        price: 26, hungerD: 13, happyD: 27, weightD: 0.05, desc: 'Berries in the icing',   color: '#8E92D6', source: 'bakery' },
  { id: 'donut_red_velvet',   name: 'Red Velvet',       price: 30, hungerD: 14, happyD: 30, weightD: 0.06, desc: 'Cream cheese crown',     color: '#B02036', source: 'bakery' },
  { id: 'donut_mocha',        name: 'Mocha Bean',       price: 28, hungerD: 13, happyD: 28, weightD: 0.05, desc: 'Coffee beans & drizzle', color: '#C9A77C', source: 'bakery' },
  { id: 'donut_lattice',      name: 'Berry Lattice',    price: 30, hungerD: 15, happyD: 29, weightD: 0.06, desc: 'Pie crust woven on top', color: '#6B4C9A', source: 'bakery' },
  { id: 'donut_sakura',       name: 'Sakura',           price: 32, hungerD: 12, happyD: 32, weightD: 0.04, desc: 'Cherry blossom petals',  color: '#F5A7C0', source: 'bakery' },
  { id: 'donut_hibiscus',     name: 'Hibiscus',         price: 32, hungerD: 12, happyD: 32, weightD: 0.04, desc: 'Dragonfruit & a flower', color: '#E5187F', source: 'bakery' },
  { id: 'donut_black_forest', name: 'Black Forest',     price: 34, hungerD: 15, happyD: 32, weightD: 0.07, desc: 'Cocoa, cream, cherries', color: '#4A2C22', source: 'bakery' },
  { id: 'donut_ube',          name: 'Ube',              price: 26, hungerD: 12, happyD: 27, weightD: 0.04, desc: 'Purple yam glaze',       color: '#9B4FD0', source: 'bakery' },
  { id: 'donut_maple_bacon',  name: 'Maple Bacon',      price: 30, hungerD: 18, happyD: 26, weightD: 0.07, desc: 'Sweet, salty, wrong',    color: '#A9662F', source: 'bakery' },
  { id: 'donut_mochi',        name: 'Mochi Ring',       price: 28, hungerD: 13, happyD: 30, weightD: 0.05, desc: 'Eight chewy beads',      color: '#EBD9C4', source: 'bakery' },
  { id: 'donut_sesame',       name: 'Black Sesame',     price: 30, hungerD: 13, happyD: 28, weightD: 0.05, desc: 'Charcoal & toasted seed', color: '#3A3A3A', source: 'bakery' },
  { id: 'donut_gold_leaf',    name: 'Gold Leaf',        price: 40, hungerD: 14, happyD: 34, weightD: 0.06, desc: 'Actual gold, on cocoa',  color: '#4A3018', source: 'bakery' },
  { id: 'donut_pizza',        name: 'Pizza Donut',      price: 30, hungerD: 22, happyD: 22, weightD: 0.08, desc: 'Yes. Really.',           color: '#E8901E', source: 'bakery' },
  { id: 'donut_lavender',     name: 'Lavender',         price: 28, hungerD: 12, happyD: 28, weightD: 0.04, desc: 'Honey drizzle, berries', color: '#B98BE0', source: 'bakery' },
  { id: 'donut_biscoff',      name: 'Biscoff',          price: 30, hungerD: 15, happyD: 29, weightD: 0.06, desc: 'Spiced biscuit spread',  color: '#B5793F', source: 'bakery' },
  { id: 'donut_pistachio',    name: 'Pistachio',        price: 32, hungerD: 13, happyD: 30, weightD: 0.05, desc: 'Nutty green crumble',    color: '#A8BE72', source: 'bakery' },
  { id: 'donut_white_choc',   name: 'White Chocolate',  price: 30, hungerD: 13, happyD: 29, weightD: 0.05, desc: 'Curls of white choc',    color: '#E8DCC8', source: 'bakery' },

  // ── Gacha exclusives ─────────────────────────────────────────────────────
  // Priced like the fanciest bakery stock so the collection screen has a number
  // to show, but nothing sells them — see `source` above.
  { id: 'donut_tiger',  name: 'Tiger Tail',  price: 45, hungerD: 16, happyD: 30, weightD: 0.05, desc: 'Twisted. Not even a ring.', color: '#E8891E', source: 'gacha' },
  { id: 'donut_arcade', name: 'Arcade',      price: 60, hungerD: 14, happyD: 38, weightD: 0.05, desc: 'Covered in stickers',       color: '#E31E5A', source: 'gacha' },
  { id: 'donut_neon',   name: 'Neon Slime',  price: 60, hungerD: 14, happyD: 40, weightD: 0.05, desc: 'It glows. Probably fine.',  color: '#5BE81E', source: 'gacha' },
]

/** Buyable at the bakery — everything the machine doesn't hold exclusive. */
export const BAKERY_DONUTS: DonutDef[] = DONUTS.filter(d => d.source !== 'gacha')

/** Sold on the kitchen shop's DONUTS shelf, every day, forever. */
export const KITCHEN_DONUTS: DonutDef[] = DONUTS.filter(d => d.source === 'kitchen')

/** The three the Snacks & Drinks machine can drop. */
export const GACHA_DONUTS: DonutDef[] = DONUTS.filter(d => d.source === 'gacha')

export function getDonut(id: string): DonutDef | undefined {
  return DONUTS.find(d => d.id === id)
}

/** How many the bakery puts out each morning. */
export const DONUTS_PER_DAY = 3

/** Days to work through the whole case before anything comes back around. */
const CYCLE_DAYS = Math.ceil(BAKERY_DONUTS.length / DONUTS_PER_DAY)

/** Whole days since the epoch for a 'yyyy-mm-dd' key. */
function dayNumber(dayKey: string): number {
  const y = Number(dayKey.slice(0, 4))
  const m = Number(dayKey.slice(5, 7))
  const d = Number(dayKey.slice(8, 10))
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * Today's three donuts.
 *
 * Deliberately a CYCLE rather than "pick 3 at random". Independent daily draws
 * would show the same donut twice in a week and hide another one for a month;
 * here the case is shuffled once per cycle and then dealt three a day, so every
 * donut is guaranteed to come up inside {@link CYCLE_DAYS} and the order still
 * changes each time around. The seed is the cycle number, so it's the same
 * three for both people in the household without anything being stored.
 *
 * The last day of a cycle deals a short tray when the case doesn't divide
 * evenly — better than padding it with a repeat of something already sold today.
 *
 * @param dayKey today as 'yyyy-mm-dd' in the VIEWER's timezone (todayKey()).
 */
export function dailyDonuts(dayKey: string): DonutDef[] {
  const day = dayNumber(dayKey)
  const cycle = Math.floor(day / CYCLE_DAYS)
  const slot = ((day % CYCLE_DAYS) + CYCLE_DAYS) % CYCLE_DAYS
  const order = shuffled(mulberry32(hashString(`donut-case:${cycle}`)), BAKERY_DONUTS)
  return order.slice(slot * DONUTS_PER_DAY, slot * DONUTS_PER_DAY + DONUTS_PER_DAY)
}

/** Milliseconds until the tray changes over — local midnight. */
export function msUntilNextBatch(now = new Date()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return midnight.getTime() - now.getTime()
}
