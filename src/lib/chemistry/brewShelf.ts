// ═════════════════════════════════════════════════════════════════════════════
// THE SHELF — where bottled potions wait, and what you're allowed to pour.
//
// The rule the whole lab hangs off: brewing is free, POURING is once a day.
// Without that cap a two-minute puzzle would refill every care stat in the app
// on demand and the rest of the game would stop mattering. With it, an extra
// batch is worth doing anyway — it stocks a bottle for tomorrow, and it's the
// only way to finish the twelve-potion collection.
//
// localStorage on purpose. The daily "brew done" marker already lives here, the
// shelf is a personal trophy rack rather than shared household state, and it
// costs no migration — so the feature works the moment it ships instead of
// waiting on a paste into the Supabase dashboard.
// ═════════════════════════════════════════════════════════════════════════════

import type { BrewGrade } from './potions'

export interface Bottle {
  potionId: string
  grade: BrewGrade
}

export interface ShelfState {
  /** Bottled and not yet poured. Oldest first. */
  bottles: Bottle[]
  /** Every potion id ever bottled — the collection, append-only. */
  brewed: string[]
  /** Daily key of the last pour, or null. One pour per key. */
  pouredOn: string | null
  /** The day `extras` counts for — reset when the key rolls over. */
  extrasOn: string | null
  /** Extra orders filled today, for the small coin tip. */
  extras: number
}

const KEY = 'eren_brew_shelf_v1'

/** A shelf holds twelve. Past that the oldest bottle gets used for cleaning. */
export const SHELF_MAX = 12
/** Extra orders that still pay a tip, per day. */
export const EXTRA_TIP_LIMIT = 3
/** Coins for an extra order, once the daily one is filled. */
export const EXTRA_TIP_COINS = 5

const EMPTY: ShelfState = { bottles: [], brewed: [], pouredOn: null, extrasOn: null, extras: 0 }

export function readShelf(): ShelfState {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<ShelfState>
    return {
      bottles:  Array.isArray(parsed.bottles) ? parsed.bottles : [],
      brewed:   Array.isArray(parsed.brewed) ? parsed.brewed : [],
      pouredOn: typeof parsed.pouredOn === 'string' ? parsed.pouredOn : null,
      extrasOn: typeof parsed.extrasOn === 'string' ? parsed.extrasOn : null,
      extras:   typeof parsed.extras === 'number' ? parsed.extras : 0,
    }
  } catch { return EMPTY }
}

export function writeShelf(next: ShelfState): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(KEY, JSON.stringify(next)) }
  catch { /* private mode — the shelf is a nicety, not a dependency */ }
}

/** Whether today's pour is still available. */
export function canPour(shelf: ShelfState, dailyKey: string): boolean {
  return shelf.pouredOn !== dailyKey
}

/** Extras filled today, with the counter rolled over if the day changed. */
export function extrasToday(shelf: ShelfState, dailyKey: string): number {
  return shelf.extrasOn === dailyKey ? shelf.extras : 0
}

/** Shelve a fresh bottle and mark its potion collected. Pure — returns a new state. */
export function shelveBottle(shelf: ShelfState, bottle: Bottle): ShelfState {
  const bottles = [...shelf.bottles, bottle].slice(-SHELF_MAX)
  const brewed = shelf.brewed.includes(bottle.potionId)
    ? shelf.brewed
    : [...shelf.brewed, bottle.potionId]
  return { ...shelf, bottles, brewed }
}

/** Take one bottle off the shelf and spend today's pour. Pure. */
export function pourBottle(shelf: ShelfState, index: number, dailyKey: string): ShelfState {
  return {
    ...shelf,
    bottles: shelf.bottles.filter((_, i) => i !== index),
    pouredOn: dailyKey,
  }
}

/** Bump the extra-order counter, rolling it over on a new day. Pure. */
export function noteExtra(shelf: ShelfState, dailyKey: string): ShelfState {
  const current = extrasToday(shelf, dailyKey)
  return { ...shelf, extrasOn: dailyKey, extras: current + 1 }
}
