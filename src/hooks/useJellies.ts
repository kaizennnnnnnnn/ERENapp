'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth, PROFILE_UPDATED_EVENT } from './useAuth'
import { useInventory } from './useInventory'
import { useErenStats } from './useErenStats'
import { notifyRewardIndicators } from '@/lib/rewardIndicators'
import { pendingSuperJellyFeeds, saveSuperJellyFeed, superJellySaveError, type SuperJellySave } from '@/lib/superJellySaves'
import { pendingJellyRounds } from '@/lib/jellyRoundSaves'
import {
  JELLIES, JELLY_SKIN_ID, SUPER_FEEDS_FOR_SKIN, TRAY_SIZE,
  getJelly, type JellyDef, type JellyEffect, type JellyId,
  type SuperJellySnack,
} from '@/lib/jellies'

// ─── useJellies ─────────────────────────────────────────────────────────────
// The Parlour's whole progression: today's tray, the Super Jellies it mints,
// and how many of those Eren has eaten on the way to his own jelly coat.
//
// useJellyRound saves scores, rolls and effects together. This hook reads that
// progress and owns recoverable Super Jelly feeding from the kitchen fridge.

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
  owner: string | null
  home: string | null
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

const EMPTY: Progress = { owner: null, home: null, today: new Set(), supers: 0, fed: 0, loaded: false, blocked: false }

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
  snack?: { food_key: SuperJellySnack; quantity: 1 }
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
  const home = profile?.household_id ?? null
  const { inventory, loaded: invLoaded, loading, refetch: refetchInventory } = useInventory()
  const { refetch: refetchStats } = useErenStats(home)
  const [storedProgress, setProgress] = useState<Progress>(EMPTY)
  const progress = storedProgress.owner === user?.id && storedProgress.home === home ? storedProgress : EMPTY
  const [feeding, setFeeding] = useState(false)
  const [feedPending, setFeedPending] = useState(false)
  const [feedIssue, setFeedIssue] = useState<{ actor: string; home: string; message: string } | null>(null)
  const scope = useRef({ actor: user?.id, home }); scope.current = { actor: user?.id, home }
  const mounted = useRef(true), epoch = useRef(0), readVersion = useRef(0)
  const busyRef = useRef<symbol | null>(null)
  useEffect(() => {
    mounted.current = true; busyRef.current = null
    setProgress(EMPTY); setFeeding(false); setFeedIssue(null)
    setFeedPending(Boolean(user?.id && home && pendingSuperJellyFeeds(user.id, home).length))
    return () => { mounted.current = false; epoch.current++; readVersion.current++ }
  }, [user?.id, home])

  // ── Read ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id) return
    const read = ++readVersion.current, actor = user.id
    const res = await withRetry(() => supabase
      .from('jelly_progress')
      .select('day, flavours, supers, fed')
      .eq('user_id', user.id)
      .maybeSingle())
    if (!mounted.current || scope.current.actor !== actor || scope.current.home !== home || read !== readVersion.current) return
    // An outage must not read as an empty tray: that would draw every slot
    // locked to someone who filled four this morning. A MISSING table is a
    // different thing and gets said out loud.
    if (res.error) {
      if (isSetupError(res.error)) setProgress(p => ({ ...p, owner: actor, home, blocked: true }))
      return
    }

    const row = res.data as { day: string; flavours: JellyId[]; supers: number; fed: number } | null
    // No row yet is a real, confirmed answer — a player who has never played.
    if (!row) {
      setProgress({ ...EMPTY, owner: actor, home, today: new Set(), loaded: true })
      return
    }

    // The tray belongs to a DAY. The RPC resets it lazily on the next collect,
    // so a client that opened the app after midnight must not render
    // yesterday's slots as filled while it waits for that write.
    const stale = row.day !== utcDay()
    const today = new Set<JellyId>(stale ? [] : (row.flavours ?? []).filter(f => !!getJelly(f)))
    setProgress({
      owner: actor, home,
      today,
      supers: row.supers ?? 0,
      fed: row.fed ?? 0,
      loaded: true,
      blocked: false,
    })
  }, [user?.id, home, supabase])

  useEffect(() => { void load() }, [load])
  // Self-heal after an outage that outlasted withRetry's backoff, and pick up
  // the tray reset when the app is reopened the next morning.
  useEffect(() => onForeground(() => {
    if (user?.id && home) setFeedPending(pendingSuperJellyFeeds(user.id, home).length > 0)
    void load()
  }), [load, user?.id, home])

  const ownsSkin = useMemo(
    () => inventory.some(r => r.item_id === `skin_${JELLY_SKIN_ID}`),
    [inventory],
  )

  // ── Feed a Super Jelly ──────────────────────────────────────────────────
  /**
   * Confirm one whole feed. Recovery reuses its receipt even when the stand
   * is empty; no effects or wallet grants are repeated on the client.
   */
  const feedSuper = useCallback(async (): Promise<FeedResult> => {
    const none: FeedResult = { ok: false, supers: progress.supers, fed: progress.fed, skinGranted: false }
    const actor = user?.id, generation = epoch.current
    const active = () => mounted.current && epoch.current === generation && scope.current.actor === actor && scope.current.home === home
    if (!actor || !home || !active() || busyRef.current || (progress.supers < 1 && !pendingSuperJellyFeeds(actor, home).length)) return none
    const token = Symbol('super-jelly-feed'); busyRef.current = token; readVersion.current++
    setFeeding(true); setFeedIssue(null)
    try {
      const res = await saveSuperJellyFeed(supabase, actor, home)
      if (!active()) return none
      if (!res.ok) {
        setFeedIssue({ actor, home, message: superJellySaveError(res.reason) })
        void load()
        return none
      }
      const saved = res as SuperJellySave
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { id: actor, patch: { coins: saved.coins } } }))
      window.dispatchEvent(new CustomEvent('eren:my-action', { detail: { household_id: home, user_id: actor, action_type: 'feed' } }))
      setProgress(p => ({ ...p, owner: actor, home, supers: saved.current_supers, fed: saved.current_fed }))
      void refetchStats(); void load()
      if (saved.skin_granted) void refetchInventory()
      notifyRewardIndicators()
      return { ok: true, supers: saved.supers, fed: saved.fed, skinGranted: saved.skin_granted, ...(saved.snack ? { snack: saved.snack } : {}) }
    } catch {
      if (active()) setFeedIssue({ actor, home, message: superJellySaveError() })
      return none
    } finally {
      if (busyRef.current === token) busyRef.current = null
      if (active()) {
        setFeeding(false); setFeedPending(pendingSuperJellyFeeds(actor, home).length > 0)
        notifyRewardIndicators()
      }
    }
  }, [user?.id, home, progress.supers, progress.fed, supabase, refetchStats, load, refetchInventory])

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
    feeding,
    feedPending: feedPending && Boolean(user?.id && home && pendingSuperJellyFeeds(user.id, home).length),
    feedError: feedIssue?.actor === user?.id && feedIssue?.home === home ? feedIssue.message : null,
    roundsPending: user?.id && home ? pendingJellyRounds(user.id, home) : [],
    feedSuper,
    reload: load,
  }
}

/** UTC day string, matching the table's `day` default so both agree at midnight. */
function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}
