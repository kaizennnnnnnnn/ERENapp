'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth, PROFILE_UPDATED_EVENT } from './useAuth'
import { useErenStats } from './useErenStats'
import { pendingSavedRpcs, savedRpc } from '@/lib/savedRpc'
import { useTasks } from '@/contexts/TaskContext'
import type { UserGachaState, GachaPullResult, GachaRarity } from '@/types'
import { getItemById } from '@/lib/gacha'
import { skinItemId } from '@/lib/skins'

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
  const pullLock = useRef(false)

  useEffect(() => {
    if (!user?.id) return
    const previous = pendingSavedRpcs(user.id, 'pull_gacha_atomic')[0]?.args
    if (previous && typeof previous.p_banner_id === 'string' && (previous.p_count === 1 || previous.p_count === 10)) {
      setRetryPull({ bannerId: previous.p_banner_id, count: previous.p_count })
      setPullError('Your last pull needs confirmation. Try again to recover it without paying twice.')
    }
  }, [user?.id])

  // ── Load or init gacha state ──
  const fetchState = useCallback(async () => {
    if (!user?.id) return
    // maybeSingle + error check: "request failed" must not be confused
    // with "no row yet". A transient Supabase 503 used to fall through to
    // the init branch and reset pity counters/stardust in client state,
    // which the next pull then wrote back to the DB.
    const { data, error } = await withRetry(() => supabase
      .from('user_gacha_state')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle())
    if (error) return // outage — leave state null; the focus listener retries

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
      const { error: insertError } = await supabase.from('user_gacha_state').insert(init)
      if (!insertError) {
        setState(init)
      } else {
        // Most likely a conflict: another writer (fortune claim, rewards
        // page) created the row between our read and insert. Re-read once —
        // that row carries the real state.
        const { data: row } = await withRetry(() => supabase
          .from('user_gacha_state').select('*').eq('user_id', user.id).maybeSingle())
        if (row) setState(row)
      }
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchState() }, [fetchState])

  // Self-heal: state still null after mount means fetchState hit a Supabase
  // outage that outlasted withRetry's backoff. Retry when the app returns
  // to the foreground; the listener only exists while in the broken state.
  useEffect(() => {
    if (state) return
    return onForeground(fetchState)
  }, [state, fetchState])

  const pull = useCallback(async (bannerId: string, count: 1 | 10, useTicket = false): Promise<GachaPullResult[] | null> => {
    if (!user?.id || pullLock.current) return null
    pullLock.current = true
    setPulling(true)
    setPullError(null)
    try {
      const receipt = await savedRpc<PullReceipt>(supabase, user.id, 'pull_gacha_atomic', `${bannerId}:${count}`, {
        p_banner_id: bannerId, p_count: count, p_use_ticket: useTicket,
      })
      if (!receipt.ok) {
        setRetryPull(receipt.reason === 'connection' ? { bannerId, count } : null)
        setPullError(receipt.reason === 'not_ready'
          ? 'Pulls are waiting for a saving update. No coins or tickets were spent.'
          : receipt.reason === 'insufficient' ? 'Not enough coins for this pull.'
          : receipt.reason === 'no_ticket' ? 'No free tickets left. Please try again.'
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
      setState(saved.state)
      setRetryPull(null)
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { id: user.id, patch: { coins: saved.coins } } }))
      // Consumables were stocked inside the transaction, never in the page.
      void refetchFridge()
      return results
    } catch {
      setPullError('Could not confirm your pull. Check your collection before trying again.')
      return null
    } finally {
      pullLock.current = false
      setPulling(false)
    }
  }, [user?.id, refetchFridge]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return {
    state, pulling, pullError, retryPull, clearPullError: () => setPullError(null), pullSingle, pullTen, purchaseSkin, coins,
    stardust: state?.stardust ?? 0,
    pityEpic: state ? state.pulls_since_epic : 0,
    pityLegendary: state ? state.pulls_since_legendary : 0,
    tickets: (state as unknown as Record<string, number>)?.gacha_tickets ?? 0,
    refetch: fetchState,
  }
}
