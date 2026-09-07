// ─── Jump foes ──────────────────────────────────────────────────────────────
// The things in the shaft that can hurt him, and the rules that keep every one
// of them beatable.
//
// ── Why a hazard is harder to make fair than a platform ────────────────────
// The player has ONE input: steer left or right. He cannot jump, cannot wait,
// cannot duck. Every bounce fires on its own the moment he touches a shelf. So
// a hazard he cannot steer around is not a hazard, it is a tax — and a hazard
// he cannot see coming is a tax collected at random. Each kind below therefore
// has a TELL you can read while falling, a STEERING answer, and a spawn rule in
// dealFoe() that makes the answer exist on every deal. There are two families:
//
//   ROUTE hazards sit somewhere perfect play never has to be. The chain shelf
//     (the one addPlat placed within reach) is always clear of them.
//       WASP    perched on one end of a shelf. Land on the other ≥50px.
//       BEETLE  crawls a shelf at 40px/s. Slow enough to aim around.
//       SOUR    a trap shelf beside the real one. It is never the only way up.
//       FLIER   patrols the FREE side of a storey, ≥95px clear of both shelves.
//
//   TIMED hazards own a column on a cycle, so passing them is about WHEN. But he
//     cannot choose when to jump — so they are only ever dealt above a shelf he
//     can bounce on in place (persistent, un-hazarded, normal bounce), and the
//     column sits ≥65px from both shelves so bouncing straight up is always
//     clear. Waiting costs him the chain, never the run.
//       DRIP    a drop of syrup falls the column, slowly, 45% of the time.
//       SPIDER  drops fast, dangles, climbs slowly. Cross while it is high.
//
// ── The three rules dealFoe() enforces on every deal ───────────────────────
//   1. SPACING. `credit` counts shelves since the last hazard; a new one needs
//      credit ≥ 2, so the shelf BELOW a hazard is always hazard-free. That is
//      the shelf you wait on.
//   2. THE SHELF BELOW IS PERSISTENT AND UNCAPPED. Never a crumb (spent on
//      landing — nowhere to wait), never a syrup or lid (the hop above them is
//      already capped, and a hazard on a capped hop is two punishments for one
//      landing).
//   3. GEOMETRY. Each kind's placement is checked against the two shelves it
//      sits between, with the numbers in its own section. If the geometry is
//      not there, the kind is not dealt — it is never squeezed in.
//
// A hit is a stung hop, not a death: see HIT_V / HIT_SHOVE in page.tsx.

import type { PlatKind } from './JumpPlatform'
import { PLAT_W } from './JumpPlatform'

export type FoeKind = 'wasp' | 'beetle' | 'drip' | 'spider' | 'flier'

export interface Foe {
  id: number
  kind: FoeKind
  /** WASP / BEETLE: the shelf it rides. */
  host: number
  /** WASP: fixed offset from the host's centre. BEETLE: current offset. */
  ox: number
  /** BEETLE / FLIER: direction of travel. */
  dir: 1 | -1
  /** DRIP / SPIDER: the column, and its band in world Y (top < bot). */
  cx: number
  top: number
  bot: number
  /** FLIER: patrol bounds and the storey it holds. */
  minX: number
  maxX: number
  x: number
  wy: number
  /** DRIP / SPIDER: cycle offset, so a screenful is never synchronised. */
  phase: number
  el?: HTMLDivElement | null
  /** The part that moves inside the positioned wrapper (drop, body). */
  inner?: HTMLElement | null
  /** SPIDER: the thread, scaled to the body. */
  thread?: HTMLElement | null
  /** WASP / BEETLE / FLIER: the span that carries scaleX for facing. */
  flip?: HTMLElement | null
}

// ── Sizes: hit-test half extents ──────────────────────────────────────────
/**
 * Eren's hazard box. Smaller than his 46px sprite on purpose: brushing a wasp
 * with an ear should not sting, and a forgiving box is what makes the answer
 * to a hazard feel like steering rather than luck.
 */
export const EREN_HIT_R = 16
export const WASP_R = 11
export const BEETLE_R = 9
export const DROP_R = 7
export const SPIDER_R = 11
export const FLIER_RX = 12
export const FLIER_RY = 8

// ── Behaviour ─────────────────────────────────────────────────────────────
export const BEETLE_SPEED = 40
/** Syrup is viscous; the drop is SLOW so the column reads before it matters. */
export const DRIP_CYCLE = 2000
export const DRIP_FALL_FRAC = 0.45
/** drop 0.3s · dangle 0.6s · climb 1.2s · rest 0.9s. Rest is the clear window. */
export const SPIDER_CYCLE = 3000
export const SPIDER_DROP_END = 0.10
export const SPIDER_DANGLE_END = 0.30
export const SPIDER_CLIMB_END = 0.70
/** The shiver before it drops — the last part of its rest. */
export const SPIDER_SHIVER_FROM = 0.93
export const FLIER_SPEED = 170

// ── Placement geometry ────────────────────────────────────────────────────
/** A perched wasp sits this far in from its shelf's end. */
const WASP_INSET = 13
/**
 * A column must be this far from BOTH shelf centres it sits between.
 *
 * The catch window on a shelf is ±49.5px, so a landing can be up to ~34px
 * off-centre and still be a reasonable landing. 65 − 34 = 31 ≥ EREN_HIT_R +
 * SPIDER_R (27): even a wide landing followed by a straight bounce clears the
 * column. A centred landing clears it by 49px.
 */
const COLUMN_CLEAR = 65
/** The column wanders this far off the exact midpoint, so a row of them is not a rail. */
const COLUMN_JITTER = 8
/**
 * A column needs the two shelves this far apart to fit between them — the
 * clearance on BOTH sides plus the jitter on both sides, so the jitter can
 * never eat into the clearance. (It did: 65·2 let a jittered column sit 57px
 * from a shelf, and the generator proof caught it.)
 */
const COLUMN_MIN_DX = 2 * (COLUMN_CLEAR + COLUMN_JITTER)
/**
 * A flier's patrol stops this far from the nearer shelf centre. The widest
 * reasonable landing (~45px off-centre) is then 50px from it — clear of
 * EREN_HIT_R + FLIER_RX (28) by 22px.
 */
const FLIER_CLEAR = 95
const FLIER_MIN_RANGE = 60
/** A sour shelf sits this far from the real one — no catch-window overlap. */
const SOUR_OFFSET_MIN = PLAT_W + 30
const SOUR_OFFSET_MAX = PLAT_W + 52

// ── Unlocks, in metres. One idea at a time. ───────────────────────────────
export const UNLOCK: Record<FoeKind | 'sour', number> = {
  wasp: 140,
  sour: 200,
  beetle: 300,
  drip: 360,
  flier: 420,
  spider: 520,
}

export const HAZARD_SPACING = 2

/** Shelves you can bounce on in place, with a normal-or-better bounce. */
const WAITABLE: PlatKind[] = ['jelly', 'slider', 'cream', 'rack']
/** Shelves a perched foe may ride. Cream is the reward; leave it alone. */
const PERCHABLE: PlatKind[] = ['jelly', 'slider', 'rack']

interface Shelf { x: number; wy: number; kind: PlatKind; id: number }

export interface Deal {
  foe?: Omit<Foe, 'el' | 'inner' | 'thread' | 'flip'>
  /** A sour trap shelf to push beside the real one. */
  sour?: { x: number; wy: number }
}

/**
 * Maybe deal one hazard for the hop `from` → `to`.
 *
 * Pure: everything it needs comes in, and the only randomness is `rnd`, so the
 * generator harness can run it a million times and check every rule above.
 */
export function dealFoe(a: {
  W: number
  climbed: number
  heat: number
  from: Shelf
  to: Shelf
  credit: number
  rnd: () => number
  nextId: () => number
}): Deal | null {
  const { W, climbed, heat, from, to, credit, rnd } = a
  if (credit < HAZARD_SPACING) return null
  if (!WAITABLE.includes(from.kind)) return null
  const chance = 0.14 + heat * 0.20
  if (rnd() >= chance) return null

  // Which kinds the climb has introduced so far, weighted. Sour is the
  // cheapest to place (it always fits) so it is held down, or a third of every
  // hazard in the shaft is a trap shelf.
  const pool = (Object.keys(UNLOCK) as Array<FoeKind | 'sour'>).filter(k => climbed >= UNLOCK[k])
  if (pool.length === 0) return null
  const weight = (k: FoeKind | 'sour') => (k === 'sour' ? 2 : 3)
  const total = pool.reduce((t, k) => t + weight(k), 0)
  let r = rnd() * total
  let pick: FoeKind | 'sour' = pool[pool.length - 1]
  for (const k of pool) { r -= weight(k); if (r <= 0) { pick = k; break } }
  const half = PLAT_W / 2
  const lo = half, hi = Math.max(half, W - half)
  const dx = to.x - from.x

  /**
   * A kind whose geometry is not there this hop is not squeezed in — but it is
   * not silently dropped either, or every hop too narrow for a column would
   * come out hazard-free and the easy hops would be the ONLY safe ones. The
   * pick is tried first, then the others in an order that keeps the trap shelf
   * LAST: it always fits, so anywhere earlier it would become a third of the
   * shaft.
   */
  const perched = (kind: 'wasp' | 'beetle'): Deal | null => {
    if (!PERCHABLE.includes(to.kind)) return null
    // The wasp takes the end nearer the shelf below: the lazy landing is the
    // stung one.
    return kind === 'wasp'
      ? { foe: base(a.nextId(), 'wasp', { host: to.id, ox: (dx >= 0 ? -1 : 1) * (half - WASP_INSET), dir: 1 }) }
      : { foe: base(a.nextId(), 'beetle', { host: to.id, ox: (rnd() * 2 - 1) * (half - BEETLE_R - 4), dir: rnd() < 0.5 ? -1 : 1 }) }
  }
  const sour = (): Deal | null => {
    // Beside the real shelf, on whichever side has room; prefer the side
    // nearer the shelf below, because a trap you would never be tempted by is
    // decoration. Same wy: they are the same storey, one of them lies.
    const off = SOUR_OFFSET_MIN + rnd() * (SOUR_OFFSET_MAX - SOUR_OFFSET_MIN)
    for (const side of dx >= 0 ? [-1, 1] : [1, -1]) {
      const x = to.x + side * off
      if (x >= lo && x <= hi) return { sour: { x, wy: to.wy } }
    }
    return null
  }
  const column = (kind: 'drip' | 'spider'): Deal | null => {
    // Between the two shelves when they are far enough apart; otherwise
    // BESIDE the pair, past the outer edge of whichever shelf is nearer the
    // wall. Either way the column is ≥ COLUMN_CLEAR from both centres, which
    // is the whole fairness argument, so the proof is the same proof.
    const spots: number[] = []
    if (Math.abs(dx) >= COLUMN_MIN_DX) spots.push(from.x + dx / 2)
    const outerR = Math.max(from.x, to.x) + COLUMN_CLEAR + COLUMN_JITTER
    const outerL = Math.min(from.x, to.x) - COLUMN_CLEAR - COLUMN_JITTER
    if (outerR <= W - 16) spots.push(outerR)
    if (outerL >= 16) spots.push(outerL)
    if (spots.length === 0) return null
    const cx = spots[Math.floor(rnd() * spots.length)] + (rnd() * 2 - 1) * COLUMN_JITTER
    // The band: from just under the target's top face to just under the
    // launch shelf's. He is above the top at landing (his box sits 6–40px
    // above a shelf he is standing on) and clears the bottom by x, never y.
    const top = to.wy + 14
    const bot = from.wy + 10
    return {
      foe: base(a.nextId(), kind, {
        cx, top, bot, x: cx, wy: top, phase: rnd() * (kind === 'drip' ? DRIP_CYCLE : SPIDER_CYCLE),
      }),
    }
  }
  const flier = (): Deal | null => {
    // Whichever side of the storey both shelves leave free.
    const right = Math.max(from.x, to.x) + FLIER_CLEAR
    const left = Math.min(from.x, to.x) - FLIER_CLEAR
    const ranges: Array<[number, number]> = []
    if (W - 14 - right >= FLIER_MIN_RANGE) ranges.push([right, W - 14])
    if (left - 14 >= FLIER_MIN_RANGE) ranges.push([14, left])
    if (ranges.length === 0) return null
    const [minX, maxX] = ranges[Math.floor(rnd() * ranges.length)]
    const wy = to.wy + (from.wy - to.wy) / 2
    return {
      foe: base(a.nextId(), 'flier', {
        minX, maxX, x: minX + rnd() * (maxX - minX), wy, dir: rnd() < 0.5 ? -1 : 1,
      }),
    }
  }

  const build = (k: FoeKind | 'sour'): Deal | null =>
    k === 'sour' ? sour()
      : k === 'wasp' || k === 'beetle' ? perched(k)
        : k === 'drip' || k === 'spider' ? column(k)
          : flier()
  const order: Array<FoeKind | 'sour'> = [pick, rnd() < 0.5 ? 'wasp' : 'beetle', 'flier', rnd() < 0.5 ? 'drip' : 'spider', 'sour']
  for (const k of order) {
    if (!pool.includes(k)) continue
    const d = build(k)
    if (d) return d
  }
  return null
}

function base(id: number, kind: FoeKind, over: Partial<Omit<Foe, 'el' | 'inner' | 'thread' | 'flip'>>): Omit<Foe, 'el' | 'inner' | 'thread' | 'flip'> {
  return {
    id, kind, host: -1, ox: 0, dir: 1, cx: 0, top: 0, bot: 0, minX: 0, maxX: 0,
    x: 0, wy: 0, phase: 0, ...over,
  }
}

/**
 * Where a DRIP's drop is right now: 0→1 down the band while falling, or null
 * while the column is clear. Pure in `now`, so the loop and the harness agree.
 */
export function dripAt(f: Foe, now: number): number | null {
  const t = ((now + f.phase) % DRIP_CYCLE) / DRIP_CYCLE
  return t < DRIP_FALL_FRAC ? t / DRIP_FALL_FRAC : null
}

/** Where a SPIDER's body is: 0 (top of band) → 1 (bottom). And whether it is shivering. */
export function spiderAt(f: Foe, now: number): { u: number; shiver: boolean } {
  const t = ((now + f.phase) % SPIDER_CYCLE) / SPIDER_CYCLE
  if (t < SPIDER_DROP_END) return { u: t / SPIDER_DROP_END, shiver: false }
  if (t < SPIDER_DANGLE_END) return { u: 1, shiver: false }
  if (t < SPIDER_CLIMB_END) return { u: 1 - (t - SPIDER_DANGLE_END) / (SPIDER_CLIMB_END - SPIDER_DANGLE_END), shiver: false }
  return { u: 0, shiver: t >= SPIDER_SHIVER_FROM }
}
