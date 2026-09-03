'use client'

// useDailyBattle — fresh-each-day care-action scoreboard between the
// two household members. Same scoring scale as the weekly love meter,
// but the window is "today" (local midnight → now) so every day is a
// short, recoverable race. Used by the home-screen HUD bar, the
// floating action pop-up, and the detail sheet.

import {
  useEffect, useState, useCallback, useRef,
  createContext, useContext, createElement, type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from './useAuth'
import { useCouple } from './useCouple'
import type { Interaction } from '@/types'
import { format, subDays } from 'date-fns'
import {
  isComebackEligible, claimComebackBonus, scoreDaily,
  COMEBACK_BONUS_COINS, type DailyBattleRow,
} from '@/lib/battleResults'
import {
  twistForDate, scoreActions, isBattleAction, type TwistDef,
} from '@/lib/dailyTwist'
import { EREN_OPPONENT_NAME } from '@/lib/erenOpponent'
import { useTrophyEffects } from './useTrophyEffects'
import { notifyPartnerAction } from '@/lib/statNotifications'

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
  /** Household of one. Eren is already holding the other seat in `partnerScore`
   *  (scoreDaily falls through to erenOpponentScore on an empty partner id), so
   *  this is what lets the HUD show a race that is genuinely being played
   *  rather than hiding it for want of a second profile row. */
  isSolo: boolean
  /** True when the partner has had zero interactions in the last 24h — used
   *  to hide the scoreboard HUD so a one-sided 100-0 bar doesn't sit there. */
  partnerDormant: boolean
  /** Today's rule. Never null — every day has one. */
  twist: TwistDef
  /** Local 'yyyy-MM-dd' the scores belong to. Flips at midnight. */
  dayKey: string
}

function startOfDay(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Local 'yyyy-MM-dd' — the same key the snapshot rows are filed under. */
function localDayKey(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}

let _channelCounter = 0

// Internal implementation. Used to be exported as the public `useDailyBattle`
// hook, which meant every consumer (DailyBattleHUD on home, DailyBattlePop in
// layout) mounted its own postgres_changes channel on `interactions`. Now
// wrapped in a singleton DailyBattleProvider so the channel is opened once.
//
// While we're here, the partner-action toast that used to live in a separate
// `home_notifs_${user.id}` channel in home/page.tsx is fired right from this
// realtime handler. Same INSERT event, no reason to keep two subscribers.
function useDailyBattleImpl(): DailyBattleState {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { partner, isSolo } = useCouple()
  // Today's bought privileges. A Double Hour or a Point Steal changes what the
  // rows are worth, and both phones have to reach the same number, so the mods
  // go through the same scorer the snapshot uses rather than being patched
  // onto the display.
  const { mods, myDoubleLive } = useTrophyEffects()

  const [dayKey, setDayKey]           = useState(() => localDayKey())
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
  // True when the last fetchToday hit a Supabase outage that outlasted
  // withRetry's backoff — the foreground listener uses it to refetch.
  const loadFailedRef = useRef(false)

  const channelSuffix = useRef(`db_${++_channelCounter}`)
  // Read through a ref so a new effect landing does not rebuild fetchToday and
  // re-subscribe the realtime channel; the refetch below is what applies it.
  const modsRef = useRef(mods)
  modsRef.current = mods
  // A live Double Hour makes an action worth twice its face value, which a
  // flat increment cannot know. Refetch for those rows too, or the bar would
  // undercount all hour and then jump when something else forces a reload.
  const doubleLiveRef = useRef(myDoubleLive)
  doubleLiveRef.current = myDoubleLive

  const fetchToday = useCallback(async () => {
    if (!profile?.household_id || !user?.id) return
    const sinceIso = startOfDay().toISOString()
    // Select * so the query works whether or not the `useful` column
    // has been added by migration_interactions_useful.sql. Filtering
    // useful=false then happens client-side — pre-migration the
    // field is undefined and every row counts, which matches the
    // old behaviour.
    // Error-checked: a transient 503 resolves as { data: null, error } and
    // must not be scored as a 0/0/0 day — keep the previous scores and let
    // the foreground listener refetch.
    const { data, error } = await withRetry(() => supabase
      .from('interactions')
      .select('*')
      .eq('household_id', profile.household_id)
      .gte('created_at', sinceIso))
    if (error) {
      loadFailedRef.current = true
      setLoading(false)
      return
    }
    loadFailedRef.current = false

    // One scorer for the whole app — the snapshot the backfill writes tonight
    // is computed by this exact function, so the bar can never disagree with
    // the result screen tomorrow morning.
    const rows = (data ?? []) as Interaction[]
    const today = localDayKey()
    const sp = scoreDaily(rows, user.id, partner?.id ?? '', today, modsRef.current)
    setDayKey(today)
    setMyScore(sp.myScore)
    setPartnerScore(sp.partnerScore)
    setTotalActions(rows.filter(i => i.useful !== false && isBattleAction(i.action_type)).length)

    // Dormancy check: any partner interaction in the last 24h?
    if (partner?.id) {
      if (sp.partnerScore > 0) {
        setPartnerDormant(false)
      } else {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: recent, error: recentError } = await withRetry(() => supabase
          .from('interactions')
          .select('id')
          .eq('user_id', partner.id)
          .gte('created_at', dayAgo)
          .limit(1))
        // A failed read must not mark the partner dormant — keep the
        // previous flag and refetch on return to foreground.
        if (recentError) loadFailedRef.current = true
        else setPartnerDormant(!recent || recent.length === 0)
      }
    } else {
      setPartnerDormant(false)
    }

    setLoading(false)
  }, [profile?.household_id, user?.id, partner?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchToday() }, [fetchToday])

  // A privilege fired on either phone re-prices today's rows. Cheap to redo
  // and it is the only way a Point Steal shows up on the victim's screen.
  const modsKey = JSON.stringify(mods)
  useEffect(() => { void fetchToday() }, [modsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Self-heal: fetchToday only re-runs on dep change or midnight rollover
  // (realtime only adds future inserts), so a failed load would otherwise
  // show a stale scoreboard until reload. Retry on return to foreground
  // (focus alone misses iOS standalone, which only fires visibilitychange).
  useEffect(() => onForeground(() => { if (loadFailedRef.current) fetchToday() }), [fetchToday])

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
        // Fire partner-action toast for ANY action by the other user, even
        // ones that won't count toward the battle (backfills, wasted actions).
        // This is what the old home_notifs_${user.id} channel did; folded in
        // here so we only open one Realtime subscription on `interactions`.
        if (row.user_id !== user.id) {
          let partnerName = partner?.name?.split(' ')[0] ?? 'Your partner'
          try {
            const cached = localStorage.getItem(`eren_partner_name_${user.id}`)
            if (cached) partnerName = cached
          } catch { /* localStorage blocked */ }
          notifyPartnerAction(partnerName, row.action_type)
        }
        // Ignore anything that didn't happen today (e.g. backfilled rows).
        if (new Date(row.created_at) < startOfDay()) return
        // Skip wasted actions. `useful` is stamped at write time against the
        // PRE-action stats (useErenStats.isUsefulAction) and is the only
        // honest answer — the local re-check that used to live here read
        // post-action stats, so it rejected exactly the feeds and washes that
        // had just done the most good, while the fetch and the nightly
        // snapshot both counted them. Trust the column.
        if (row.useful === false) return
        if (!isBattleAction(row.action_type)) return

        const twist = twistForDate(localDayKey())
        const isMe = row.user_id === user.id
        const isPartner = row.user_id === partner?.id
        if (!isMe && !isPartner) return
        if (isPartner) setPartnerDormant(false)

        // What the pop-up shouts. Scoring this single action in isolation is
        // also its exact value under every per-row twist, and its best case
        // under the two contextual ones.
        const pts = scoreActions(twist, [row.action_type])

        // A contextual twist (FULL HOUSE, SPRINT) prices an action by what
        // that person already did today, which an increment cannot know.
        // Refetch instead — correctness beats the extra round-trip, and it is
        // at most a handful of times a day.
        // Any double-hour window at all (mine or theirs) makes the flat
        // increment wrong for the affected side, so fall back to a refetch.
        const anyDouble = doubleLiveRef.current
          || Object.keys(modsRef.current.doubles).length > 0
        if (twist.perRow && !anyDouble) {
          if (isMe) setMyScore(s => s + pts)
          else setPartnerScore(s => s + pts)
          setTotalActions(c => c + 1)
        } else {
          void fetchToday()
        }
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
      // Outage retry: an actively-focused tab never gets a foreground event,
      // so a failed load (e.g. the midnight refetch below hitting a 503)
      // would stick all day. Bounded to one retry per tick.
      if (loadFailedRef.current) { fetchToday(); return }
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
    partnerName: partner?.name?.split(' ')[0] ?? (isSolo ? EREN_OPPONENT_NAME : 'Partner'),
    myPct, partnerPct,
    leader, total, totalActions,
    lastAction,
    hasPartner: !!partner?.id,
    isSolo,
    partnerDormant,
    twist: twistForDate(dayKey),
    dayKey,
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

const DailyBattleContext = createContext<DailyBattleState | null>(null)

// Singleton provider — mounted once at (app)/layout.tsx. Owns the only
// realtime channel on `interactions` for the daily battle scoreboard.
export function DailyBattleProvider({ children }: { children: ReactNode }) {
  const value = useDailyBattleImpl()
  return createElement(DailyBattleContext.Provider, { value }, children)
}

// Public hook. Throws when used outside the provider so a missing wrap
// surfaces loudly rather than silently re-opening a per-consumer channel.
export function useDailyBattle(): DailyBattleState {
  const ctx = useContext(DailyBattleContext)
  if (!ctx) throw new Error('useDailyBattle must be used inside <DailyBattleProvider>')
  return ctx
}
