import type { ErenStats } from '@/types'
import type { createClient } from './supabase/client'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc } from './savedRpc'

export const PLAY_SESSION_RPC = 'complete_play_session_atomic'
export type PlayStats = Pick<ErenStats, 'household_id' | 'hunger' | 'happiness' | 'energy' | 'sleep_quality' | 'cleanliness' | 'weight' | 'mood' | 'is_sick' | 'is_sleeping' | 'last_decay_at' | 'updated_at'>
export interface PlaySessionSave {
  ok: boolean; reason?: string; version: 1; request_id: string; user_id: string; household_id: string
  action: 'play'; interaction_id: string; useful: boolean; saved_at: string; stats: PlayStats
}
export function pendingPlaySession(actor: string, home: string) {
  return pendingSavedRpcs(actor, PLAY_SESSION_RPC).find(r => r.slot === `${home}:play` && r.args.p_expected_user === actor && r.args.p_household_id === home) ?? null
}
export function mergePlayStats(current: ErenStats | null, patch: PlayStats): ErenStats | null {
  if (!current || current.household_id !== patch.household_id || Date.parse(current.updated_at) > Date.parse(patch.updated_at)) return current
  return { ...current, ...patch }
}
export function validPlaySession(r: PlaySessionSave, actor: string, home: string, id: string) {
  const s = r.stats
  return r.version === 1 && r.request_id === id && r.user_id === actor && r.household_id === home && r.action === 'play'
    && typeof r.interaction_id === 'string' && r.interaction_id.length > 0 && typeof r.useful === 'boolean' && typeof r.saved_at === 'string' && Number.isFinite(Date.parse(r.saved_at))
    && !!s && s.household_id === home && [s.hunger, s.happiness, s.energy, s.sleep_quality].every(v => Number.isInteger(v) && v >= 0 && v <= 100)
    && typeof s.cleanliness === 'number' && Number.isFinite(s.cleanliness) && s.cleanliness >= 0 && s.cleanliness <= 100
    && typeof s.weight === 'number' && Number.isFinite(s.weight) && s.weight >= 2 && s.weight <= 10
    && ['idle', 'happy', 'hungry', 'sleepy', 'playful', 'angry'].includes(s.mood)
    && typeof s.is_sick === 'boolean' && typeof s.is_sleeping === 'boolean'
    && typeof s.last_decay_at === 'string' && Number.isFinite(Date.parse(s.last_decay_at)) && typeof s.updated_at === 'string' && Number.isFinite(Date.parse(s.updated_at))
}
export async function savePlaySession(client: ReturnType<typeof createClient>, actor: string, home: string, recover = false) {
  const previous = pendingPlaySession(actor, home)
  if (previous && !recover) return { ok: false as const, reason: 'pending' }
  if (recover && !previous) return { ok: false as const, reason: 'nothing_pending' }
  const args = { p_expected_user: actor, p_household_id: home }, slot = `${home}:play`
  const request = prepareSavedRpc(actor, PLAY_SESSION_RPC, slot, args)
  return savedRpc<PlaySessionSave>(client, actor, PLAY_SESSION_RPC, slot, args, true, r => validPlaySession(r, actor, home, request.id))
}
export function playSessionError(reason?: string) {
  if (reason === 'loading') return 'Playtime is still loading. Please try again in a moment.'
  if (reason === 'busy') return 'Your play session is already saving.'
  if (reason === 'not_ready') return 'Playtime saving needs an update. Your session is kept for retry.'
  if (reason === 'sleeping') return 'Your cat is asleep. The play session is kept for retry.'
  if (reason === 'session_changed' || reason === 'household_changed') return 'Your account or household changed. Reopen the playroom.'
  if (reason === 'pending') return 'Your previous play session needs confirmation first.'
  return 'Could not confirm playtime. Retry to recover the same session.'
}
