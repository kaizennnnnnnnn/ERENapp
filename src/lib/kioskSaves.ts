import type { createClient } from './supabase/client'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc, type PendingSavedRequest } from './savedRpc'
import type { Regulars } from '@/components/kiosk/kioskShift'
import type { ShiftReport } from '@/components/kiosk/useKioskShift'

export const KIOSK_START_RPC = 'start_kiosk_shift_atomic'
export const KIOSK_CLOSE_RPC = 'close_kiosk_shift_atomic'
export interface KioskSession {
  ok: boolean; reason?: string; session_id: string; user_id: string; household_id: string
  shift_date: string; paid: boolean; blocked: boolean; energy: number; started_at: string
}
export interface KioskSettlement {
  ok: boolean; reason?: string; request_id: string; session_id: string; user_id: string; household_id: string
  shift_date: string; awarded: number; coins: number; paid: boolean; blocked: boolean; grade: ShiftReport['grade']
  night_total: number; goal_met: boolean; wraps_before: number; wraps_after: number; saved_at: string
}
export function pendingKioskSaves(actor: string, home: string) {
  return pendingSavedRpcs(actor, KIOSK_CLOSE_RPC).filter(r => r.args.p_expected_user === actor && r.args.p_household_id === home)
}
export function validKioskSession(result: KioskSession, actor: string, home: string, id: string) {
  return result.session_id === id && result.user_id === actor && result.household_id === home
    && /^\d{4}-\d{2}-\d{2}$/.test(result.shift_date) && typeof result.paid === 'boolean' && typeof result.blocked === 'boolean'
    && Number.isInteger(result.energy) && result.energy >= 0 && result.energy <= 100
    && (!result.blocked || !result.paid) && Number.isFinite(Date.parse(result.started_at))
}
export function startKioskShift(client: ReturnType<typeof createClient>, actor: string, home: string) {
  const slot = `${home}:start`, args = { p_expected_user: actor, p_household_id: home,
    p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }
  const intent = prepareSavedRpc(actor, KIOSK_START_RPC, slot, args)
  return savedRpc<KioskSession>(client, actor, KIOSK_START_RPC, slot, args, true,
    value => validKioskSession(value, actor, home, intent.id))
}
export function prepareKioskClose(actor: string, home: string, session: KioskSession, report: ShiftReport, regulars: Regulars): PendingSavedRequest {
  const slot = `${home}:${session.session_id}`
  return { slot, ...prepareSavedRpc(actor, KIOSK_CLOSE_RPC, slot, { p_expected_user: actor, p_household_id: home,
    p_session_id: session.session_id, p_takings: report.takings, p_weather: report.weather, p_early: report.early, p_regulars: regulars }) }
}
export function validKioskSettlement(value: KioskSettlement, actor: string, request: PendingSavedRequest) {
  const takings = request.args.p_takings as ShiftReport['takings']
  return value.request_id === request.id && value.user_id === actor && value.household_id === request.args.p_household_id
    && value.session_id === request.args.p_session_id && /^\d{4}-\d{2}-\d{2}$/.test(value.shift_date)
    && Number.isSafeInteger(value.awarded) && value.awarded >= 0 && value.awarded <= 34240
    && Number.isSafeInteger(value.coins) && value.coins >= 0 && typeof value.paid === 'boolean' && typeof value.blocked === 'boolean'
    && (value.paid || value.awarded === 0) && (!value.blocked || !value.paid) && ['S','A','B','C','D'].includes(value.grade)
    && Number.isSafeInteger(value.night_total) && value.night_total >= 0 && typeof value.goal_met === 'boolean'
    && value.goal_met === (value.night_total >= 22) && Number.isSafeInteger(value.wraps_before) && value.wraps_before >= 0
    && value.wraps_after === value.wraps_before + takings.served && Number.isFinite(Date.parse(value.saved_at))
}
const flights = new Map<string, Promise<KioskSettlement | { ok: false; reason: string }>>()
export function saveKioskClose(client: ReturnType<typeof createClient>, actor: string, request: PendingSavedRequest) {
  const key = `${actor}:${request.id}`, existing = flights.get(key)
  if (existing) return existing
  const next = savedRpc<KioskSettlement>(client, actor, KIOSK_CLOSE_RPC, request.slot, request.args, true,
    value => validKioskSettlement(value, actor, request)).catch(() => ({ ok: false as const, reason: 'connection' }))
  flights.set(key, next)
  return next.finally(() => { if (flights.get(key) === next) flights.delete(key) })
}
export function kioskSaveError(reason?: string) {
  if (reason === 'not_ready') return 'The shop needs its saving update. Your finished shift is kept for retry.'
  if (reason === 'household_changed' || reason === 'session_changed') return 'Your account or household changed. Reopen the shop.'
  if (reason === 'already_closed') return 'This shift was already saved. Reopen the shop to check your record.'
  if (reason === 'bad_result') return 'This shift could not be confirmed. Your saved result has been kept.'
  return 'Could not confirm your shift and coins. Retry to recover the same shift.'
}
