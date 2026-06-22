import type { GachaRarity } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════
// CLOTHING-GACHA HIT CINEMATICS
// Rarity-tiered "you got a hit!" videos that open every Clothing (hat) pull.
// One is picked at random per pull, chosen by the HIGHEST rarity in the batch
// (a 10-pull plays the cinematic of its best drop). Files live in public/gacha/.
//
// `common` is intentionally empty: the Clothing banner has no common skins and
// rollItem escalates a common roll to the lowest in-banner tier, so clothes
// pulls are always rare+ — there is always a matching video.
// ═══════════════════════════════════════════════════════════════════════════

const CLOTHES_HIT_VIDEOS: Record<GachaRarity, string[]> = {
  common: [],
  rare: ['/gacha/rare-1.mp4', '/gacha/rare-2.mp4'],
  epic: ['/gacha/epic-1.mp4', '/gacha/epic-2.mp4', '/gacha/epic-3.mp4', '/gacha/epic-4.mp4', '/gacha/epic-5.mp4'],
  legendary: ['/gacha/legendary-1.mp4', '/gacha/legendary-2.mp4'],
}

const RARITY_RANK: Record<GachaRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 }

/** The best (rarest) rarity in a pull batch — drives which cinematic plays. */
export function highestRarity(rarities: GachaRarity[]): GachaRarity {
  return rarities.reduce<GachaRarity>(
    (best, r) => (RARITY_RANK[r] > RARITY_RANK[best] ? r : best),
    'common',
  )
}

/** A random hit cinematic for `rarity`, or null if that tier has no videos. */
export function pickClothesHitVideo(rarity: GachaRarity): string | null {
  const pool = CLOTHES_HIT_VIDEOS[rarity]
  if (!pool || pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
