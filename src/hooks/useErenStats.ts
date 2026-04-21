'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ErenStats, FoodInventory } from '@/types'
import { computeErenMood, clampStat, shouldBecomeSick } from '@/lib/utils'
import { ACTION_CONFIGS, type ActionType } from '@/types'

const DECAY_PER_HOUR = {
  hunger:        -11,
  happiness:     -7,
  energy:        -8,
  sleep_quality: -7,
  cleanliness:   -4.5,
}

let _channelCounter = 0

export function useErenStats(householdId: string | null) {
  const supabase = createClient()
  const channelSuffix = useRef(`${++_channelCounter}`)
  const [stats, setStats]     = useState<ErenStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!householdId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('eren_stats').select('*').eq('household_id', householdId).single()
    if (error) { setError(error.message); setLoading(false); return }

    // ── Apply offline decay ──────────────────────────────────────────────
    // Calculate how many hours have passed since last decay and apply it now,
    // so stats go down even when no cron ran.
    const raw = data as ErenStats & { last_decay_at?: string }

    // Use last_decay_at if it exists, otherwise updated_at, cap at 12h to avoid huge jumps
    const lastDecayStr = raw.last_decay_at ?? raw.updated_at
    const hoursElapsed = Math.min(12, (Date.now() - new Date(lastDecayStr).getTime()) / 3_600_000)

    if (hoursElapsed >= 0.25) {
      const ri = (n: number) => Math.round(clampStat(n)) // integer columns
      const rf = (n: number) => Math.round(clampStat(n) * 10) / 10 // numeric columns

      const newHunger      = ri(raw.hunger        + DECAY_PER_HOUR.hunger        * hoursElapsed)
      const newHappiness   = ri(raw.happiness     + DECAY_PER_HOUR.happiness     * hoursElapsed)
      const newEnergy      = ri(raw.energy        + DECAY_PER_HOUR.energy        * hoursElapsed)
      const newSleep       = ri(raw.sleep_quality + DECAY_PER_HOUR.sleep_quality * hoursElapsed)
      const newCleanliness = rf((raw.cleanliness ?? 100) + DECAY_PER_HOUR.cleanliness * hoursElapsed)
      const newIsSick = raw.is_sick ? true : shouldBecomeSick({ cleanliness: newCleanliness, sleep_quality: newSleep, weight: raw.weight ?? 4 })
      const newMood = computeErenMood({ happiness: newHappiness, hunger: newHunger, energy: newEnergy, sleep_quality: newSleep, cleanliness: newCleanliness })

      const decayed: ErenStats = {
        ...raw,
        hunger:        newHunger,
        happiness:     newHappiness,
        energy:        newEnergy,
        sleep_quality: newSleep,
        cleanliness:   newCleanliness,
        is_sick:       newIsSick,
        mood:          newMood,
      }
      setStats(decayed)

      // Save to DB — await so we know if it succeeds
      const { error: saveErr } = await supabase.from('eren_stats').update({
        hunger:        newHunger,
        happiness:     newHappiness,
        energy:        newEnergy,
        sleep_quality: newSleep,
        cleanliness:   newCleanliness,
        is_sick:       newIsSick,
        mood:          newMood,
        last_decay_at: new Date().toISOString(),
        updated_at:    new Date().toISOString(),
      }).eq('household_id', householdId)

      // If save failed (e.g. last_decay_at column missing), log it
      if (saveErr) console.warn('Decay save failed:', saveErr.message)
    } else {
      setStats(raw)
    }

    setLoading(false)
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchStats() }, [fetchStats])

  useEffect(() => {
    if (!householdId) return
    const ch = supabase
      .channel(`eren_stats:${householdId}:${channelSuffix.current}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'eren_stats', filter: `household_id=eq.${householdId}` },
        payload => { setStats(payload.new as ErenStats) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  const applyAction = useCallback(async (userId: string, action: ActionType): Promise<{ success: boolean; message: string }> => {
    if (!stats || !householdId) return { success: false, message: 'No stats loaded' }
    const cfg = ACTION_CONFIGS[action]
    const newH  = Math.round(clampStat(stats.happiness    + (cfg.deltas.happiness    ?? 0)))
    const newHu = Math.round(clampStat(stats.hunger       + (cfg.deltas.hunger       ?? 0)))
    const newE  = Math.round(clampStat(stats.energy       + (cfg.deltas.energy       ?? 0)))
    const newS  = Math.round(clampStat(stats.sleep_quality + (cfg.deltas.sleep_quality ?? 0)))
    const newW  = Math.round(Math.max(2, Math.min(10, stats.weight + (cfg.deltas.weight ?? 0))) * 100) / 100
    const newCl = clampStat((stats.cleanliness ?? 100) + (cfg.deltas.cleanliness ?? 0))
    const newSick = action === 'medicine' ? false : shouldBecomeSick({ cleanliness: newCl, sleep_quality: newS, weight: newW })
    const newMood = computeErenMood({ happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, cleanliness: newCl })
    setStats(prev => prev ? { ...prev, happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, weight: newW, cleanliness: newCl, is_sick: newSick, mood: newMood } : prev)
    const [su] = await Promise.all([
      supabase.from('eren_stats').update({ happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, weight: newW, cleanliness: newCl, is_sick: newSick, mood: newMood, updated_at: new Date().toISOString() }).eq('household_id', householdId),
      supabase.from('interactions').insert({ household_id: householdId, user_id: userId, action_type: action, happiness_delta: cfg.deltas.happiness ?? 0, hunger_delta: cfg.deltas.hunger ?? 0, energy_delta: cfg.deltas.energy ?? 0, sleep_delta: cfg.deltas.sleep_quality ?? 0, weight_delta: cfg.deltas.weight ?? 0 }),
    ])
    if (su.error) { await fetchStats(); return { success: false, message: su.error.message } }
    return { success: true, message: `${cfg.emoji} ${cfg.label} done!` }
  }, [stats, householdId, fetchStats]) // eslint-disable-line react-hooks/exhaustive-deps

  const feedWithFood = useCallback(async (userId: string, hungerD: number, happyD: number, weightD: number): Promise<{ success: boolean; message: string }> => {
    if (!stats || !householdId) return { success: false, message: 'No stats loaded' }
    const newH  = Math.round(clampStat(stats.happiness + happyD))
    const newHu = Math.round(clampStat(stats.hunger    + hungerD))
    const newW  = Math.round(Math.max(2, Math.min(10, stats.weight + weightD)) * 100) / 100
    const newMood = computeErenMood({ happiness: newH, hunger: newHu, energy: stats.energy, sleep_quality: stats.sleep_quality, cleanliness: stats.cleanliness ?? 100 })
    setStats(prev => prev ? { ...prev, happiness: newH, hunger: newHu, weight: newW, mood: newMood } : prev)
    const [su, ii] = await Promise.all([
      supabase.from('eren_stats').update({ happiness: newH, hunger: newHu, weight: newW, mood: newMood, updated_at: new Date().toISOString() }).eq('household_id', householdId),
      supabase.from('interactions').insert({ household_id: householdId, user_id: userId, action_type: 'feed', happiness_delta: happyD, hunger_delta: hungerD, energy_delta: 0, sleep_delta: 0, weight_delta: weightD }),
    ])
    if (su.error || ii.error) { await fetchStats(); return { success: false, message: 'Failed' } }
    return { success: true, message: 'Eren is eating! 😸' }
  }, [stats, householdId, fetchStats]) // eslint-disable-line react-hooks/exhaustive-deps

  const spendCoins = useCallback(async (amount: number): Promise<boolean> => {
    if (!stats || !householdId) return false
    const cur = stats.coins ?? 0
    if (cur < amount) return false
    const next = cur - amount
    setStats(prev => prev ? { ...prev, coins: next } : prev)
    const { error } = await supabase.from('eren_stats').update({ coins: next }).eq('household_id', householdId)
    if (error) { await fetchStats(); return false }
    return true
  }, [stats, householdId, fetchStats]) // eslint-disable-line react-hooks/exhaustive-deps

  const addCoins = useCallback(async (amount: number): Promise<void> => {
    if (!stats || !householdId) return
    const next = (stats.coins ?? 0) + amount
    setStats(prev => prev ? { ...prev, coins: next } : prev)
    await supabase.from('eren_stats').update({ coins: next }).eq('household_id', householdId)
  }, [stats, householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveFoodInventory = useCallback(async (inv: FoodInventory): Promise<void> => {
    if (!householdId) return
    setStats(prev => prev ? { ...prev, food_inventory: inv } : prev)
    await supabase.from('eren_stats').update({ food_inventory: inv }).eq('household_id', householdId)
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { stats, loading, error, applyAction, feedWithFood, spendCoins, addCoins, saveFoodInventory, refetch: fetchStats }
}
