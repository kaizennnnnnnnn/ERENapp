'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ErenStats, FoodInventory } from '@/types'
import { computeErenMood, clampStat, shouldBecomeSick } from '@/lib/utils'
import { ACTION_CONFIGS, type ActionType } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════
// Decay is applied CLIENT-SIDE on fetch + action + periodic tick, keyed off
// last_decay_at in the DB. Every path that writes to eren_stats refreshes
// last_decay_at to NOW, so decay is never double-applied across tabs/sessions.
// The /api/decay server endpoint still runs the same math for push
// notifications; it's pinged on mount but we no longer depend on it for the
// stat values the user sees.
// ═══════════════════════════════════════════════════════════════════════════

const DECAY_PER_HOUR = {
  hunger:        -10,
  happiness:     -7,
  energy:        -8,
  sleep_quality: -7,
  cleanliness:   -4,
}
const DECAY_CAP_HOURS = 12 // cap per run — a 3-day absence shouldn't instantly zero stats
const DECAY_MIN_SAVE_HOURS = 0.05 // ~3 min — below this, don't bother writing to DB

type DecayResult = {
  happiness: number
  hunger: number
  energy: number
  sleep_quality: number
  cleanliness: number
  hours: number
}

function computeDecay(stats: ErenStats | null): DecayResult | null {
  if (!stats || !stats.last_decay_at) return null
  const lastDecay = new Date(stats.last_decay_at)
  const rawHours = (Date.now() - lastDecay.getTime()) / 3600000
  if (!Number.isFinite(rawHours) || rawHours <= 0) return null
  const hours = Math.min(DECAY_CAP_HOURS, rawHours)
  return {
    happiness:     clampStat(stats.happiness    + DECAY_PER_HOUR.happiness    * hours),
    hunger:        clampStat(stats.hunger       + DECAY_PER_HOUR.hunger       * hours),
    energy:        clampStat(stats.energy       + DECAY_PER_HOUR.energy       * hours),
    sleep_quality: clampStat(stats.sleep_quality + DECAY_PER_HOUR.sleep_quality * hours),
    cleanliness:   clampStat((stats.cleanliness ?? 100) + DECAY_PER_HOUR.cleanliness * hours),
    hours,
  }
}

// Fire-and-forget ping to /api/decay so push notifications still fire.
let _decaySchedulerStarted = false
let _lastDecayPing = 0
function pingDecay() {
  const now = Date.now()
  if (now - _lastDecayPing < 10 * 60 * 1000) return
  _lastDecayPing = now
  fetch('/api/decay', { method: 'GET', cache: 'no-store' }).catch(() => {})
}
function startDecayScheduler() {
  if (typeof window === 'undefined' || _decaySchedulerStarted) return
  _decaySchedulerStarted = true
  pingDecay()
  setInterval(pingDecay, 30 * 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pingDecay()
  })
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

    const raw = data as ErenStats

    // Initialize last_decay_at on first load so subsequent ticks have a reference.
    if (!raw.last_decay_at) {
      const now = new Date().toISOString()
      await supabase.from('eren_stats').update({ last_decay_at: now }).eq('household_id', householdId)
      setStats({ ...raw, last_decay_at: now })
      setLoading(false)
      return
    }

    const decay = computeDecay(raw)
    if (!decay || decay.hours < DECAY_MIN_SAVE_HOURS) {
      setStats(raw)
      setLoading(false)
      return
    }

    const decayedMood = computeErenMood({
      happiness: decay.happiness, hunger: decay.hunger, energy: decay.energy,
      sleep_quality: decay.sleep_quality, cleanliness: decay.cleanliness,
    })
    const decayedSick = raw.is_sick || shouldBecomeSick({
      cleanliness: decay.cleanliness, sleep_quality: decay.sleep_quality, weight: raw.weight,
    })

    const decayed: ErenStats = {
      ...raw,
      happiness: Math.round(decay.happiness),
      hunger: Math.round(decay.hunger),
      energy: Math.round(decay.energy),
      sleep_quality: Math.round(decay.sleep_quality),
      cleanliness: Math.round(decay.cleanliness),
      mood: decayedMood,
      is_sick: decayedSick,
      last_decay_at: new Date().toISOString(),
    }
    setStats(decayed)
    setLoading(false)

    // Persist the decayed values + refreshed timestamp.
    supabase.from('eren_stats').update({
      happiness: decayed.happiness,
      hunger: decayed.hunger,
      energy: decayed.energy,
      sleep_quality: decayed.sleep_quality,
      cleanliness: decayed.cleanliness,
      mood: decayed.mood,
      is_sick: decayed.is_sick,
      last_decay_at: decayed.last_decay_at,
      updated_at: new Date().toISOString(),
    }).eq('household_id', householdId)
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchStats() }, [fetchStats])

  // Periodic decay tick while the tab is open + on visibility + server ping.
  useEffect(() => {
    if (!householdId) return
    startDecayScheduler()
    const tick = setInterval(() => { fetchStats() }, 2 * 60 * 1000) // re-decay every 2 min
    const onVis = () => { if (document.visibilityState === 'visible') fetchStats() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [householdId, fetchStats])

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
    // Apply any decay accumulated since the last update, THEN the action delta.
    const decay = computeDecay(stats)
    const base = decay ? { ...stats, ...decay } : stats

    const newH  = Math.round(clampStat(base.happiness    + (cfg.deltas.happiness    ?? 0)))
    const newHu = Math.round(clampStat(base.hunger       + (cfg.deltas.hunger       ?? 0)))
    const newE  = Math.round(clampStat(base.energy       + (cfg.deltas.energy       ?? 0)))
    const newS  = Math.round(clampStat(base.sleep_quality + (cfg.deltas.sleep_quality ?? 0)))
    const newW  = Math.round(Math.max(2, Math.min(10, base.weight + (cfg.deltas.weight ?? 0))) * 100) / 100
    const newCl = clampStat((base.cleanliness ?? 100) + (cfg.deltas.cleanliness ?? 0))
    const newSick = action === 'medicine' ? false : shouldBecomeSick({ cleanliness: newCl, sleep_quality: newS, weight: newW })
    const newMood = computeErenMood({ happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, cleanliness: newCl })
    setStats(prev => prev ? { ...prev, happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, weight: newW, cleanliness: newCl, is_sick: newSick, mood: newMood } : prev)
    const [su] = await Promise.all([
      supabase.from('eren_stats').update({ happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, weight: newW, cleanliness: newCl, is_sick: newSick, mood: newMood, last_decay_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('household_id', householdId),
      supabase.from('interactions').insert({ household_id: householdId, user_id: userId, action_type: action, happiness_delta: cfg.deltas.happiness ?? 0, hunger_delta: cfg.deltas.hunger ?? 0, energy_delta: cfg.deltas.energy ?? 0, sleep_delta: cfg.deltas.sleep_quality ?? 0, weight_delta: cfg.deltas.weight ?? 0 }),
    ])
    if (su.error) { await fetchStats(); return { success: false, message: su.error.message } }
    return { success: true, message: `${cfg.emoji} ${cfg.label} done!` }
  }, [stats, householdId, fetchStats]) // eslint-disable-line react-hooks/exhaustive-deps

  const feedWithFood = useCallback(async (userId: string, hungerD: number, happyD: number, weightD: number): Promise<{ success: boolean; message: string }> => {
    if (!stats || !householdId) return { success: false, message: 'No stats loaded' }
    const decay = computeDecay(stats)
    const base = decay ? { ...stats, ...decay } : stats

    const newH  = Math.round(clampStat(base.happiness + happyD))
    const newHu = Math.round(clampStat(base.hunger    + hungerD))
    const newE  = Math.round(clampStat(base.energy))
    const newS  = Math.round(clampStat(base.sleep_quality))
    const newCl = Math.round(clampStat(base.cleanliness ?? 100))
    const newW  = Math.round(Math.max(2, Math.min(10, base.weight + weightD)) * 100) / 100
    const newMood = computeErenMood({ happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, cleanliness: newCl })
    setStats(prev => prev ? { ...prev, happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, cleanliness: newCl, weight: newW, mood: newMood } : prev)
    const [su, ii] = await Promise.all([
      supabase.from('eren_stats').update({ happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, cleanliness: newCl, weight: newW, mood: newMood, last_decay_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('household_id', householdId),
      supabase.from('interactions').insert({ household_id: householdId, user_id: userId, action_type: 'feed', happiness_delta: happyD, hunger_delta: hungerD, energy_delta: 0, sleep_delta: 0, weight_delta: weightD }),
    ])
    if (su.error || ii.error) { await fetchStats(); return { success: false, message: 'Failed' } }
    return { success: true, message: 'Eren is eating!' }
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
