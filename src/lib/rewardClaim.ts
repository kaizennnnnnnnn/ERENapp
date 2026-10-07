// ─── Claiming the reward road ────────────────────────────────────────────────
// The pure half of a claim: what a run of levels pays, and which look a skin
// box opens to. The writes themselves stay in the page, next to the services
// they go through (TaskContext's coins, the stats provider's fridge).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FoodKey } from '@/types'
import { withRetry } from './supabaseRetry'
import { GACHA_SKINS, itemIdToSkinId, type SkinDef } from './skins'
import { LEVEL_REWARDS, type SkinBoxRarity } from './levelRewards'

export interface RewardBatch {
  coins: number
  stardust: number
  tickets: number
  /** One entry per item, ready for addManyToMyFood. */
  foods: FoodKey[]
  skinBoxes: SkinBoxRarity[]
}

/** Everything levels `from` to `to` (both included) pay, added up. */
export function batchFor(from: number, to: number): RewardBatch {
  const batch: RewardBatch = { coins: 0, stardust: 0, tickets: 0, foods: [], skinBoxes: [] }
  for (const reward of LEVEL_REWARDS.slice(from - 1, to)) {
    for (const item of reward.items) {
      if (item.kind === 'coins') batch.coins += item.amount
      else if (item.kind === 'stardust') batch.stardust += item.amount
      else if (item.kind === 'tickets') batch.tickets += item.amount
      else if (item.kind === 'food') batch.foods.push(...item.foods)
      else batch.skinBoxes.push(item.rarity)
    }
  }
  return batch
}

/** A look of this rarity nobody in the household has yet, or null when they
 *  have them all. Only gacha looks: Rainbow, Golden and Jelly are earned. */
export function pickSkin(rarity: SkinBoxRarity, owned: ReadonlySet<string>): SkinDef | null {
  const pool = GACHA_SKINS.filter(s => s.rarity === rarity && !s.unlock && !owned.has(s.id))
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
}

/** Every look either partner owns (the Closet's union), or null when the read
 *  failed: an outage must not read as "owns nothing" and open a duplicate. */
export async function readHouseholdSkins(supabase: SupabaseClient, householdId: string): Promise<Set<string> | null> {
  const { data: members, error } = await withRetry(() => supabase
    .from('profiles').select('id').eq('household_id', householdId))
  if (error) return null
  const ids = (members ?? []).map(m => m.id as string)
  const owned = new Set<string>()
  if (ids.length === 0) return owned
  const { data: rows, error: rowsError } = await withRetry(() => supabase
    .from('user_inventory').select('item_id').in('user_id', ids))
  if (rowsError) return null
  for (const row of rows ?? []) {
    const id = itemIdToSkinId(row.item_id as string)
    if (id) owned.add(id)
  }
  return owned
}
