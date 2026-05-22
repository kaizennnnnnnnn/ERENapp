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
import type { Interaction } from '@/types'

const ACTION_POINTS: Record<string, number> = {
  feed: 3,
  play: 4,
  sleep: 2,
  wash: 3,
  medicine: 5,
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

  const [myScore, setMyScore]         = useState(0)
  const [partnerScore, setPartnerScore] = useState(0)
  const [totalActions, setTotalActions] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [lastAction, setLastAction]   = useState<DailyActionSignal | null>(null)

  const channelSuffix = useRef(`db_${++_channelCounter}`)

  const fetchToday = useCallback(async () => {
    if (!profile?.household_id || !user?.id) return
    const sinceIso = startOfDay().toISOString()
    // Only count rows the server marked as useful — i.e. the
    // relevant stat was actually low at action time. Wasted actions
    // (feeding when full, washing when clean) inserted with
    // useful=false don't score.
    const { data } = await supabase
      .from('interactions')
      .select('user_id, action_type, useful')
      .eq('household_id', profile.household_id)
      .gte('created_at', sinceIso)
      .or('useful.is.null,useful.eq.true')

    let me = 0, them = 0, count = 0
    for (const i of (data ?? []) as Pick<Interaction, 'user_id' | 'action_type' | 'useful'>[]) {
      const pts = ACTION_POINTS[i.action_type] ?? 1
      if (i.user_id === user.id) me += pts
      else if (i.user_id === partner?.id) them += pts
      count++
    }
    setMyScore(me)
    setPartnerScore(them)
    setTotalActions(count)
    setLoading(false)
  }, [profile?.household_id, user?.id, partner?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchToday() }, [fetchToday])

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
        // Skip wasted actions — the daily battle only counts (and
        // animates) when the relevant stat was actually low.
        if (row.useful === false) return
        const pts = ACTION_POINTS[row.action_type] ?? 1
        const isMe = row.user_id === user.id
        if (isMe) setMyScore(s => s + pts)
        else if (row.user_id === partner?.id) setPartnerScore(s => s + pts)
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
  // refetch from scratch so the bar zeroes out automatically.
  const lastDayRef = useRef<string>(new Date().toDateString())
  useEffect(() => {
    const id = setInterval(() => {
      const today = new Date().toDateString()
      if (today !== lastDayRef.current) {
        lastDayRef.current = today
        fetchToday()
      }
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [fetchToday])

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
