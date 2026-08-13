'use client'

// ─── useFoodMenu ─────────────────────────────────────────────────────────────
// Today's three foods, their tick state, and the payout when all three land.
//
// The menu itself is computed, never stored — same day + same household always
// gives the same three (see lib/foodMenu), so the only thing worth a DB row is
// what's been FED, which is genuinely new information.
//
// The clock is read after mount, not during render: a day key computed while
// rendering reads UTC on the server and local time on the phone, and would
// hydrate a different three foods than it painted.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FoodKey } from '@/types'
import { useErenStats } from './useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { dailyMenu, menuProgress, MENU_REWARD } from '@/lib/foodMenu'
import { todayKey } from '@/lib/seededRng'
import { onForeground } from '@/lib/onForeground'

export function useFoodMenu(householdId: string | null | undefined) {
  const { stats, claimMenu } = useErenStats(householdId ?? null)
  const { addCoins } = useTasks()

  const [day, setDay] = useState<string | null>(null)
  useEffect(() => {
    const sync = () => setDay(todayKey(new Date()))
    sync()
    // Cheap re-check rather than a midnight timer: the menu only has to roll
    // over by the time someone looks at it, and coming back to the app is when
    // that happens. The interval is the backstop for a tab left open all night.
    const t = setInterval(sync, 60_000)
    const off = onForeground(sync)
    return () => { clearInterval(t); off() }
  }, [])

  const menu = useMemo<FoodKey[]>(
    () => day ? dailyMenu(day, householdId ?? null) : [],
    [day, householdId])

  // Yesterday's row must not tick today's menu — the day has to match.
  const state = stats?.menu_state?.day === day ? stats.menu_state : null
  const done = useMemo(() => state?.done ?? [], [state])
  const progress = useMemo(
    () => menuProgress(menu, done as FoodKey[], []),
    [menu, done])
  const complete = menu.length > 0 && progress.every(Boolean)
  const claimed = Boolean(state?.claimed_at)

  // Payout. `claimMenu` is the gate, not this effect: it re-reads the live row
  // and answers false if the claim already landed, so the partner's device
  // completing the menu at the same moment can't pay twice.
  const [paying, setPaying] = useState(false)
  useEffect(() => {
    if (!day || !complete || claimed || paying) return
    setPaying(true)
    void (async () => {
      const won = await claimMenu(day)
      if (won) await addCoins(MENU_REWARD)
      setPaying(false)
    })()
  }, [day, complete, claimed, paying, claimMenu, addCoins])

  const foodDone = useCallback((k: FoodKey) => done.includes(k), [done])

  return { day, menu, progress, done, complete, claimed, foodDone, reward: MENU_REWARD }
}
