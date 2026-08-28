// ═══════════════════════════════════════════════════════════════════════════
// KIOSK SHIFT — the data behind serving shawarma.
// ──────────────────────────────────────────────────────────────────────────
// Everything here is pure: the art geometry (measured off the 768×1376 walls,
// see the comments per table), the order roll, and the order/build comparison.
// The moving parts live in useKioskShift.
// ═══════════════════════════════════════════════════════════════════════════

import { GACHA_SKINS, type SkinDef } from '@/lib/skins'

export type ToppingId = 'tomato' | 'onion' | 'cheese' | 'lettuce'

// ── The weather ───────────────────────────────────────────────────────────
// Rolled once when you walk in, and it colours the whole night: what the
// street looks like through the hatch, how often anybody turns up, how long
// the ticket stays legible, and what they leave on top.
//
// The rule behind the numbers: bad weather pays. Fog pays best of all because
// it empties the street — fewer customers, but every one of them has walked
// past three shut shops to get here.
export type WeatherId = 'clear' | 'rain' | 'fog' | 'wind'

export interface WeatherDef {
  id: WeatherId
  /** On the clock HUD. */
  label: string
  /** On the receipt, and on the board out front. Empty for a clear night —
   *  nobody says "I worked in the clear". */
  note: string
  /** Relative chance of a night being this one. */
  weight: number
  /** Multiplier on every tip. */
  tip: number
  /** Multiplier on the gap before the next customer. Above 1 = a quiet street. */
  flow: number
  /** Multiplier on how fast the ticket goes to ghosts. */
  ticketBurn: number
}

export const WEATHER: WeatherDef[] = [
  { id: 'clear', label: 'CLEAR', note: '',            weight: 44, tip: 1,    flow: 1,    ticketBurn: 1   },
  { id: 'rain',  label: 'RAIN',  note: 'in the rain', weight: 25, tip: 1.15, flow: 1,    ticketBurn: 1   },
  { id: 'fog',   label: 'FOG',   note: 'in the fog',  weight: 18, tip: 1.45, flow: 1.55, ticketBurn: 1   },
  { id: 'wind',  label: 'WIND',  note: 'in the wind', weight: 13, tip: 1.15, flow: 0.92, ticketBurn: 1.9 },
]

export const WEATHER_BY_ID: Record<WeatherId, WeatherDef> =
  Object.fromEntries(WEATHER.map(w => [w.id, w])) as Record<WeatherId, WeatherDef>

export function rollWeather(): WeatherId {
  const total = WEATHER.reduce((sum, w) => sum + w.weight, 0)
  let n = Math.random() * total
  for (const w of WEATHER) {
    n -= w.weight
    if (n <= 0) return w.id
  }
  return 'clear'
}

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

// ── Sauce ──────────────────────────────────────────────────────────────────
// Three squeeze bottles standing on the prep counter under the pans. The
// counter's top surface runs 71.8% -> 75.2% of the picture (a column scan of
// KioskLeftSide: the bright band between the dark wall above and the cabinet
// face below), so a bottle's base sits at 74.6% and it stands up into the
// shadow between the counter and the warmer shelf.
export type SauceId = 'garlic' | 'chilli' | 'herb'

export interface SauceDef {
  id: SauceId
  label: string
  /** The bottle on the counter. */
  sprite: string
  /** The squeeze of it, laid across the wrap. */
  drizzle: string
  /** Centre of the bottle, % of the picture's width. */
  x: number
  /** Lifetime wraps before it's on the menu. 0 = there from the start. */
  unlockAt: number
}

export const SAUCES: SauceDef[] = [
  { id: 'garlic', label: 'Garlic', sprite: '/sauce_garlic.webp', drizzle: '/drizzle_garlic.webp', x: 13.5, unlockAt: 0  },
  { id: 'chilli', label: 'Chilli', sprite: '/sauce_chilli.webp', drizzle: '/drizzle_chilli.webp', x: 23.5, unlockAt: 0  },
  { id: 'herb',   label: 'Herb',   sprite: '/sauce_herb.webp',   drizzle: '/drizzle_herb.webp',   x: 33.5, unlockAt: 25 },
]

export const SAUCE_BY_ID: Record<SauceId, SauceDef> =
  Object.fromEntries(SAUCES.map(x => [x.id, x])) as Record<SauceId, SauceDef>

/** Bottle box on the toppings wall: width in % of the picture, top set so the
 *  base lands on the counter. */
export const SAUCE_BOX = { width: 5.6, top: 65.46 }

// ── Sides ──────────────────────────────────────────────────────────────────
// Things that ride alongside the wrap instead of going in it. The Pepsi comes
// out of the fridge; the chips come out of the warmer basket at the far end
// of the same counter the sauces stand on.
export type SideId = 'pepsi' | 'chips'

export interface SideDef {
  id: SideId
  label: string
  sprite: string
  unlockAt: number
}

export const SIDES: SideDef[] = [
  { id: 'pepsi', label: 'Pepsi', sprite: PEPSI_SPRITE,     unlockAt: 0  },
  { id: 'chips', label: 'Chips', sprite: '/fr_chips.webp', unlockAt: 50 },
]

export const SIDE_BY_ID: Record<SideId, SideDef> =
  Object.fromEntries(SIDES.map(x => [x.id, x])) as Record<SideId, SideDef>

/** The chip warmer, on the counter's right-hand end. */
export const CHIPS_BOX = { x: 84, width: 11.7, top: 69.04 }

/** What the kiosk currently sells. Grows with the household's lifetime wraps
 *  — see UNLOCKS for what arrives when. */
export interface MenuState {
  sauces: SauceId[]
  sides: SideId[]
}

export interface Unlock {
  at: number
  label: string
  /** One line on the receipt, the night it lands. */
  blurb: string
}

export const UNLOCKS: Unlock[] = [
  { at: 25, label: 'HERB SAUCE', blurb: 'a third bottle turned up on the counter' },
  { at: 50, label: 'CHIPS',      blurb: 'the warmer works again — chips are back on' },
]

export function menuFor(lifetimeWraps: number): MenuState {
  return {
    sauces: SAUCES.filter(x => lifetimeWraps >= x.unlockAt).map(x => x.id),
    sides:  SIDES.filter(x => lifetimeWraps >= x.unlockAt).map(x => x.id),
  }
}

/** An unlock crossed on THIS shift, for the receipt to announce. */
export function unlockedBetween(before: number, after: number): Unlock | null {
  return UNLOCKS.find(u => before < u.at && after >= u.at) ?? null
}

/** Deterministic 0–1 noise. The same pan at the same level must produce the
 *  same lumps every render — a surface that re-rolled on each paint would
 *  boil like static. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/** Where the pan's walls are at a given height. The wells lean, so the food's
 *  width depends on how deep in the tray you are. */
function spanAt(well: [number, number][], y: number): [number, number] {
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < well.length; i++) {
    const a = well[i], b = well[(i + 1) % well.length]
    if ((a[1] <= y && b[1] >= y) || (b[1] <= y && a[1] >= y)) {
      const t = a[1] === b[1] ? 0 : (y - a[1]) / (b[1] - a[1])
      const x = a[0] + (b[0] - a[0]) * t
      if (x < lo) lo = x
      if (x > hi) hi = x
    }
  }
  return [lo, hi]
}

/** Points along the food's surface, and down each wall to the floor. Both
 *  counts are FIXED so every level produces a polygon with the same number of
 *  vertices — which is the only way clip-path will animate between them
 *  instead of snapping. */
const SURFACE_POINTS = 13
const WALL_POINTS = 5
/** Lumps in the surface, as a fraction of the pan's depth. */
const LUMP = 0.085
/** How far the pile domes up as the pan empties. */
const DOME = 0.24
/** Where loose pieces sit along the surface, before jitter. Six slots, of
 *  which each pan uses a hashed handful — a fixed count at fixed spacing is
 *  a row of decorations, which is the symmetry this was all trying to fix. */
const CREST_AT = [0.13, 0.29, 0.44, 0.58, 0.73, 0.88]

export interface PanCrest {
  /** Picture coordinates, same space as the well. */
  x: number
  y: number
  rot: number
  /** Multiplier on the base piece size. No two the same. */
  scale: number
}

/**
 * The pan's contents at a given level.
 *
 * The food is NOT the well polygon with its top cropped off. A dead-straight
 * horizontal boundary across a texture reads as a cropped image, not as a
 * level — nothing edible has a flat top. So the surface is a lumpy polyline
 * with a slight tilt, and as the pan empties it domes into a heap in the
 * middle with bare steel showing at the sides, the way a tray that's been
 * served from all night actually looks.
 *
 * The lumps are hashed off the pan and the level, so they hold still between
 * renders and change only when someone takes a scoop.
 *
 * Returns the bounding box to position the element on, a `clip-path` polygon
 * in percentages of that box, where the surface sits within it (for lighting
 * it), and a few points to drop loose pieces on.
 */
export function panFill(well: [number, number][], left: number, seed = 0) {
  const xs = well.map(p => p[0])
  const ys = well.map(p => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = Math.min(...ys), y1 = Math.max(...ys)
  const w = x1 - x0, h = y1 - y0

  const level = Math.max(0, Math.min(1, left / MAX_USES))
  // The mean height of the food. Everything below shapes the surface AROUND
  // this line without moving it, so the pan still reads as N-fifths full.
  const cut = y1 - h * level
  // Empty pans heap; full pans lie flat against the brim.
  const dome = (1 - level) * h * DOME
  // And nothing is ever quite level.
  const tilt = (hash(seed + 0.5) - 0.5) * h * 0.07

  const surfaceY = (t: number, i: number) => {
    // Parabola with its mean subtracted: up in the middle, down at the walls,
    // average unchanged.
    const p = (2 * t - 1) ** 2 - 1 / 3
    const lump = (hash(seed * 31 + left * 7 + i) - 0.5) * h * LUMP
    const y = cut + dome * p + tilt * (t - 0.5) + lump
    return Math.max(y0, Math.min(y1, y))
  }

  const [sxL, sxR] = spanAt(well, Math.max(y0 + 0.01, Math.min(y1 - 0.01, cut)))

  const pts: [number, number][] = []
  for (let i = 0; i < SURFACE_POINTS; i++) {
    const t = i / (SURFACE_POINTS - 1)
    pts.push([sxL + (sxR - sxL) * t, surfaceY(t, i)])
  }
  for (let k = 1; k <= WALL_POINTS; k++) {
    const y = cut + (y1 - cut) * (k / (WALL_POINTS + 1))
    pts.push([spanAt(well, y)[1], y])
  }
  const [bxL, bxR] = spanAt(well, y1 - 0.01)
  pts.push([bxR, y1], [bxL, y1])
  for (let k = WALL_POINTS; k >= 1; k--) {
    const y = cut + (y1 - cut) * (k / (WALL_POINTS + 1))
    pts.push([spanAt(well, y)[0], y])
  }

  // A handful of pieces half-buried in the pile. They sit a little BELOW the
  // surface, not on it, so they read as part of the food rather than as
  // ornaments resting on a shelf — and they're what stops the top edge being
  // legible as a cut at all.
  const crest: PanCrest[] = []
  for (let i = 0; i < CREST_AT.length; i++) {
    // Each slot is a coin flip, so the count and the spacing both vary.
    if (hash(seed * 7 + left * 23 + i * 3) < 0.42) continue
    const t = Math.max(0.06, Math.min(0.94,
      CREST_AT[i] + (hash(seed * 17 + left * 3 + i) - 0.5) * 0.1))
    crest.push({
      x: sxL + (sxR - sxL) * t,
      y: surfaceY(t, Math.round(t * (SURFACE_POINTS - 1)))
        + h * (0.03 + hash(seed * 71 + left * 5 + i) * 0.05),
      rot: (hash(seed * 53 + left * 11 + i) - 0.5) * 150,
      scale: 0.72 + hash(seed * 97 + left * 13 + i) * 0.5,
    })
  }

  const rel = pts.map(([x, y]) => `${((x - x0) / w * 100).toFixed(2)}% ${((y - y0) / h * 100).toFixed(2)}%`)
  return {
    box: { left: `${x0}%`, top: `${y0}%`, width: `${w}%`, height: `${h}%` },
    clip: `polygon(${rel.join(', ')})`,
    /** The surface's mean height, as a % down the box — for putting the
     *  lamplight on it. */
    surfacePct: ((cut - y0) / h) * 100,
    crest,
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

// ── How long the cone has been on ─────────────────────────────────────────
// A fresh cone is raw for a moment and then it is exactly right for a while
// and then it is ruined, which is the whole job of standing next to one. The
// clock starts when you hang it and resets when you hang the next.
//
// The good band is deliberately most of a shift: this is a thing to keep half
// an eye on between customers, not a second timer to fight.
export const MEAT_RAW_MS = 8_000
export const MEAT_GOOD_MS = 82_000
/** The last few seconds of good, when the warning is worth showing. */
export const MEAT_WARN_MS = 14_000

export type MeatState = 'raw' | 'good' | 'charred'

/** `on` is how long the cone has been hanging, in ms. */
export function meatState(on: number): MeatState {
  if (on < MEAT_RAW_MS) return 'raw'
  if (on < MEAT_GOOD_MS) return 'good'
  return 'charred'
}

/** 0 → 1 across the whole life of a cone, for the gauge on the wall. */
export function meatHeat01(on: number): number {
  return Math.max(0, Math.min(1, on / MEAT_GOOD_MS))
}

// ── Rolling it up ─────────────────────────────────────────────────────────
// Hold the button and the wrap rolls; let go when it is round. Too early and
// it is loose, too late and the tortilla splits. The band is wide on purpose
// — this is a flourish that pays a little, not a gate you can fail.
export type Tidiness = 'loose' | 'neat' | 'split'
/** One full roll, from nothing to torn. */
export const ROLL_MS = 1_100
export const ROLL_BAND: [number, number] = [0.46, 0.82]

export function tidinessFor(progress: number): Tidiness {
  if (progress < ROLL_BAND[0]) return 'loose'
  if (progress > ROLL_BAND[1]) return 'split'
  return 'neat'
}

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

// ── What else is on the back wall ─────────────────────────────────────────
// Two bits of bare tiling, both above things that already have hit boxes: the
// note goes over the payphone (whose target starts at 35.3%) and the apron
// over the fridge (whose target starts at 25.7%). Both stop short of the
// door's target at 78%, and both sit inside the 9%–91% strip a tall phone
// can actually see after the cover crop.
export const NOTE_BOARD = { x: 64, y: 12.5, width: 24 }
export const APRON_HOOK = { x: 27, y: 7, width: 13 }
export const APRON_BROWN = '/apron_brown.webp'
export const APRON_PINK = '/apron_pink.webp'

// ── The window ────────────────────────────────────────────────────────────
/** Where a customer standing outside gets cut off — the top edge of the
 *  serving ledge, y=905 of InsideOfKiosk's 1376. The line above it, at 62.2%,
 *  is where the road meets the PAVEMENT: clipping there left a strip of empty
 *  street under everybody's chin and put them out on the kerb instead of at
 *  the window. */
export const SILL_PCT = 65.8
/** The hatch's glass, in % of the picture — the aperture runs x 129→644 and
 *  y 391→905 of InsideOfKiosk's 768×1376, traced by scanning for where the
 *  cool street colour gives way to the warm timber of the frame. Its bottom
 *  edge IS the sill, which is why the height lands exactly on SILL_PCT.
 *
 *  Anything that belongs to the weather outside is clipped to this box. */
export const GLASS = { left: 16.8, top: 28.4, width: 67.05, height: 37.4 }
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
/** The tip jar, standing on the serving ledge. That ledge's top surface runs
 *  68.6%–69.8% of the picture (a column scan), so the jar's base sits at 69.3
 *  — left of the customer's head, and clear of the shakers at 61%. It's in
 *  FRONT of whoever's at the window, which is why it draws over them. */
export const TIP_JAR = { x: 36, width: 6.2, top: 64.77 }
export const TIP_JAR_SPRITE = '/tipjar.webp'
export const TIP_JAR_COINS = '/tipjar_coins.webp'
/** Tips that fill it to the lid. A very good night, not a possible one — a
 *  jar that tops out at eight o'clock stops meaning anything. */
export const TIP_JAR_FULL = 70

/** The radio, on the prep counter beside the sauce bottles — the same
 *  measured surface they stand on, in the gap before the crumbs at 70%. */
export const RADIO_BOX = { x: 53, width: 9.5, top: 71.17 }
export const RADIO_SPRITE = '/kiosk_radio.webp'
/** The little celebration when a wrap lands: they hop on the spot before
 *  they drop back under the sill. Shared, because the window animates it and
 *  the shift has to wait it out before pulling the customer. */
export const CHEER_MS = 880
/** Then they STAY, holding the thank-you up where you can read it. The hop
 *  used to run straight into the duck, which gave you about seven hundred
 *  milliseconds of a line in a 6px font — long enough to notice somebody had
 *  said something, nowhere near long enough to find out what. The gap after
 *  they leave pays for most of it (see NEXT_AFTER_SALE_MS): the beat is spent
 *  on a customer you can still see instead of on an empty window. */
export const LINGER_MS = 1_500
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
/** The squeeze of sauce, laid across everything else. Wider than the meat and
 *  sitting a touch low, so it reads as the last thing on rather than another
 *  filling. */
export const SAUCE_ON_TORTILLA = { x: 50, y: 55, size: 76, rot: -7 }
export const SHAVED_MEAT = '/meat_shaved.webp'

// ── Orders ─────────────────────────────────────────────────────────────────
export interface Wrap {
  /** Exactly what has to be on it. */
  toppings: ToppingId[]
  sauce: SauceId | null
  /** Display only. A three-topping wrap is every topping BUT one, and reading
   *  it as "no onion" is a different job from reading a list of three — so
   *  some of them are drawn that way. The required set above is already the
   *  complement; nothing about the matching changes. */
  without: ToppingId | null
}

/** Not everyone who comes to the window wants feeding. */
export type VisitKind = 'order' | 'chat'
/** How they're behaving. A rude one tips nothing — unless you're right AND
 *  quick, and then they have the decency to say so. */
export type Mood = 'normal' | 'rude'

export interface Order {
  kind: VisitKind
  /** One wrap, or two when they're buying for someone waiting outside.
   *  Empty for a chat: there's nothing to make. */
  wraps: Wrap[]
  sides: SideId[]
  /** Whoever walked up — a whole costume from the closet, so the window can
   *  render them through BlinkingEren with their own eyes and lid tones. */
  customer: SkinDef
  /** What they say while they're waiting. */
  line: string
  /** They asked for "the usual" and the ticket stays blank. You either
   *  remember what they had last time or you guess. */
  usual: boolean
  mood: Mood
  /** For a chat: everything they came to say, in order. You get the next one
   *  each time you tap them, and they leave when they run out or get bored. */
  chat: string[]
  /** The one who turns up after the shutters should already be down. */
  late: boolean
}

/** The open tortilla in front of you.
 *
 *  `toppings` is a MULTISET, not a set: the same id twice means a double
 *  portion of it, which is a thing people ask for and a thing you can get
 *  wrong by tapping a pan one time too many. */
export interface Build {
  meat: boolean
  toppings: ToppingId[]
  sauce: SauceId | null
  /** How it came out of the roll. Meaningless until it's on the tray. */
  tidy: Tidiness
  /** What the cone was like at the moment this slice came off it, or null if
   *  it was exactly right. Rides with the WRAP, not with the spit: hang a
   *  fresh cone afterwards and this one is still what it is. */
  meatBad: MeatState | null
}

/** What's finished and waiting on the counter to be handed over. */
export interface Tray {
  wraps: Build[]
  sides: SideId[]
}

export const EMPTY_BUILD: Build = { meat: false, toppings: [], sauce: null, tidy: 'neat', meatBad: null }
/** Most portions of one topping that will fit on a tortilla. */
export const MAX_PORTIONS = 2

export function portionsOf(list: ToppingId[], id: ToppingId): number {
  return list.reduce((n, t) => n + (t === id ? 1 : 0), 0)
}
export const EMPTY_TRAY: Tray = { wraps: [], sides: [] }

/** What a costume ordered last time they were served properly. Kept per
 *  household, so a regular of hers is a regular of yours. */
export interface RememberedOrder {
  wraps: Wrap[]
  sides: SideId[]
  /** How many times they've been served right. Two, and they stop telling you
   *  what they want. */
  times: number
}

export type Regulars = Record<string, RememberedOrder>

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

/** What a regular says instead of an order. */
export const USUAL_LINES = [
  'the usual, when you get a minute',
  'same as always. you know it.',
  'my usual. don’t make me say it.',
  'you remember. i can tell.',
  'the same one. the good one.',
]

/** What they say when their usual comes back wrong — and then, mercifully,
 *  the ticket comes back too. */
export const USUAL_MISS = [
  'that’s not my usual',
  'close, but no. here — look.',
  'you forgot. it happens.',
]

/** Someone who came to the window in a mood. They tip nothing on principle
 *  — but get it right and get it fast and they climb down. */
export const RUDE_LINES = [
  'do you know how long i’ve been standing here',
  'just make it. i don’t need a chat.',
  'is this place always this slow',
  'i’m only here because everywhere else shut',
  'don’t get it wrong. i mean it.',
  'you look like you’re about to get it wrong',
  'quickly. i have somewhere to be.',
  'the last one was cold, by the way',
]

/** And what they say when you’ve earned it. */
export const RUDE_HAPPY = [
  'okay. that’s... that’s actually good. sorry.',
  'fine. you know what you’re doing.',
  'i was rude. that was quick.',
  'right. i’ll stop talking. here.',
  'you didn’t deserve that. good wrap.',
]

/** A rude customer, served right but slowly: no apology, no tip. */
export const RUDE_FLAT = [
  'took you long enough',
  'yeah. that’s the one.',
  'about time',
  'right. bye.',
]

// ── Someone who didn’t come to buy anything ──────────────────────────────
// They stand at the window and use up the slot, and they’re the only thing in
// the kiosk you can lose money to on purpose. Hear one all the way out and
// they leave something in the jar, because that’s what people do.
export const CHAT_VISITS: string[][] = [
  ['i’m not buying anything. is that alright.',
   'i just wanted to stand where a light is on.',
   'that’s all. thanks. genuinely.'],
  ['my shift ended an hour ago',
   'i’ve been walking the long way round since',
   'i’ll go home now. i think.'],
  ['do you ever get the one where the street is quiet',
   'and it’s not peaceful, it’s just quiet',
   'anyway. your lamps are nice.'],
  ['i had a whole thing i was going to say',
   'and now i’m here and i’ve lost it',
   'it wasn’t important. sorry.'],
  ['someone told me you’re open all night',
   'i didn’t believe them',
   'good. good. okay. night.'],
  ['i’m not hungry. i checked.',
   'i just liked the smell from the corner',
   'right. i’ll leave you to it.'],
  ['my phone died four hours ago',
   'you’re the first person i’ve spoken to since',
   'that’s a bit much, isn’t it. sorry.'],
  ['is it tomorrow yet or is it still tonight',
   'i can never tell at this bit',
   'okay. thank you. that helped.'],
]

/** What they say as they go, after you’ve heard them out. */
export const CHAT_THANKS = [
  'here. for listening.',
  'take that. i mean it.',
  'you didn’t have to. thanks.',
]

// ── The one who comes after last call ─────────────────────────────────────
// Same face every time, same order, always after the street has emptied. The
// only customer worth staying open for, and the whole reason to not close up
// the second the clock turns.
export const LATE_REGULAR_ID = 'owl'
export const LATE_LINES = [
  'knew you’d still be here',
  'i always cut it fine. sorry.',
  'last one of the night. same as ever.',
  'you never close on time. good.',
]
export const LATE_HAPPY = [
  'that’s the one. see you tomorrow, late.',
  'perfect. now go home.',
  'every night. thank you. every night.',
]

/** Handed a wrap with meat that wasn’t ready, or meat that was ready an hour
 *  ago. They still take it — they just take less off their own pocket. */
export const RAW_LINES = [
  'this is a bit... pink',
  'was that on the heat at all',
  'i’ll eat it. i’ll regret it.',
]
export const BURNT_LINES = [
  'that’s been on there a while',
  'tastes like the inside of a lamp',
  'crunchy. that’s not the word i wanted.',
]
/** And a wrap that came apart in the bag. */
export const MESSY_LINES = [
  'it’s falling out the end',
  'you rolled this in a hurry',
  'half of it’s in the bag now',
]

/** What they say on the way out, having given up on you. */
export const WALKOUT_LINES = [
  'forget it. i’ll get chips.',
  'i waited. i really did.',
  'next time, maybe',
  'you’re busy. i get it.',
  'i’m going home',
]

/** Chance a customer with a remembered order asks for it by name. */
const USUAL_CHANCE = 0.4
/** Chance an order is for two wraps rather than one. */
const TWO_WRAP_CHANCE = 0.16
/** Chance a short order asks for a double of one of its toppings. Only on
 *  one- and two-topping wraps: "no onion, extra tomato" is a ticket nobody
 *  should have to read at four in the morning. */
const DOUBLE_CHANCE = 0.2

function rollWrap(menu: MenuState): Wrap {
  const want = 1 + Math.floor(Math.random() * 3)
  const pool = [...TOPPINGS]
  const toppings: ToppingId[] = []
  for (let i = 0; i < want; i++) {
    toppings.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id)
  }
  // Three of the four means exactly one is missing, and whatever's left in
  // the pool IS the missing one. Half the time the ticket says so instead of
  // listing the other three.
  const without = want === TOPPINGS.length - 1 && Math.random() < 0.55 ? pool[0].id : null
  if (want <= 2 && !without && Math.random() < DOUBLE_CHANCE) toppings.push(pick(toppings))
  const sauce = menu.sauces.length > 0 && Math.random() < 0.5 ? pick(menu.sauces) : null
  return { toppings, sauce, without }
}

/** The shape every visitor shares, so the three rollers below only have to
 *  say what's different about theirs. */
function visitor(customer: SkinDef): Omit<Order, 'wraps' | 'sides' | 'line'> {
  return { kind: 'order', customer, usual: false, mood: 'normal', chat: [], late: false }
}

/** Whoever's next. Meat is never asked for — every shawarma has it, which is
 *  why the spit is a step and not a choice. */
export function rollOrder(menu: MenuState, regulars: Regulars, rude = false): Order {
  const customer = pick(CUSTOMER_SKINS)
  const known = regulars[customer.id]
  const mood: Mood = rude ? 'rude' : 'normal'

  if (known && known.times >= 2 && known.wraps.length > 0 && Math.random() < USUAL_CHANCE) {
    return {
      ...visitor(customer), mood,
      wraps: known.wraps, sides: known.sides,
      line: rude ? pick(RUDE_LINES) : pick(USUAL_LINES), usual: true,
    }
  }

  const wraps = [rollWrap(menu)]
  if (Math.random() < TWO_WRAP_CHANCE) wraps.push(rollWrap(menu))

  const sides: SideId[] = []
  if (Math.random() < 0.45) sides.push('pepsi')
  if (menu.sides.includes('chips') && Math.random() < 0.3) sides.push('chips')

  return {
    ...visitor(customer), mood, wraps, sides,
    line: rude ? pick(RUDE_LINES) : pick(pick([NICE, WEIRD, CREEPY])),
  }
}

/** Somebody who just wanted the window to be open. Nothing to build, nothing
 *  to hand over — only a slot at the counter and the choice of what to do
 *  with it. */
export function rollChat(): Order {
  const said = pick(CHAT_VISITS)
  return {
    ...visitor(pick(CUSTOMER_SKINS)),
    kind: 'chat', wraps: [], sides: [], chat: said, line: said[0],
  }
}

/** The last one of the night, after the street has already emptied. Always
 *  the same face, always the same order, so remembering it is the point. */
export function rollLate(menu: MenuState): Order {
  const customer = CUSTOMER_SKINS.find(c => c.id === LATE_REGULAR_ID) ?? CUSTOMER_SKINS[0]
  const sauce: SauceId | null = menu.sauces.includes('herb') ? 'herb' : 'garlic'
  return {
    ...visitor(customer), late: true,
    wraps: [{ toppings: ['onion', 'cheese'], sauce, without: null }],
    sides: ['pepsi'],
    line: pick(LATE_LINES),
  }
}

/** One finished wrap against one that was asked for. Contents, not order of
 *  assembly. Meat is required on every wrap even though nobody asks for it. */
export function wrapMatches(want: Wrap, got: Build): boolean {
  if (!got.meat) return false
  if (want.sauce !== got.sauce) return false
  // Counts, not membership: one tomato and two tomatoes are different orders,
  // and the second tap on a pan is how you get it wrong.
  if (want.toppings.length !== got.toppings.length) return false
  return TOPPINGS.every(t =>
    portionsOf(want.toppings, t.id) === portionsOf(got.toppings, t.id))
}

/** The whole hand-over. Two wraps count either way round — they're both
 *  going into the same bag. */
export function orderMatches(order: Order, tray: Tray): boolean {
  if (tray.wraps.length !== order.wraps.length) return false
  if (tray.sides.length !== order.sides.length) return false
  if (!order.sides.every(s => tray.sides.includes(s))) return false
  if (order.wraps.length === 1) return wrapMatches(order.wraps[0], tray.wraps[0])
  return (wrapMatches(order.wraps[0], tray.wraps[0]) && wrapMatches(order.wraps[1], tray.wraps[1]))
      || (wrapMatches(order.wraps[0], tray.wraps[1]) && wrapMatches(order.wraps[1], tray.wraps[0]))
}

/** What to remember about someone you just got right. */
export function rememberOrder(order: Order, known: RememberedOrder | undefined): RememberedOrder {
  return { wraps: order.wraps, sides: order.sides, times: (known?.times ?? 0) + 1 }
}
