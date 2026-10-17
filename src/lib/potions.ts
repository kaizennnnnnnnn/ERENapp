// ═══════════════════════════════════════════════════════════════════════════
// POTION MIXER — the Lab's toy. Pour any three things into the cauldron, stir,
// and something always comes out: there are no wrong answers, only potions you
// haven't found yet. Give one to Eren and it shows on him for an hour, in every
// room and on the home screen, on both phones.
//
// HOW A RECIPE BECOMES A POTION. Only which COLOURS went in decides the potion
// (berry red, honey yellow, moon blue, catnip green), not how much of each, so
// the book can say "red and blue" and mean it. Milk and stardust aren't
// colours: milk softens the shade, stardust adds a sparkle on top of whatever
// the colours make. Three pours with no colour at all make one of the two cloud
// potions, and three catnip makes the zoomies. 17 to find.
//
// The liquid's colour is mixed for real, as paint mixes (yellow and blue make
// green), from every pour, so two batches of the same potion can be different
// shades and the one he drinks is the one you made.
// ═══════════════════════════════════════════════════════════════════════════

export type IngredientId = 'berry' | 'honey' | 'moon' | 'catnip' | 'milk' | 'star'

export interface IngredientDef {
  id: IngredientId
  name: string
  /** The bottle and the paint it adds to the pot. */
  color: string
  /** Which colour it counts as, for the recipe. Milk and stardust count as none. */
  hue: 'R' | 'Y' | 'B' | 'C' | null
}

export const INGREDIENTS: IngredientDef[] = [
  { id: 'berry',  name: 'Berry Syrup', color: '#E2475E', hue: 'R' },
  { id: 'honey',  name: 'Honey Drop',  color: '#F2B33D', hue: 'Y' },
  { id: 'moon',   name: 'Moon Water',  color: '#4F86D9', hue: 'B' },
  { id: 'catnip', name: 'Catnip Tea',  color: '#5DAA5F', hue: 'C' },
  { id: 'milk',   name: 'Cloud Milk',  color: '#F6F1E7', hue: null },
  { id: 'star',   name: 'Stardust',    color: '#B9A2EE', hue: null },
]
export const INGREDIENT_BY_ID = Object.fromEntries(INGREDIENTS.map(i => [i.id, i])) as Record<IngredientId, IngredientDef>

/** Pours per batch. */
export const POURS = 3

export type PotionEffect =
  | 'hearts' | 'glow' | 'ghost' | 'tiny' | 'big' | 'float' | 'notes' | 'bubbles' | 'sparkles'
  | 'wobble' | 'dizzy' | 'leaves' | 'stars' | 'flowers' | 'spin' | 'cloud' | 'rainbow'

export interface PotionDef {
  id: string
  name: string
  /** The potion's own colour, for the book (a batch's real shade is mixed). */
  color: string
  effect: PotionEffect
  /** What it does to him, a lib/catWords template: fill with cat.t. */
  blurb: string
  /** The book's nudge for one not found yet. */
  hint: string
  rare?: boolean
}

export const POTIONS: PotionDef[] = [
  { id: 'rose',     name: 'Rose Draught',   color: '#F07A9A', effect: 'hearts',   blurb: 'Little hearts float off {him}.', hint: 'Something red' },
  { id: 'honey',    name: 'Honey Glow',     color: '#F5C542', effect: 'glow',     blurb: '{He} glows like a little sun.', hint: 'Something yellow' },
  { id: 'moon',     name: 'Moon Mist',      color: '#7FA8E8', effect: 'ghost',    blurb: '{He} goes see-through, like a friendly ghost.', hint: 'Something blue' },
  { id: 'shrink',   name: 'Shrinking Tea',  color: '#6DBB6F', effect: 'tiny',     blurb: '{He} shrinks to a pocket-sized cat.', hint: 'Something green' },
  { id: 'sunset',   name: 'Sunset Punch',   color: '#F59A4A', effect: 'big',      blurb: '{He} grows big and proud.', hint: 'Red and yellow' },
  { id: 'plum',     name: 'Plum Fizz',      color: '#A06BD6', effect: 'float',    blurb: '{He} floats up and bobs in the air.', hint: 'Red and blue' },
  { id: 'bramble',  name: 'Bramble Song',   color: '#B5654A', effect: 'notes',    blurb: '{He} hums, and music notes drift round {him}.', hint: 'Red and green' },
  { id: 'lagoon',   name: 'Lagoon Tonic',   color: '#5CC2B0', effect: 'bubbles',  blurb: 'Bubbles rise all around {him}.', hint: 'Yellow and blue' },
  { id: 'lime',     name: 'Lime Zest',      color: '#B8D64A', effect: 'sparkles', blurb: '{He} fizzes with sparkles.', hint: 'Yellow and green' },
  { id: 'jelly',    name: 'Jelly Wobble',   color: '#4FB3A8', effect: 'wobble',   blurb: '{He} wobbles like a jelly.', hint: 'Blue and green' },
  { id: 'mud',      name: 'Mud Pie',        color: '#8A6A4F', effect: 'dizzy',    blurb: 'A muddle. Stars spin round {his} head.', hint: 'Red, yellow and blue', rare: true },
  { id: 'autumn',   name: 'Autumn Cider',   color: '#D98A3A', effect: 'leaves',   blurb: 'Leaves tumble down around {him}.', hint: 'Red, yellow and green', rare: true },
  { id: 'midnight', name: 'Midnight Tea',   color: '#5A4C9C', effect: 'stars',    blurb: 'Tiny stars twinkle around {him}.', hint: 'Red, blue and green', rare: true },
  { id: 'spring',   name: 'Spring Tonic',   color: '#7CC77A', effect: 'flowers',  blurb: 'Flowers pop up at {his} feet.', hint: 'Yellow, blue and green', rare: true },
  { id: 'zoomies',  name: 'Catnip Zoomies', color: '#4FA35A', effect: 'spin',     blurb: '{He} gets the zoomies and spins.', hint: 'Nothing but catnip', rare: true },
  { id: 'cloud',    name: 'Cloud Nine',     color: '#E9E2F2', effect: 'cloud',    blurb: '{He} naps on a little cloud in the air.', hint: 'No colour, mostly milk', rare: true },
  { id: 'starlight', name: 'Starlight',     color: '#C9B6F2', effect: 'rainbow',  blurb: '{He} shimmers through every colour.', hint: 'No colour, mostly stardust', rare: true },
]
export const POTION_BY_ID = Object.fromEntries(POTIONS.map(p => [p.id, p])) as Record<string, PotionDef>

/** The colours that went in, as a key: 'R', 'RB', 'YBC'... in RYBC order. */
const HUE_FAMILY: Record<string, string> = {
  R: 'rose', Y: 'honey', B: 'moon', C: 'shrink',
  RY: 'sunset', RB: 'plum', RC: 'bramble', YB: 'lagoon', YC: 'lime', BC: 'jelly',
  RYB: 'mud', RYC: 'autumn', RBC: 'midnight', YBC: 'spring',
}

/** Which potion three pours make. Always one: there is no failed batch. */
export function potionFor(pours: IngredientId[]): PotionDef {
  const count = (id: IngredientId) => pours.filter(p => p === id).length
  if (count('catnip') === POURS) return POTION_BY_ID.zoomies
  const hues = (['R', 'Y', 'B', 'C'] as const).filter(h => pours.some(p => INGREDIENT_BY_ID[p].hue === h)).join('')
  if (!hues) return count('milk') >= count('star') ? POTION_BY_ID.cloud : POTION_BY_ID.starlight
  return POTION_BY_ID[HUE_FAMILY[hues]]
}

/** A pinch of stardust in a coloured potion sparkles on top of its own effect. */
export const sparkles = (pours: IngredientId[]) =>
  pours.includes('star') && pours.some(p => INGREDIENT_BY_ID[p].hue !== null)

// ─── Mixing the colour ───────────────────────────────────────────────────────
// Paint mixes by what each pigment lets through, so the shade of a mix is the
// geometric mean of the parts in each channel: yellow and blue meet at green,
// red and blue at plum, and milk lightens anything it touches.

const toRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
const toHex = (rgb: number[]) => '#' + rgb.map(c => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')

export function mixColor(pours: IngredientId[]): string | null {
  if (pours.length === 0) return null
  // Stardust is glitter, not paint: it sparkles on top and leaves the colour
  // alone (unless it's all there is).
  const paint = pours.some(p => p !== 'star') ? pours.filter(p => p !== 'star') : pours
  const sums = [0, 0, 0]
  for (const p of paint) {
    toRgb(INGREDIENT_BY_ID[p].color).forEach((c, i) => { sums[i] += Math.log(Math.max(c, 0.04)) })
  }
  return toHex(vivid(sums.map(s => Math.exp(s / paint.length))))
}

/** Real paint mixes go muddy; a potion is allowed to be a bit brighter than
 *  physics. Pushes each channel away from the grey of its own lightness. */
function vivid(rgb: number[], by = 1.6): number[] {
  const grey = (Math.max(...rgb) + Math.min(...rgb)) / 2
  return rgb.map(c => grey + (c - grey) * by)
}

/** A lighter tint of a colour, for tiles behind a bottle. */
export function tint(hex: string, amount = 0.78): string {
  return toHex(toRgb(hex).map(c => c + (1 - c) * amount))
}

// ─── The potion he's on ──────────────────────────────────────────────────────

/** How long a potion lasts on him. */
export const POTION_MS = 60 * 60_000

/** What's stored on the household row (or this phone, before the migration). */
export interface ActivePotion {
  id: string
  /** This batch's mixed shade. */
  color: string
  sparkle: boolean
  /** Who gave it to him. */
  by: string
  /** ISO. Past = nothing is running. */
  until: string
}

/** The potion running now, or null: lapsed, missing or unknown reads as none. */
export function livePotion(active: ActivePotion | null | undefined, now = Date.now()): (ActivePotion & { def: PotionDef }) | null {
  if (!active?.id || !active.until) return null
  const def = POTION_BY_ID[active.id]
  if (!def) return null
  const until = new Date(active.until).getTime()
  if (!Number.isFinite(until) || until <= now) return null
  return { ...active, def }
}

/** Coins for a potion found for the first time, and for finding them all. */
export const FIRST_FIND_COINS = 20
export const FULL_BOOK_COINS = 150
