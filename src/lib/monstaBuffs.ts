import type { FoodKey } from '@/types'

// ─── Monsta buffs ────────────────────────────────────────────────────────────
// Every can in the family does two things: refills the energy bar to full, and
// grants ONE perk of its own. That's what separates a 100-coin can from an
// 8-coin biscuit — you buy a can for the perk, not for the calories.
//
// The perks are picked off each can's own identity (zero sugar burns weight,
// the punch knocks the sickness out, ultra rosa puts him to sleep), so the
// family stays memorable instead of being nine interchangeable stat sticks.
//
// Rainbow — the gacha jackpot — is EVERY perk at once, and it's DERIVED from
// the table below rather than hand-copied. Add a tenth flavour and the rainbow
// picks its perk up for free, with no chance of the two drifting apart.
//
// The two SPECIAL EDITION cans (Rainbow, Gold) sit OUTSIDE the flavour table on
// purpose. They're siblings, not flavours: keeping Gold out of FLAVOURS stops it
// silently inflating the rainbow through everyBuff(), and lets the pair pull in
// different directions — Rainbow is breadth (a little of everything, cures,
// slims), Gold is depth (the biggest single hit of joy in the family, and it
// pays you back). Neither strictly dominates the other, so both stay worth
// chasing.

export interface MonstaBuff {
  /** Short line for the shop chip and the feeding toast. */
  label: string
  // Stat deltas, applied on top of the food's own hunger/joy.
  happiness?: number
  hunger?: number
  sleep_quality?: number
  cleanliness?: number
  /** Negative slims him down. */
  weight?: number
  /** Clears is_sick. */
  cure?: boolean
  /** Paid through TaskContext.addCoins — coins aren't an eren_stats column. */
  coins?: number
}

/** Energy every can restores him to, whatever the flavour. */
export const MONSTA_ENERGY = 100

const FLAVOURS = {
  monsta_original: { label: '+40 COINS',      coins: 40 },
  monsta_white:    { label: '-0.25 KG',       weight: -0.25 },
  monsta_mango:    { label: 'JOY +35',        happiness: 35 },
  monsta_loco:     { label: 'HUNGER +35',     hunger: 35 },
  monsta_pipeline: { label: 'CLEAN +35',      cleanliness: 35 },
  monsta_punch:    { label: 'CURES SICKNESS', cure: true },
  monsta_rosa:     { label: 'SLEEP +35',      sleep_quality: 35 },
  monsta_peachy:   { label: 'JOY+20 SLEEP+20', happiness: 20, sleep_quality: 20 },
} satisfies Partial<Record<FoodKey, MonstaBuff>>

/** The rainbow can: the strongest version of every perk in the table above. */
function everyBuff(): MonstaBuff {
  const all: MonstaBuff[] = Object.values(FLAVOURS)
  // `|| undefined` so an unused lever stays absent rather than a no-op 0.
  const best = (pick: (b: MonstaBuff) => number | undefined) =>
    Math.max(...all.map(b => pick(b) ?? 0)) || undefined
  return {
    label: 'EVERY BUFF',
    happiness:     best(b => b.happiness),
    hunger:        best(b => b.hunger),
    sleep_quality: best(b => b.sleep_quality),
    cleanliness:   best(b => b.cleanliness),
    coins:         best(b => b.coins),
    weight: Math.min(...all.map(b => b.weight ?? 0)) || undefined,
    cure: all.some(b => b.cure),
  }
}

// The coin kickback MUST stay under MONSTA_PRICE (100). Every can is buyable in
// the shop, so a can that pays back more than it costs is an infinite money
// printer — and coins are what buy gacha pulls. +60 leaves it a net sink, in
// the same shape as Original's +40.
const MONSTA_GOLD_BUFF: MonstaBuff = {
  label: '+60 COINS JOY+60',
  coins: 60,
  happiness: 60,
}

export const MONSTA_BUFFS: Partial<Record<FoodKey, MonstaBuff>> = {
  ...FLAVOURS,
  monsta_rainbow: everyBuff(),
  monsta_gold: MONSTA_GOLD_BUFF,
}

/** The buff a food grants, or undefined if it's an ordinary dish. */
export const monstaBuff = (id: string): MonstaBuff | undefined =>
  MONSTA_BUFFS[id as FoodKey]
