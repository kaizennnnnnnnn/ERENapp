'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TASK_DEFS, getDailyKey, getWeeklyKey, xpForNextLevel } from '@/lib/tasks'
import type { TaskId, TaskCompletion } from '@/types'
import { useAuth } from '@/hooks/useAuth'

interface TaskContextValue {
  completedIds: Set<string>        // "taskId:periodKey"
  completeTask: (taskId: TaskId) => Promise<{ coins: number; xp: number; levelUp: boolean } | null>
  xp: number
  level: number
  loading: boolean
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { user, profile } = useAuth()

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [loading, setLoading] = useState(true)

  // Load completions for today + this week
  useEffect(() => {
    if (!user?.id) return
    const dailyKey  = getDailyKey()
    const weeklyKey = getWeeklyKey()

    async function load() {
      const { data } = await supabase
        .from('user_task_completions')
        .select('task_id, period_key')
        .eq('user_id', user!.id)
        .in('period_key', [dailyKey, weeklyKey])

      if (data) {
        setCompletedIds(new Set(data.map((c: { task_id: string; period_key: string }) => `${c.task_id}:${c.period_key}`)))
      }
      setLoading(false)
    }
    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync XP + level from profile
  useEffect(() => {
    if (profile) {
      setXp(profile.xp ?? 0)
      setLevel(profile.level ?? 1)
    }
  }, [profile?.xp, profile?.level]) // eslint-disable-line react-hooks/exhaustive-deps

  const completeTask = useCallback(async (taskId: TaskId): Promise<{ coins: number; xp: number; levelUp: boolean } | null> => {
    if (!user?.id || !profile?.household_id) return null

    const def = TASK_DEFS.find(t => t.id === taskId)
    if (!def) return null

    const periodKey = def.period === 'daily' ? getDailyKey() : getWeeklyKey()
    const key = `${taskId}:${periodKey}`

    // Already done
    if (completedIds.has(key)) return null

    // 1. Insert completion
    const { error: insertError } = await supabase
      .from('user_task_completions')
      .insert({ user_id: user.id, task_id: taskId, period_key: periodKey, coins_earned: def.coins, xp_earned: def.xp })
      .select()
      .single()

    if (insertError) return null

    // 2. Add coins to eren_stats
    const { data: statsData } = await supabase
      .from('eren_stats')
      .select('coins')
      .eq('household_id', profile.household_id)
      .single()

    if (statsData) {
      await supabase
        .from('eren_stats')
        .update({ coins: (statsData.coins ?? 0) + def.coins })
        .eq('household_id', profile.household_id)
    }

    // 3. Award XP + check level up
    const newXp = xp + def.xp
    let newLevel = level
    let levelUp = false

    while (newXp >= xpForNextLevel(newLevel) + (newLevel === 1 ? 0 : newXp - def.xp >= xpForNextLevel(newLevel - 1) ? 0 : 0)) {
      // Simple check: accumulated XP within current level
      const xpInLevel = newXp - ((newLevel * (newLevel - 1)) / 2 * 100)
      if (xpInLevel >= xpForNextLevel(newLevel)) {
        newLevel++
        levelUp = true
      } else {
        break
      }
    }

    await supabase
      .from('profiles')
      .update({ xp: newXp, level: newLevel })
      .eq('id', user.id)

    setXp(newXp)
    setLevel(newLevel)
    setCompletedIds(prev => { const next = new Set(prev); next.add(key); return next })

    return { coins: def.coins, xp: def.xp, levelUp }
  }, [user?.id, profile?.household_id, completedIds, xp, level]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TaskContext.Provider value={{ completedIds, completeTask, xp, level, loading }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTasks must be used inside TaskProvider')
  return ctx
}
