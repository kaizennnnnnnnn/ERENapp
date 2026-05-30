'use client'

// useDailyBattle — fresh-each-day care-action scoreboard between the
// two household members. Same scoring scale as the weekly love meter,
// but the window is "today" (local midnight → now) so every day is a
// short, recoverable race. Used by the home-screen HUD bar, the
// floating action pop-up, and the detail sheet.

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { useCouple } from './useCouple'
import { useErenStats } from './useErenStats'
import type { Interaction, ErenStats } from '@/types'
import { format, subDays } from 'date-fns'
import {
  isComebackEligible, claimComebackBonus,
  COMEBACK_BONUS_COINS, type DailyBattleRow,
} from '@/lib/battleResults'

const USEFUL_THRESHOLD = 90

function isUsefulByStats(action: string, stats: ErenStats | null): boolean {
  if (!stats) return true
  switch (action) {
    case 'feed':     return stats.hunger        < USEFUL_THRESHOLD
    case 'play':     return stats.happiness     < USEFUL_THRESHOLD
    case 'sleep':    return stats.energy        < USEFUL_THRESHOLD
    case 'wash':     return (stats.cleanliness ?? 100) < USEFUL_THRESHOLD
    case 'medicine': return !!stats.is_sick
    default:         return true
  }
}

const ACTION_POINTS: Record<string, number> = {
  feed: 1,
  play: 1,
  sleep: 1,
  wash: 1,
  medicine: 1,
}

export interface DailyActionSignal {
  userId: string
  userName: string
  action: string
  points: number
  ts: number
  isMe: boolean
}

export interface DailyBattleState {
  loading: boolean
  myScore: number
  partnerScore: number
  myName: string
  partnerName: string
  myPct: number
  partnerPct: number
  leader: 'me' | 'partner' | null
  total: number
  totalActions: number
  /** Most recent action — for the pop-up to animate off. */
  lastAction: DailyActionSignal | null
  hasPartner: boolean
  /** True when the partner has had zero interactions in the last 24h — used
   *  to hide the scoreboard HUD so a one-sided 100-0 bar doesn't sit there. */
  partnerDormant: boolean
}

function startOfDay(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

let _channelCounter = 0

export function useDailyBattle(): DailyBattleState {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { partner } = useCouple()
  const { stats } = useErenStats(profile?.household_id ?? null)

  const [myScore, setMyScore]         = useState(0)
  const [partnerScore, setPartnerScore] = useState(0)
  const [totalActions, setTotalActions] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [lastAction, setLastAction]   = useState<DailyActionSignal | null>(null)
  const [partnerDormant, setPartnerDormant] = useState(false)
  // Yesterday's snapshot row used to detect a comeback (loss yesterday +
  // ahead today + bonus not yet claimed). null until the first fetch
  // returns or after the bonus has been claimed.
  const [yesterdayRow, setYesterdayRow] = useState<DailyBattleRow | null>(null)
  // Per-session dedupe — even though the DB CAS guards against double-payout,
  // skip extra round-trips if this tab already fired the attempt.
  const comebackAttemptedRef = useRef(false)

  const channelSuffix = useRef(`db_${++_channelCounter}`)
  const statsRef = useRef(stats)
  statsRef.current = stats

  const fetchToday = useCallback(async () => {
    if (!profile?.household_id || !user?.id) return
    const sinceIso = startOfDay().toISOString()
    // Select * so the query works whether or not the `useful` column
    // has been added by migration_interactions_useful.sql. Filtering
    // useful=false then happens client-side — pre-migration the
    // field is undefined and every row counts, which matches the
    // old behaviour.
    const { data } = await supabase
      .from('interactions')
      .select('*')
      .eq('household_id', profile.household_id)
      .gte('created_at', sinceIso)

    let me = 0, them = 0, count = 0
    for (const i of (data ?? []) as Interaction[]) {
      if (i.useful === false) continue
      const pts = ACTION_POINTS[i.action_type] ?? 1
      if (i.user_id === user.id) me += pts
      else if (i.user_id === partner?.id) them += pts
      count++
    }
    setMyScore(me)
    setPartnerScore(them)
    setTotalActions(count)

    // Dormancy check: any partner interaction in the last 24h?
    if (partner?.id) {
      if (them > 0) {
        setPartnerDormant(false)
      } else {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: recent } = await supabase
          .from('interactions')
          .select('id')
          .eq('user_id', partner.id)
          .gte('created_at', dayAgo)
          .limit(1)
        setPartnerDormant(!recent || recent.length === 0)
      }
    } else {
      setPartnerDormant(false)
    }

    setLoading(false)
  }, [profile?.household_id, user?.id, partner?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchToday() }, [fetchToday])

  // Load yesterday's snapshot. Backfill may not have run yet — null is OK,
  // the eligibility check short-circuits and we re-fetch on day rollover.
  useEffect(() => {
    if (!user?.id) return
    const yStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    let cancelled = false
    supabase
      .from('daily_battle_results')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', yStr)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setYesterdayRow((data as DailyBattleRow | null) ?? null)
      })
    return () => { cancelled = true }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Comeback watcher — fires the moment today's score crosses partner's
  // and only when yesterday's row says we lost & no bonus claimed yet.
  // DB CAS (comeback_claimed=false) + comebackAttemptedRef de-dupe across
  // the multiple useDailyBattle instances that the home page mounts.
  useEffect(() => {
    if (comebackAttemptedRef.current) return
    if (!user?.id) return
    if (!isComebackEligible(yesterdayRow, myScore, partnerScore)) return
    comebackAttemptedRef.current = true
    let cancelled = false
    ;(async () => {
      const row = yesterdayRow!
      const won = await claimComebackBonus(supabase, user.id, row.date)
      if (cancelled) return
      if (won) {
        setYesterdayRow({ ...row, comeback_claimed: true })
        window.dispatchEvent(new CustomEvent('eren:comeback-payout', {
          detail: { coins: COMEBACK_BONUS_COINS },
        }))
        window.dispatchEvent(new CustomEvent('eren:comeback', {
          detail: { coins: COMEBACK_BONUS_COINS },
        }))
      } else {
        // The other tab/partner-instance beat us. Refetch so the local
        // state mirrors reality (comeback_claimed=true → no retries).
        const yStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
        const { data } = await supabase
          .from('daily_battle_results')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', yStr)
          .maybeSingle()
        if (!cancelled) setYesterdayRow((data as DailyBattleRow | null) ?? null)
      }
    })()
    return () => { cancelled = true }
  }, [user?.id, myScore, partnerScore, yesterdayRow]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    const ch = supabase
      .channel(`daily_battle:${profile.household_id}:${channelSuffix.current}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'interactions',
        filter: `household_id=eq.${profile.household_id}`,
      }, payload => {
        const row = payload.new as Interaction
        // Ignore anything that didn't happen today (e.g. backfilled rows).
        if (new Date(row.created_at) < startOfDay()) return
        // Skip wasted actions — the daily battle only counts when the
        // relevant stat was actually low. If the useful column exists
        // trust it; otherwise fall back to checking current stats.
        if (row.useful === false) return
        if (row.useful === undefined && !isUsefulByStats(row.action_type, statsRef.current)) return
        const pts = ACTION_POINTS[row.action_type] ?? 1
        const isMe = row.user_id === user.id
        if (isMe) setMyScore(s => s + pts)
        else if (row.user_id === partner?.id) {
          setPartnerScore(s => s + pts)
          setPartnerDormant(false)
        }
        setTotalActions(c => c + 1)
        setLastAction({
          userId:   row.user_id,
          userName: isMe
            ? (profile?.name?.split(' ')[0] ?? 'You')
            : (partner?.name?.split(' ')[0] ?? 'Partner'),
          action:   row.action_type,
          points:   pts,
          ts:       Date.now(),
          isMe,
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.household_id, user?.id, partner?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect midnight rollover. If the day stamp changes between checks,
  // refetch from scratch so the bar zeroes out automatically AND reset
  // the comeback watcher — what was "yesterday" is now 2 days ago.
  const lastDayRef = useRef<string>(new Date().toDateString())
  useEffect(() => {
    const id = setInterval(() => {
      const today = new Date().toDateString()
      if (today !== lastDayRef.current) {
        lastDayRef.current = today
        comebackAttemptedRef.current = false
        setYesterdayRow(null)
        fetchToday()
        if (user?.id) {
          const yStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
          supabase
            .from('daily_battle_results')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', yStr)
            .maybeSingle()
            .then(({ data }) => setYesterdayRow((data as DailyBattleRow | null) ?? null))
        }
      }
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [fetchToday, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = myScore + partnerScore
  const myPct      = total === 0 ? 50 : Math.round((myScore      / total) * 100)
  const partnerPct = total === 0 ? 50 : 100 - myPct
  const leader: 'me' | 'partner' | null =
    myScore > partnerScore ? 'me'
    : partnerScore > myScore ? 'partner'
    : null

  return {
    loading,
    myScore, partnerScore,
    myName:     profile?.name?.split(' ')[0] ?? 'You',
    partnerName: partner?.name?.split(' ')[0] ?? 'Partner',
    myPct, partnerPct,
    leader, total, totalActions,
    lastAction,
    hasPartner: !!partner?.id,
    partnerDormant,
  }
}

/** Hours/minutes until local midnight — the daily reset. */
export function timeUntilMidnight(): { hours: number; minutes: number; ms: number } {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const ms = tomorrow.getTime() - now.getTime()
  return {
    hours:   Math.floor(ms / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    ms,
  }
}

/** Fixed for now — future: scale by total household activity, or
 *  award stardust at the end of streaks. Surface in the UI so the
 *  goal is visible. */
export const DAILY_PRIZE_COINS = 30
