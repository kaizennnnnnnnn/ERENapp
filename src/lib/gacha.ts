import type { GachaItemDef, GachaBannerDef, GachaRarity, GachaCategory, FoodKey } from '@/types'
import { SKIN_GACHA_ITEMS } from './skins'
import { foodArt } from './foodMeta'

/**
 * The Snacks & Drinks jackpot. Named because the gacha screen fires the energy
 * opening cinematic off it — an id worth matching on shouldn't be a bare string
 * literal sitting in a page component.
 */
export const MONSTA_RAINBOW_ID = 'cons_monsta_rainbow'

/** The other SPECIAL EDITION can. Same legendary tier as the rainbow, different
 *  reason to want it — see MONSTA_BUFFS. Named for the same reason as above:
 *  the reveal and the fridge both light it up, and both need to match on it. */
export const MONSTA_GOLD_ID = 'cons_monsta_gold'

/**
 * Gacha item id → the fridge food a pull also stocks.
 *
 * Consumables normally live only in the gacha collection, where they're used
 * for their buff. That's the wrong place for a drink: pull a Monsta and you go
 * looking in the fridge, not in a collection screen. So a pulled can is granted
 * as food too — the collection entry stays as the "collected" record, and the
 * can itself is where you'd feed it from.
 */
export const GACHA_FOOD_GRANT: Record<string, FoodKey> = {
  cons_monsta_original: 'monsta_original',
  cons_monsta_white:    'monsta_white',
  cons_monsta_mango:    'monsta_mango',
  cons_monsta_loco:     'monsta_loco',
  cons_monsta_pipeline: 'monsta_pipeline',
  cons_monsta_punch:    'monsta_punch',
  cons_monsta_rosa:     'monsta_rosa',
  cons_monsta_peachy:   'monsta_peachy',
  [MONSTA_RAINBOW_ID]:  'monsta_rainbow',
  [MONSTA_GOLD_ID]:     'monsta_gold',
}

// ═══════════════════════════════════════════════════════════════════════════════
// GACHA SYSTEM — Eren's Capsule Machine
// ═══════════════════════════════════════════════════════════════════════════════

export const PULL_COST_SINGLE = 50
export const PULL_COST_TEN    = 450

export const PITY_EPIC      = 30   // guaranteed Epic+ every 30 pulls
export const PITY_LEGENDARY  = 100  // guaranteed Legendary every 100 pulls

export const DUPLICATE_STARDUST: Record<GachaRarity, number> = {
  common: 5, rare: 15, epic: 50, legendary: 200,
}

export const RARITY_WEIGHTS: Record<GachaRarity, number> = {
  common: 60, rare: 25, epic: 12, legendary: 3,
}

export const RARITY_COLORS: Record<GachaRarity, { bg: string; border: string; text: string; glow: string }> = {
  common:    { bg: '#E5E7EB', border: '#9CA3AF', text: '#6B7280', glow: 'rgba(156,163,175,0.4)' },
  rare:      { bg: '#BFDBFE', border: '#60A5FA', text: '#2563EB', glow: 'rgba(96,165,250,0.5)' },
  epic:      { bg: '#E9D5FF', border: '#A78BFA', text: '#7C3AED', glow: 'rgba(167,139,250,0.6)' },
  legendary: { bg: '#FEF3C7', border: '#F59E0B', text: '#B45309', glow: 'rgba(245,158,11,0.6)' },
}

// ─── All gacha items ─────────────────────────────────────────────────────────

export const GACHA_ITEMS: GachaItemDef[] = [
  // Every item here carries real art. The emoji-only tiers this list used to
  // open with — outfits, decorations, backgrounds, recipes, emotes, frames and
  // fourteen emoji consumables — were deleted: the app's rule is pixel art, not
  // emoji, and a gacha that pays out an emoji is paying out nothing.
  // ── MONSTA CANS ────────────────────────────────────────────────
  // Real can art, shared with the kitchen via foodArt() so both surfaces hit
  // one cache entry.
  // Seven of these are also buyable in the shop's SPECIAL row; Rainbow Monsta
  // is gacha-only, which is what makes it worth chasing.
  // Every can fills the energy bar — that's the family trait, and it's what
  // using one straight from the collection does. The flavour's own perk lands
  // when you FEED it in the kitchen (see lib/monstaBuffs.ts), which is why each
  // description names its perk rather than an energy number.
  { id: 'cons_monsta_original',  name: 'Original Monsta',   category: 'consumable', rarity: 'rare',      description: 'Full energy. Feed it for 40 coins back.',         buff: { stat: 'energy', amount: 100 }, image: foodArt('monsta_original') },
  { id: 'cons_monsta_white',     name: 'White Monsta',      category: 'consumable', rarity: 'common',    description: 'Full energy. Feed it to burn 0.25 kg.',           buff: { stat: 'energy', amount: 100 }, image: foodArt('monsta_white') },
  { id: 'cons_monsta_mango',     name: 'Mango Monsta',      category: 'consumable', rarity: 'rare',      description: 'Full energy. Feed it for +35 happiness.',         buff: { stat: 'energy', amount: 100 }, image: foodArt('monsta_mango') },
  { id: 'cons_monsta_loco',      name: 'Loco Monsta',       category: 'consumable', rarity: 'rare',      description: 'Full energy. Feed it for +35 hunger.',            buff: { stat: 'energy', amount: 100 }, image: foodArt('monsta_loco') },
  { id: 'cons_monsta_pipeline',  name: 'Pipeline Monsta',   category: 'consumable', rarity: 'rare',      description: 'Full energy. Feed it for +35 cleanliness.',       buff: { stat: 'energy', amount: 100 }, image: foodArt('monsta_pipeline') },
  { id: 'cons_monsta_punch',     name: 'Punch Monsta',      category: 'consumable', rarity: 'rare',      description: 'Full energy. Feed it to knock a sickness out.',   buff: { stat: 'energy', amount: 100 }, image: foodArt('monsta_punch') },
  { id: 'cons_monsta_rosa',      name: 'Rosa Monsta',       category: 'consumable', rarity: 'epic',      description: 'Full energy. Feed it for +35 sleep quality.',     buff: { stat: 'energy', amount: 100 }, image: foodArt('monsta_rosa') },
  { id: 'cons_monsta_peachy',    name: 'Peachy Monsta',     category: 'consumable', rarity: 'epic',      description: 'Full energy. Feed it for +20 joy and sleep.',     buff: { stat: 'energy', amount: 100 }, image: foodArt('monsta_peachy') },
  // The two SPECIAL EDITIONs share the legendary tier, which means they SPLIT
  // it: rollItem picks uniformly inside a tier, so each is now 1.5% a pull
  // rather than the rainbow's old 3%. That's the price of a second jackpot.
  { id: MONSTA_RAINBOW_ID,       name: 'Rainbow Monsta',    category: 'consumable', rarity: 'legendary', description: 'Full energy. Feed it for EVERY buff at once.',    buff: { stat: 'energy', amount: 100 }, image: foodArt('monsta_rainbow') },
  { id: MONSTA_GOLD_ID,          name: 'Gold Monsta',       category: 'consumable', rarity: 'legendary', description: 'Full energy. Feed it for 60 coins and +60 joy.',  buff: { stat: 'energy', amount: 100 }, image: foodArt('monsta_gold') },

  // ── SKINS — full-body Eren looks (Clothing gacha). Generated in lib/skins.ts.
  ...SKIN_GACHA_ITEMS,
]

// ─── Banners ─────────────────────────────────────────────────────────────────

export const GACHA_BANNERS: GachaBannerDef[] = [
  {
    id: 'food',
    name: 'Snacks & Drinks',
    description: 'Energy cans for Eren.',
    featuredItems: [],
    permanent: true,
    bgGradient: ['#EC4899', '#F9A8D4'],
    categories: ['consumable'],
  },
  {
    id: 'animal',
    name: 'Kitty Costumes',
    description: 'Full-body Eren skins — wear them in any room.',
    featuredItems: [],
    permanent: true,
    bgGradient: ['#A78BFA', '#F472B6'],
    categories: ['skin'],
    skinSet: 'animal',  // animal-costume skins only (see lib/skins.ts)
  },
  {
    id: 'foodsuits',
    name: 'FoodSuits',
    description: 'Food-costume Eren skins — wear them in any room.',
    featuredItems: [],
    permanent: true,
    bgGradient: ['#F5A623', '#F8D57E'],
    // Drops the FOOD skin set (donut, boba, cupcake, …). Same `skin` category as
    // the animal banner, so skinSet scopes each banner to its own set. Food skins
    // are rare/epic/legendary (no commons), so a common roll escalates to rare —
    // pity and the ten-pull guarantee work exactly as on the animal banner.
    categories: ['skin'],
    skinSet: 'food',
  },
]

// ─── Pull mechanics ──────────────────────────────────────────────────────────

export function rollRarity(pullsSinceEpic: number, pullsSinceLegendary: number): GachaRarity {
  // Pity overrides
  if (pullsSinceLegendary >= PITY_LEGENDARY - 1) return 'legendary'
  if (pullsSinceEpic >= PITY_EPIC - 1) return 'epic'

  // Weighted random
  const total = RARITY_WEIGHTS.common + RARITY_WEIGHTS.rare + RARITY_WEIGHTS.epic + RARITY_WEIGHTS.legendary
  const roll = Math.random() * total
  if (roll < RARITY_WEIGHTS.legendary) return 'legendary'
  if (roll < RARITY_WEIGHTS.legendary + RARITY_WEIGHTS.epic) return 'epic'
  if (roll < RARITY_WEIGHTS.legendary + RARITY_WEIGHTS.epic + RARITY_WEIGHTS.rare) return 'rare'
  return 'common'
}

const RARITY_ORDER: GachaRarity[] = ['common', 'rare', 'epic', 'legendary']

/**
 * "Is this item in this banner's pool?" — the single definition, shared by the
 * roller and by bannerOdds. The odds panel has to fold the exact same rules the
 * machine uses, so the predicate can't be written down twice.
 */
function bannerFilter(bannerId: string): (i: GachaItemDef) => boolean {
  const banner = GACHA_BANNERS.find(b => b.id === bannerId)
  return (i: GachaItemDef) =>
    // An item with a non-gacha unlock route (Rainbow/Golden Eren, earned by
    // pouring the matching can) is never in ANY pool — the machine can't hand
    // out something the kitchen is supposed to be the only source of.
    !i.unlock &&
    (!banner?.categories || banner.categories.includes(i.category)) &&
    // A skin banner draws only its own set; two banners share `category: 'skin'`.
    (!banner?.skinSet || i.skinSet === banner.skinSet)
}

export interface BannerOdds {
  rarity: GachaRarity
  /** Percent chance per pull, with tier escalation already folded in. */
  chance: number
  /** Distinct items sitting in this tier on this banner. */
  items: number
}

/**
 * What this banner ACTUALLY drops, per rarity.
 *
 * RARITY_WEIGHTS on its own is a lie on any banner that's missing a tier.
 * rollItem escalates a roll upward until it finds a tier that has items, so on
 * the two skin banners — which have no commons — the entire 60% common slice
 * lands on rare instead. A panel printing the raw table would be wrong about
 * 60% of pulls there.
 *
 * Derived from GACHA_ITEMS through the same predicate the roller uses, so the
 * numbers can't drift: add one common skin and the machine and the panel change
 * together.
 */
export function bannerOdds(bannerId: string): BannerOdds[] {
  const inBanner = bannerFilter(bannerId)
  const counts = RARITY_ORDER.map(r =>
    GACHA_ITEMS.filter(i => i.rarity === r && inBanner(i)).length)

  const total = RARITY_ORDER.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0)
  const share: Record<GachaRarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 }

  RARITY_ORDER.forEach((rolled, idx) => {
    // Walk up to the first tier that has items — rollItem's escalation loop.
    let landing = idx
    while (landing < RARITY_ORDER.length && counts[landing] === 0) landing++
    if (landing >= RARITY_ORDER.length) return  // banner has no items at all
    share[RARITY_ORDER[landing]] += RARITY_WEIGHTS[rolled]
  })

  return RARITY_ORDER
    .map((r, idx) => ({ rarity: r, chance: (share[r] / total) * 100, items: counts[idx] }))
    .filter(o => o.items > 0)
    .reverse()  // legendary first — the tier anyone opening this panel came for
}

export function rollItem(rarity: GachaRarity, bannerId: string): GachaItemDef {
  const banner = GACHA_BANNERS.find(b => b.id === bannerId)
  const inBanner = bannerFilter(bannerId)

  // Resolve the item pool at the rolled rarity, scoped to the banner's
  // categories. A banner may have NO items at a given tier (the Clothing
  // banner is skins-only, and there are no common skins) — escalate to the
  // next rarity that DOES have in-banner items so a common roll never leaks a
  // non-skin (e.g. a bowtie) into the clothing machine. The drawn item's own
  // rarity is authoritative for display/stardust (see useGacha).
  let pool: GachaItemDef[] = []
  for (let i = Math.max(0, RARITY_ORDER.indexOf(rarity)); i < RARITY_ORDER.length; i++) {
    const tier = GACHA_ITEMS.filter(it => it.rarity === RARITY_ORDER[i] && inBanner(it))
    if (tier.length > 0) { pool = tier; break }
  }
  if (pool.length === 0) pool = GACHA_ITEMS.filter(inBanner)
  if (pool.length === 0) return GACHA_ITEMS[0] // last-ditch fallback

  // Banner featured items have 50% chance if applicable
  if (banner && banner.featuredItems.length > 0 && Math.random() < 0.5) {
    const featured = pool.filter(i => banner.featuredItems.includes(i.id))
    if (featured.length > 0) return featured[Math.floor(Math.random() * featured.length)]
  }

  return pool[Math.floor(Math.random() * pool.length)]
}

export function getItemById(id: string): GachaItemDef | undefined {
  return GACHA_ITEMS.find(i => i.id === id)
}

export function getItemsByCategory(category: GachaCategory): GachaItemDef[] {
  return GACHA_ITEMS.filter(i => i.category === category)
}

export function getCategoryLabel(cat: GachaCategory): string {
  return { consumable: 'Drinks', skin: 'Skins' }[cat]
}
