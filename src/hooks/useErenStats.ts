'use client'

import { useEffect, useState, useCallback, useRef, createContext, useContext, createElement, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
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

// Daily-battle gate: an action only counts toward the per-day
// scoreboard / floating bar when the relevant stat is BELOW this
// value (or, for medicine, when Eren is actually sick). Feeding at
// 92 / washing at 95 still inserts the row for history, but
// `useful: false` keeps the partner-competition meter from being
// gamed by spamming maxed stats.
const USEFUL_THRESHOLD = 90

function isUsefulAction(action: ActionType, before: ErenStats): boolean {
  switch (action) {
    case 'feed':     return before.hunger        < USEFUL_THRESHOLD
    case 'play':     return before.happiness     < USEFUL_THRESHOLD
    case 'sleep':    return before.energy        < USEFUL_THRESHOLD
    case 'wash':     return (before.cleanliness ?? 100) < USEFUL_THRESHOLD
    case 'medicine': return !!before.is_sick
    default:         return true
  }
}

// Detect once whether the interactions.useful column exists, then
// cache the answer in localStorage for 24h. Without this every care
// action would 400 on its first insert attempt (then retry without
// the column and succeed) — the retry works, but the failed first
// attempt still shows up as a red 400 in the browser console. The
// probe runs at most once per day per device.
const USEFUL_CACHE_KEY = 'eren_useful_col_supported'
const USEFUL_CACHE_TTL_MS = 24 * 60 * 60 * 1000

let _usefulSupported: boolean | undefined
let _usefulProbe: Promise<boolean> | null = null

function readUsefulCache(): boolean | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(USEFUL_CACHE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { v: boolean; t: number }
    if (Date.now() - parsed.t > USEFUL_CACHE_TTL_MS) return undefined
    return parsed.v
  } catch { return undefined }
}
function writeUsefulCache(v: boolean) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(USEFUL_CACHE_KEY, JSON.stringify({ v, t: Date.now() }))
  } catch { /* ignore */ }
}
async function detectUsefulSupported(
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  if (_usefulSupported !== undefined) return _usefulSupported
  const cached = readUsefulCache()
  if (cached !== undefined) { _usefulSupported = cached; return cached }
  if (_usefulProbe) return _usefulProbe
  // Sample a single interactions row with select('*') and check
  // whether `useful` is a key on it. select('*') never 400s on a
  // missing column (it just returns the columns that DO exist), so
  // this probe is silent in the network panel. If the household has
  // no rows yet we conservatively report unsupported and let the
  // 24h cache expire — the migration will be picked up on the next
  // probe once any row exists.
  _usefulProbe = (async () => {
    const { data, error } = await supabase
      .from('interactions')
      .select('*')
      .limit(1)
    const supported = !error && !!data && data.length > 0 && 'useful' in (data[0] as Record<string, unknown>)
    _usefulSupported = supported
    writeUsefulCache(supported)
    return supported
  })()
  return _usefulProbe
}

// Insert into interactions. Strips `useful` upfront when the column
// isn't supported (detected once per session) so the network tab
// stays clean instead of logging a 400 on every care action.
async function insertInteraction(
  supabase: ReturnType<typeof createClient>,
  data: Record<string, unknown>,
): Promise<void> {
  const supported = await detectUsefulSupported(supabase)
  let inserted = false
  if (supported) {
    const r = await supabase.from('interactions').insert(data)
    if (!r.error) inserted = true
    // Safety net: schema cache may have lied. Strip and retry.
    else if (r.error.message?.toLowerCase().includes('useful')) {
      _usefulSupported = false
      writeUsefulCache(false)
    } else {
      return
    }
  }
  if (!inserted) {
    const { useful: _omit, ...rest } = data
    void _omit
    const r = await supabase.from('interactions').insert(rest)
    if (r.error) return
  }
  // Notify the rest of the app a care action just landed — TaskContext
  // turns this into a server push so the closed-PWA partner still hears it.
  try {
    window.dispatchEvent(new CustomEvent('eren:my-action', { detail: {
      household_id: data.household_id,
      user_id: data.user_id,
      action_type: data.action_type,
    } }))
  } catch { /* SSR/no-window */ }
}
const DECAY_CAP_HOURS = 12 // cap per run — a 3-day absence shouldn't instantly zero stats
const DECAY_MIN_SAVE_HOURS = 0.05 // ~3 min — below this, don't bother writing to DB

// Client-initiated push ping. Only fires when the app is in the background
// (document.visibilityState !== 'visible'), so users with the app open in
// the foreground don't get a system toast for stats they already see on
// screen. /api/notify-stats applies the same 2h per-tag cooldown that the
// server cron uses, so this is safe to call freely.
function maybeFireBackgroundPush(householdId: string) {
  if (typeof document === 'undefined') return
  if (document.visibilityState === 'visible') return
  fetch('/api/notify-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ household_id: householdId }),
    cache: 'no-store',
  }).catch(() => {})
}

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

// Cached across scene swipes: every new scene mounts a fresh useErenStats
// instance and refetches, leaving `stats` null for ~200 ms. Scenes read this
// cache synchronously on mount so Eren doesn't flash or pop in. Kept in
// module scope (persists for the tab session); refreshed whenever any hook
// instance receives a stats update.
let _cachedIsSleeping: boolean | null = null
export function getCachedIsSleeping(): boolean | null { return _cachedIsSleeping }

// Internal implementation. Lives in module scope; ONLY the provider below
// instantiates it, so every consumer of useErenStats() across the app
// shares a single decay loop + a single realtime channel. The hook export
// at the bottom of this file is a context reader — calling useErenStats()
// in StatsHeader, FeedScene, every game page, etc. used to open its own
// channel (3-5 duplicate eren_stats subscribers per page, blowing through
// the Supabase Disk IO budget). Now they all read from the provider.
function useErenStatsImpl(householdId: string | null) {
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

    // If the client just decayed across a threshold while the tab is in
    // the background, ping the server so it can fire a push (cooldown-
    // throttled). When the tab is visible we skip — user is looking at
    // the bars dropping in real time, no push needed.
    maybeFireBackgroundPush(householdId)
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchStats() }, [fetchStats])

  // Keep the shared sleeping cache in sync with this hook's stats.
  useEffect(() => {
    if (stats?.is_sleeping !== undefined && stats.is_sleeping !== null) {
      _cachedIsSleeping = stats.is_sleeping
    }
  }, [stats?.is_sleeping])

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
        payload => {
          const newRow = payload.new as ErenStats
          setStats(prev => {
            if (!prev) return newRow
            // Realtime broadcasts the ENTIRE row on every update, including
            // columns that weren't actually changed. A buy/gift only writes
            // `food_by_user`, but the broadcast still carries pre-decay
            // happiness/hunger/etc. from whatever snapshot the DB currently
            // holds — which may be older than what we already decayed
            // locally. Blindly replacing stats would visually re-fill the
            // bars until the next real decay/feed write catches up.
            //
            // Stat-touching writes (feed/play/wash/sleep/medicine and the
            // decay tick) always bump last_decay_at forward. So we accept
            // the full row only when its last_decay_at is strictly newer
            // than ours; otherwise we keep our stat values and merge in
            // just the non-stat columns the write actually changed.
            const newDecay = new Date(newRow.last_decay_at ?? 0).getTime()
            const oldDecay = new Date(prev.last_decay_at ?? 0).getTime()
            if (newDecay > oldDecay) return newRow
            return {
              ...prev,
              food_by_user:   newRow.food_by_user,
              food_inventory: newRow.food_inventory,
              coins:          newRow.coins,
              is_sleeping:    newRow.is_sleeping,
              is_sick:        newRow.is_sick,
              mood:           newRow.mood,
              weight:         newRow.weight,
            }
          })
        })
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
    const sleepingFlag = action === 'sleep' ? true : base.is_sleeping
    setStats(prev => prev ? { ...prev, happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, weight: newW, cleanliness: newCl, is_sick: newSick, mood: newMood, is_sleeping: sleepingFlag } : prev)
    const useful = isUsefulAction(action, base)
    const [su] = await Promise.all([
      supabase.from('eren_stats').update({ happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, weight: newW, cleanliness: newCl, is_sick: newSick, mood: newMood, is_sleeping: sleepingFlag, last_decay_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('household_id', householdId),
      insertInteraction(supabase, { household_id: householdId, user_id: userId, action_type: action, happiness_delta: cfg.deltas.happiness ?? 0, hunger_delta: cfg.deltas.hunger ?? 0, energy_delta: cfg.deltas.energy ?? 0, sleep_delta: cfg.deltas.sleep_quality ?? 0, weight_delta: cfg.deltas.weight ?? 0, useful }),
    ])
    if (su.error) { await fetchStats(); return { success: false, message: su.error.message } }
    return { success: true, message: `${cfg.emoji} ${cfg.label} done!` }
  }, [stats, householdId, fetchStats]) // eslint-disable-line react-hooks/exhaustive-deps

  const wakeUp = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!stats || !householdId) return { success: false, message: 'No stats loaded' }
    setStats(prev => prev ? { ...prev, is_sleeping: false } : prev)
    const { error } = await supabase.from('eren_stats').update({ is_sleeping: false, updated_at: new Date().toISOString() }).eq('household_id', householdId)
    if (error) { await fetchStats(); return { success: false, message: error.message } }
    return { success: true, message: 'Eren is awake!' }
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
    // Feeding only counts toward the daily battle when Eren is
    // actually hungry — at 90+ he's full and the action is wasted.
    const useful = base.hunger < USEFUL_THRESHOLD
    const [su] = await Promise.all([
      supabase.from('eren_stats').update({ happiness: newH, hunger: newHu, energy: newE, sleep_quality: newS, cleanliness: newCl, weight: newW, mood: newMood, last_decay_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('household_id', householdId),
      insertInteraction(supabase, { household_id: householdId, user_id: userId, action_type: 'feed', happiness_delta: happyD, hunger_delta: hungerD, energy_delta: 0, sleep_delta: 0, weight_delta: weightD, useful }),
    ])
    if (su.error) { await fetchStats(); return { success: false, message: 'Failed' } }
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

  // ── Per-user fridge helpers ─────────────────────────────────────────────
  // The shared `food_inventory` column stays as a legacy pool either user can
  // still draw from. `food_by_user` holds per-user piles keyed by user id.
  const saveFoodByUser = useCallback(async (next: Record<string, FoodInventory>): Promise<void> => {
    if (!householdId) return
    setStats(prev => prev ? { ...prev, food_by_user: next } : prev)
    await supabase.from('eren_stats').update({ food_by_user: next }).eq('household_id', householdId)
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Adds 1 of `key` to the buyer's personal pile.
  const addToMyFood = useCallback(async (userId: string, key: keyof FoodInventory): Promise<void> => {
    if (!stats) return
    const byUser = { ...(stats.food_by_user ?? {}) }
    const mine = { ...(byUser[userId] ?? {}) }
    mine[key] = (mine[key] ?? 0) + 1
    byUser[userId] = mine
    await saveFoodByUser(byUser)
  }, [stats, saveFoodByUser])

  // Consumes 1 of `key` for feeding. Tries the user's personal pile first;
  // falls back to the shared legacy pool. Returns true if anything was
  // consumed.
  const consumeMyFood = useCallback(async (userId: string, key: keyof FoodInventory): Promise<boolean> => {
    if (!stats) return false
    const byUser = { ...(stats.food_by_user ?? {}) }
    const mine = { ...(byUser[userId] ?? {}) }
    if ((mine[key] ?? 0) > 0) {
      mine[key] = (mine[key] ?? 0) - 1
      byUser[userId] = mine
      await saveFoodByUser(byUser)
      return true
    }
    // Legacy shared pool fallback
    const shared = { ...(stats.food_inventory ?? {}) }
    if ((shared[key] ?? 0) > 0) {
      shared[key] = (shared[key] ?? 0) - 1
      await saveFoodInventory(shared)
      return true
    }
    return false
  }, [stats, saveFoodByUser, saveFoodInventory])

  // Moves 1 of `key` from sender's pile to recipient's pile. Returns true on
  // success (sender had stock), false otherwise.
  const giftFood = useCallback(async (
    fromUserId: string,
    toUserId: string,
    key: keyof FoodInventory,
  ): Promise<boolean> => {
    if (!stats) return false
    const byUser = { ...(stats.food_by_user ?? {}) }
    const sender = { ...(byUser[fromUserId] ?? {}) }
    if ((sender[key] ?? 0) <= 0) return false
    sender[key] = (sender[key] ?? 0) - 1
    const recipient = { ...(byUser[toUserId] ?? {}) }
    recipient[key] = (recipient[key] ?? 0) + 1
    byUser[fromUserId] = sender
    byUser[toUserId] = recipient
    await saveFoodByUser(byUser)
    return true
  }, [stats, saveFoodByUser])

  return {
    stats, loading, error, applyAction, feedWithFood,
    spendCoins, addCoins, saveFoodInventory,
    addToMyFood, consumeMyFood, giftFood,
    wakeUp, refetch: fetchStats,
  }
}

type ErenStatsApi = ReturnType<typeof useErenStatsImpl>

const ErenStatsContext = createContext<ErenStatsApi | null>(null)

// Singleton provider — mounted once at (app)/layout.tsx. Owns the only
// realtime channel and the only decay tick for the eren_stats row.
export function ErenStatsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const value = useErenStatsImpl(profile?.household_id ?? null)
  return createElement(ErenStatsContext.Provider, { value }, children)
}

// Public hook. Same shape every consumer already uses — the householdId arg
// is ignored (the provider derives it from auth) and kept for call-site
// compatibility. Throws when used outside the provider so a missing wrap
// surfaces loudly instead of silently re-opening a per-consumer channel.
export function useErenStats(_householdId?: string | null): ErenStatsApi {
  const ctx = useContext(ErenStatsContext)
  if (!ctx) throw new Error('useErenStats must be used inside <ErenStatsProvider>')
  return ctx
}
