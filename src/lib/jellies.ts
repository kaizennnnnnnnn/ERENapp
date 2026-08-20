import type { MonstaBuff } from './monstaBuffs'

// ═══════════════════════════════════════════════════════════════════════════
// JELLIES — the Jelly Parlour's five collectibles.
//
// You don't buy these. They're the prize for a round in the Parlour, and a
// round pays out ONE jelly picked at random — then that jelly rolls one of its
// OWN three effects, so the same flavour isn't the same gift twice. Five
// flavours × three outcomes is fifteen ways a round can end, which is what
// keeps "win a jelly" interesting on the fortieth run.
//
// Own all five and Eren Jelly unlocks (see useJellies).
//
// Effects reuse MonstaBuff rather than inventing a second stat-delta shape:
// useErenStats.feedWithFood already applies exactly these fields, and calling
// it with zero hunger/joy/weight makes it a pure buff channel. Coins are the
// one field it can't write (they live on profiles), so the caller pays those
// through TaskContext the same way the kitchen does for a Monsta.
//
// Effect budget: nothing here is bigger than a can's perk (~35 of a stat, 60
// coins). A jelly is a treat for playing, not a way to skip caring for him.
// ═══════════════════════════════════════════════════════════════════════════

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

// ─── Inventory ids ───────────────────────────────────────────────────────────
// Jellies live in user_inventory alongside skins and gacha items — same table,
// same unique(user_id, item_id), so ownership and the "first one" check come
// free with no migration. They are deliberately NOT in GACHA_ITEMS, so they
// never appear in the gacha collection or count toward its completion.
export const JELLY_ITEM_PREFIX = 'jelly_'
export const jellyItemId = (id: JellyId) => `${JELLY_ITEM_PREFIX}${id}`
export const itemIdToJellyId = (itemId: string): JellyId | null => {
  if (!itemId.startsWith(JELLY_ITEM_PREFIX)) return null
  const id = itemId.slice(JELLY_ITEM_PREFIX.length)
  return (BY_ID[id] ? (id as JellyId) : null)
}

/** The reward for owning the full set. Granted by useJellies, worn from the Closet. */
export const JELLY_SKIN_ID = 'jelly'

// ─── Rolling ─────────────────────────────────────────────────────────────────

/**
 * Pick the jelly a finished round pays out.
 *
 * Weighted toward flavours you're missing, because a pure uniform roll turns
 * the last jelly of five into a long grind (coupon-collector: the fifth one
 * takes five times as many wins as the first). `NEW_BIAS` is the chance of
 * drawing from the missing pile when one exists — high enough that the set
 * finishes, low enough that a duplicate still happens and still pays out.
 */
const NEW_BIAS = 0.7

export function rollJelly(owned: ReadonlySet<string>, rnd: () => number = Math.random): JellyDef {
  const missing = JELLIES.filter(j => !owned.has(j.id))
  const pool = missing.length > 0 && rnd() < NEW_BIAS ? missing : JELLIES
  return pool[Math.floor(rnd() * pool.length)]
}

/** Pick which of the flavour's three things it does this time. */
export function rollEffect(jelly: JellyDef, rnd: () => number = Math.random): JellyEffect {
  return jelly.effects[Math.floor(rnd() * jelly.effects.length)]
}
