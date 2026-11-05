import type { Profile, TaskId, FoodKey } from '@/types'
import type { AchievementTrigger } from './achievements'
import type { SkinBoxRarity } from './levelRewards'
import type { createClient } from './supabase/client'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc, type PendingSavedRequest } from './savedRpc'

export type RewardKind = 'task' | 'achievement' | 'repair' | 'road' | 'wallet'
export interface RewardRoadOutcome {
  from: number; to: number; coins: number; stardust: number; tickets: number
  foods: FoodKey[]; skinIds: string[]; boxDust: number; converted: SkinBoxRarity[]
}
export interface RewardOutcome {
  tasks: { id: TaskId; period: 'daily' | 'weekly'; periodKey: string; coins: number; xp: number }[]
  achievements: string[]
  milestones?: number[]; milestoneCoins?: number; freezeUsed?: boolean
  levelUp?: boolean; levelReached?: number; repaired?: boolean; streakCount?: number
  walletDelta?: number; road?: RewardRoadOutcome
}
export type RewardProfile = Pick<Profile, 'coins' | 'xp' | 'level' | 'streak' | 'achievements' | 'claimed_level'>
export interface RewardSaveResult { ok: boolean; reason?: string; profile?: RewardProfile; outcome?: RewardOutcome }
export const REWARD_RPC = 'claim_reward_atomic'
const queues = new Map<string, Promise<unknown>>()

export function rewardDay(now = new Date()) {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { day, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }
}

export function pendingRewardSaves(userId: string): PendingSavedRequest[] {
  return pendingSavedRpcs(userId, REWARD_RPC).filter(request => {
    const { p_kind: kind, p_input: input } = request.args
    return typeof kind === 'string' && ['task', 'achievement', 'repair', 'road', 'wallet'].includes(kind)
      && input !== null && typeof input === 'object' && !Array.isArray(input)
  })
}

export function saveReward(
  client: ReturnType<typeof createClient>, userId: string, kind: RewardKind,
  input: Record<string, unknown>, slot: string, canRun: () => boolean = () => true,
  recoverId?: string,
): Promise<RewardSaveResult> {
  if (!canRun()) return Promise.resolve({ ok: false, reason: 'session_changed' })
  const requestId = recoverId ?? prepareSavedRpc(userId, REWARD_RPC, slot, { p_kind: kind, p_input: input }).id
  const run = async (): Promise<RewardSaveResult> => {
    if (!canRun()) return { ok: false, reason: 'session_changed' }
    // A queued recovery may have been confirmed by its original caller already.
    if (!pendingRewardSaves(userId).some(request => request.id === requestId && request.slot === slot)) {
      return { ok: false, reason: 'nothing_pending' }
    }
    try {
      return await savedRpc<RewardSaveResult>(client, userId, REWARD_RPC, slot, { p_kind: kind, p_input: input })
    } catch { return { ok: false, reason: 'connection' } }
  }
  const next = (queues.get(userId) ?? Promise.resolve()).then(run, run)
  queues.set(userId, next)
  return next.finally(() => { if (queues.get(userId) === next) queues.delete(userId) })
}

export function recoverReward(client: ReturnType<typeof createClient>, userId: string, request: PendingSavedRequest, canRun?: () => boolean) {
  return saveReward(client, userId, request.args.p_kind as RewardKind,
    request.args.p_input as Record<string, unknown>, request.slot, canRun, request.id)
}

export function taskRewardInput(taskId: TaskId) {
  const input = { taskId, ...rewardDay() }
  return { input, slot: `task:${taskId}:${input.day}` }
}

export function achievementRewardInput(trigger: AchievementTrigger) {
  return { input: { trigger, ...rewardDay() }, slot: `achievement:${crypto.randomUUID()}` }
}

export function rewardSaveError(reason?: string): string {
  if (reason === 'not_ready') return 'Rewards are waiting for a saving update. Nothing was claimed.'
  if (reason === 'insufficient') return 'Not enough coins. Nothing was changed.'
  if (reason === 'period_changed') return 'The quest period changed before the reward could be saved.'
  if (reason === 'household_changed' || reason === 'session_changed') return 'Your account or household changed. Please reopen this screen.'
  if (reason === 'not_eligible') return 'That reward is not available yet.'
  return 'Could not confirm your reward. Retry to recover it without claiming twice.'
}
