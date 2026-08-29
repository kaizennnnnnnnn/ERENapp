// ═══════════════════════════════════════════════════════════════════════════
// KIOSK ECONOMY — what a night is worth, and how long it lasts.
// ──────────────────────────────────────────────────────────────────────────
// Pure numbers, no React. Kept apart from kioskShift's art geometry because
// these are the knobs you actually want to turn: how long the night runs, how
// fast a customer's patience burns, what a tip is worth.
//
// The shape of a shift:
//   * The kiosk opens at 22:00 and the street empties at 02:00. That whole
//     night is SHIFT_MS of real time, so the clock on the wall is a readout of
//     a real countdown rather than decoration.
//   * Closing time stops NEW customers. Whoever is already at the window can
//     still be served — you are never cut off mid-order.
//   * Coins are NOT paid per wrap. They pile up in the till and are banked
//     when you close up, which is what makes closing a moment instead of a
//     door. Walk out through the door early and the base pay follows you home;
//     the tips do not.
// ═══════════════════════════════════════════════════════════════════════════

import type { Order, SideId, Tidiness, WeatherId, Wrap } from './kioskShift'

// ── The night ─────────────────────────────────────────────────────────────
/** How long the street stays busy. Turn this one number to make the night
 *  longer or shorter — the clock, the customer flow and the report all read
 *  from it. */
export const SHIFT_MS = 210_000
/** Painted on the clock: open at 22:00, dead by 02:00. */
export const OPEN_HOUR = 22
export const SHIFT_HOURS = 4

/** The kiosk clock, as hours and minutes, from how far into the night you are. */
export function shiftClock(elapsed: number): { h: number; m: number } {
  const t = Math.max(0, Math.min(1, elapsed / SHIFT_MS)) * SHIFT_HOURS
  const h = (OPEN_HOUR + Math.floor(t)) % 24
  return { h, m: Math.floor((t % 1) * 60) }
}

export function clockText(elapsed: number): string {
  const { h, m } = shiftClock(elapsed)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── Waiting ───────────────────────────────────────────────────────────────
/** How long someone will stand at the window before they give up and walk.
 *  Long enough to carve, load a pan and still make it; short enough that
 *  wandering off to admire the smoke costs you the sale. */
export const PATIENCE_MS = 34_000
/** Below this much patience left, they start saying so. */
export const GRUMBLE_AT = 0.42
/** And below this the meter goes red. */
export const PANIC_AT = 0.2
/** Gap between one customer leaving and the next walking up. */
export const NEXT_CUSTOMER_MS = 1_600
/** Shorter after a SALE, because the beat has already been spent: the
 *  customer stood there being pleased with you for LINGER_MS. A walk-out
 *  keeps the full gap — an empty window is how a lost sale lands. */
export const NEXT_AFTER_SALE_MS = 700

// ── Money ─────────────────────────────────────────────────────────────────
/** Base pay for one wrap: the bread, plus what's on it. */
export function wrapBase(w: Wrap): number {
  return 6 + w.toppings.length * 2 + (w.sauce ? 2 : 0)
}

export function sideBase(id: SideId): number {
  return id === 'cola' ? 3 : 4
}

/** What the order is worth before anyone decides how they feel about you. */
export function orderBase(o: Order): number {
  return o.wraps.reduce((sum, w) => sum + wrapBase(w), 0)
    + o.sides.reduce((sum, s) => sum + sideBase(s), 0)
}

/** Each correct wrap in a row is worth a little more than the last, up to a
 *  ceiling — a hot streak should feel hot without turning one lucky night
 *  into the whole economy. */
export const STREAK_STEP = 0.12
export const STREAK_CAP = 5

export function streakMultiplier(streak: number): number {
  return 1 + Math.min(streak, STREAK_CAP) * STREAK_STEP
}

/**
 * The tip. Everything above base pay comes from how fast you were and how
 * long you've been getting it right — served the moment they arrive and on a
 * run, a wrap can pay nearly double; served as they're about to walk out, it
 * pays base and nothing else.
 *
 * `patience01` is how much of their patience was LEFT when you handed it over.
 */
export function orderTip(base: number, patience01: number, streak: number): number {
  const speed = Math.max(0, Math.min(1, patience01))
  return Math.round(base * 0.55 * speed * streakMultiplier(streak))
}

/** Remembering an order nobody told you deserves paying for. */
export const USUAL_BONUS = 8

// ── Who's at the window ───────────────────────────────────────────────────
/** Chance the next arrival is somebody in a mood. Never the first of the
 *  night: the kiosk gets to introduce itself politely. */
export const RUDE_CHANCE = 0.11
/** Patience left they need to still have when you hand it over, before a rude
 *  customer will admit you did well. */
export const RUDE_EARNS_IT = 0.5
/** And what the apology is worth, on top of a normal tip. */
export const RUDE_MULT = 2.1

/** Chance the next arrival didn{A}t come to buy anything. */
export const CHAT_CHANCE = 0.12
/** How long a chat visitor stands there if you never answer them. */
export const CHAT_PATIENCE_MS = 15_000
/** Beat between the last thing they say and them walking off. */
export const CHAT_LEAVE_MS = 2_400
/** What hearing one all the way out is worth. Never much — the point isn{A}t
 *  the money, it{A}s that the money is not the reason. */
export const CHAT_TIP = 9

/** Chance the closing-time regular turns up at all. */
export const LATE_CHANCE = 0.72
/** How long after last call they appear. */
export const LATE_ARRIVES_MS: [number, number] = [6_000, 13_000]
/** Everything they pay, times this. Staying open for one more is meant to be
 *  worth it. */
export const LATE_MULT = 2.4

// ── What can go wrong with the food ───────────────────────────────────────
/** Tip multiplier for a wrap made with meat that was raw or charred. They
 *  still take it. They still notice. */
export const BAD_MEAT_MULT = 0.45
/** And what the roll is worth, per wrap on the tray. */
export const TIDY_BONUS: Record<Tidiness, number> = { neat: 0.18, loose: 0, split: -0.14 }

// ── The lights going out ──────────────────────────────────────────────────
/** Chance the street loses power at some point in the night. */
export const BLACKOUT_CHANCE = 0.3
export const BLACKOUT_MS = 26_000
/** Flat extra on every wrap handed over in the dark. */
export const BLACKOUT_BONUS = 7

// ── Between the two of you ────────────────────────────────────────────────
/** Wraps the household is asked for in one night, across both shifts. */
export const NIGHT_GOAL = 22
/** What meeting it is worth, to whoever closes with it met. Both of you get
 *  it if you both close after the line is crossed — which is the point. */
export const GOAL_BONUS = 40
/** What an unanswered phone costs off the night's tips — a caller who wanted
 *  something and got the machine instead. */
export const MISSED_CALL_COST = 4
/** Sitting in the till at the start of the night, so the first coin flight
 *  isn't from zero. */
export const FLOAT_COINS = 0

// ── The report ────────────────────────────────────────────────────────────
export interface Takings {
  /** Wraps handed over while the street had no power. */
  inDark: number
  /** Wraps handed over and paid for. */
  served: number
  /** Handed over wrong. */
  wrong: number
  /** Gave up and walked off. */
  walked: number
  /** Calls the machine had to take. */
  missedCalls: number
  /** Best run of correct orders. */
  bestStreak: number
  base: number
  tips: number
}

export const EMPTY_TAKINGS: Takings = {
  served: 0, wrong: 0, walked: 0, missedCalls: 0, bestStreak: 0, base: 0, tips: 0, inDark: 0,
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

/**
 * The night, in one letter.
 *
 * Accuracy is most of it — a kiosk that gets orders wrong doesn't get busy.
 * Volume is the rest, measured against a night's honest work rather than a
 * theoretical maximum, so a good run at a comfortable pace still grades well.
 */
export const GOOD_NIGHT = 9

export function gradeNight(t: Takings): Grade {
  const attempts = t.served + t.wrong + t.walked
  if (attempts === 0) return 'D'
  const accuracy = t.served / attempts
  const volume = Math.min(1, t.served / GOOD_NIGHT)
  const score = accuracy * 0.68 + volume * 0.32
  if (score >= 0.94 && t.wrong === 0 && t.walked === 0) return 'S'
  if (score >= 0.82) return 'A'
  if (score >= 0.64) return 'B'
  if (score >= 0.42) return 'C'
  return 'D'
}

/** Printed on cream till paper, not on a dark panel — these are ink colours.
 *  The pale set that reads well on the kiosk's HUD disappears on the roll. */
export const GRADE_COLOR: Record<Grade, string> = {
  S: '#B07A12',
  A: '#2E7D32',
  B: '#1F5FA8',
  C: '#A85E12',
  D: '#A83A32',
}

export const GRADE_WORD: Record<Grade, string> = {
  S: 'a perfect night',
  A: 'a good night',
  B: 'a fair night',
  C: 'a slow night',
  D: 'a rough night',
}
