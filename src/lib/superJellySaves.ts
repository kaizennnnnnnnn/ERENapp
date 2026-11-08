import type { createClient } from './supabase/client'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc } from './savedRpc'
import { SUPER_JELLY_SNACKS, type SuperJellySnack } from './jellies'

export const SUPER_JELLY_RPC = 'feed_super_jelly_atomic'
export interface SuperJellySave {
  ok: boolean
  reason?: string
  version: 1 | 2
  snack?: { food_key: SuperJellySnack; quantity: 1 }
  request_id: string
  user_id: string
  household_id: string
  awarded: number
  coins: number
  supers: number
  fed: number
  current_supers: number
  current_fed: number
  skin_granted: boolean
  saved_at: string
}
export function pendingSuperJellyFeeds(actor: string, home: string) {
  return pendingSavedRpcs(actor, SUPER_JELLY_RPC).filter(request => request.args.p_expected_user === actor && request.args.p_household_id === home)
}
export function saveSuperJellyFeed(client: ReturnType<typeof createClient>, actor: string, home: string) {
  const args = { p_expected_user: actor, p_household_id: home }, slot = `${home}:feed`
  const intent = prepareSavedRpc(actor, SUPER_JELLY_RPC, slot, args)
  return savedRpc<SuperJellySave>(client, actor, SUPER_JELLY_RPC, slot, args, false, result =>
    ((result.version === 1 && result.snack == null) || (result.version === 2 && result.snack?.quantity === 1 && SUPER_JELLY_SNACKS.includes(result.snack.food_key)))
    && result.request_id === intent.id && result.user_id === actor && result.household_id === home
    && result.awarded === 120 && Number.isSafeInteger(result.coins) && result.coins >= 0
    && [result.supers, result.current_supers].every(value => Number.isSafeInteger(value) && value >= 0)
    && [result.fed, result.current_fed].every(value => Number.isSafeInteger(value) && value >= 1)
    && result.current_fed >= result.fed && typeof result.skin_granted === 'boolean'
    && (!result.skin_granted || result.fed >= 5) && Number.isFinite(Date.parse(result.saved_at)))
}
export function superJellySaveError(reason?: string) {
  if (reason === 'not_ready') return 'Super Jelly feeding needs an update. Nothing was spent.'
  if (reason === 'none') return 'That Super Jelly is no longer available.'
  if (reason === 'household_changed' || reason === 'session_changed') return 'Your account or household changed. Reopen the kitchen.'
  return 'Could not confirm the feed. Retry to recover it without spending another Super Jelly.'
}
