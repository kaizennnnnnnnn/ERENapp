// ═════════════════════════════════════════════════════════════════════════════
// EREN'S DAILY QUIP — Eren's Inner Life (Living Voice)
//
// One ambient "decision" Eren makes per local day, deterministic from
// (date, household) so BOTH partners see the same quirk on the same date —
// something to talk about ("did you see he claimed the box again?").
//
// Flavor-only: no grant, no reward, nothing to claim. Sibling to wishes.ts /
// flavorLines.ts. The list is APPEND-ONLY — rotation hashes against the index,
// so reordering or deleting shifts every household's history.
// ═════════════════════════════════════════════════════════════════════════════

import { hashStr, dateKey } from './wishes'

export interface Quip {
  id: string
  text: string
}

// Append-only. New quips go at the END.
export const QUIPS: Quip[] = [
  { id: 'q-basket',    text: 'today, the laundry basket is mine.' },
  { id: 'q-window',    text: "i've decided the windowsill is a bed now." },
  { id: 'q-leaf',      text: "i brought you a leaf. you're welcome." },
  { id: 'q-box',       text: 'this box? mine. forever.' },
  { id: 'q-knock',     text: "i knocked something over earlier. wasn't me." },
  { id: 'q-laptop',    text: "i've claimed the warm laptop. do not disturb." },
  { id: 'q-highshelf', text: 'i will be sitting up high today. judging.' },
  { id: 'q-sock',      text: 'i took one sock. you will never find it.' },
  { id: 'q-loaf',      text: "i'm a loaf today. no paws. just loaf." },
  { id: 'q-supervise', text: "i'll be supervising everything you do today." },
  { id: 'q-door',      text: 'i want to be on the other side of every door.' },
  { id: 'q-bag',       text: 'if it fits, i sits. the bag fits.' },
]

/** The quip for a given date + household. Deterministic — both partners in a
 *  household compute the same one. Mirrors wishOfTheDay's hashing. */
export function quipOfTheDay(opts: {
  date: Date
  householdId: string
  tz: string | null | undefined
}): Quip {
  const key = `${dateKey(opts.date, opts.tz)}::${opts.householdId}`
  return QUIPS[hashStr(key) % QUIPS.length]
}
