// ═════════════════════════════════════════════════════════════════════════════
// chatAllowance — what it costs Eren to talk to you.
//
// TWO layers, and the split is the whole design:
//
//   Energy  — the VISIBLE one, and the only one a player should ever meet.
//             Talking drains the same energy stat the arcade already gates on,
//             so a long conversation tires him out and you fix it the way you
//             fix everything else: feed him, put him to bed. That turns the
//             limit into a loop back into the care rooms instead of a wall
//             that ends the session.
//
//   Daily   — the INVISIBLE backstop. Energy is restorable, so feed → talk →
//             feed → talk is unbounded, and every message is billed to one
//             Anthropic key. This is the ceiling that bounds the invoice when
//             someone decides to find out. Tuned to sit well above what a
//             normal day of play produces, so nobody meets it by accident.
//
// Shared by the API route (which enforces both) and /talk (which draws the
// first). Plain constants rather than env vars on purpose: the bar and the
// enforcement have to agree exactly, and a NEXT_PUBLIC_* value is inlined at
// BUILD time — an edited variable without a redeploy would draw a bar that
// lies about when he stops answering.
// ═════════════════════════════════════════════════════════════════════════════

import { EXHAUSTED_ENERGY } from '@/lib/gameRewards'

/** Energy spent per message. At 2, a full cat is good for ~35 messages before
 *  he hits EXHAUSTED_ENERGY — a real conversation, with a real cost. */
export const ENERGY_PER_MESSAGE = 2

/** Per-person daily ceiling. A backstop, not a game mechanic: energy is meant
 *  to bite long before this does. Raise it if real usage says otherwise —
 *  lowering it far enough to be hit routinely would put a second, invisible
 *  wall behind the visible one, which is exactly what this design avoids. */
export const DAILY_ALLOWANCE = 100

/**
 * Start of the current allowance day, as an ISO timestamp.
 *
 * UTC midnight, not local. The server has no trustworthy read on the caller's
 * timezone, and a client-supplied boundary is a one-line spoof into an
 * unlimited allowance.
 */
export function allowanceDayStart(now = new Date()): string {
  return new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
  )).toISOString()
}

/**
 * Energy as a 0–100 "how sleepy is he" reading, for the bar on /talk.
 *
 * Scaled across the USABLE range rather than raw energy: he stops talking at
 * EXHAUSTED_ENERGY, not at zero, so a raw inversion would peg the bar at 70%
 * and never fill. Mapping 100 → 0% and EXHAUSTED_ENERGY → 100% means the bar
 * fills exactly as he falls asleep, which is the thing it promises.
 */
export function sleepiness(energy: number): number {
  const span = 100 - EXHAUSTED_ENERGY
  return Math.max(0, Math.min(100, ((100 - energy) / span) * 100))
}

/** He's too tired to hold a conversation. Same threshold the arcade uses to
 *  stop paying coins, so "too tired" means one thing across the whole app. */
export function isTooSleepy(energy: number): boolean {
  return energy < EXHAUSTED_ENERGY
}

/**
 * How many more messages he has in him before the energy gate closes.
 *
 * This, not a raw stat number, is what the bar reads out: "17 LEFT" is a thing
 * a player can plan around, where "ENERGY 64" makes them do the division.
 */
export function messagesLeft(energy: number): number {
  return Math.max(0, Math.floor((energy - EXHAUSTED_ENERGY) / ENERGY_PER_MESSAGE))
}
