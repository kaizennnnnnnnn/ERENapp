import type { ErenStats } from '@/types'
import type { createClient } from './supabase/client'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc } from './savedRpc'

export const SLEEP_SESSION_RPC = 'complete_sleep_session_atomic'
export type SleepAction = 'tuck' | 'wake'
export type SleepStats = Pick<ErenStats, 'household_id' | 'hunger' | 'happiness' | 'energy' | 'sleep_quality' | 'cleanliness' | 'weight' | 'mood' | 'is_sick' | 'is_sleeping' | 'last_decay_at' | 'updated_at'>
export interface SleepSessionSave {
  ok: boolean; reason?: string; version: 1; request_id: string; user_id: string; household_id: string
  action: SleepAction; changed: boolean; interaction_id: string | null; useful: boolean; saved_at: string; stats: SleepStats
}
export function pendingSleepSession(actor: string, home: string) {
  const r = pendingSavedRpcs(actor, SLEEP_SESSION_RPC).find(r => r.slot === `${home}:sleep` && r.args.p_expected_user === actor && r.args.p_household_id === home && ['tuck', 'wake'].includes(String(r.args.p_action)))
  return r ? { ...r, action: r.args.p_action as SleepAction } : null
}
export function mergeSleepStats(current: ErenStats | null, patch: SleepStats): ErenStats | null {
  if (!current || current.household_id !== patch.household_id || Date.parse(current.updated_at) > Date.parse(patch.updated_at)) return current
  return { ...current, ...patch }
}
export function validSleepSession(r: SleepSessionSave, actor: string, home: string, id: string, action: SleepAction) {
  const s = r.stats
  return r.version === 1 && r.request_id === id && r.user_id === actor && r.household_id === home && r.action === action && typeof r.changed === 'boolean'
    && (r.changed && action === 'tuck' ? typeof r.interaction_id === 'string' && r.interaction_id.length > 0 : r.interaction_id === null)
    && typeof r.useful === 'boolean' && typeof r.saved_at === 'string' && Number.isFinite(Date.parse(r.saved_at))
    && !!s && s.household_id === home && [s.hunger, s.happiness, s.energy, s.sleep_quality].every(v => Number.isInteger(v) && v >= 0 && v <= 100)
    && typeof s.cleanliness === 'number' && Number.isFinite(s.cleanliness) && s.cleanliness >= 0 && s.cleanliness <= 100
    && typeof s.weight === 'number' && Number.isFinite(s.weight) && s.weight >= 2 && s.weight <= 10
    && ['idle', 'happy', 'hungry', 'sleepy', 'playful', 'angry'].includes(s.mood)
    && typeof s.is_sick === 'boolean' && typeof s.is_sleeping === 'boolean'
    && (s.last_decay_at === null || typeof s.last_decay_at === 'string' && Number.isFinite(Date.parse(s.last_decay_at)))
    && typeof s.updated_at === 'string' && Number.isFinite(Date.parse(s.updated_at))
}
export async function saveSleepSession(client: ReturnType<typeof createClient>, actor: string, home: string, action: SleepAction, recover = false) {
  const previous = pendingSleepSession(actor, home)
  if (previous && !recover) return { ok: false as const, reason: 'pending' }
  if (recover && !previous) return { ok: false as const, reason: 'nothing_pending' }
  const args = { p_expected_user: actor, p_household_id: home, p_action: action }, slot = `${home}:sleep`
  const request = prepareSavedRpc(actor, SLEEP_SESSION_RPC, slot, args)
  return savedRpc<SleepSessionSave>(client, actor, SLEEP_SESSION_RPC, slot, args, true, r => validSleepSession(r, actor, home, request.id, request.args.p_action as SleepAction))
}
export function sleepSessionError(reason?: string) {
  if (reason === 'loading') return 'The bedroom is still loading. Please try again in a moment.'
  if (reason === 'busy') return 'Your bedroom save is already in progress.'
  if (reason === 'not_ready') return 'Bedroom saving needs an update. Your action is kept for retry.'
  if (reason === 'session_changed' || reason === 'household_changed') return 'Your account or household changed. Reopen the bedroom.'
  if (reason === 'pending') return 'Your previous bedroom save needs confirmation first.'
  return 'Could not confirm this bedroom save. Retry to recover the same action.'
}
