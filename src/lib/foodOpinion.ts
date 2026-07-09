// ═════════════════════════════════════════════════════════════════════════════
// PICKY PRINCE — Eren's Inner Life (He Remembers)
//
// Eren has an innate favorite and disliked food, rolled deterministically from
// the household id (same trick as the daily wish/quip) — so both partners' apps
// agree, it's stable for the life of the household, and the couple discovers his
// tastes by feeding him. Zero schema.
// ═════════════════════════════════════════════════════════════════════════════

import { hashStr } from './wishes'
import type { FoodKey } from '@/types'

// Canonical ordered food list for the preference roll. APPEND-ONLY — the
// favorite/disliked hash indexes into this, so reordering or removing an entry
// would silently change every household's cat's tastes. Mirrors the FoodKey union.
export const FOOD_KEYS: FoodKey[] = [
  'kibble', 'treat', 'biscuit', 'fish', 'tuna', 'shrimp', 'salmon', 'sardine', 'sushi',
  'steak', 'chicken', 'sausage', 'cream', 'milk', 'cheese', 'yogurt', 'cake', 'egg',
  'monster', 'donut', 'cookie', 'jelly_caka',
]

export type FoodOpinion = 'favorite' | 'disliked' | 'neutral'

export interface FoodTastes { favorite: FoodKey; disliked: FoodKey }

/** Eren's innate favorite + disliked food for a household. Deterministic and
 *  stable; both partners resolve the same pair. */
export function foodTastes(householdId: string): FoodTastes {
  const n = FOOD_KEYS.length
  const favIdx = hashStr(`${householdId}::fav`) % n
  let disIdx = hashStr(`${householdId}::dis`) % n
  if (disIdx === favIdx) disIdx = (disIdx + 1) % n // never the same food
  return { favorite: FOOD_KEYS[favIdx], disliked: FOOD_KEYS[disIdx] }
}

/** How Eren feels about a specific food for this household. */
export function foodOpinion(householdId: string | null | undefined, food: FoodKey): FoodOpinion {
  if (!householdId) return 'neutral'
  const t = foodTastes(householdId)
  if (food === t.favorite) return 'favorite'
  if (food === t.disliked) return 'disliked'
  return 'neutral'
}
