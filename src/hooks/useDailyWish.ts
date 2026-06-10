'use client'

// ═════════════════════════════════════════════════════════════════════════════
// useDailyWish — Phase 3 daily wish orchestrator.
//
// Responsibilities:
//   1. Load today's eren_wishes row for the household (or insert + roll one
//      if it doesn't exist yet — the first partner to open the app today
//      seeds the wish for both).
//   2. Subscribe to realtime updates on that row so the other partner sees
//      the granted state instantly.
//   3. Listen to in-session events (eren:my-action, eren:fed-food,
//      eren:nudge-sent, eren:minigame-done, eren:pet) plus a one-time
//      catch-up query of today's interactions to build DailyActions.
//   4. When matchWish(wish, actions) returns true and the row is still
//      ungranted, call the grant_wish RPC and dispatch eren:wish-granted.
//
// Caller passes the contextual data (household, user, partner, leader, fridge
// keys) — the hook stays decoupled from useAuth/useCouple/useErenStats so it
// can be tested in isolation.
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import type { FoodKey } from '@/types'
import {
  WISHES, FALLBACK_WISH,
  wishOfTheDay, matchWish, dateKey, renderWishText,
  type Wish, type DailyActions, type EligibilityCtx,
} from '@/lib/wishes'

let _wishChannelCounter = 0

const SESSION_FEEDS_KEY = 'eren:wish:fed-today'
const SESSION_PLAYS_KEY = 'eren:wish:plays-today'
const SESSION_NUDGES_KEY = 'eren:wish:nudges-today'

interface DailyWishRow {
  household_id: string
  period_key: string
  wish_id: string
  shown_at: string
  granted_at: string | null
  granted_by: string | null
  action_taken: string | null
  coins_paid: number
}

export interface UseDailyWishOptions {
  householdId: string | null
  userId: string | null
  partnerId: string | null
  tz: string | null
  leaderName: string | null
  viewerName: string
  /** Union of both partners' fridge food keys. Caller computes from
   *  stats.food_by_user; food wishes whose key isn't in this set won't roll. */
  fridgeKeys: Set<string>
}

export interface UseDailyWishResult {
  wish: Wish | null
  /** wish.text with {leader} substituted in. */
  text: string
  status: 'loading' | 'pending' | 'granted'
  grantedBy: string | null
  grantedAt: string | null
  coinsPaid: number
  todayKey: string | null
  weekGrantedCount: number
  refresh: () => Promise<void>
}

// ─── localStorage helpers — per-period_key session state ─────────────────────
// We persist today's session actions in localStorage so a refresh mid-day
// doesn't lose the "i fed salmon at noon" context. Keys are scoped by
// period_key so the next day's session starts clean.

function lsRead<T>(key: string, periodKey: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(`${key}:${periodKey}`)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch { return fallback }
}

function lsWrite(key: string, periodKey: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${key}:${periodKey}`, JSON.stringify(value))
  } catch { /* quota or disabled */ }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDailyWish(opts: UseDailyWishOptions): UseDailyWishResult {
  const supabase = createClient()
  const channelSuffix = useRef(`${++_wishChannelCounter}_${Math.random().toString(36).slice(2, 8)}`)

  const todayKey = useMemo(() => {
    if (!opts.tz && typeof Intl === 'undefined') return null
    return dateKey(new Date(), opts.tz)
  }, [opts.tz])

  const [row, setRow] = useState<DailyWishRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekGrantedCount, setWeekGrantedCount] = useState(0)
  // Flips true after the interactions catch-up query lands its result. Until
  // then, tryGrant() would run with empty `cares` refs and matchWish would
  // return false even when the user has actually done the action today —
  // leaving the wish stuck on "pending" forever after a fresh app open.
  const [caughtUp, setCaughtUp] = useState(false)
  // True when the last fetchOrSeed hit a Supabase outage that outlasted
  // withRetry's backoff — the foreground listener uses it to refetch.
  const loadFailedRef = useRef(false)
  // True when the interactions catch-up below failed — the foreground
  // listener re-runs it so `caughtUp` never flips true over empty refs.
  const caughtUpFailedRef = useRef(false)

  // ── Session action refs — survive across renders, persist via localStorage.
  // partnerFeeds intentionally stays empty: the interactions table doesn't
  // carry the food key, so we can only track WHO fed (via partnerCares),
  // not what they fed. Couple-feed wishes (feed:both) work fine because
  // they only need both partners to have logged any feed.
  const sessionFeedsRef = useRef<FoodKey[]>([])
  const sessionPlaysRef = useRef<string[]>([])
  const sessionNudgesRef = useRef<Set<string>>(new Set())
  const myCaresRef = useRef<Array<'feed'|'play'|'sleep'|'wash'|'medicine'>>([])
  const partnerCaresRef = useRef<Array<'feed'|'play'|'sleep'|'wash'|'medicine'>>([])
  const partnerPlaysRef = useRef<string[]>([])
  const partnerNudgesRef = useRef<Set<string>>(new Set())

  // Rehydrate session caches whenever the calendar day flips.
  useEffect(() => {
    if (!todayKey) return
    sessionFeedsRef.current = lsRead<FoodKey[]>(SESSION_FEEDS_KEY, todayKey, [])
    sessionPlaysRef.current = lsRead<string[]>(SESSION_PLAYS_KEY, todayKey, [])
    sessionNudgesRef.current = new Set(lsRead<string[]>(SESSION_NUDGES_KEY, todayKey, []))
  }, [todayKey])

  // ── Build a fresh DailyActions snapshot from the refs.
  const buildActions = useCallback((): DailyActions => ({
    feeds: [...sessionFeedsRef.current],
    partnerFeeds: [],
    cares: [...myCaresRef.current],
    partnerCares: [...partnerCaresRef.current],
    plays: [...sessionPlaysRef.current],
    partnerPlays: [...partnerPlaysRef.current],
    nudges: new Set(sessionNudgesRef.current),
    partnerNudges: new Set(partnerNudgesRef.current),
    fridgeKeys: opts.fridgeKeys,
  }), [opts.fridgeKeys])

  // ── Load (or seed) today's wish row.
  const fetchOrSeed = useCallback(async () => {
    if (!opts.householdId || !todayKey) { setLoading(false); return }
    setLoading(true)

    // Try to read the existing row first. Error-checked: a transient 503
    // resolves as { data: null, error } and must NOT read as "no wish row
    // today" — that would send us down the seed path during an outage.
    const { data: existing, error: readError } = await withRetry(() => supabase
      .from('eren_wishes')
      .select('household_id, period_key, wish_id, shown_at, granted_at, granted_by, action_taken, coins_paid')
      .eq('household_id', opts.householdId)
      .eq('period_key', todayKey)
      .maybeSingle())
    if (readError) {
      loadFailedRef.current = true
      setLoading(false)
      return
    }

    if (existing) {
      loadFailedRef.current = false
      setRow(existing as DailyWishRow)
      setLoading(false)
      return
    }

    // No row — this client is the first opener today. Roll one and insert it
    // with ON CONFLICT DO NOTHING so the other partner racing the same mount
    // doesn't double-insert.
    const ctx = await buildEligibilityCtx()
    const picked = wishOfTheDay({
      date: new Date(),
      householdId: opts.householdId,
      tz: opts.tz,
      ctx,
    })

    const { error: insertError } = await supabase
      .from('eren_wishes')
      .insert({
        household_id: opts.householdId,
        period_key: todayKey,
        wish_id: picked.id,
      })
    void insertError // ignore unique-violation; we re-select below

    const { data: reread, error: rereadError } = await withRetry(() => supabase
      .from('eren_wishes')
      .select('household_id, period_key, wish_id, shown_at, granted_at, granted_by, action_taken, coins_paid')
      .eq('household_id', opts.householdId)
      .eq('period_key', todayKey)
      .maybeSingle())
    if (rereadError) {
      // Keep whatever row we already had instead of blanking the cloud.
      loadFailedRef.current = true
      setLoading(false)
      return
    }

    loadFailedRef.current = false
    setRow((reread as DailyWishRow) ?? null)
    setLoading(false)
  }, [opts.householdId, opts.tz, todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Eligibility ctx for the rotation hash. We don't strictly need this
  // after the row exists, but we use it when seeding.
  const buildEligibilityCtx = useCallback(async (): Promise<EligibilityCtx> => {
    const ctx: EligibilityCtx = {
      leaderName: opts.leaderName,
      viewerName: opts.viewerName,
      bothActiveLast48h: false,
      fridgeKeys: opts.fridgeKeys,
      recentlyShown: new Map(),
      today: todayKey ?? '',
    }

    if (!opts.householdId) return ctx

    // 48h bothActive check — count distinct user_ids in the last 48h.
    const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString()
    const { data: recent } = await supabase
      .from('interactions')
      .select('user_id')
      .eq('household_id', opts.householdId)
      .gte('created_at', cutoff)
    if (recent && new Set(recent.map(r => r.user_id)).size >= 2) {
      ctx.bothActiveLast48h = true
    }

    // Recent shown history — last 30 wish rows, keyed by wish_id.
    const { data: history } = await supabase
      .from('eren_wishes')
      .select('wish_id, period_key')
      .eq('household_id', opts.householdId)
      .order('period_key', { ascending: false })
      .limit(30)
    if (history) {
      for (const h of history) {
        const cur = ctx.recentlyShown.get(h.wish_id)
        if (!cur || cur < h.period_key) ctx.recentlyShown.set(h.wish_id, h.period_key)
      }
    }

    return ctx
  }, [opts.householdId, opts.leaderName, opts.viewerName, opts.fridgeKeys, todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Catch-up: when the hook mounts, pull today's interactions so refs
  // reflect anything that happened earlier today before this session began.
  // Query a 36h window in UTC and filter to "today" in the user's local tz —
  // a `gte(created_at, todayKey + 'T00:00:00Z')` filter would miss any
  // interaction logged before UTC midnight on the user's local today (e.g.
  // a bath at 01:00 local for a user at UTC+3), which is the exact case
  // that leaves a wish stuck on "pending" all day.
  // A callback (not effect-local) so the foreground listener can re-run it
  // after an outage. Each run bumps the generation so a stale in-flight
  // query (day flip, household change, overlapping retry) can't write refs.
  const catchUpGenRef = useRef(0)
  const catchUp = useCallback(async () => {
    const gen = ++catchUpGenRef.current
    if (!opts.householdId || !opts.userId || !todayKey) return
    const cutoff = new Date(Date.now() - 36 * 3600_000).toISOString()
    // Error-checked: a transient 503 resolves as { data: null, error } —
    // flipping caughtUp over falsely-empty refs would spend the once-only
    // grant pass on nothing, sticking a done wish on "pending" all day.
    const { data: rows, error } = await withRetry(() => supabase
      .from('interactions')
      .select('user_id, action_type, created_at')
      .eq('household_id', opts.householdId)
      .gte('created_at', cutoff))
    if (gen !== catchUpGenRef.current) return
    if (error) {
      caughtUpFailedRef.current = true
      return
    }
    caughtUpFailedRef.current = false
    const me: Array<'feed'|'play'|'sleep'|'wash'|'medicine'> = []
    const part: Array<'feed'|'play'|'sleep'|'wash'|'medicine'> = []
    for (const i of (rows ?? [])) {
      if (dateKey(new Date(i.created_at as string), opts.tz) !== todayKey) continue
      const at = i.action_type as 'feed'|'play'|'sleep'|'wash'|'medicine'
      if (i.user_id === opts.userId) me.push(at)
      else part.push(at)
    }
    myCaresRef.current = me
    partnerCaresRef.current = part
    setCaughtUp(true)
  }, [opts.householdId, opts.userId, todayKey, opts.tz]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCaughtUp(false)
    void catchUp()
  }, [catchUp])

  // ── Realtime subscription on this household's wish row.
  useEffect(() => {
    if (!opts.householdId) return
    const ch = supabase
      .channel(`daily_wish:${opts.householdId}:${channelSuffix.current}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'eren_wishes',
        filter: `household_id=eq.${opts.householdId}`,
      }, payload => {
        const next = (payload.new ?? null) as DailyWishRow | null
        if (!next || next.period_key !== todayKey) return
        const wasGranted = row?.granted_at != null
        setRow(next)
        if (!wasGranted && next.granted_at && payload.eventType === 'UPDATE') {
          try {
            window.dispatchEvent(new CustomEvent('eren:wish-granted', {
              detail: { wishId: next.wish_id, by: next.granted_by, coinsPaid: next.coins_paid },
            }))
          } catch { /* ignore */ }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [opts.householdId, todayKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Try-grant: the only place that calls the grant_wish RPC.
  const tryGrant = useCallback(async () => {
    if (!row || !opts.householdId || !opts.userId || !todayKey) return
    if (row.granted_at) return
    const wish = WISHES.find(w => w.id === row.wish_id)
      ?? (row.wish_id === FALLBACK_WISH.id ? FALLBACK_WISH : null)
    if (!wish) return

    const actions = buildActions()
    if (!matchWish(wish, actions)) return

    // Compose action_taken from the most likely trigger so the row records what
    // crossed the line. Cheap heuristic — used for analytics + the partner-
    // facing "granted by" line.
    const lastFood = sessionFeedsRef.current[sessionFeedsRef.current.length - 1]
    const lastPlay = sessionPlaysRef.current[sessionPlaysRef.current.length - 1]
    let actionTaken = wish.match
    if (wish.match === 'feed:any' || wish.match.startsWith('feed:')) {
      if (lastFood) actionTaken = `feed:${lastFood}`
    } else if (wish.match.startsWith('play:')) {
      if (lastPlay) actionTaken = `play:${lastPlay}`
    }

    const { data, error } = await supabase.rpc('grant_wish', {
      p_household_id: opts.householdId,
      p_period_key: todayKey,
      p_user_id: opts.userId,
      p_action_taken: actionTaken,
      p_coins: wish.coinReward,
    })
    if (error || !data?.[0]?.granted) return

    // Optimistic local-state update — don't wait for the realtime UPDATE to
    // round-trip. If realtime is slow or the channel is wedged the UI would
    // sit on the stale "pending" view for seconds; this flips it instantly.
    const grantedAt = new Date().toISOString()
    setRow(prev => prev ? {
      ...prev,
      granted_at: grantedAt,
      granted_by: opts.userId!,
      action_taken: actionTaken,
      coins_paid: wish.coinReward,
    } : prev)
    setWeekGrantedCount(c => c + 1)

    // Also dispatch the grant event locally so the Eren sparkle + coin pop
    // fire immediately. The realtime listener guards against double-firing
    // by checking `wasGranted` against the row state before the UPDATE.
    try {
      window.dispatchEvent(new CustomEvent('eren:wish-granted', {
        detail: { wishId: wish.id, by: opts.userId, coinsPaid: wish.coinReward },
      }))
    } catch { /* ignore */ }

    // Push the granted-state to the partner (PR 9). Idempotent — the route
    // gates on eren_wishes.granted_pushed_at and stamps it on success.
    fetch('/api/notify-wish-granted', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        household_id: opts.householdId,
        period_key:   todayKey,
        granter_id:   opts.userId,
      }),
    }).catch(() => { /* best-effort; the realtime UPDATE still flips the UI */ })
  }, [row, opts.householdId, opts.userId, todayKey, buildActions])

  // ── Event listeners for the action stream.
  useEffect(() => {
    if (!opts.householdId || !opts.userId) return

    const onMyAction = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { action_type?: string; user_id?: string } | undefined
      if (!detail?.action_type) return
      // eren:my-action fires for THIS user (insertInteraction dispatches it).
      const at = detail.action_type as 'feed'|'play'|'sleep'|'wash'|'medicine'
      if (detail.user_id === opts.userId) myCaresRef.current.push(at)
      else partnerCaresRef.current.push(at)
      void tryGrant()
    }
    const onFedFood = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { food?: FoodKey; user_id?: string } | undefined
      if (!detail?.food) return
      if (detail.user_id === opts.userId || !detail.user_id) {
        sessionFeedsRef.current.push(detail.food)
        if (todayKey) lsWrite(SESSION_FEEDS_KEY, todayKey, sessionFeedsRef.current)
      }
      void tryGrant()
    }
    const onNudgeSent = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { nudgeId?: string } | undefined
      if (!detail?.nudgeId) return
      sessionNudgesRef.current.add(detail.nudgeId)
      if (todayKey) lsWrite(SESSION_NUDGES_KEY, todayKey, Array.from(sessionNudgesRef.current))
      void tryGrant()
    }
    const onMinigame = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { id?: string } | undefined
      if (!detail?.id) return
      sessionPlaysRef.current.push(detail.id)
      if (todayKey) lsWrite(SESSION_PLAYS_KEY, todayKey, sessionPlaysRef.current)
      void tryGrant()
    }
    const onPet = () => {
      // Pet is its own play-flavoured trigger so mood-pet / mood-lap can grant.
      myCaresRef.current.push('play')
      void tryGrant()
    }

    window.addEventListener('eren:my-action', onMyAction)
    window.addEventListener('eren:fed-food', onFedFood)
    window.addEventListener('eren:nudge-sent', onNudgeSent)
    window.addEventListener('eren:minigame-done', onMinigame)
    window.addEventListener('eren:pet', onPet)
    return () => {
      window.removeEventListener('eren:my-action', onMyAction)
      window.removeEventListener('eren:fed-food', onFedFood)
      window.removeEventListener('eren:nudge-sent', onNudgeSent)
      window.removeEventListener('eren:minigame-done', onMinigame)
      window.removeEventListener('eren:pet', onPet)
    }
  }, [opts.householdId, opts.userId, todayKey, tryGrant])

  // ── Refresh "wishes this week" pill.
  useEffect(() => {
    if (!opts.householdId || !todayKey) return
    let cancelled = false
    ;(async () => {
      // Start of the most recent Monday in household tz.
      const today = new Date(todayKey + 'T00:00:00Z')
      const dow = today.getUTCDay() // 0 = Sun, 1 = Mon, ...
      const offsetToMon = (dow + 6) % 7
      const monday = new Date(today.getTime() - offsetToMon * 86_400_000)
      const monKey = monday.toISOString().slice(0, 10)
      const { count } = await supabase
        .from('eren_wishes')
        .select('household_id', { count: 'exact', head: true })
        .eq('household_id', opts.householdId)
        .gte('period_key', monKey)
        .not('granted_at', 'is', null)
      if (!cancelled && typeof count === 'number') setWeekGrantedCount(count)
    })()
    return () => { cancelled = true }
  }, [opts.householdId, todayKey, row?.granted_at]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Boot.
  useEffect(() => { void fetchOrSeed() }, [fetchOrSeed])

  // Self-heal: fetchOrSeed and the catch-up only run on mount/dep change, so
  // bailing on a Supabase outage would otherwise leave the cloud empty (and
  // the grant pass gated on empty refs) all day. Retry on return to
  // foreground (focus alone misses iOS standalone, which only fires
  // visibilitychange).
  useEffect(() => onForeground(() => {
    if (loadFailedRef.current) void fetchOrSeed()
    if (caughtUpFailedRef.current) void catchUp()
  }), [fetchOrSeed, catchUp])

  // ── Catch-up grant: if the wish row arrived AFTER the user already did
  // the matching action today (race on first mount, or app reopen after
  // doing the action), tryGrant once more so we don't sit on a pending
  // wish forever just because the row loaded a tick late. Gated on
  // `caughtUp` — without that gate, if the row read returns before the
  // interactions query, tryGrant runs against empty `cares` refs and
  // matchWish returns false, leaving a "completed" wish stuck on pending.
  useEffect(() => {
    if (!row || row.granted_at) return
    if (!caughtUp) return
    void tryGrant()
  }, [row?.wish_id, caughtUp]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resolve the Wish definition + rendered text.
  const wish = useMemo<Wish | null>(() => {
    if (!row) return null
    return WISHES.find(w => w.id === row.wish_id)
      ?? (row.wish_id === FALLBACK_WISH.id ? FALLBACK_WISH : null)
  }, [row])

  const text = useMemo(() => wish ? renderWishText(wish, opts.leaderName) : '', [wish, opts.leaderName])

  const status: 'loading' | 'pending' | 'granted' = loading ? 'loading'
    : row?.granted_at ? 'granted'
    : 'pending'

  return {
    wish,
    text,
    status,
    grantedBy: row?.granted_by ?? null,
    grantedAt: row?.granted_at ?? null,
    coinsPaid: row?.coins_paid ?? 0,
    todayKey,
    weekGrantedCount,
    refresh: fetchOrSeed,
  }
}
