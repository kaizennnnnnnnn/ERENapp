import type { ErenStats } from '@/types'
import type { createClient } from './supabase/client'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc } from './savedRpc'

export const MEDICINE_SESSION_RPC = 'complete_medicine_session_atomic'
export type MedicineStats = Pick<ErenStats, 'household_id' | 'hunger' | 'happiness' | 'energy' | 'sleep_quality' | 'cleanliness' | 'weight' | 'mood' | 'is_sick' | 'is_sleeping' | 'last_decay_at' | 'updated_at'>
export interface MedicineSessionSave {
  ok: boolean; reason?: string; version: 1; request_id: string; user_id: string; household_id: string
  changed: boolean; interaction_id: string | null; useful: boolean; saved_at: string; stats: MedicineStats
}
export function pendingMedicineSession(actor: string, home: string) {
  return pendingSavedRpcs(actor, MEDICINE_SESSION_RPC).find(r => r.slot === `${home}:medicine` && r.args.p_expected_user === actor && r.args.p_household_id === home) ?? null
}
export function mergeMedicineStats(current: ErenStats | null, patch: MedicineStats): ErenStats | null {
  if (!current || current.household_id !== patch.household_id || Date.parse(current.updated_at) > Date.parse(patch.updated_at)) return current
  return { ...current, ...patch }
}
export function validMedicineSession(r: MedicineSessionSave, actor: string, home: string, id: string) {
  const s = r.stats
  return r.version === 1 && r.request_id === id && r.user_id === actor && r.household_id === home && typeof r.changed === 'boolean'
    && (r.changed ? typeof r.interaction_id === 'string' && r.interaction_id.length > 0 : r.interaction_id === null && r.useful === false)
    && typeof r.useful === 'boolean' && typeof r.saved_at === 'string' && Number.isFinite(Date.parse(r.saved_at))
    && !!s && s.household_id === home && [s.hunger, s.happiness, s.energy, s.sleep_quality].every(v => Number.isInteger(v) && v >= 0 && v <= 100)
    && typeof s.cleanliness === 'number' && Number.isFinite(s.cleanliness) && s.cleanliness >= 0 && s.cleanliness <= 100
    && typeof s.weight === 'number' && Number.isFinite(s.weight) && s.weight >= 2 && s.weight <= 10
    && ['idle', 'happy', 'hungry', 'sleepy', 'playful', 'angry'].includes(s.mood)
    && typeof s.is_sick === 'boolean' && typeof s.is_sleeping === 'boolean'
    && (s.last_decay_at === null || typeof s.last_decay_at === 'string' && Number.isFinite(Date.parse(s.last_decay_at)))
    && typeof s.updated_at === 'string' && Number.isFinite(Date.parse(s.updated_at))
}
export async function saveMedicineSession(client: ReturnType<typeof createClient>, actor: string, home: string, recover = false) {
  const previous = pendingMedicineSession(actor, home)
  if (previous && !recover) return { ok: false as const, reason: 'pending' }
  if (recover && !previous) return { ok: false as const, reason: 'nothing_pending' }
  const args = { p_expected_user: actor, p_household_id: home }, slot = `${home}:medicine`
  const request = prepareSavedRpc(actor, MEDICINE_SESSION_RPC, slot, args)
  return savedRpc<MedicineSessionSave>(client, actor, MEDICINE_SESSION_RPC, slot, args, true, r => validMedicineSession(r, actor, home, request.id))
}
export function medicineSessionError(reason?: string) {
  if (reason === 'loading') return 'The vet is still loading. Please try again in a moment.'
  if (reason === 'busy') return 'Your treatment save is already in progress.'
  if (reason === 'not_ready') return 'Treatment saving needs an update. Your action is kept for retry.'
  if (reason === 'session_changed' || reason === 'household_changed') return 'Your account or household changed. Reopen the vet.'
  if (reason === 'pending') return 'Your previous treatment save needs confirmation first.'
  return 'Could not confirm this treatment. Retry to recover the same dose.'
}
