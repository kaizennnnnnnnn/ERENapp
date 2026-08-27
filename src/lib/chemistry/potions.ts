// ═════════════════════════════════════════════════════════════════════════════
// POTIONS — what a finished brew actually IS.
//
// Filling an order used to end in a fun-fact card, which is why the lab felt
// like homework: you did chemistry and chemistry gave you back more chemistry.
// A potion now carries a real perk, poured into Eren the same way a Monsta can
// is (the `MonstaBuff` shape is deliberately reused so there's ONE perk path in
// useErenStats, not two that can drift).
//
// Twelve of them, each with its own colour and its own reason to want it. The
// day's order rolls one; the shelf collects the ones you've bottled.
// ═════════════════════════════════════════════════════════════════════════════

import type { MonstaBuff } from '@/lib/monstaBuffs'

/** How cleanly the order was filled. Scales the potion, not whether you get it. */
export type BrewGrade = 'perfect' | 'good' | 'murky'

export interface Potion {
  id: string
  name: string
  /** Liquid body colour. */
  deep: string
  /** Meniscus + bubbles — the lighter tint of the same liquid. */
  light: string
  /** Short all-caps line for the order card chip. */
  effect: string
  /** One sentence of flavour, shown once it's bottled. */
  blurb: string
  /** What drinking it does. Numbers scale with the grade; flags don't. */
  buff: MonstaBuff
}

export const POTIONS: Potion[] = [
  {
    id: 'moonmilk',
    name: 'Fizzy Moonmilk',
    deep: '#8B5CF6', light: '#C4B5FD',
    effect: 'SLEEP +30',
    blurb: 'Warm, faintly fizzy, tastes like the last hour before bed.',
    buff: { label: 'SLEEP +30', sleep_quality: 30 },
  },
  {
    id: 'frostmint',
    name: 'Frostmint Fizz',
    deep: '#14B8A6', light: '#7EE7DA',
    effect: 'CLEAN +35',
    blurb: 'One sip and his whole coat squeaks. Nobody knows why.',
    buff: { label: 'CLEAN +35', cleanliness: 35 },
  },
  {
    id: 'sunbeam',
    name: 'Sunbeam Syrup',
    deep: '#F59E0B', light: '#FCD34D',
    effect: 'JOY +35',
    blurb: 'Bottled four in the afternoon, when the rug gets the good light.',
    buff: { label: 'JOY +35', happiness: 35 },
  },
  {
    id: 'sardine',
    name: 'Sardine Sparkle',
    deep: '#0EA5E9', light: '#7DD3FC',
    effect: 'FULL +35',
    blurb: 'Do not smell it. Just give it to him.',
    buff: { label: 'FULL +35', hunger: 35 },
  },
  {
    id: 'purring',
    name: 'Purring Draught',
    deep: '#EC4899', light: '#F9A8D4',
    effect: 'JOY +20 · SLEEP +20',
    blurb: 'The purr starts before he finishes swallowing.',
    buff: { label: 'JOY +20 · SLEEP +20', happiness: 20, sleep_quality: 20 },
  },
  {
    id: 'midnight',
    name: 'Midnight Bubbles',
    deep: '#4F46E5', light: '#A5B4FC',
    effect: 'SLEEP +40',
    blurb: 'Goes down like a dark room and a closed door.',
    buff: { label: 'SLEEP +40', sleep_quality: 40 },
  },
  {
    id: 'comet',
    name: 'Comet Cream',
    deep: '#06B6D4', light: '#A5F3FC',
    effect: 'FULL +20 · JOY +20',
    blurb: 'Dessert and dinner, settled out of court.',
    buff: { label: 'FULL +20 · JOY +20', hunger: 20, happiness: 20 },
  },
  {
    id: 'ember',
    name: 'Velvet Ember',
    deep: '#DC2626', light: '#FCA5A5',
    effect: 'CURES THE SNIFFLES',
    blurb: 'Tastes like a blanket. Works like one too.',
    buff: { label: 'CURES THE SNIFFLES', cure: true, happiness: 12 },
  },
  {
    id: 'whisker',
    name: 'Whisker Tonic',
    deep: '#65A30D', light: '#BEF264',
    effect: '-0.3 KG · CLEAN +15',
    blurb: 'Green, virtuous, and he pretends not to enjoy it.',
    buff: { label: '-0.3 KG · CLEAN +15', weight: -0.3, cleanliness: 15 },
  },
  {
    id: 'nebula',
    name: 'Nebula Milk',
    deep: '#A21CAF', light: '#F0ABFC',
    effect: '+60 COINS',
    blurb: 'He drinks it, then coughs up small change. Never question it.',
    buff: { label: '+60 COINS', coins: 60, happiness: 8 },
  },
  {
    id: 'thunder',
    name: 'Bottled Thunder',
    deep: '#0284C7', light: '#BAE6FD',
    effect: 'ENERGY TO FULL',
    blurb: 'The fur on his tail stands up for a solid minute afterwards.',
    buff: { label: 'ENERGY TO FULL', energy: 100 },
  },
  {
    id: 'honeyed',
    name: 'Honeyed Static',
    deep: '#CA8A04', light: '#FDE68A',
    effect: 'A LITTLE OF EVERYTHING',
    blurb: 'The batch that goes slightly wrong in exactly the right way.',
    buff: { label: 'A LITTLE OF EVERYTHING', happiness: 15, hunger: 15, cleanliness: 15, sleep_quality: 15 },
  },
]

export const POTION_BY_ID: Record<string, Potion> = Object.fromEntries(
  POTIONS.map(p => [p.id, p]),
)

interface GradeDef {
  label: string
  /** Scales every numeric delta on the buff. */
  mult: number
  /** `buff.energy` is an absolute target, not a delta — it gets its own tier. */
  energyTarget: number
  /** Paid on top of the daily quest for filling the order cleanly. */
  bonusCoins: number
  color: string
  line: string
}

/**
 * Three tiers, no fail state. A wrong pour never locks you out of the potion —
 * it waters it down. This is the thing you do while the kettle boils.
 */
export const GRADES: Record<BrewGrade, GradeDef> = {
  perfect: { label: 'PERFECT', mult: 1,    energyTarget: 100, bonusCoins: 15, color: '#4ADE80', line: 'Not one wrong pour.' },
  good:    { label: 'GOOD',    mult: 0.7,  energyTarget: 85,  bonusCoins: 8,  color: '#FCD34D', line: 'A little cloudy. He will not notice.' },
  murky:   { label: 'MURKY',   mult: 0.45, energyTarget: 70,  bonusCoins: 0,  color: '#F87171', line: 'Half the bench is on the floor. It still counts.' },
}

/** Misses → grade. Two slips is still a good batch; three is a murky one. */
export function gradeFor(misses: number): BrewGrade {
  if (misses === 0) return 'perfect'
  if (misses <= 2) return 'good'
  return 'murky'
}

/**
 * The potion as actually poured. Numeric deltas shrink with a sloppier batch;
 * `cure` is a flag and doesn't scale (half a cure isn't a thing), and `energy`
 * is an absolute target so it steps down by tier instead of by multiplier.
 */
export function scaleBuff(buff: MonstaBuff, grade: BrewGrade): MonstaBuff {
  const g = GRADES[grade]
  const scale = (n: number | undefined) =>
    n === undefined ? undefined : Math.round(n * g.mult)
  return {
    label: buff.label,
    happiness:     scale(buff.happiness),
    hunger:        scale(buff.hunger),
    sleep_quality: scale(buff.sleep_quality),
    cleanliness:   scale(buff.cleanliness),
    coins:         scale(buff.coins),
    // Weight is the one delta that's fractional — rounding it to an integer
    // would turn -0.3 kg into 0 and quietly delete the tonic's whole point.
    weight: buff.weight === undefined
      ? undefined
      : Math.round(buff.weight * g.mult * 100) / 100,
    energy: buff.energy === undefined ? undefined : g.energyTarget,
    cure: buff.cure,
  }
}

/** Human-readable "what it did", built from the buff that was actually poured. */
export function buffLines(buff: MonstaBuff): string[] {
  const out: string[] = []
  if (buff.hunger)        out.push(`FULL +${buff.hunger}`)
  if (buff.happiness)     out.push(`JOY +${buff.happiness}`)
  if (buff.energy)        out.push(`ENERGY ${buff.energy}`)
  if (buff.sleep_quality) out.push(`SLEEP +${buff.sleep_quality}`)
  if (buff.cleanliness)   out.push(`CLEAN +${buff.cleanliness}`)
  if (buff.weight)        out.push(`${buff.weight > 0 ? '+' : ''}${buff.weight} KG`)
  if (buff.cure)          out.push('SNIFFLES GONE')
  if (buff.coins)         out.push(`+${buff.coins} COINS`)
  return out
}
