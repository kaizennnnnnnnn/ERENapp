import type { createClient } from './supabase/client'
import { writeWithRetry } from './supabaseRetry'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc } from './savedRpc'
import { KIOSK_BONUS_RPC } from './kioskSaves'
import type { ShiftRow } from '@/components/kiosk/useKioskRecord'
import { EXHAUSTED_ENERGY } from './gameRewards'

export interface KioskNight {
  ok: true; version: 2; user_id: string; household_id: string
  server_time: string; time_zone: string; night_date: string; starts_at: string; resets_at: string
  worked: boolean; night_total: number; bonus_due: number; rows: ShiftRow[]
  receivedAt: number
}
export interface KioskBonus {
  ok: boolean; reason?: string; version: 2; request_id: string; user_id: string; household_id: string
  awarded: number; coins: number; nights: string[]; saved_at: string
}
export function validKioskNight(value: KioskNight, actor: string, home: string) {
  const start = Date.parse(value?.starts_at), reset = Date.parse(value?.resets_at), now = Date.parse(value?.server_time)
  return value?.ok === true && value.version === 2 && value.user_id === actor && value.household_id === home
    && /^\d{4}-\d{2}-\d{2}$/.test(value.night_date) && typeof value.time_zone === 'string'
    && Number.isFinite(start) && Number.isFinite(reset) && Number.isFinite(now) && start <= now && now < reset
    && typeof value.worked === 'boolean' && Number.isSafeInteger(value.night_total) && value.night_total >= 0
    && Number.isSafeInteger(value.bonus_due) && value.bonus_due >= 0 && value.bonus_due % 40 === 0 && Array.isArray(value.rows)
}
export function readKioskNight(client: ReturnType<typeof createClient>, actor: string, home: string) {
  return writeWithRetry(signal => client.rpc('get_kiosk_night_status', { p_expected_user: actor, p_household_id: home }).abortSignal(signal),
    1, error => !['PGRST202', '42883', '42501'].includes(error.code ?? ''))
}
export function nightRemaining(night: KioskNight, monotonic = performance.now()) {
  return Math.max(0, Date.parse(night.resets_at) - Date.parse(night.server_time) - Math.max(0, monotonic - night.receivedAt))
}
export function nightCountdown(ms: number) {
  const minutes = Math.ceil(Math.max(0, ms) / 60_000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}
export function kioskNotice(night: KioskNight | null, energy: number | null, pendingSaves: number, pendingBonuses: number, unread: boolean) {
  if (pendingSaves > 0) return 'A finished shift needs confirmation'
  if (pendingBonuses > 0) return 'A nightly bonus needs confirmation'
  if (night && night.bonus_due > 0) return 'Your nightly bonus is ready'
  if (unread) return 'New kiosk rewards are ready to view'
  if (night && nightRemaining(night) > 0 && !night.worked && energy !== null && energy >= EXHAUSTED_ENERGY && energy <= 100) return 'A paid shift is ready'
  return null
}
export function pendingKioskBonuses(actor: string, home: string) {
  return pendingSavedRpcs(actor, KIOSK_BONUS_RPC).filter(request => request.args.p_expected_user === actor && request.args.p_household_id === home)
}
export function claimKioskBonus(client: ReturnType<typeof createClient>, actor: string, home: string) {
  const slot = `${home}:bonus`, args = { p_expected_user: actor, p_household_id: home }
  const intent = prepareSavedRpc(actor, KIOSK_BONUS_RPC, slot, args)
  return savedRpc<KioskBonus>(client, actor, KIOSK_BONUS_RPC, slot, args, true, result =>
    result.version === 2 && result.request_id === intent.id && result.user_id === actor && result.household_id === home
    && Number.isSafeInteger(result.coins) && result.coins >= 0 && Number.isSafeInteger(result.awarded) && result.awarded >= 0
    && Array.isArray(result.nights) && result.awarded === result.nights.length * 40 && new Set(result.nights).size === result.nights.length
    && result.nights.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date)) && Number.isFinite(Date.parse(result.saved_at)))
}
