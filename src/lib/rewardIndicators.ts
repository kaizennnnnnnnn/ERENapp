import type { GameType } from '@/types'
import { PLAYABLE_MINIGAME_IDS } from './minigames'

export const REWARD_INDICATORS_CHANGED = 'eren:reward-indicators-changed'
export const FREE_FOOD_RPC = 'claim_free_food_gacha_atomic'
export const FREE_REWARD_MS = 24 * 60 * 60 * 1000
export function untilFree(stamp: unknown, now = Date.now()): number | null {
  if (stamp === null) return 0
  if (typeof stamp !== 'string' || !Number.isFinite(Date.parse(stamp))) return null
  return Math.max(0, Date.parse(stamp) + FREE_REWARD_MS - now)
}
export function freeFoodWait(state: Record<string, unknown> | null, now = Date.now()) {
  return state && Object.prototype.hasOwnProperty.call(state, 'last_free_food_gacha') ? untilFree(state.last_free_food_gacha, now) : null
}
export function freeWaitLabel(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
}
export function notifyRewardIndicators() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REWARD_INDICATORS_CHANGED))
}
export const seenGamesKey = (userId: string) => `eren:seen-games:v1:${userId}`
export function readSeenGames(storage: Pick<Storage, 'getItem'> | null, userId: string, fallback = PLAYABLE_MINIGAME_IDS): Set<string> {
  try {
    const value = JSON.parse(storage?.getItem(seenGamesKey(userId)) ?? 'null')
    if (Array.isArray(value) && value.every(id => typeof id === 'string')) return new Set(value)
  } catch { /* First visit/private storage: seed quietly, never mark the entire arcade new. */ }
  return new Set(fallback)
}
export function unseenGames(seen: Set<string>, games = PLAYABLE_MINIGAME_IDS): GameType[] {
  return games.filter(id => !seen.has(id))
}
