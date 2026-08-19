// ═══════════════════════════════════════════════════════════════════════════
// KIOSK SHIFT — the data behind serving shawarma.
// ──────────────────────────────────────────────────────────────────────────
// Everything here is pure: the art geometry (measured off the 768×1376 walls,
// see the comments per table), the order roll, and the order/build comparison.
// The moving parts live in useKioskShift.
// ═══════════════════════════════════════════════════════════════════════════

import { GACHA_SKINS, type SkinDef } from '@/lib/skins'

export type ToppingId = 'tomato' | 'onion' | 'cheese' | 'lettuce'

/** Uses per full tray, and per full spit. Both deplete one step at a time. */
export const MAX_USES = 5

export function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

// ── Toppings ──────────────────────────────────────────────────────────────
// `well` is the pan's MOUTH, traced off KioskLeftSide by scanning for the
// dark outline that rings each interior. The pans sit in perspective and lean
// away from the centre — pan 1's edges drift left as they descend, pan 4's
// drift right — so these are real polygons, not rectangles, and the corners
// are chamfered because the pans are rounded. Fill anything smaller and you
// see bare steel in the corners, which is exactly what went wrong the first
// time round.
export interface ToppingDef {
  id: ToppingId
  label: string
  fill: string      // seamless texture that fills the pan
  sprite: string    // single item, for the fridge and the order ticket
  well: [number, number][]
}

export const TOPPINGS: ToppingDef[] = [
  { id: 'tomato',  label: 'Tomato',  fill: '/fill_tomato.webp',  sprite: '/fr_tomato.webp',
    well: [[15.35, 48.30], [27.35, 48.30], [28.06, 49.85], [26.44, 57.30],
           [25.05, 58.85], [12.00, 58.85], [11.43, 57.34], [13.82, 49.81]] },
  { id: 'onion',   label: 'Onion',   fill: '/fill_onion.webp',   sprite: '/fr_onion.webp',
    well: [[34.35, 48.30], [46.67, 48.30], [47.70, 49.88], [47.62, 57.27],
           [46.55, 58.85], [32.15, 58.85], [31.42, 57.30], [32.98, 49.85]] },
  { id: 'cheese',  label: 'Cheese',  fill: '/fill_cheese.webp',  sprite: '/fr_cheese.webp',
    well: [[53.33, 48.30], [65.65, 48.30], [67.02, 49.85], [68.58, 57.30],
           [67.85, 58.85], [53.45, 58.85], [52.38, 57.27], [52.30, 49.88]] },
  { id: 'lettuce', label: 'Lettuce', fill: '/fill_lettuce.webp', sprite: '/fr_lettuce.webp',
    well: [[72.65, 48.30], [84.65, 48.30], [86.18, 49.81], [88.57, 57.34],
           [88.00, 58.85], [74.95, 58.85], [73.56, 57.30], [71.94, 49.85]] },
]

export const TOPPING_BY_ID: Record<ToppingId, ToppingDef> =
  Object.fromEntries(TOPPINGS.map(t => [t.id, t])) as Record<ToppingId, ToppingDef>

export const PEPSI_SPRITE = '/fr_pepsi.webp'

/**
 * The pan's contents at a given level: the well polygon with everything above
 * the food line cut away. Clipping the real outline (rather than shrinking a
 * rectangle) is what keeps the food inside the steel as it drains — the walls
 * lean, so a level line has to be trimmed by them, not approximated.
 *
 * Returns the bounding box to position the element on, plus a `clip-path`
 * polygon in percentages of that box.
 */
export function panFill(well: [number, number][], left: number) {
  const xs = well.map(p => p[0])
  const ys = well.map(p => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = Math.min(...ys), y1 = Math.max(...ys)
  const w = x1 - x0, h = y1 - y0

  // Where the surface of the food sits. Full = the brim, empty = the floor.
  const cut = y1 - h * (left / MAX_USES)

  // Sutherland–Hodgman against the single edge y >= cut.
  const kept: [number, number][] = []
  for (let i = 0; i < well.length; i++) {
    const a = well[i], b = well[(i + 1) % well.length]
    const aIn = a[1] >= cut, bIn = b[1] >= cut
    if (aIn) kept.push(a)
    if (aIn !== bIn) {
      const t = (cut - a[1]) / (b[1] - a[1])
      kept.push([a[0] + (b[0] - a[0]) * t, cut])
    }
  }

  const rel = kept.map(([x, y]) => `${((x - x0) / w * 100).toFixed(2)}% ${((y - y0) / h * 100).toFixed(2)}%`)
  return {
    box: { left: `${x0}%`, top: `${y0}%`, width: `${w}%`, height: `${h}%` },
    clip: `polygon(${rel.join(', ')})`,
  }
}

// ── The spit ──────────────────────────────────────────────────────────────
// All five meat PNGs were drawn on canvases of the same 1536 height with the
// meat centred, so rendering each canvas at ONE height with the same top and
// centre lands every carve exactly where the artist put it. Crop them and the
// shrink falls apart.
export const MEAT_FRAMES = ['/meat1.webp', '/meat2.webp', '/meat3.webp', '/meat4.webp', '/meat5.webp']
/** Meat canvas box on KioskRightSide, % of the picture. */
export const SPIT_BOX = { left: 50, top: 14.10, height: 50.15 }
// ── Heat off the cone ─────────────────────────────────────────────────────
// The cone doesn't steam out of its scalp, it steams all over. Vents are held
// in the meat's OWN coordinates — `u` across the half-width, `v` down the
// height — and mapped onto the level's real footprint, because the cone loses
// half its width by the last slice and vents pinned to the picture would end
// up smoking bare air.
export const MEAT_BOX = [
  { x0: 36.6, x1: 63.2, y0: 28.5, y1: 56.6 },
  { x0: 36.8, x1: 62.6, y0: 29.1, y1: 55.3 },
  { x0: 39.1, x1: 60.9, y0: 29.9, y1: 55.3 },
  { x0: 43.7, x1: 56.5, y0: 30.7, y1: 55.3 },
  { x0: 44.8, x1: 54.5, y0: 31.0, y1: 54.9 },
]

interface Vent {
  u: number       // -1..1 across the cone at that depth
  v: number       // 0..1 from crown to base
  size: number    // cqi
  puff: number    // peak opacity — the crown reads strongest
  lift: number    // how far it rises, cqi
  drift: number   // sideways wander, cqi
  delay: number   // s
  dur: number     // s
}

/** Eleven vents, none of them in step with any other, and none idle for long
 *  — a stagger longer than about three seconds leaves visible dead air. */
export const SPIT_VENTS: Vent[] = [
  { u:  0.0, v: 0.02, size: 12, puff: 0.86, lift: -19, drift:  0.5, delay: 0.0, dur: 5.4 },
  { u: -0.5, v: 0.04, size: 10, puff: 0.74, lift: -18, drift: -2.4, delay: 1.6, dur: 5.0 },
  { u:  0.5, v: 0.04, size: 10, puff: 0.74, lift: -18, drift:  2.2, delay: 2.9, dur: 5.8 },
  { u: -0.8, v: 0.14, size:  9, puff: 0.68, lift: -17, drift: -3.4, delay: 0.7, dur: 6.0 },
  { u:  0.8, v: 0.14, size:  9, puff: 0.68, lift: -17, drift:  3.1, delay: 2.2, dur: 5.2 },
  { u: -0.9, v: 0.34, size:  8, puff: 0.62, lift: -15, drift: -3.9, delay: 1.1, dur: 6.4 },
  { u:  0.9, v: 0.34, size:  8, puff: 0.62, lift: -15, drift:  3.7, delay: 3.3, dur: 5.6 },
  { u: -0.8, v: 0.58, size:  7, puff: 0.54, lift: -13, drift: -3.0, delay: 2.6, dur: 6.2 },
  { u:  0.8, v: 0.58, size:  7, puff: 0.54, lift: -13, drift:  2.8, delay: 0.4, dur: 5.9 },
  { u: -0.5, v: 0.82, size:  6, puff: 0.46, lift: -11, drift: -2.3, delay: 3.1, dur: 6.6 },
  { u:  0.5, v: 0.82, size:  6, puff: 0.46, lift: -11, drift:  2.1, delay: 1.9, dur: 6.9 },
]

/** The vents placed on the cone as it stands right now, in % of the picture.
 *  The half-width narrows with depth because the cone does. */
export function smokeVents(meat: number) {
  const box = MEAT_BOX[MAX_USES - meat] ?? MEAT_BOX[MEAT_BOX.length - 1]
  const cx = (box.x0 + box.x1) / 2
  const half = (box.x1 - box.x0) / 2
  return SPIT_VENTS.map((vent, i) => ({
    ...vent,
    key: i,
    x: cx + vent.u * half * (1 - 0.5 * vent.v),
    y: box.y0 + vent.v * (box.y1 - box.y0),
  }))
}
/** The LOAD button, on the bare wall to the right of the machine. */
export const MEAT_BTN = { x: 80, y: 40 }

// ── The knife ─────────────────────────────────────────────────────────────
// Carving is a gesture, not a button: you hold the knife against the cone and
// saw it up and down. `x` and `size` are in % of the picture's WIDTH (what a
// cqi is); `home`, `top` and `bottom` are the sprite's CENTRE in % of its
// height. The stroke band is set so the blade sweeps the whole cone — not the
// tip, which hangs well below the middle of the sprite.
export const KNIFE = { x: 60, size: 30, home: 45, top: 33, bottom: 53, lean: 40 }
export const KNIFE_SPRITE = '/knife.webp'
/** Travel, in % of the picture's HEIGHT, that one slice costs. Measured
 *  rather than timed, so a slice is the same amount of hand movement on a
 *  tall phone as on a short one — about five full strokes. */
export const CARVE_TRAVEL = 105
/** The carve gauge, on the tiles under the machine's drip tray. */
export const CARVE_BAR = { y: 63, width: 34 }
/** The nudge that says the knife is yours to move, clear of the LOAD button
 *  above it and of the blade itself. */
export const KNIFE_TAG = { x: 76, y: 54 }

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
// The lit interior runs 26.2%..74.1% of the picture: stock on the left of it,
// its button on the right, both clear of the door frame.
export const FRIDGE_ITEM_X = 39
export const FRIDGE_BTN_X = 62
/** The stocked cooler on KioskBackReal, % of the picture. */
export const FRIDGE_HIT = { left: 5.73, top: 25.73, width: 43.10, height: 52.30 }
export const FRIDGE_TAG = { x: 27.8, y: 50 }

// ── The door ──────────────────────────────────────────────────────────────
// The door leaf starts at 85.3% and runs off the right edge of the picture,
// and a phone's cover-crop eats everything past ~91%, so what's actually on
// screen is a stripe hard against the bezel. Too thin to aim at, so the hit
// area is padded out across the bare wall to its left and the EXIT tag sits
// on that padding, pointing at the door. It starts at 78 rather than 76 now:
// the payphone's housing ends at 75.3% and two adjacent targets want a gap.
export const DOOR_HIT = { left: 78, top: 25, width: 22, height: 51 }
export const DOOR_TAG = { x: 82, y: 50 }

// ── The payphone ──────────────────────────────────────────────────────────
// The housing is painted into the wall; the handset and its coiled cord are
// not, so they can move. `HANDSET` is the sprite's box, placed so the handset
// hangs in the cradle over the phone's face and the cord loops down onto the
// coin box, exactly as the reference photo has it.
export const PHONE_HIT = { left: 57.8, top: 35.3, width: 18.4, height: 25.3 }
export const PHONE_TAG = { x: 67, y: 64 }
export const HANDSET = { left: 58.33, top: 38.66, width: 17.19 }
export const HANDSET_SPRITE = '/kiosk_handset.webp'

// ── The window ────────────────────────────────────────────────────────────
/** Where a customer standing outside gets cut off — the top edge of the
 *  serving ledge, y=905 of InsideOfKiosk's 1376. The line above it, at 62.2%,
 *  is where the road meets the PAVEMENT: clipping there left a strip of empty
 *  street under everybody's chin and put them out on the kerb instead of at
 *  the window. */
export const SILL_PCT = 65.8
/** Side of the square BlinkingEren box, in cqi (% of the picture's width).
 *  The sprite is letterboxed to fill the box's HEIGHT, so this is its height —
 *  which matters because the costumes run 0.58 to 0.84 aspect and sizing them
 *  by width made the tall ones tower over the window. */
export const CUSTOMER_BOX = 34
/** How much of that box clears the sill. Just the head and a little shoulder:
 *  they lean up to the window rather than standing out in the road. Every
 *  costume's eyes sit above 37% of its box, so a blink always shows. */
export const CUSTOMER_SHOW = 0.52
/** Speech bubble, anchored by its BOTTOM so it stays above their head no
 *  matter how many lines they're saying. % up from the bottom of the picture. */
export const BUBBLE_BOTTOM = 49
/** The little celebration when a wrap lands: they hop on the spot before
 *  they drop back under the sill. Shared, because the window animates it and
 *  the shift has to wait it out before pulling the customer. */
export const CHEER_MS = 880
/** And the duck away afterwards. */
export const DUCK_MS = 760

// ── The prep board ────────────────────────────────────────────────────────
/** Where each topping lands on the tortilla, in % of the disc. */
export const TORTILLA_SPOTS: Record<ToppingId, { x: number; y: number; size: number; rot: number }> = {
  tomato:  { x: 33, y: 32, size: 33, rot: -12 },
  onion:   { x: 67, y: 36, size: 33, rot:  10 },
  cheese:  { x: 34, y: 67, size: 33, rot:  -7 },
  lettuce: { x: 66, y: 68, size: 33, rot:  14 },
}
export const MEAT_ON_TORTILLA = { x: 50, y: 50, size: 52, rot: -4 }
export const SHAVED_MEAT = '/meat_shaved.webp'

// ── Orders ────────────────────────────────────────────────────────────────
export interface Order {
  toppings: ToppingId[]
  pepsi: boolean
  /** Whoever walked up — a whole costume from the closet, so the window can
   *  render them through BlinkingEren with their own eyes and lid tones. */
  customer: SkinDef
  /** What they say while they're waiting. */
  line: string
}

export interface Build {
  meat: boolean
  toppings: ToppingId[]
  pepsi: boolean
}

export const EMPTY_BUILD: Build = { meat: false, toppings: [], pepsi: false }

/** Customers are drawn from the animal costumes — the food ones would be odd
 *  company for a shawarma. */
const CUSTOMER_SKINS = GACHA_SKINS.filter(s => s.set === 'animal')

// ── What they say ─────────────────────────────────────────────────────────
// Three moods, rolled evenly. Nobody mentions their own order — that's what
// the icons under the line are for — so the talk stays talk.
const NICE = [
  'you’re still open. bless you.',
  'no rush. i’ve got nowhere to be',
  'your lights look nice from here',
  'long shift? i know the feeling',
  'keep the change, seriously',
  'smells like the good place',
  'you always get it right',
  'hope you get home okay tonight',
  'best window on this street',
  'my bus is late. this is better anyway',
  'i brought exact change for once',
  'you’re the only thing open and awake',
  'i told my sister about this place',
  'take your time, i like watching',
  'cold night. warm window',
  'my friends said they’d wait. they did not',
  'i’ll eat it on the bench across the road',
  'this is the good part of my day',
]

const WEIRD = [
  'i can hear your fridge from here',
  'my shoes are on the wrong feet',
  'i’ve been awake for one day',
  'there’s a word for this hour',
  'i think i left the tap running',
  'my reflection blinked early',
  'i can taste the colour orange tonight',
  'i had this exact night in march',
  'my phone thinks we’re in another city',
  'do you hear it too or is that mine',
  'i’ve been practising standing still',
]

const CREEPY = [
  'don’t look behind me. not yet.',
  'you were here last night too',
  'i’ve eaten here before. sort of.',
  'the lamp outside stopped humming',
  'someone else ordered for me',
  'how many of you work here',
  'your door was open earlier',
  'i know what time you close',
  'the street gets hungry first',
  'don’t turn around until i’ve gone',
  'i’ve stood here longer than you think',
  'your window is the only one that answers',
  'someone’s been ordering as me',
  'i’d finish that one quickly',
]

/** What the customer says when the wrap is wrong — kept vague on purpose, so
 *  you have to read your own ticket rather than being told the answer. */
export const REFUSALS = [
  'this isn’t what i ordered',
  'that’s not my order',
  'hey — wrong one',
  'nope, not mine',
  'close. not close enough',
  'i’d eat it, but no',
  'try again, i’m patient',
  'that’s not what i said',
]

export const HAPPY_LINES = [
  'perfect. see you tomorrow.',
  'worth the walk',
  'you’re a legend',
  'exactly right. thank you.',
  'this’ll do nicely',
  'same time next week',
  'this is why i walk the long way',
  'see you when it’s dark again',
]

export const IMPATIENT_LINES = [
  'any day now',
  'it’s getting cold out here',
  'still here, by the way',
  'i can wait. i think.',
  'you didn’t forget me, right',
  'don’t wrap it pretty, wrap it fast',
  'is this how long it always takes',
  'everywhere else shut. that’s the only reason',
  'hello? still breathing out here',
  'no pressure. some pressure',
  'take your time. i’m being sarcastic',
  'any progress or shall i sit down',
]

/** One to three toppings, plus a coin-flip Pepsi. Meat is never asked for —
 *  every shawarma has it, which is why the spit is a step and not a choice. */
export function rollOrder(): Order {
  const want = 1 + Math.floor(Math.random() * 3)
  const pool = [...TOPPINGS]
  const toppings: ToppingId[] = []
  for (let i = 0; i < want; i++) {
    toppings.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id)
  }
  return {
    toppings,
    pepsi: Math.random() < 0.45,
    customer: pick(CUSTOMER_SKINS),
    line: pick(pick([NICE, WEIRD, CREEPY])),
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
