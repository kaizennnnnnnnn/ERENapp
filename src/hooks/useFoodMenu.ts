'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FoodKey } from '@/types'
import { useErenStats } from './useErenStats'
import { useAuth, PROFILE_UPDATED_EVENT, type ProfileUpdatedDetail } from './useAuth'
import { createClient } from '@/lib/supabase/client'
import { dailyMenu, menuProgress, MENU_REWARD } from '@/lib/foodMenu'
import { todayKey } from '@/lib/seededRng'
import { onForeground } from '@/lib/onForeground'
import { saveMenu, hasPendingMenu, menuSaveError } from '@/lib/menuSaves'

export function useFoodMenu(householdId: string | null | undefined) {
  const { stats, acceptMenuState } = useErenStats(householdId ?? null)
  const { user } = useAuth()
  const supabase = createClient()
  const [day, setDay] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  const lock = useRef<symbol | null>(null)
  const rerun = useRef(false)
  const refreshRef = useRef<() => Promise<boolean>>(async () => false)
  const errorRef = useRef(error)
  errorRef.current = error
  const scope = useRef({ userId: user?.id, householdId, day })
  scope.current = { userId: user?.id, householdId, day }
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const refresh = useCallback(async () => {
    const actor = user?.id
    if (!actor || !householdId || !day || !alive.current || lock.current
      || scope.current.userId !== actor || scope.current.householdId !== householdId || scope.current.day !== day) return false
    const token = Symbol('menu')
    lock.current = token
    const active = () => alive.current && scope.current.userId === actor
      && scope.current.householdId === householdId && scope.current.day === day && lock.current === token
    setBusy(true); setError(null)
    try {
      // Finish an older receipt first, then reconcile the currently displayed day.
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await saveMenu(supabase, actor, householdId, day)
        if (!active()) return false
        if (!result.ok) {
          if (attempt === 0 && result.reason === 'period_changed' && result.day !== day) continue
          setError(menuSaveError(result.reason))
          return false
        }
        if (result.user_id !== actor || result.household_id !== householdId || !Number.isSafeInteger(result.coins)
          || !result.menu_state || !Array.isArray(result.menu_state.done)) {
          setError(menuSaveError())
          return false
        }
        window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, {
          detail: { id: actor, patch: { coins: result.coins } },
        }))
        if (result.menu_state.day === day) acceptMenuState(result.menu_state)
        if (result.day !== day && attempt === 0) continue
        return true
      }
      return false
    } catch {
      if (active()) setError(menuSaveError())
      return false
    } finally {
      if (lock.current === token) {
        lock.current = null
        if (alive.current && scope.current.userId === actor && scope.current.householdId === householdId) setBusy(false)
        if (rerun.current && activeScope()) {
          rerun.current = false
          queueMicrotask(() => { void refreshRef.current() })
        }
      }
    }
  }, [user?.id, householdId, day, acceptMenuState]) // eslint-disable-line react-hooks/exhaustive-deps
  refreshRef.current = refresh

  function activeScope() {
    return alive.current && scope.current.userId === user?.id && scope.current.householdId === householdId && scope.current.day === day
  }

  useEffect(() => {
    const sync = () => {
      const currentDay = todayKey(new Date())
      if (currentDay !== day) setDay(currentDay)
      else void refreshRef.current()
    }
    const currentDay = todayKey(new Date())
    if (currentDay !== day) setDay(currentDay)
    const off = onForeground(sync)
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const currentDay = todayKey(new Date())
      if (currentDay !== day) setDay(currentDay)
      else if (errorRef.current || user?.id && householdId && hasPendingMenu(user.id, householdId)) void refreshRef.current()
    }, 60_000)
    return () => { off(); clearInterval(timer) }
  }, [day, user?.id, householdId])

  useEffect(() => {
    lock.current = null
    rerun.current = false
    setBusy(false); setError(null)
  }, [user?.id, householdId, day])

  const foodRevision = useMemo(() => JSON.stringify([stats?.food_by_user, stats?.food_inventory]), [stats?.food_by_user, stats?.food_inventory])
  useEffect(() => {
    if (stats?.household_id !== householdId || !day) return
    if (lock.current) rerun.current = true
    else void refresh()
  }, [user?.id, householdId, day, stats?.household_id, foodRevision]) // eslint-disable-line react-hooks/exhaustive-deps

  const menu = useMemo(() => day ? dailyMenu(day, householdId ?? null) : [], [day, householdId])
  const state = stats && stats.household_id === householdId && stats.menu_state?.day === day ? stats.menu_state : null
  const done = useMemo(() => state?.done ?? [], [state])
  const progress = useMemo(() => menuProgress(menu, done as FoodKey[], []), [menu, done])
  const complete = menu.length > 0 && progress.every(Boolean)
  const claimed = Boolean(state?.claimed_at)
  const foodDone = useCallback((key: FoodKey) => done.includes(key), [done])
  return { day, menu, progress, done, complete, claimed, foodDone, reward: MENU_REWARD, busy, error, refresh }
}
