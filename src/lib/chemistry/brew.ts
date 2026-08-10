// ═════════════════════════════════════════════════════════════════════════════
// EREN'S BREW — the lab's daily potion order.
//
// Every other chemistry mode in this app asks the same question in a different
// costume: "which symbol goes with which name". This one never asks that. An
// order is written in PROPERTIES — "one that's liquid at room temperature, and
// two noble gases" — so the way you solve it is by knowing where things sit on
// the table and what they ARE, not by reciting a lookup.
//
// The order is seeded off the date, so both people in the household get the
// same brew, and it's a different one tomorrow.
//
// Data-only on purpose: the overlay renders this, it doesn't decide any of it.
// ═════════════════════════════════════════════════════════════════════════════

import { elements, type Element } from './elements'

// ─── Seeded RNG ──────────────────────────────────────────────────────────────
// Same key in → same brew out, on both phones, all day.

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)]

function shuffled<T>(rng: () => number, arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── What an order can ask for ───────────────────────────────────────────────
// `label` is the sentence fragment on the order card; `chip` is the short form
// printed on an empty slot. `maxCount` caps how many of a kind one order may
// ask for — there are only two liquids on the whole table, so asking for two
// of them is a puzzle with exactly one answer, which isn't a puzzle.

interface Ask {
  id: string
  label: string
  chip: string
  maxCount: number
  test: (el: Element) => boolean
}

const ASKS: Ask[] = [
  { id: 'noble',    label: 'a noble gas',                 chip: 'NOBLE GAS',    maxCount: 2, test: e => e.category === 'noble-gas' },
  { id: 'halogen',  label: 'a halogen',                   chip: 'HALOGEN',      maxCount: 2, test: e => e.category === 'halogen' },
  { id: 'alkali',   label: 'an alkali metal',             chip: 'ALKALI METAL', maxCount: 2, test: e => e.category === 'alkali-metal' },
  { id: 'earth',    label: 'an alkaline earth metal',     chip: 'ALK. EARTH',   maxCount: 2, test: e => e.category === 'alkaline-earth-metal' },
  { id: 'metalloid',label: 'a metalloid',                 chip: 'METALLOID',    maxCount: 2, test: e => e.category === 'metalloid' },
  { id: 'transition',label:'a transition metal',          chip: 'TRANSITION',   maxCount: 2, test: e => e.category === 'transition-metal' },
  { id: 'posttrans',label: 'a poor metal',                chip: 'POOR METAL',   maxCount: 2, test: e => e.category === 'post-transition-metal' },
  { id: 'nonmetal', label: 'a plain nonmetal',            chip: 'NONMETAL',     maxCount: 2, test: e => e.category === 'nonmetal' },
  { id: 'lanth',    label: 'a lanthanide',                chip: 'LANTHANIDE',   maxCount: 2, test: e => e.category === 'lanthanide' },
  { id: 'actin',    label: 'an actinide',                 chip: 'ACTINIDE',     maxCount: 2, test: e => e.category === 'actinide' },
  // Only Br and Hg — the whole point of the ask. Hard-capped at one.
  { id: 'liquid',   label: 'something liquid at room temperature', chip: 'A LIQUID', maxCount: 1, test: e => e.state === 'liquid' },
  { id: 'gas',      label: 'anything that\'s a gas',      chip: 'A GAS',        maxCount: 2, test: e => e.state === 'gas' },
  { id: 'p2',       label: 'anything from period 2',      chip: 'PERIOD 2',     maxCount: 2, test: e => e.period === 2 },
  { id: 'p3',       label: 'anything from period 3',      chip: 'PERIOD 3',     maxCount: 2, test: e => e.period === 3 },
  { id: 'p4',       label: 'anything from period 4',      chip: 'PERIOD 4',     maxCount: 2, test: e => e.period === 4 },
  { id: 'tiny',     label: 'an element lighter than neon',chip: 'NUMBER < 10',  maxCount: 2, test: e => e.atomicNumber < 10 },
  { id: 'heavy',    label: 'an element heavier than lead',chip: 'NUMBER > 82',  maxCount: 2, test: e => e.atomicNumber > 82 },
]

/** Elements an ask matches. Computed once — the table never changes. */
const MATCHES: Record<string, Element[]> = Object.fromEntries(
  ASKS.map(a => [a.id, elements.filter(a.test)]),
)

/** Two asks are usable together only if NOTHING satisfies both. Otherwise a
 *  tile could legitimately belong in two slots and the player would be marked
 *  wrong for a right answer (neon is a gas AND a noble gas). */
function disjoint(a: Ask, b: Ask): boolean {
  return !MATCHES[a.id].some(el => b.test(el))
}

// ─── Potions ─────────────────────────────────────────────────────────────────
// Name + liquid colour travel together so a "Frostmint Fizz" is never brown.

interface Potion { name: string; deep: string; light: string }

const POTIONS: Potion[] = [
  { name: 'Fizzy Moonmilk',  deep: '#8B5CF6', light: '#C4B5FD' },
  { name: 'Frostmint Fizz',  deep: '#14B8A6', light: '#7EE7DA' },
  { name: 'Sunbeam Syrup',   deep: '#F59E0B', light: '#FCD34D' },
  { name: 'Sardine Sparkle', deep: '#0EA5E9', light: '#7DD3FC' },
  { name: 'Purring Draught', deep: '#EC4899', light: '#F9A8D4' },
  { name: 'Midnight Bubbles',deep: '#4F46E5', light: '#A5B4FC' },
  { name: 'Comet Cream',     deep: '#06B6D4', light: '#A5F3FC' },
  { name: 'Velvet Ember',    deep: '#DC2626', light: '#FCA5A5' },
  { name: 'Whisker Tonic',   deep: '#65A30D', light: '#BEF264' },
  { name: 'Nebula Milk',     deep: '#A21CAF', light: '#F0ABFC' },
  { name: 'Bottled Thunder', deep: '#0284C7', light: '#BAE6FD' },
  { name: 'Honeyed Static',  deep: '#CA8A04', light: '#FDE68A' },
]

// ─── The order ───────────────────────────────────────────────────────────────

/** One thing the flask still needs. Slots are independent and disjoint, so a
 *  tapped tile fits at most one of them — no ambiguity, no wrong rejections. */
export interface BrewSlot {
  askId: string
  chip: string
  test: (el: Element) => boolean
  filled: Element | null
}

export interface BrewOrder {
  /** Daily key, or `free-N` for a replay after the daily one is done. */
  key: string
  potion: Potion
  /** The order card sentence, e.g. "a noble gas, and two metalloids". */
  sentence: string
  slots: BrewSlot[]
  /** Nine tiles: every slot's answer, a couple of spares, and near-misses. */
  shelf: Element[]
}

const PLURAL: Record<string, string> = {
  'a noble gas': 'noble gases',
  'a halogen': 'halogens',
  'an alkali metal': 'alkali metals',
  'an alkaline earth metal': 'alkaline earth metals',
  'a metalloid': 'metalloids',
  'a transition metal': 'transition metals',
  'a poor metal': 'poor metals',
  'a plain nonmetal': 'plain nonmetals',
  'a lanthanide': 'lanthanides',
  'an actinide': 'actinides',
  "anything that's a gas": 'gases',
  'anything from period 2': 'from period 2',
  'anything from period 3': 'from period 3',
  'anything from period 4': 'from period 4',
  'an element lighter than neon': 'lighter than neon',
  'an element heavier than lead': 'heavier than lead',
}

const COUNT_WORD = ['', 'one', 'two', 'three']

function phrase(ask: Ask, count: number): string {
  if (count === 1) return ask.label
  return `${COUNT_WORD[count]} ${PLURAL[ask.label] ?? ask.label}`
}

/** Join with commas and a trailing "and", the way a person writes a list. */
function joinNicely(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}

const SHELF_SIZE = 9

/**
 * Build the order for `key`. Deterministic: same key always yields the same
 * potion, asks, and shelf — including the tile order.
 */
export function buildBrew(key: string): BrewOrder {
  const rng = mulberry32(hashString(`brew:${key}`))

  // Pick 2–3 asks that can't overlap. Anything with fewer than two matching
  // elements is dropped so a slot always has an alternative answer.
  const chosen: Ask[] = []
  const wanted = rng() < 0.45 ? 2 : 3
  for (const ask of shuffled(rng, ASKS)) {
    if (chosen.length >= wanted) break
    if (MATCHES[ask.id].length < 2) continue
    if (chosen.every(c => disjoint(c, ask))) chosen.push(ask)
  }

  // Counts: 3–4 tiles total. One ask may be doubled if it has room for it.
  const counts = chosen.map(() => 1)
  const doubleTarget = chosen.findIndex(a => a.maxCount >= 2 && MATCHES[a.id].length >= 4)
  if (doubleTarget >= 0 && (chosen.length === 2 || rng() < 0.5)) counts[doubleTarget] = 2

  const slots: BrewSlot[] = []
  chosen.forEach((ask, i) => {
    for (let n = 0; n < counts[i]; n++) {
      slots.push({ askId: ask.id, chip: ask.chip, test: ask.test, filled: null })
    }
  })

  // Shelf: one answer per slot, then a spare answer per ask where the table
  // allows it (so there's more than one right way to fill the order), then
  // near-misses that satisfy nothing.
  const used = new Set<number>()
  const takeFrom = (ask: Ask): Element | null => {
    const pool = MATCHES[ask.id].filter(e => !used.has(e.atomicNumber))
    if (pool.length === 0) return null
    const el = pick(rng, pool)
    used.add(el.atomicNumber)
    return el
  }

  const shelf: Element[] = []
  chosen.forEach((ask, i) => {
    for (let n = 0; n < counts[i]; n++) {
      const el = takeFrom(ask)
      if (el) shelf.push(el)
    }
  })
  for (const ask of chosen) {
    if (shelf.length >= SHELF_SIZE - 3) break
    const spare = takeFrom(ask)
    if (spare) shelf.push(spare)
  }

  const distractors = elements.filter(
    e => !used.has(e.atomicNumber) && chosen.every(a => !a.test(e)),
  )
  for (const el of shuffled(rng, distractors)) {
    if (shelf.length >= SHELF_SIZE) break
    shelf.push(el)
  }

  return {
    key,
    potion: pick(rng, POTIONS),
    sentence: joinNicely(chosen.map((a, i) => phrase(a, counts[i]))),
    slots,
    shelf: shuffled(rng, shelf),
  }
}

/**
 * Where a tile belongs, or -1 if it belongs nowhere. Slots are disjoint, so
 * the first unfilled match IS the only match — no need to be clever.
 */
export function slotFor(order: BrewOrder, el: Element): number {
  return order.slots.findIndex(s => !s.filled && s.test(el))
}

/** One line explaining why a tile fit, shown after it drops in. */
export function whyItFits(el: Element, askId: string): string {
  switch (askId) {
    case 'liquid':   return `${el.name} — one of only two elements that pour at room temperature.`
    case 'gas':      return `${el.name} — a gas at room temperature.`
    case 'p2': case 'p3': case 'p4':
      return `${el.name} — period ${el.period}, so it fills that shell.`
    case 'tiny':     return `${el.name} — number ${el.atomicNumber}, lighter than neon.`
    case 'heavy':    return `${el.name} — number ${el.atomicNumber}, heavier than lead.`
    default:         return `${el.name} — ${CATEGORY_PHRASE[el.category] ?? el.category}.`
  }
}

const CATEGORY_PHRASE: Record<string, string> = {
  'noble-gas': 'a noble gas, group 18, reacts with almost nothing',
  'halogen': 'a halogen, group 17, desperate for one more electron',
  'alkali-metal': 'an alkali metal, group 1, soft and violent in water',
  'alkaline-earth-metal': 'an alkaline earth metal, group 2',
  'metalloid': 'a metalloid, half metal and half not',
  'transition-metal': 'a transition metal, the big middle block',
  'post-transition-metal': 'a poor metal, soft and low-melting',
  'nonmetal': 'a nonmetal',
  'lanthanide': 'a lanthanide, from the first pulled-out row',
  'actinide': 'an actinide, from the second pulled-out row',
}
