import type { ErenStats, UserInventoryItem } from '@/types'
import type { createClient } from './supabase/client'
import { GACHA_ITEMS } from './gacha'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc } from './savedRpc'

export const INVENTORY_ITEM_RPC = 'use_inventory_item_atomic'
export type InventoryStats = Pick<ErenStats, 'household_id' | 'energy' | 'happiness' | 'updated_at'>
export interface InventoryItemSave {
  ok: true; version: 1; request_id: string; user_id: string; household_id: string; item_id: string
  saved_at: string; inventory_item: UserInventoryItem | null; stats: InventoryStats
}
export function pendingInventoryItem(actor: string, home: string) {
  const r = pendingSavedRpcs(actor, INVENTORY_ITEM_RPC).find(r => r.slot === `${home}:item`
    && r.args.p_expected_user === actor && r.args.p_household_id === home
    && GACHA_ITEMS.some(i => i.id === r.args.p_item_id && i.category === 'consumable'))
  return r ? { ...r, itemId: r.args.p_item_id as string } : null
}
export function validInventoryItem(r: InventoryItemSave, actor: string, home: string, request: string, item: string) {
  const row = r.inventory_item, s = r.stats
  return r.version === 1 && r.request_id === request && r.user_id === actor && r.household_id === home && r.item_id === item
    && typeof r.saved_at === 'string' && Number.isFinite(Date.parse(r.saved_at))
    && (row === null || !!row && typeof row.id === 'string' && row.id.length > 0 && row.user_id === actor && row.item_id === item
      && Number.isInteger(row.quantity) && row.quantity > 0 && typeof row.equipped === 'boolean'
      && typeof row.obtained_at === 'string' && Number.isFinite(Date.parse(row.obtained_at)))
    && !!s && s.household_id === home && [s.energy, s.happiness].every(v => Number.isInteger(v) && v >= 0 && v <= 100)
    && typeof s.updated_at === 'string' && Number.isFinite(Date.parse(s.updated_at))
}
export function mergeInventoryStats(current: ErenStats | null, patch: InventoryStats): ErenStats | null {
  if (!current || current.household_id !== patch.household_id || Date.parse(current.updated_at) > Date.parse(patch.updated_at)) return current
  return { ...current, energy: patch.energy, happiness: patch.happiness, updated_at: patch.updated_at }
}
export async function saveInventoryItem(client: ReturnType<typeof createClient>, actor: string, home: string, item: string, recover = false) {
  const previous = pendingInventoryItem(actor, home)
  if (previous && !recover) return { ok: false as const, reason: 'pending' }
  if (recover && !previous) return { ok: false as const, reason: 'nothing_pending' }
  const args = { p_expected_user: actor, p_household_id: home, p_item_id: previous?.itemId ?? item }, slot = `${home}:item`
  const request = prepareSavedRpc(actor, INVENTORY_ITEM_RPC, slot, args)
  return savedRpc<InventoryItemSave>(client, actor, INVENTORY_ITEM_RPC, slot, args, false,
    r => validInventoryItem(r, actor, home, request.id, request.args.p_item_id as string))
}
export function inventoryItemError(reason?: string) {
  if (reason === 'not_ready') return 'Snack saving needs an update. Nothing was used. Please try again after the update.'
  if (reason === 'no_stock') return 'This snack is no longer in your collection. Nothing was used.'
  if (reason === 'session_changed' || reason === 'household_changed' || reason === 'unauthenticated') return 'Your account or household changed. Reopen your collection.'
  if (reason === 'pending') return 'Confirm your previous snack first. Retrying will not use another one.'
  if (reason === 'busy') return 'Your snack is already being saved.'
  return 'Could not confirm your snack. Retry to check the same save, without using another one.'
}
