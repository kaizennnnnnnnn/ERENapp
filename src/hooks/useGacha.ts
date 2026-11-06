'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth, PROFILE_UPDATED_EVENT } from './useAuth'
import { useErenStats } from './useErenStats'
import { pendingSavedRpcs, prepareSavedRpc, savedRpc } from '@/lib/savedRpc'
import { receiveRewardNews } from '@/lib/rewardNews'
import { useTasks } from '@/contexts/TaskContext'
import type { UserGachaState, GachaPullResult, GachaRarity } from '@/types'
import { getItemById } from '@/lib/gacha'
import { skinItemId } from '@/lib/skins'
import { FREE_FOOD_RPC, freeFoodWait, notifyRewardIndicators } from '@/lib/rewardIndicators'

export interface SkinPurchaseResult {
  ok: boolean
  /** 'insufficient' | 'already_owned' | 'no_state' | 'error' | 'not_ready' | ... */
  reason?: string
  /** New stardust balance after the purchase (present on the server paths). */
  stardust?: number
}

interface PullReceipt {
  ok: boolean
  reason?: string
  coins?: number
  state?: UserGachaState
  results?: { itemId: string; isNew: boolean; stardustGained: number; isPity: boolean }[]
}

export function useGacha() {
  const supabase = createClient()
  const { user } = useAuth()
  const { coins } = useTasks()
  const { refetch: refetchFridge } = useErenStats()

  const [state, setState] = useState<UserGachaState | null>(null)
  const [pulling, setPulling] = useState(false)
  const [pullError, setPullError] = useState<string | null>(null)
  const [retryPull, setRetryPull] = useState<{ bannerId: string; count: 1 | 10 } | null>(null)
  const pullLock = useRef<symbol | null>(null)
  const activeUser = useRef(user?.id); activeUser.current = user?.id
  const alive = useRef(true)
  const readVersion = useRef(0)
  const [now, setNow] = useState(0)
  useEffect(() => {
    alive.current = true; pullLock.current = null; readVersion.current++
    setState(null); setPulling(false); setPullError(null); setRetryPull(null); setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => { alive.current = false; readVersion.current++; clearInterval(timer) }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const free = pendingSavedRpcs(user.id, FREE_FOOD_RPC)[0]
    if (free) {
      setRetryPull({ bannerId: 'food', count: 1 })
      setPullError('Your free food pull needs confirmation. Try again to recover it.')
      return
    }
    const previous = pendingSavedRpcs(user.id, 'pull_gacha_atomic')[0]?.args
    if (previous && typeof previous.p_banner_id === 'string' && (previous.p_count === 1 || previous.p_count === 10)) {
      setRetryPull({ bannerId: previous.p_banner_id, count: previous.p_count })
      setPullError('Your last pull needs confirmation. Try again to recover it without paying twice.')
    }
  }, [user?.id])

  // ── Load or init gacha state ──
  const fetchState = useCallback(async () => {
    if (!user?.id) return
    const version = ++readVersion.current
    const active = () => alive.current && activeUser.current === user.id && readVersion.current === version
    // maybeSingle + error check: "request failed" must not be confused
    // with "no row yet". A transient Supabase 503 used to fall through to
    // the init branch and reset pity counters/stardust in client state,
    // which the next pull then wrote back to the DB.
    const { data, error } = await withRetry(() => supabase
      .from('user_gacha_state')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle())
    if (!active() || error) return // outage — leave state null; the focus listener retries

    if (data) {
      setState(data)
    } else {
      // Genuinely no row — first visit. Create initial state.
      const init: UserGachaState = {
        user_id: user.id,
        stardust: 0,
        pulls_since_epic: 0,
        pulls_since_legendary: 0,
        total_pulls: 0,
        last_free_fortune: null,
      }
      const { data: inserted, error: insertError } = await supabase.from('user_gacha_state').insert(init).select('*').single()
      if (!active()) return
      if (!insertError && inserted) {
        setState(inserted)
      } else {
        // Most likely a conflict: another writer (fortune claim, rewards
        // page) created the row between our read and insert. Re-read once —
        // that row carries the real state.
        const { data: row } = await withRetry(() => supabase
          .from('user_gacha_state').select('*').eq('user_id', user.id).maybeSingle())
        if (active() && row) setState(row)
      }
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchState() }, [fetchState])

  // Refresh cooldowns and recover failed reads when the app returns.
  useEffect(() => {
    return onForeground(fetchState)
  }, [fetchState])

  const pull = useCallback(async (bannerId: string, count: 1 | 10, useTicket = false): Promise<GachaPullResult[] | null> => {
    if (!user?.id || pullLock.current) return null
    const actor = user.id, token = Symbol('pull')
    const active = () => alive.current && activeUser.current === actor && pullLock.current === token
    pullLock.current = token
    setPulling(true)
    setPullError(null)
    try {
      const paidPending = pendingSavedRpcs(actor, 'pull_gacha_atomic').some(r => r.slot === `${bannerId}:${count}`)
      const freePending = pendingSavedRpcs(actor, FREE_FOOD_RPC).length > 0
      const free = bannerId === 'food' && count === 1 && !paidPending
        && (freePending || freeFoodWait(state?.user_id === actor ? state as unknown as Record<string, unknown> : null, Date.now()) === 0)
      const validate = (r: PullReceipt) => r.state?.user_id === actor && Array.isArray(r.results) && r.results.length === count
        && Number.isSafeInteger(r.coins) && r.results.every(item => Boolean(getItemById(item.itemId)))
      const rpc = free ? FREE_FOOD_RPC : 'pull_gacha_atomic', slot = free ? 'food' : `${bannerId}:${count}`
      const args = free ? { p_expected_user: actor } : { p_banner_id: bannerId, p_count: count, p_use_ticket: useTicket }
      const intent = prepareSavedRpc(actor, rpc, slot, args)
      const receipt = await savedRpc<PullReceipt>(supabase, actor, rpc, slot, args, false, validate)
      if (!active()) return null
      if (!receipt.ok) {
        const failedState = (receipt as PullReceipt).state
        if (failedState?.user_id === actor) { readVersion.current++; setState(failedState); notifyRewardIndicators() }
        setRetryPull(receipt.reason === 'connection' ? { bannerId, count } : null)
        setPullError(receipt.reason === 'not_ready'
          ? 'Pulls are waiting for a saving update. No coins or tickets were spent.'
          : receipt.reason === 'insufficient' ? 'Not enough coins for this pull.'
          : receipt.reason === 'no_ticket' ? 'No free tickets left. Please try again.'
          : receipt.reason === 'cooldown' ? 'The free food pull was already used. Nothing was spent.'
          : 'Could not confirm your pull. Tap the same pull again to recover it without paying twice.')
        return null
      }
      const saved = receipt as PullReceipt
      if (!saved.state || !saved.results || saved.results.length !== count || typeof saved.coins !== 'number') {
        throw new Error('Incomplete pull receipt')
      }
      const results = saved.results.map(result => {
        const item = getItemById(result.itemId)
        if (!item) throw new Error('Unknown reward in receipt')
        return { item, isNew: result.isNew, stardustGained: result.stardustGained, isPity: result.isPity }
      })
      readVersion.current++
      setState(saved.state)
      setNow(Date.now())
      setRetryPull(null)
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { id: user.id, patch: { coins: saved.coins } } }))
      // Consumables were stocked inside the transaction, never in the page.
      void refetchFridge()
      notifyRewardIndicators()
      if (bannerId === 'food') receiveRewardNews(actor, 'kitchen', `gacha:${intent.id}`)
      return results
    } catch {
      if (active()) setPullError('Could not confirm your pull. Check your collection before trying again.')
      return null
    } finally {
      if (pullLock.current === token) {
        pullLock.current = null
        if (alive.current && activeUser.current === actor) setPulling(false)
      }
    }
  }, [user?.id, refetchFridge, state]) // eslint-disable-line react-hooks/exhaustive-deps

  const pullSingle = useCallback(async (bannerId: string, useTicket = false) =>
    (await pull(bannerId, 1, useTicket))?.[0] ?? null, [pull])
  const pullTen = useCallback((bannerId: string) => pull(bannerId, 10), [pull])

  // ── Buy a skin outright with stardust ──
  // Atomic on the server (deduct dust + grant the skin in one transaction; see
  // supabase/migration_skin_stardust_shop.sql). We sync the returned balance into
  // local state so the closet header updates without a refetch. Ownership lands
  // in user_inventory — the caller refetches the closet's owned set to unlock it.
  const purchaseSkin = useCallback(async (skinId: string, rarity: GachaRarity): Promise<SkinPurchaseResult> => {
    if (!user?.id) return { ok: false, reason: 'not_ready' }
    // Price is derived server-side from rarity — the client never sends the cost.
    const { data, error } = await supabase.rpc('purchase_skin_with_stardust', {
      p_item_id: skinItemId(skinId),
      p_rarity: rarity,
    })
    if (error) return { ok: false, reason: 'error' }
    const res = (data ?? { ok: false, reason: 'error' }) as SkinPurchaseResult
    if (typeof res.stardust === 'number') {
      setState(prev => (prev ? { ...prev, stardust: res.stardust! } : prev))
    }
    return res
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const ownState = state?.user_id === user?.id ? state : null
  const freeFoodIn = freeFoodWait(ownState as unknown as Record<string, unknown> | null, now)
  return {
    state: ownState, pulling, pullError, retryPull, clearPullError: () => setPullError(null), pullSingle, pullTen, purchaseSkin, coins,
    freeFoodReady: freeFoodIn === 0,
    freeFoodIn,
    stardust: ownState?.stardust ?? 0,
    pityEpic: ownState?.pulls_since_epic ?? 0,
    pityLegendary: ownState?.pulls_since_legendary ?? 0,
    tickets: ownState?.gacha_tickets ?? 0,
    refetch: fetchState,
  }
}
