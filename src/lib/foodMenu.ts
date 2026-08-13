import type { FoodKey } from '@/types'
import { hashString, mulberry32, shuffled } from './seededRng'

// ═══════════════════════════════════════════════════════════════════════════
// TODAY'S MENU — three foods Eren wants, every day.
// ──────────────────────────────────────────────────────────────────────────
// The daily WISH (lib/wishes.ts) asks for one thing and is done. This sits
// beside it and asks for three, which changes what a day feels like: one wish
// is something you happen to satisfy, three named foods is a shopping list.
//
// Deliberately NOT part of the wish catalogue. A wish is one rotating line with
// a grant trigger and a cooldown; this is a fixed shape — always three foods,
// always food, always today — and folding it into WISHES would have meant a
// third of the catalogue being near-duplicate three-food entries.
//
// Same determinism rules as everything else daily here: seeded on (day,
// household) so both phones show the same three with nothing stored until it's
// actually completed.
// ═══════════════════════════════════════════════════════════════════════════

/** How many he asks for. Three is a list; two is a coincidence, four is a job. */
export const MENU_SIZE = 3

/** Coins for clearing the whole menu. Above a single wish (5–15), below a spin. */
export const MENU_REWARD = 30

/**
 * What he's allowed to ask for.
 *
 * Only foods you can actually BUY — asking for a gacha-exclusive can or a donut
 * that isn't in today's bakery tray would be a menu you can't complete, which
 * is worse than no menu. Kept as an explicit list rather than derived from the
 * shop table because that table lives inside a React component; when a food
 * becomes buyable, add it here.
 */
export const MENU_POOL: FoodKey[] = [
  // Staples
  'kibble', 'fish', 'treat', 'tuna', 'steak', 'cream', 'biscuit', 'shrimp',
  'salmon', 'chicken', 'sausage', 'milk', 'cheese', 'yogurt', 'egg',
  'cake', 'sushi', 'sardine', 'cookie', 'jelly_caka',
  // World dishes
  'pizza', 'carbonara', 'lasagna', 'risotto',
  'nigiri', 'temaki', 'maki',
  'ramen', 'pad_thai', 'gyoza', 'xiaolongbao',
  'cevapi', 'sarma', 'doner',
  'tacos', 'wrap', 'paella', 'stew', 'meatballs', 'roast_chicken',
  // The two donuts that are always on the kitchen shelf. The bakery's rotating
  // stock is NOT here — it would be a menu item you can only buy on some days.
  'donut', 'donut_choco',
]

/**
 * Today's three, in a stable order.
 *
 * Seeded per household as well as per day so the two of you aren't handed the
 * same menu as every other household — and so a household's menus don't happen
 * to line up with its wish rotation, which uses a different seed prefix.
 */
export function dailyMenu(dayKey: string, householdId: string | null): FoodKey[] {
  const rng = mulberry32(hashString(`eren-menu:${dayKey}:${householdId ?? 'solo'}`))
  return shuffled(rng, MENU_POOL).slice(0, MENU_SIZE)
}

/**
 * Which of today's menu items have been fed, by EITHER of you.
 *
 * Takes both feed lists because the menu belongs to the cat, not to a person:
 * if one of you feeds the salmon, the salmon is fed.
 */
export function menuProgress(
  menu: readonly FoodKey[],
  fedByMe: readonly FoodKey[],
  fedByPartner: readonly FoodKey[],
): boolean[] {
  const fed = new Set<string>([...fedByMe, ...fedByPartner])
  return menu.map(k => fed.has(k))
}

/** True when the claim on record is for today — i.e. already paid out. */
export function menuAlreadyClaimed(
  claim: { day: string } | null | undefined,
  dayKey: string,
): boolean {
  return claim?.day === dayKey
}
