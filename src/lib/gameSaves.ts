import type { GameType } from '@/types'
import type { createClient } from './supabase/client'
import { PLAYABLE_MINIGAME_IDS } from './minigames'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc, type PendingSavedRequest } from './savedRpc'

export const GAME_RESULT_RPC = 'save_game_result_atomic'
export const GAME_SAVED_EVENT = 'eren:game-saved'
export interface ReportGameResultOpts { gameType: GameType; score: number; won?: boolean; saveScore?: boolean }
export interface GameSaveResult {
  ok: boolean; reason?: string; request_id?: string; user_id?: string; household_id?: string
  game_type?: GameType; score?: number; awarded?: number; coins?: number; blocked?: boolean; energy?: number
  score_id?: string | null; saved_at?: string
}
const flights = new Map<string, Promise<GameSaveResult>>()
const queues = new Map<string, Promise<unknown>>()

export function pendingGameSaves(userId: string, householdId: string, gameType?: GameType) {
  return pendingSavedRpcs(userId, GAME_RESULT_RPC).filter(r => r.args.p_expected_user === userId
    && r.args.p_household_id === householdId && PLAYABLE_MINIGAME_IDS.includes(r.args.p_game_type as GameType)
    && (!gameType || r.args.p_game_type === gameType))
}
export function prepareGameResult(userId: string, householdId: string, opts: ReportGameResultOpts): PendingSavedRequest {
  if (!Number.isSafeInteger(opts.score) || opts.score < 0 || opts.score > 2147483647 || !PLAYABLE_MINIGAME_IDS.includes(opts.gameType)) throw Error('Invalid game result')
  const slot = `${householdId}:${crypto.randomUUID()}`
  return { slot, ...prepareSavedRpc(userId, GAME_RESULT_RPC, slot, {
    p_expected_user: userId, p_household_id: householdId, p_game_type: opts.gameType,
    p_score: opts.score, p_won: opts.won ?? false, p_save_score: opts.saveScore ?? opts.score > 0,
  }) }
}
export function saveGameResult(client: ReturnType<typeof createClient>, userId: string, request: PendingSavedRequest, canRun = () => true): Promise<GameSaveResult> {
  const key = `${userId}:${request.id}`
  const existing = flights.get(key)
  if (existing) return existing
  const run = async (): Promise<GameSaveResult> => {
    if (!canRun()) return { ok: false, reason: 'session_changed' }
    try { return await savedRpc<GameSaveResult>(client, userId, GAME_RESULT_RPC, request.slot, request.args, true,
      result => validGameResult(result, userId, request)) }
    catch { return { ok: false, reason: 'connection' } }
  }
  const next = (queues.get(userId) ?? Promise.resolve()).then(run, run)
  queues.set(userId, next); flights.set(key, next)
  return next.finally(() => {
    if (flights.get(key) === next) flights.delete(key)
    if (queues.get(userId) === next) queues.delete(userId)
  })
}
export function validGameResult(result: GameSaveResult, userId: string, request: PendingSavedRequest) {
  return result.user_id === userId && result.request_id === request.id
    && result.household_id === request.args.p_household_id && result.game_type === request.args.p_game_type
    && result.score === request.args.p_score && Number.isSafeInteger(result.coins) && result.coins! >= 0
    && Number.isSafeInteger(result.awarded) && result.awarded! >= 0 && result.awarded! <= 44
    && Number.isInteger(result.energy) && result.energy! >= 0 && result.energy! <= 100
    && typeof result.blocked === 'boolean' && (!result.blocked || result.awarded === 0)
    && typeof result.saved_at === 'string'
    && (request.args.p_save_score && Number(request.args.p_score) > 0 ? typeof result.score_id === 'string' : result.score_id === null)
}
export function gameSaveError(reason?: string) {
  if (reason === 'not_ready') return 'Game saving is waiting for an update. Your result is kept for retry.'
  if (reason === 'household_changed' || reason === 'session_changed') return 'Your account or household changed. Reopen the arcade.'
  if (reason === 'bad_result') return 'This game result could not be saved.'
  return 'Could not confirm your score and coins. Retry to recover them.'
}
