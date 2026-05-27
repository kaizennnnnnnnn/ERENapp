'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TASK_DEFS, getDailyKey, getWeeklyKey, xpForNextLevel, totalXpForLevel,
  PROGRESS_MAP, CARE_TASK_IDS, getWeekDailyKeys,
} from '@/lib/tasks'
import type { TaskId, StreakData, AchievementMap, ErenStats, GameType } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import {
  updateStreak, STREAK_MILESTONE_COINS,
  checkAchievements, type AchievementContext, type AchievementTrigger, type AchievementDef,
} from '@/lib/achievements'
import { format } from 'date-fns'

interface TaskContextValue {
  completedIds: Set<string>          // "taskId:periodKey"
  taskProgress: Map<TaskId, number>  // weekly task id → current progress count
  completeTask: (taskId: TaskId) => Promise<{ coins: number; xp: number; levelUp: boolean } | null>
  addCoins: (amount: number) => Promise<void>
  spendCoins: (amount: number) => Promise<boolean>
  coins: number
  xp: number
  level: number
  loading: boolean
  streak: StreakData
  achievements: AchievementMap
  checkAchievementsFor: (trigger: AchievementTrigger, extra?: Partial<AchievementContext>) => Promise<void>
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { user, profile } = useAuth()

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [taskProgress, setTaskProgress] = useState<Map<TaskId, number>>(new Map())
  const [xp, setXp]       = useState(0)
  const [level, setLevel] = useState(1)
  const [coins, setCoins] = useState(0)
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState<StreakData>({ current: 0, best: 0, lastDate: null })
  const [achievements, setAchievements] = useState<AchievementMap>({})

  // ── Load completions + compute weekly progress ──────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const dailyKey  = getDailyKey()
    const weeklyKey = getWeeklyKey()
    const weekDayKeys = getWeekDailyKeys()

    async function load() {
      // Fetch today + this week's daily keys + weekly key
      const allKeys = Array.from(new Set([dailyKey, weeklyKey, ...weekDayKeys]))
      const { data } = await supabase
        .from('user_task_completions')
        .select('task_id, period_key')
        .eq('user_id', user!.id)
        .in('period_key', allKeys)

      if (data) {
        // Completed set (for today + weekly)
        setCompletedIds(new Set(
          data
            .filter(c => c.period_key === dailyKey || c.period_key === weeklyKey)
            .map(c => `${c.task_id}:${c.period_key}`)
        ))

        // Weekly progress from all daily completions this week
        const weeklyComps = data.filter(c => weekDayKeys.includes(c.period_key))

        const progress = new Map<TaskId, number>()

        // weekly_all_care: distinct care types done any day this week
        const careDone = new Set(weeklyComps.filter(c => (CARE_TASK_IDS as string[]).includes(c.task_id)).map(c => c.task_id))
        progress.set('weekly_all_care', careDone.size)

        // weekly_mood_5: distinct days with mood logged
        const moodDays = new Set(weeklyComps.filter(c => c.task_id === 'daily_mood').map(c => c.period_key))
        progress.set('weekly_mood_5', moodDays.size)

        // weekly_all_games: total game sessions this week (cap at 3)
        progress.set('weekly_all_games', Math.min(3, weeklyComps.filter(c => c.task_id === 'daily_game').length))

        setTaskProgress(progress)
      }

      setLoading(false)
    }

    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync XP + level + coins + streak + achievements from profile ─────────
  useEffect(() => {
    if (profile) {
      setXp(profile.xp ?? 0)
      setLevel(profile.level ?? 1)
      setCoins(profile.coins ?? 0)
      setStreak(profile.streak ?? { current: 0, best: 0, lastDate: null })
      setAchievements(profile.achievements ?? {})
    }
  }, [profile?.xp, profile?.level, profile?.coins, profile?.streak, profile?.achievements]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Retroactive achievement check on mount ───────────────────────────────
  // Catches achievements the user already qualifies for (e.g. level-based
  // ones for existing high-level users who got the feature after leveling).
  useEffect(() => {
    if (!user?.id || loading || !profile) return
    const currentAch = profile.achievements ?? {}
    const currentStreak = profile.streak ?? { current: 0, best: 0, lastDate: null }
    const ctx: AchievementContext = {
      userId: user.id,
      completedIds,
      stats: null,
      level: profile.level ?? 1,
      streak: currentStreak,
      achievements: { ...currentAch },
    }
    runAchievementCheck('mount', ctx, profile.coins ?? 0).catch(() => {})
  }, [user?.id, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add coins to user profile ────────────────────────────────────────────
  const addCoins = useCallback(async (amount: number): Promise<void> => {
    if (!user?.id) return
    const next = coins + amount
    setCoins(next)
    await supabase.from('profiles').update({ coins: next }).eq('id', user.id)
  }, [user?.id, coins]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Spend coins (returns false if insufficient) ──────────────────────────
  const spendCoins = useCallback(async (amount: number): Promise<boolean> => {
    if (!user?.id || coins < amount) return false
    const next = coins - amount
    setCoins(next)
    const { error } = await supabase.from('profiles').update({ coins: next }).eq('id', user.id)
    if (error) { setCoins(coins); return false }
    return true
  }, [user?.id, coins]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared helper: run achievement checks + persist unlocks ──────────────
  // Mutates ctx.achievements so sequential calls within the same batch see
  // freshly-unlocked IDs and don't double-fire.
  const runAchievementCheck = useCallback(async (
    trigger: AchievementTrigger,
    ctx: AchievementContext,
    currentCoins: number,
  ) => {
    const unlocked = await checkAchievements(trigger, ctx, supabase)
    if (unlocked.length === 0) return currentCoins

    const now = new Date().toISOString()
    let achCoins = 0
    for (const a of unlocked) { ctx.achievements[a.id] = now; achCoins += a.coins }

    setAchievements({ ...ctx.achievements })
    const nextCoins = currentCoins + achCoins
    setCoins(nextCoins)
    await supabase.from('profiles').update({ achievements: ctx.achievements, coins: nextCoins }).eq('id', ctx.userId)

    window.dispatchEvent(new CustomEvent<{ achievements: AchievementDef[] }>('eren:achievement-unlocked', {
      detail: { achievements: unlocked },
    }))
    return nextCoins
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public: trigger achievement check from outside (games, battles) ─────
  const checkAchievementsFor = useCallback(async (
    trigger: AchievementTrigger,
    extra?: Partial<AchievementContext>,
  ) => {
    if (!user?.id) return
    const ctx: AchievementContext = {
      userId: user.id,
      completedIds,
      stats: null,
      level,
      streak,
      achievements,
      ...extra,
    }
    await runAchievementCheck(trigger, ctx, coins)
  }, [user?.id, completedIds, level, streak, achievements, coins, runAchievementCheck])

  // ── Complete a task ──────────────────────────────────────────────────────
  const completeTask = useCallback(async (taskId: TaskId): Promise<{ coins: number; xp: number; levelUp: boolean } | null> => {
    if (!user?.id) return null

    const def = TASK_DEFS.find(t => t.id === taskId)
    if (!def) return null

    const periodKey = def.period === 'daily' ? getDailyKey() : getWeeklyKey()
    const key = `${taskId}:${periodKey}`
    if (completedIds.has(key)) return null

    // 1. Insert completion
    const { error } = await supabase
      .from('user_task_completions')
      .insert({ user_id: user.id, task_id: taskId, period_key: periodKey, coins_earned: def.coins, xp_earned: def.xp })

    if (error) return null

    // 2. Update coins + XP on profile
    let newCoins = coins + def.coins
    const newXp  = xp + def.xp
    let newLevel = level
    let levelUp  = false

    while (true) {
      const xpInLevel = newXp - totalXpForLevel(newLevel)
      if (xpInLevel >= xpForNextLevel(newLevel)) { newLevel++; levelUp = true }
      else break
    }

    // 3. Streak update on first daily task of the day
    let newStreak = streak
    const profilePatch: Record<string, unknown> = { coins: newCoins, xp: newXp, level: newLevel }
    if (def.period === 'daily') {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const result = updateStreak(streak, todayStr)
      if (result.changed) {
        newStreak = result.streak
        setStreak(newStreak)
        profilePatch.streak = newStreak

        let bonusCoins = 0
        for (const m of result.milestonesHit) bonusCoins += STREAK_MILESTONE_COINS[m] ?? 0
        if (bonusCoins > 0) {
          newCoins += bonusCoins
          profilePatch.coins = newCoins
          window.dispatchEvent(new CustomEvent('eren:streak-milestone', {
            detail: { milestones: result.milestonesHit, coins: bonusCoins, streak: newStreak.current },
          }))
        }
      }
    }

    await supabase.from('profiles').update(profilePatch).eq('id', user.id)
    setCoins(newCoins)
    setXp(newXp)
    setLevel(newLevel)
    const nextCompleted = new Set(completedIds)
    nextCompleted.add(key)
    setCompletedIds(nextCompleted)

    // 4. Update weekly progress if this daily task contributes to a weekly one
    if (def.period === 'daily') {
      const weeklyTaskId = PROGRESS_MAP[taskId]
      if (weeklyTaskId) {
        const weeklyDef = TASK_DEFS.find(t => t.id === weeklyTaskId)!
        const weeklyKey = getWeeklyKey()

        setTaskProgress(prev => {
          const next = new Map(prev)
          const weeklyComps = prev.get(weeklyTaskId) ?? 0

          let newCount = weeklyComps
          if (weeklyTaskId === 'weekly_all_care') {
            const alreadyCounted = (prev.get('weekly_all_care') ?? 0)
            const typeDone = completedIds.has(`${taskId}:${getDailyKey()}`)
            if (!typeDone && alreadyCounted < (weeklyDef.maxProgress ?? 4)) {
              newCount = alreadyCounted + 1
            }
          } else {
            const max = weeklyDef.maxProgress ?? 99
            newCount = Math.min(max, weeklyComps + 1)
          }

          next.set(weeklyTaskId, newCount)

          const max = weeklyDef.maxProgress ?? 0
          if (max > 0 && newCount >= max && !completedIds.has(`${weeklyTaskId}:${weeklyKey}`)) {
            setTimeout(() => completeTask(weeklyTaskId), 300)
          }

          return next
        })
      }
    }

    // 5. Achievement checks — collect all triggers, run once sequentially
    const triggers: AchievementTrigger[] = []
    if ((CARE_TASK_IDS as string[]).includes(taskId)) triggers.push('care')
    else if (taskId === 'daily_game') triggers.push('game')
    else if (taskId === 'daily_mood') triggers.push('mood')
    if (newStreak !== streak) triggers.push('streak')
    if (levelUp) triggers.push('level')

    if (triggers.length > 0) {
      ;(async () => {
        let currentAch = { ...achievements }
        let currentCoins = newCoins
        const achCtx: AchievementContext = {
          userId: user.id,
          completedIds: nextCompleted,
          stats: null,
          level: newLevel,
          streak: newStreak,
          achievements: currentAch,
        }
        for (const t of triggers) {
          achCtx.achievements = currentAch
          currentCoins = await runAchievementCheck(t, achCtx, currentCoins)
          currentAch = { ...achCtx.achievements }
        }
      })().catch(() => {})
    }

    return { coins: def.coins, xp: def.xp, levelUp }
  }, [user?.id, completedIds, coins, xp, level, streak, achievements, runAchievementCheck]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TaskContext.Provider value={{ completedIds, taskProgress, completeTask, addCoins, spendCoins, coins, xp, level, loading, streak, achievements, checkAchievementsFor }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTasks must be used inside TaskProvider')
  return ctx
}
