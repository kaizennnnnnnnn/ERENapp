'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { TASK_DEFS, getDailyKey, getWeeklyKey, CARE_TASK_IDS, getWeekDailyKeys } from '@/lib/tasks'
import type { TaskId, StreakData, AchievementMap } from '@/types'
import { useAuth, PROFILE_UPDATED_EVENT, type ProfileUpdatedDetail } from '@/hooks/useAuth'
import {
  ACHIEVEMENT_DEFS, canRepairStreak, STREAK_REPAIR_COST,
  type AchievementContext, type AchievementTrigger, type AchievementDef,
} from '@/lib/achievements'
import {
  saveReward, recoverReward, pendingRewardSaves, rewardDay, taskRewardInput,
  achievementRewardInput, rewardSaveError, type RewardKind, type RewardSaveResult,
} from '@/lib/rewardSaves'
import type { PendingSavedRequest } from '@/lib/savedRpc'
import { receiveRewardNews } from '@/lib/rewardNews'

interface TaskContextValue {
  completedIds: Set<string>
  taskProgress: Map<TaskId, number>
  completeTask: (taskId: TaskId) => Promise<{ coins: number; xp: number; levelUp: boolean } | null>
  addCoins: (amount: number) => Promise<boolean>
  spendCoins: (amount: number) => Promise<boolean>
  coins: number; xp: number; level: number; loading: boolean
  streak: StreakData; achievements: AchievementMap
  checkAchievementsFor: (trigger: AchievementTrigger, extra?: Partial<AchievementContext>) => Promise<void>
  streakRepairAvailable: boolean; streakRepairCost: number
  repairStreak: () => Promise<boolean>
  claimLevelRewards: (target: number, householdId: string) => Promise<RewardSaveResult>
  rewardError: string | null; pendingRewards: number; rewardBusy: boolean
  retryRewards: () => Promise<void>
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [taskProgress, setTaskProgress] = useState<Map<TaskId, number>>(new Map())
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [coins, setCoins] = useState(0)
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState<StreakData>({ current: 0, best: 0, lastDate: null })
  const [achievements, setAchievements] = useState<AchievementMap>({})
  const [rewardError, setRewardError] = useState<string | null>(null)
  const [pendingRewards, setPendingRewards] = useState(0)
  const [rewardBusy, setRewardBusy] = useState(false)
  const completedRef = useRef(completedIds)
  const currentUser = useRef(user?.id)
  const mounted = useRef(true)
  const activeRequests = useRef(0)
  const readVersion = useRef(0)
  const loadFailedRef = useRef(false)
  completedRef.current = completedIds
  currentUser.current = user?.id
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; readVersion.current++ } }, [])

  const loadCompletions = useCallback(async () => {
    if (!user?.id || currentUser.current !== user.id) return
    const version = ++readVersion.current
    const dailyKey = getDailyKey(), weeklyKey = getWeeklyKey(), weekDayKeys = getWeekDailyKeys()
    const { data, error } = await withRetry(() => supabase.from('user_task_completions')
      .select('task_id, period_key').eq('user_id', user.id).in('period_key', Array.from(new Set([dailyKey, weeklyKey, ...weekDayKeys]))))
    if (!mounted.current || currentUser.current !== user.id || version !== readVersion.current) return
    if (error) { loadFailedRef.current = true; setRewardError('Could not load your quests. Please retry.'); setLoading(false); return }
    loadFailedRef.current = false
    const rows = data ?? []
    const complete = new Set(rows.filter(row => row.period_key === dailyKey || row.period_key === weeklyKey)
      .map(row => `${row.task_id}:${row.period_key}`))
    completedRef.current = complete
    setCompletedIds(complete)
    const weekly = rows.filter(row => weekDayKeys.includes(row.period_key))
    setTaskProgress(new Map<TaskId, number>([
      ['weekly_all_care', new Set(weekly.filter(row => (CARE_TASK_IDS as string[]).includes(row.task_id)).map(row => row.task_id)).size],
      ['weekly_mood_5', new Set(weekly.filter(row => row.task_id === 'daily_mood').map(row => row.period_key)).size],
      ['weekly_all_games', Math.min(3, weekly.filter(row => row.task_id === 'daily_game').length)],
    ]))
    setLoading(false)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true)
    completedRef.current = new Set()
    setCompletedIds(new Set())
    setTaskProgress(new Map())
    setRewardError(null)
    void loadCompletions()
  }, [loadCompletions])

  useEffect(() => {
    if (!profile) return
    setXp(profile.xp ?? 0); setLevel(profile.level ?? 1); setCoins(profile.coins ?? 0)
    setStreak(profile.streak ?? { current: 0, best: 0, lastDate: null })
    setAchievements(profile.achievements ?? {})
  }, [profile?.xp, profile?.level, profile?.coins, profile?.streak, profile?.achievements]) // eslint-disable-line react-hooks/exhaustive-deps

  // Adopt saved wallet events synchronously; no callback performs balance arithmetic.
  useEffect(() => {
    const onSaved = (event: Event) => {
      const { id, patch } = (event as CustomEvent<ProfileUpdatedDetail>).detail
      if (id !== currentUser.current || typeof patch.coins !== 'number') return
      setCoins(patch.coins)
    }
    window.addEventListener(PROFILE_UPDATED_EVENT, onSaved)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onSaved)
  }, [])

  const adoptReward = useCallback((result: RewardSaveResult) => {
    if (!result.profile || !result.outcome || !user?.id) return false
    const saved = result.profile, outcome = result.outcome
    if (![saved.coins, saved.xp, saved.level, saved.claimed_level].every(Number.isSafeInteger)
      || !Array.isArray(outcome.tasks) || !Array.isArray(outcome.achievements)) return false
    setCoins(saved.coins); setXp(saved.xp); setLevel(saved.level)
    setStreak(saved.streak ?? { current: 0, best: 0, lastDate: null })
    setAchievements(saved.achievements ?? {})
    window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, { detail: { id: user.id, patch: saved } }))
    if (outcome.tasks.length) {
      for (const task of outcome.tasks) receiveRewardNews(user.id, 'quests', `task:${task.id}:${task.periodKey}`)
      const next = new Set(completedRef.current)
      for (const task of outcome.tasks) next.add(`${task.id}:${task.periodKey}`)
      completedRef.current = next
      setCompletedIds(next)
      for (const task of outcome.tasks) window.dispatchEvent(new CustomEvent('eren:quest-complete', {
        detail: { taskId: task.id, period: task.period, coins: task.coins, xp: task.xp },
      }))
    }
    if (outcome.levelUp) window.dispatchEvent(new CustomEvent('eren:level-up', { detail: { level: outcome.levelReached } }))
    if (outcome.milestones?.length) window.dispatchEvent(new CustomEvent('eren:streak-milestone', {
      detail: { milestones: outcome.milestones, coins: outcome.milestoneCoins, streak: saved.streak?.current },
    }))
    if (outcome.freezeUsed) window.dispatchEvent(new CustomEvent('eren:streak-freeze-used', { detail: { streak: saved.streak?.current, freezesLeft: saved.streak?.freezeTokens ?? 0 } }))
    if (outcome.repaired) window.dispatchEvent(new CustomEvent('eren:streak-repaired', { detail: { streak: outcome.streakCount } }))
    const unlocked = outcome.achievements.map(id => ACHIEVEMENT_DEFS.find(def => def.id === id)).filter((def): def is AchievementDef => !!def)
    for (const achievement of unlocked) receiveRewardNews(user.id, 'profile', `achievement:${achievement.id}`)
    for (const milestone of outcome.milestones ?? []) receiveRewardNews(user.id, 'profile', `streak:${saved.streak?.lastDate}:${milestone}`)
    if (outcome.levelUp) receiveRewardNews(user.id, 'profile', `level:${outcome.levelReached}`)
    if (outcome.road?.foods.length) receiveRewardNews(user.id, 'kitchen', `road:${outcome.road.from}:${outcome.road.to}`)
    if (unlocked.length) window.dispatchEvent(new CustomEvent('eren:achievement-unlocked', { detail: { achievements: unlocked } }))
    if (outcome.road) window.dispatchEvent(new Event('eren:rewards-claimed'))
    return true
  }, [user?.id, loadCompletions])

  const performReward = useCallback(async (kind: RewardKind, input: Record<string, unknown>, slot: string, recovery?: PendingSavedRequest): Promise<RewardSaveResult> => {
    const actor = user?.id
    const active = () => mounted.current && !!actor && currentUser.current === actor
    if (!actor || !active()) return { ok: false, reason: 'session_changed' }
    activeRequests.current++
    setRewardBusy(true)
    try {
      const result = recovery ? await recoverReward(supabase, actor, recovery, active)
        : await saveReward(supabase, actor, kind, input, slot, active)
      if (!active()) return { ok: false, reason: 'session_changed' }
      if (result.ok && adoptReward(result)) {
        setRewardError(null)
        if (kind === 'task') void loadCompletions()
        return result
      }
      const failed = result.ok ? { ok: false, reason: 'connection' } : result
      if (kind !== 'road' && failed.reason !== 'nothing_pending') setRewardError(rewardSaveError(failed.reason))
      return failed
    } catch {
      if (active() && kind !== 'road') setRewardError(rewardSaveError('connection'))
      return { ok: false, reason: 'connection' }
    } finally {
      activeRequests.current--
      if (mounted.current) {
        setRewardBusy(activeRequests.current > 0)
        setPendingRewards(currentUser.current ? pendingRewardSaves(currentUser.current).filter(request => request.args.p_kind !== 'road').length : 0)
      }
    }
  }, [user?.id, adoptReward, loadCompletions]) // eslint-disable-line react-hooks/exhaustive-deps

  const addCoins = useCallback(async (amount: number): Promise<boolean> => {
    if (!Number.isSafeInteger(amount) || amount < 0) return false
    if (amount === 0) return true
    return (await performReward('wallet', { amount }, `wallet:${crypto.randomUUID()}`)).ok
  }, [performReward])
  const spendCoins = useCallback(async (amount: number): Promise<boolean> => {
    if (!Number.isSafeInteger(amount) || amount < 0) return false
    if (amount === 0) return true
    return (await performReward('wallet', { amount: -amount }, `wallet:${crypto.randomUUID()}`)).ok
  }, [performReward])

  const completeTask = useCallback(async (taskId: TaskId) => {
    if (!user?.id || !TASK_DEFS.some(task => task.id === taskId)) return null
    const { input, slot } = taskRewardInput(taskId)
    const period = TASK_DEFS.find(task => task.id === taskId)!.period
    const key = `${taskId}:${period === 'daily' ? getDailyKey() : getWeeklyKey()}`
    if (completedRef.current.has(key) && !pendingRewardSaves(user.id).some(request => request.slot === slot)) return null
    const result = await performReward('task', input, slot)
    const completed = result.ok ? result.outcome?.tasks.find(task => task.id === taskId) : null
    return completed ? { coins: completed.coins, xp: completed.xp, levelUp: !!result.outcome?.levelUp } : null
  }, [user?.id, performReward])

  const checkAchievementsFor = useCallback(async (trigger: AchievementTrigger, _extra?: Partial<AchievementContext>) => {
    const { input, slot } = achievementRewardInput(trigger)
    await performReward('achievement', input, slot)
  }, [performReward])

  const repairStreak = useCallback(async (): Promise<boolean> =>
    (await performReward('repair', rewardDay(), 'repair')).ok, [performReward])

  const claimLevelRewards = useCallback((target: number, householdId: string) =>
    performReward('road', { target, householdId }, `road:${householdId}`), [performReward])

  const retryRewards = useCallback(async () => {
    if (!user?.id || currentUser.current !== user.id) return
    setRewardError(null)
    for (const request of pendingRewardSaves(user.id).filter(request => request.args.p_kind !== 'road')) {
      await performReward(request.args.p_kind as RewardKind, request.args.p_input as Record<string, unknown>, request.slot, request)
    }
    if (loadFailedRef.current) await loadCompletions()
  }, [user?.id, performReward, loadCompletions])

  useEffect(() => {
    if (!user?.id) return
    setPendingRewards(pendingRewardSaves(user.id).filter(request => request.args.p_kind !== 'road').length)
    void retryRewards()
    return onForeground(() => { void retryRewards() })
  }, [user?.id, retryRewards])
  useEffect(() => { if (user?.id && !loading) void checkAchievementsFor('mount') }, [user?.id, loading, checkAchievementsFor])

  useEffect(() => {
    if (!user?.id) return
    const onNudge = () => { void completeTask('daily_nudge'); void checkAchievementsFor('nudge') }
    window.addEventListener('eren:nudge-sent', onNudge)
    return () => window.removeEventListener('eren:nudge-sent', onNudge)
  }, [user?.id, completeTask, checkAchievementsFor])

  useEffect(() => {
    if (!user?.id || !profile?.household_id) return
    const onMyAction = (event: Event) => {
      const detail = (event as CustomEvent<{ household_id?: string; user_id?: string; action_type?: string }>).detail
      if (!detail?.action_type) return
      fetch('/api/notify-action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        household_id: detail.household_id ?? profile.household_id, sender_id: detail.user_id ?? user.id,
        sender_name: profile.name ?? '', action_type: detail.action_type,
      }) }).catch(() => {})
    }
    window.addEventListener('eren:my-action', onMyAction)
    return () => window.removeEventListener('eren:my-action', onMyAction)
  }, [user?.id, profile?.household_id, profile?.name])

  useEffect(() => {
    if (!user?.id || !profile?.household_id) return
    const onMilestone = (event: Event) => {
      const detail = (event as CustomEvent<{ milestones?: number[] }>).detail
      if (!detail?.milestones?.length) return
      fetch('/api/notify-streak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        household_id: profile.household_id, sender_id: user.id, sender_name: profile.name ?? '', milestone: Math.max(...detail.milestones),
      }) }).catch(() => {})
    }
    window.addEventListener('eren:streak-milestone', onMilestone)
    return () => window.removeEventListener('eren:streak-milestone', onMilestone)
  }, [user?.id, profile?.household_id, profile?.name])

  useEffect(() => {
    if (!user?.id) return
    const credit = (event: Event) => {
      const amount = (event as CustomEvent<{ coins?: number }>).detail?.coins ?? 0
      if (amount > 0) void addCoins(amount)
    }
    const events = ['eren:weekly-payout', 'eren:comeback-payout', 'eren:games-payout', 'eren:coop-payout']
    events.forEach(name => window.addEventListener(name, credit))
    return () => events.forEach(name => window.removeEventListener(name, credit))
  }, [user?.id, addCoins])

  return <TaskContext.Provider value={{
    completedIds, taskProgress, completeTask, addCoins, spendCoins, coins, xp, level, loading, streak, achievements, checkAchievementsFor,
    streakRepairAvailable: canRepairStreak(streak, rewardDay().day) && coins >= STREAK_REPAIR_COST,
    streakRepairCost: STREAK_REPAIR_COST, repairStreak, claimLevelRewards, rewardError, pendingRewards, rewardBusy, retryRewards,
  }}>{children}</TaskContext.Provider>
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTasks must be used inside TaskProvider')
  return ctx
}
