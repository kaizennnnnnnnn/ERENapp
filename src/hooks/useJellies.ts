'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from './useAuth'
import { useInventory } from './useInventory'
import { useErenStats } from './useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import {
  JELLIES, JELLY_SKIN_ID, SUPER_FEEDS_FOR_SKIN, SUPER_JELLY_BUFF, TRAY_SIZE,
  getJelly, rollEffect, rollJelly, type JellyDef, type JellyEffect, type JellyId,
} from '@/lib/jellies'

// ─── useJellies ─────────────────────────────────────────────────────────────
// The Parlour's whole progression: today's tray, the Super Jellies it mints,
// and how many of those Eren has eaten on the way to his own jelly coat.
//
// Every WRITE is an RPC (collect_jelly / feed_super_jelly). Both are
// read-modify-write decisions — "is this the fifth flavour today?", "is this
// the fifth feed ever?" — and both mint something. Doing that from the client
// means two devices finishing a round together can each read four-on-the-tray
// and each hand out a Super Jelly. The RPCs take the row FOR UPDATE, so the
// database decides the transition and the client only reports it.
//
// The client still owns the two things the server has no business knowing:
// WHICH flavour a round rolled (biased toward the empty slots, so a tray is
// finishable in a day) and which of that flavour's three effects fires. The
// server validates the flavour is real and does the counting.
//
// The effect is applied through feedWithFood with zero hunger/joy/weight, which
// turns it into a pure buff channel — the jelly's own MonstaBuff is the only
// thing that lands. Coins are the one field eren_stats can't hold, so they're
// paid through TaskContext, and only AFTER the stat write succeeds: a failed
// round must not mint money.

/**
 * Errors that mean the Parlour's schema simply is not there — an unapplied
 * migration, not a bad connection. PostgREST answers PGRST202 for a function it
 * cannot find and PGRST205 for a table; Postgres itself answers 42P01 /42883.
 * Worth separating from an outage because the two need opposite responses:
 * one is "try again in a second", the other is "this will never work".
 */
const SETUP_ERRORS = new Set(['PGRST202', 'PGRST205', '42P01', '42883'])
const isSetupError = (e: { code?: string } | null) => !!e?.code && SETUP_ERRORS.has(e.code)

interface Progress {
  /** Flavours already on today's tray. */
  today: Set<JellyId>
  /** Super Jellies held and not yet fed. */
  supers: number
  /** Super Jellies fed, ever. */
  fed: number
  /** False until a fetch has actually confirmed the row (503-safe). */
  loaded: boolean
  /**
   * The tables/RPCs this hook needs do not exist. Distinct from `!loaded`,
   * which is the ordinary "still fetching / had a blip" state: this one never
   * resolves on its own and has to be SAID, or a round silently pays nothing
   * and the prize card blames the player's score.
   */
  blocked: boolean
}

const EMPTY: Progress = { today: new Set(), supers: 0, fed: 0, loaded: false, blocked: false }

/** Shape of the jsonb both RPCs return. Fields are optional on the error path. */
interface RpcResult {
  ok: boolean
  reason?: string
  is_new?: boolean
  today?: string[]
  super_awarded?: boolean
  supers?: number
  fed?: number
  skin_granted?: boolean
}

export interface JellyWin {
  jelly: JellyDef
  effect: JellyEffect
  /** First time this flavour landed on TODAY's tray — the case lights it up. */
  isNew: boolean
  /** This win filled the fifth slot and minted a Super Jelly. */
  mintedSuper: boolean
  /** Slots filled after this win, for the tray meter on the prize card. */
  trayCount: number
}

export interface FeedResult {
  ok: boolean
  /** Super Jellies still in hand. */
  supers: number
  /** Feeds so far, out of SUPER_FEEDS_FOR_SKIN. */
  fed: number
  /** This feed was the fifth and Eren Jelly was granted just now. */
  skinGranted: boolean
}

export function useJellies() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { inventory, loaded: invLoaded, loading, refetch: refetchInventory } = useInventory()
  const { feedWithFood } = useErenStats(profile?.household_id ?? null)
  const { addCoins } = useTasks()
  const [progress, setProgress] = useState<Progress>(EMPTY)
  const [awarding, setAwarding] = useState(false)
  const [feeding, setFeeding] = useState(false)
  /**
   * Mirrors of the two values the write paths BRANCH on.
   *
   * A round can award twice in a row (the round prize, then the duel-lead
   * bonus) inside one `await` chain, with no render in between — so a second
   * call reading `progress`/`feeding` from state sees the values as they were
   * before the first call. That made the bonus jelly roll against a stale tray
   * (often duplicating the flavour just won) and made the in-flight guard a
   * no-op. Refs are the only things that are actually current here.
   */
  const todayRef = useRef<Set<JellyId>>(new Set())
  const busyRef = useRef(false)

  // ── Read ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id) return
    const res = await withRetry(() => supabase
      .from('jelly_progress')
      .select('day, flavours, supers, fed')
      .eq('user_id', user.id)
      .maybeSingle())
    // An outage must not read as an empty tray: that would draw every slot
    // locked to someone who filled four this morning. A MISSING table is a
    // different thing and gets said out loud.
    if (res.error) {
      if (isSetupError(res.error)) setProgress(p => ({ ...p, blocked: true }))
      return
    }

    const row = res.data as { day: string; flavours: JellyId[]; supers: number; fed: number } | null
    // No row yet is a real, confirmed answer — a player who has never played.
    if (!row) {
      todayRef.current = new Set()
      setProgress({ ...EMPTY, today: new Set(), loaded: true })
      return
    }

    // The tray belongs to a DAY. The RPC resets it lazily on the next collect,
    // so a client that opened the app after midnight must not render
    // yesterday's slots as filled while it waits for that write.
    const stale = row.day !== utcDay()
    const today = new Set<JellyId>(stale ? [] : (row.flavours ?? []).filter(f => !!getJelly(f)))
    todayRef.current = today
    setProgress({
      today,
      supers: row.supers ?? 0,
      fed: row.fed ?? 0,
      loaded: true,
      blocked: false,
    })
  }, [user?.id, supabase])

  useEffect(() => { void load() }, [load])
  // Self-heal after an outage that outlasted withRetry's backoff, and pick up
  // the tray reset when the app is reopened the next morning.
  useEffect(() => onForeground(() => { void load() }), [load])

  const ownsSkin = useMemo(
    () => inventory.some(r => r.item_id === `skin_${JELLY_SKIN_ID}`),
    [inventory],
  )

  // ── Win a jelly ─────────────────────────────────────────────────────────
  /**
   * Pay out one flavour for a finished round. Returns null only when the write
   * genuinely failed — the caller shows nothing rather than a fake prize.
   */
  const awardJelly = useCallback(async (): Promise<JellyWin | null> => {
    if (!user?.id || busyRef.current) return null
    busyRef.current = true
    setAwarding(true)
    try {
      const jelly = rollJelly(todayRef.current)
      const effect = rollEffect(jelly)

      const { data, error } = await supabase.rpc('collect_jelly', { p_flavour: jelly.id })
      const res = data as RpcResult | null
      if (error || !res?.ok) {
        if (isSetupError(error)) setProgress(p => ({ ...p, blocked: true }))
        return null
      }

      // The jelly does its thing. Zero hunger/joy/weight → only the buff lands.
      const applied = await feedWithFood(user.id, 0, 0, 0, effect.buff)
      if (applied.success && effect.buff.coins) void addCoins(effect.buff.coins)

      const today = new Set<JellyId>((res.today ?? []).filter(f => !!getJelly(f)) as JellyId[])
      todayRef.current = today
      setProgress(p => ({ ...p, today, supers: res.supers ?? p.supers, fed: res.fed ?? p.fed, loaded: true, blocked: false }))

      return {
        jelly,
        effect,
        isNew: !!res.is_new,
        mintedSuper: !!res.super_awarded,
        trayCount: today.size,
      }
    } finally {
      busyRef.current = false
      setAwarding(false)
    }
  }, [user?.id, supabase, feedWithFood, addCoins])

  // ── Feed a Super Jelly ──────────────────────────────────────────────────
  /**
   * Spend one Super Jelly. The RPC decrements, counts the feed, and grants the
   * skin on the fifth — all in one transaction, so a dropped connection can't
   * leave someone five-fed with nothing to wear.
   */
  const feedSuper = useCallback(async (): Promise<FeedResult> => {
    const none: FeedResult = { ok: false, supers: progress.supers, fed: progress.fed, skinGranted: false }
    if (!user?.id || busyRef.current || progress.supers < 1) return none
    busyRef.current = true
    setFeeding(true)
    try {
      const { data, error } = await supabase.rpc('feed_super_jelly')
      const res = data as RpcResult | null
      if (error || !res?.ok) {
        if (isSetupError(error)) setProgress(p => ({ ...p, blocked: true }))
        return none
      }

      await feedWithFood(user.id, 0, 0, 0, SUPER_JELLY_BUFF)
      if (SUPER_JELLY_BUFF.coins) void addCoins(SUPER_JELLY_BUFF.coins)

      setProgress(p => ({ ...p, supers: res.supers ?? 0, fed: res.fed ?? 0 }))
      if (res.skin_granted) void refetchInventory()

      return { ok: true, supers: res.supers ?? 0, fed: res.fed ?? 0, skinGranted: !!res.skin_granted }
    } finally {
      busyRef.current = false
      setFeeding(false)
    }
  }, [user?.id, progress.supers, progress.fed, supabase, feedWithFood, addCoins, refetchInventory])

  return {
    /** Flavour ids already on today's tray. */
    today: progress.today,
    trayCount: progress.today.size,
    traySize: TRAY_SIZE,
    trayFull: progress.today.size >= TRAY_SIZE,
    /** Catalogue in display order, each flagged with whether today's slot is filled. */
    tray: JELLIES.map(j => ({ jelly: j, filled: progress.today.has(j.id) })),
    supers: progress.supers,
    fed: progress.fed,
    feedGoal: SUPER_FEEDS_FOR_SKIN,
    ownsSkin,
    /** The Parlour's tables/RPCs are missing — the migration has not been run. */
    blocked: progress.blocked,
    /** Both halves confirmed: the tray row AND the inventory the skin lives in. */
    loaded: progress.loaded && invLoaded,
    loading,
    awarding,
    feeding,
    awardJelly,
    feedSuper,
    reload: load,
  }
}

/** UTC day string, matching the table's `day` default so both agree at midnight. */
function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}
