import type { MonstaBuff } from './monstaBuffs'

// ════════════════════════════════════════════════════════════════════════════
// JELLIES — the Jelly Parlour's five flavours, and the tray they fill.
//
// You don't buy these and you don't keep them. Every DAY the tray of five
// empties; a won round fills one slot and that flavour immediately does one of
// its OWN three things, so five flavours × three outcomes is fifteen ways a
// round can end. Fill all five slots in a day and the tray mints ONE Super
// Jelly (see SUPER_JELLY) — feed him five of those and Eren Jelly is yours.
//
// The daily reset is the whole design. Under the old rule the set was a
// one-off checklist that the skin fell out of on day one; now finishing the
// tray is something you can do again tomorrow, and the skin is five of those
// days. Nothing about a flavour is "owned" any more, which is why there are no
// inventory ids here — the tray lives in the jelly_progress row (see
// supabase/migration_jelly_progress.sql) and the server decides every
// transition.
//
// Effects reuse MonstaBuff rather than inventing a second stat-delta shape:
// useErenStats.feedWithFood already applies exactly these fields, and calling
// it with zero hunger/joy/weight makes it a pure buff channel. Coins are the
// one field it can't write (they live on profiles), so the caller pays those
// through TaskContext the same way the kitchen does for a Monsta.
//
// Effect budget: nothing here is bigger than a can's perk (~35 of a stat, 60
// coins). A jelly is a treat for playing, not a way to skip caring for him.
// The Super Jelly is the one exception, and it has earned it.
// ════════════════════════════════════════════════════════════════════════════

export type JellyId = 'red' | 'green' | 'purple' | 'yellow' | 'orange'

export interface JellyEffect {
  /** Short line for the prize card — reads as flavour, not as a stat table. */
  label: string
  buff: MonstaBuff
}

export interface JellyDef {
  id: JellyId
  name: string
  /** Body colour, sampled from the art — drives every glow and particle. */
  colour: string
  art: string
  /** One of these is rolled each time the jelly is won. */
  effects: JellyEffect[]
}

const V = 1  // art cache-bust; bump if public/jelly/* is regenerated
const art = (id: JellyId) => `/jelly/jelly_${id}.png?v=${V}`

export const JELLIES: JellyDef[] = [
  {
    id: 'red', name: 'Strawberry Wobble', colour: '#D73832', art: art('red'),
    effects: [
      { label: 'HE BOUNCES · JOY +30', buff: { label: 'JOY +30', happiness: 30 } },
      { label: 'SUGAR RUSH · +45 COINS', buff: { label: '+45 COINS', coins: 45 } },
      { label: 'WARM BELLY · CURES HIM', buff: { label: 'CURES SICKNESS', cure: true } },
    ],
  },
  {
    id: 'green', name: 'Apple Fizz', colour: '#94D219', art: art('green'),
    effects: [
      { label: 'FIZZY PAWS · ENERGY +35', buff: { label: 'ENERGY +35', happiness: 10, sleep_quality: 25 } },
      { label: 'SOUR FACE · JOY +18', buff: { label: 'JOY +18', happiness: 18 } },
      { label: 'GREEN GLOW · CLEAN +30', buff: { label: 'CLEAN +30', cleanliness: 30 } },
    ],
  },
  {
    id: 'purple', name: 'Grape Dream', colour: '#985EBA', art: art('purple'),
    effects: [
      { label: 'SLEEPY SWIRL · SLEEP +35', buff: { label: 'SLEEP +35', sleep_quality: 35 } },
      { label: 'DREAM SNACK · HUNGER +25', buff: { label: 'HUNGER +25', hunger: 25 } },
      { label: 'PURPLE PURR · JOY +25', buff: { label: 'JOY +25', happiness: 25 } },
    ],
  },
  {
    id: 'yellow', name: 'Lemon Pop', colour: '#EBD63F', art: art('yellow'),
    effects: [
      { label: 'LUCKY POP · +60 COINS', buff: { label: '+60 COINS', coins: 60 } },
      { label: 'ZESTY · CLEAN +25 JOY +15', buff: { label: 'CLEAN +25 JOY +15', cleanliness: 25, happiness: 15 } },
      { label: 'LIGHT & TART · -0.2 KG', buff: { label: '-0.2 KG', weight: -0.2 } },
    ],
  },
  {
    id: 'orange', name: 'Mango Sunset', colour: '#F86618', art: art('orange'),
    effects: [
      { label: 'SUNSET NAP · SLEEP +20 JOY +20', buff: { label: 'SLEEP+20 JOY+20', sleep_quality: 20, happiness: 20 } },
      { label: 'BIG SLICE · HUNGER +35', buff: { label: 'HUNGER +35', hunger: 35 } },
      { label: 'GOLDEN HOUR · +35 COINS', buff: { label: '+35 COINS', coins: 35 } },
    ],
  },
]

export const JELLY_IDS: JellyId[] = JELLIES.map(j => j.id)
export const JELLY_COUNT = JELLIES.length

const BY_ID: Record<string, JellyDef> = Object.fromEntries(JELLIES.map(j => [j.id, j]))
export const getJelly = (id: string): JellyDef | undefined => BY_ID[id]

// ─── The Super Jelly ────────────────────────────────────────────────────
// What a full tray becomes. It isn't a sixth flavour — it's all five at once,
// which is why the art is the five real jellies banded together rather than a
// new drawing (see components/jelly/SuperJelly).

/** Flavours needed in one day to mint a Super Jelly. */
export const TRAY_SIZE = JELLY_COUNT

/** Super Jellies Eren has to eat before the skin is earned. */
export const SUPER_FEEDS_FOR_SKIN = 5

/**
 * What one Super Jelly does when fed.
 *
 * Deliberately bigger than any single flavour and deliberately FIXED: this is
 * a whole day's tray in one spoonful, and a player who spent a day earning it
 * should know exactly what they're about to get. Randomising it here would
 * turn a milestone into another slot pull.
 */
export const SUPER_JELLY_BUFF: MonstaBuff = {
  label: 'A WHOLE DAY OF JELLY',
  happiness: 45,
  hunger: 35,
  sleep_quality: 25,
  cleanliness: 20,
  energy: 100,
  cure: true,
  coins: 120,
}

/** The reward for feeding him {SUPER_FEEDS_FOR_SKIN} Super Jellies. */
export const JELLY_SKIN_ID = 'jelly'

// ─── Rolling ──────────────────────────────────────────────────────────────

/**
 * Pick the flavour a finished round pays out.
 *
 * Weighted toward the slots still empty on TODAY's tray, because a pure
 * uniform roll turns the fifth slot into a long grind (coupon-collector: the
 * last one takes five times as many wins as the first) — and a tray that
 * usually can't be finished in a day makes the whole daily loop pointless.
 * `NEW_BIAS` is the chance of drawing from the empty slots when any remain:
 * high enough that a good session finishes the tray, low enough that a repeat
 * still happens and still pays its effect.
 */
const NEW_BIAS = 0.7

export function rollJelly(filledToday: ReadonlySet<string>, rnd: () => number = Math.random): JellyDef {
  const empty = JELLIES.filter(j => !filledToday.has(j.id))
  const pool = empty.length > 0 && rnd() < NEW_BIAS ? empty : JELLIES
  return pool[Math.floor(rnd() * pool.length)]
}

/** Pick which of the flavour's three things it does this time. */
export function rollEffect(jelly: JellyDef, rnd: () => number = Math.random): JellyEffect {
  return jelly.effects[Math.floor(rnd() * jelly.effects.length)]
}
