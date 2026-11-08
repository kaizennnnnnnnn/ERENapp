import type { createClient } from './supabase/client'
import { getJelly, JELLY_THRESHOLDS, type JellyGame, type JellyId } from './jellies'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc, type PendingSavedRequest } from './savedRpc'

export const JELLY_ROUND_RPC = 'finish_jelly_round_atomic'
export const JELLY_ROUND_SAVED_EVENT = 'eren:jelly-round-saved'
export interface JellyRoundWin { flavour: JellyId; effect: number; is_new: boolean; minted_super: boolean; tray_count: number }
export interface JellyRoundSave {
  ok: boolean; reason?: string; version: 1; request_id: string; user_id: string; household_id: string
  game: JellyGame; score: number; best: number; is_best: boolean; theirs_today: number; their_name: string | null
  took_lead: boolean; bonus_jelly: boolean; wins: JellyRoundWin[]; awarded: number; coins: number; saved_at: string
  current_day: string | null; current_flavours: JellyId[]; current_supers: number; current_fed: number
}

export function pendingJellyRounds(actor: string, home: string, game?: JellyGame) {
  return pendingSavedRpcs(actor, JELLY_ROUND_RPC).filter(r => r.args.p_expected_user === actor && r.args.p_household_id === home
    && (r.args.p_game === 'run' || r.args.p_game === 'jump') && (!game || r.args.p_game === game))
}
export function prepareJellyRound(actor: string, home: string, game: JellyGame, score: number): PendingSavedRequest {
  if ((game !== 'run' && game !== 'jump') || !Number.isSafeInteger(score) || score < 0 || score > 2147483647) throw Error('Invalid Jelly result')
  const slot = `${home}:${game}:${crypto.randomUUID()}`
  return { slot, ...prepareSavedRpc(actor, JELLY_ROUND_RPC, slot, { p_expected_user: actor, p_household_id: home, p_game: game, p_score: score }) }
}
const integer = (v: number) => Number.isSafeInteger(v) && v >= 0
export function validJellyRound(result: JellyRoundSave, actor: string, request: PendingSavedRequest): boolean {
  const count = result.score >= JELLY_THRESHOLDS[result.game] ? (result.bonus_jelly ? 2 : 1) : 0
  return result.version === 1 && result.request_id === request.id && result.user_id === actor
    && result.household_id === request.args.p_household_id && result.game === request.args.p_game && result.score === request.args.p_score
    && integer(result.best) && result.best >= result.score && integer(result.theirs_today) && (result.their_name === null || typeof result.their_name === 'string')
    && [result.is_best, result.took_lead, result.bonus_jelly].every(v => typeof v === 'boolean') && (!result.bonus_jelly || result.took_lead)
    && Array.isArray(result.wins) && result.wins.length === count && result.wins.every(w => {
      const jelly = getJelly(w.flavour)
      return jelly && Number.isInteger(w.effect) && w.effect >= 0 && w.effect < jelly.effects.length
        && typeof w.is_new === 'boolean' && typeof w.minted_super === 'boolean' && integer(w.tray_count) && w.tray_count >= 1 && w.tray_count <= 5
        && (!w.minted_super || (w.is_new && w.tray_count === 5))
    })
    && integer(result.awarded) && result.awarded === result.wins.reduce((sum, w) => sum + (getJelly(w.flavour)!.effects[w.effect].buff.coins ?? 0), 0)
    && integer(result.coins) && integer(result.current_supers) && integer(result.current_fed)
    && Array.isArray(result.current_flavours) && result.current_flavours.length <= 5 && new Set(result.current_flavours).size === result.current_flavours.length
    && result.current_flavours.every(id => !!getJelly(id)) && (result.current_day === null || /^\d{4}-\d{2}-\d{2}$/.test(result.current_day))
    && Number.isFinite(Date.parse(result.saved_at))
}
const flights = new Map<string, Promise<JellyRoundSave | { ok: false; reason: string }>>()
const queues = new Map<string, Promise<unknown>>()
export function saveJellyRound(client: ReturnType<typeof createClient>, actor: string, request: PendingSavedRequest, canRun = () => true) {
  const key = `${actor}:${request.id}`, previous = flights.get(key)
  if (previous) return previous
  const perform = async () => {
    if (!canRun()) return { ok: false as const, reason: 'session_changed' }
    try { return await savedRpc<JellyRoundSave>(client, actor, JELLY_ROUND_RPC, request.slot, request.args, true, value => validJellyRound(value, actor, request)) }
    catch { return { ok: false as const, reason: 'connection' } }
  }
  const flight = (queues.get(actor) ?? Promise.resolve()).then(perform, perform)
  flights.set(key, flight); queues.set(actor, flight)
  return flight.finally(() => { if (flights.get(key) === flight) flights.delete(key); if (queues.get(actor) === flight) queues.delete(actor) })
}
export function jellyRoundError(reason?: string) {
  if (reason === 'not_ready') return 'Jelly saving needs an update. Your round is kept for retry.'
  if (reason === 'household_changed' || reason === 'session_changed') return 'Your account or household changed. Reopen the Jelly Parlour.'
  return 'Could not confirm this round. Retry to recover the same score and rewards.'
}
