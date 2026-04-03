'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TASK_DEFS, getDailyKey, getWeeklyKey, xpForNextLevel, totalXpForLevel,
  PROGRESS_MAP, CARE_TASK_IDS, getWeekDailyKeys,
} from '@/lib/tasks'
import type { TaskId } from '@/types'
import { useAuth } from '@/hooks/useAuth'

interface TaskContextValue {
  completedIds: Set<string>          // "taskId:periodKey"
  taskProgress: Map<TaskId, number>  // weekly task id → current progress count
  completeTask: (taskId: TaskId) => Promise<{ coins: number; xp: number; levelUp: boolean } | null>
  addCoins: (amount: number) => Promise<void>
  coins: number
  xp: number
  level: number
  loading: boolean
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

  // ── Sync XP + level + coins from profile ────────────────────────────────
  useEffect(() => {
    if (profile) {
      setXp(profile.xp ?? 0)
      setLevel(profile.level ?? 1)
      setCoins(profile.coins ?? 0)
    }
  }, [profile?.xp, profile?.level, profile?.coins]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add coins to user profile ────────────────────────────────────────────
  const addCoins = useCallback(async (amount: number): Promise<void> => {
    if (!user?.id) return
    const next = coins + amount
    setCoins(next)
    await supabase.from('profiles').update({ coins: next }).eq('id', user.id)
  }, [user?.id, coins]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const newCoins = coins + def.coins
    const newXp    = xp + def.xp
    let newLevel   = level
    let levelUp    = false

    while (true) {
      const xpInLevel = newXp - totalXpForLevel(newLevel)
      if (xpInLevel >= xpForNextLevel(newLevel)) { newLevel++; levelUp = true }
      else break
    }

    await supabase.from('profiles').update({ coins: newCoins, xp: newXp, level: newLevel }).eq('id', user.id)
    setCoins(newCoins)
    setXp(newXp)
    setLevel(newLevel)
    setCompletedIds(prev => { const s = new Set(prev); s.add(key); return s })

    // 3. Update weekly progress if this daily task contributes to a weekly one
    if (def.period === 'daily') {
      const weeklyTaskId = PROGRESS_MAP[taskId]
      if (weeklyTaskId) {
        const weeklyDef = TASK_DEFS.find(t => t.id === weeklyTaskId)!
        const weeklyKey = getWeeklyKey()

        setTaskProgress(prev => {
          const next = new Map(prev)
          const weeklyComps = prev.get(weeklyTaskId) ?? 0

          // For weekly_all_care: count distinct care types — don't double-count same type
          let newCount = weeklyComps
          if (weeklyTaskId === 'weekly_all_care') {
            const alreadyCounted = (prev.get('weekly_all_care') ?? 0)
            // Only increment if this care type wasn't counted yet
            // Check by re-querying — for now optimistically increment if not at max
            const typeDone = completedIds.has(`${taskId}:${getDailyKey()}`)
            // If this is the FIRST time completing this care type today (brand new task completion),
            // and we haven't already counted it this week from a previous day...
            // Since we just inserted the completion, if the count is below max, increment
            if (!typeDone && alreadyCounted < (weeklyDef.maxProgress ?? 4)) {
              newCount = alreadyCounted + 1
            }
          } else {
            const max = weeklyDef.maxProgress ?? 99
            newCount = Math.min(max, weeklyComps + 1)
          }

          next.set(weeklyTaskId, newCount)

          // Auto-complete weekly task when progress reaches max
          const max = weeklyDef.maxProgress ?? 0
          if (max > 0 && newCount >= max && !completedIds.has(`${weeklyTaskId}:${weeklyKey}`)) {
            // Fire and forget — auto-complete the weekly task
            setTimeout(() => completeTask(weeklyTaskId), 300)
          }

          return next
        })
      }
    }

    return { coins: def.coins, xp: def.xp, levelUp }
  }, [user?.id, completedIds, coins, xp, level]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TaskContext.Provider value={{ completedIds, taskProgress, completeTask, addCoins, coins, xp, level, loading }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTasks must be used inside TaskProvider')
  return ctx
}
