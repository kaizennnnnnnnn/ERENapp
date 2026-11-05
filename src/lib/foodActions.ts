import type { ErenStats, FoodKey } from '@/types'
import type { createClient } from './supabase/client'
import { FOOD_META } from './foodMeta'
import { pendingSavedRpcs, savedRpc } from './savedRpc'

export type FoodAction =
  | { kind: 'buy'; foodKey: FoodKey; source: 'kitchen' | 'bakery' }
  | { kind: 'feed'; foodKey: FoodKey }
  | { kind: 'spin'; useFree: boolean }

export interface FoodActionResult {
  ok: boolean
  reason?: string
  household_id?: string
  coins?: number
  stats?: Partial<ErenStats>
  food_key?: FoodKey
  new_skin?: string | null
  was_free?: boolean
  last_free_donut?: string | null
}

const RPC = { buy: 'purchase_food_atomic', feed: 'feed_food_atomic', spin: 'spin_donut_atomic' } as const

export function pendingFoodAction(userId: string, householdId: string): FoodAction | null {
  for (const kind of ['buy', 'feed', 'spin'] as const) {
    const args = pendingSavedRpcs(userId, RPC[kind]).find(request => request.args.p_household_id === householdId)?.args
    if (!args) continue
    if (kind === 'spin' && typeof args.p_use_free === 'boolean') return { kind, useFree: args.p_use_free }
    const foodKey = args.p_food_key as FoodKey
    if (!Object.prototype.hasOwnProperty.call(FOOD_META, foodKey)) continue
    if (kind === 'feed') return { kind, foodKey }
    if (kind === 'buy' && (args.p_source === 'kitchen' || args.p_source === 'bakery')) return { kind, foodKey, source: args.p_source }
  }
  return null
}

/** One outstanding intent per household; recovery works even with no coins or stock left. */
export async function saveFoodAction(
  supabase: ReturnType<typeof createClient>, userId: string, householdId: string, action: FoodAction, recover = false,
): Promise<FoodActionResult> {
  const previous = pendingFoodAction(userId, householdId)
  if (previous && !recover) return { ok: false, reason: 'pending' }
  const intent = recover ? previous : action
  if (!intent) return { ok: false, reason: 'nothing_pending' }
  const args: Record<string, unknown> = { p_household_id: householdId }
  if (intent.kind === 'spin') args.p_use_free = intent.useFree
  else {
    args.p_food_key = intent.foodKey
    if (intent.kind === 'buy') args.p_source = intent.source
  }
  return savedRpc<FoodActionResult>(supabase, userId, RPC[intent.kind], householdId, args)
}

export function foodActionError(reason?: string): string {
  if (reason === 'not_ready') return 'Food saves are waiting for an update. Nothing was changed.'
  if (reason === 'insufficient') return 'Not enough coins. Nothing was bought.'
  if (reason === 'out_of_stock') return 'That food is no longer in your fridge.'
  if (reason === 'sleeping') return 'Let your cat wake up before feeding.'
  if (reason === 'cooldown') return 'The free spin was already used. No coins were spent.'
  if (reason === 'bad_food' || reason === 'not_for_sale') return 'That food is not available here.'
  if (reason === 'household_changed' || reason === 'no_household') return 'Your household changed. Please reopen the room.'
  return 'Could not confirm this save. Retry to recover it without spending twice.'
}
