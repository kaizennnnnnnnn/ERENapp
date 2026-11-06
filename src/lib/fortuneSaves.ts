import type { createClient } from './supabase/client'
import { pendingSavedRpcs, savedRpc } from './savedRpc'

export const FORTUNE_RPC = 'claim_fortune_atomic'
export const FORTUNE_SAVED_EVENT = 'eren:fortune-saved'
export interface FortuneSaveResult {
  ok: boolean; reason?: string; user_id?: string; gift_id?: string; claimed_at?: string
  coins?: number; stardust?: number; gacha_tickets?: number; last_free_fortune?: string | null
}
const flights = new Map<string, Promise<FortuneSaveResult>>()
export function hasPendingFortune(userId: string) {
  return pendingSavedRpcs(userId, FORTUNE_RPC).some(request => request.slot === 'daily')
}
export function saveFortune(client: ReturnType<typeof createClient>, userId: string): Promise<FortuneSaveResult> {
  const existing = flights.get(userId)
  if (existing) return existing
  const request = (async () => {
    try {
      return await savedRpc<FortuneSaveResult>(client, userId, FORTUNE_RPC, 'daily', {
        p_expected_user: userId, p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      })
    } catch { return { ok: false, reason: 'connection' } }
  })()
  flights.set(userId, request)
  return request.finally(() => { if (flights.get(userId) === request) flights.delete(userId) })
}
export function fortuneSaveError(reason?: string) {
  if (reason === 'not_ready') return 'Gift saving is waiting for an update. Nothing was claimed.'
  if (reason === 'session_changed' || reason === 'unauthenticated') return 'Your account changed. Please reopen the gift.'
  if (reason === 'cooldown') return 'Today\'s gift was already opened on another screen.'
  return 'Could not confirm your gift. Retry to recover it without claiming twice.'
}
