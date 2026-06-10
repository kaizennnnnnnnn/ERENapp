'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from './useAuth'
import { useTasks } from '@/contexts/TaskContext'
import type { UserGachaState, GachaPullResult } from '@/types'
import { rollRarity, rollItem, DUPLICATE_STARDUST, PULL_COST_SINGLE, PULL_COST_TEN, getItemById } from '@/lib/gacha'

// Resolve a pulled item into the inventory: insert the first copy, bump the
// quantity on a duplicate. The owned-row read must distinguish "request
// failed" from "not owned" — on a transient 503 a duplicate used to be
// treated as new, so the stardust compensation was skipped AND the insert
// died silently on unique(user_id, item_id): the paid pull granted nothing.
// When the read fails (or races), the unique constraint itself is the
// arbiter: a rejected insert means duplicate, recovered via re-read + bump.
async function resolveDrop(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  itemId: string,
): Promise<'new' | 'dup' | 'failed'> {
  const owned = () => supabase
    .from('user_inventory')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle()

  // Once a duplicate is confirmed, it IS a dup regardless of whether the
  // quantity bump lands — the stardust compensation is the paid value, the
  // quantity count is cosmetic. (The old code ignored this error too.)
  const bump = async (row: { id: string; quantity: number }) => {
    await supabase
      .from('user_inventory')
      .update({ quantity: row.quantity + 1 })
      .eq('id', row.id)
    return 'dup' as const
  }

  const { data: existing } = await withRetry(owned)
  if (existing) return bump(existing)

  const { error: insertError } = await supabase
    .from('user_inventory')
    .insert({ user_id: userId, item_id: itemId, quantity: 1, equipped: false })
  if (!insertError) return 'new'

  const { data: recheck } = await withRetry(owned)
  return recheck ? bump(recheck) : 'failed'
}

export function useGacha() {
  const supabase = createClient()
  const { user } = useAuth()
  const { coins, spendCoins } = useTasks()

  const [state, setState] = useState<UserGachaState | null>(null)
  const [pulling, setPulling] = useState(false)

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

  // ── Single pull ──
  const pullSingle = useCallback(async (bannerId: string, useTicket = false): Promise<GachaPullResult | null> => {
    if (!user?.id || !state || pulling) return null

    // Pay
    if (useTicket) {
      if ((state as unknown as Record<string, number>).gacha_tickets <= 0) return null
      await supabase.from('user_gacha_state').update({
        gacha_tickets: ((state as unknown as Record<string, number>).gacha_tickets ?? 0) - 1,
      }).eq('user_id', user.id)
    } else {
      if (PULL_COST_SINGLE > 0) {
        if (coins < PULL_COST_SINGLE) return null
        const ok = await spendCoins(PULL_COST_SINGLE)
        if (!ok) return null
      }
    }

    setPulling(true)

    // Roll
    const rarity = rollRarity(state.pulls_since_epic, state.pulls_since_legendary)
    const item = rollItem(rarity, bannerId)
    const isPity = (rarity === 'epic' && state.pulls_since_epic >= 29) ||
                   (rarity === 'legendary' && state.pulls_since_legendary >= 99)

    const outcome = await resolveDrop(supabase, user.id, item.id)
    const isNew = outcome === 'new'
    const stardustGained = outcome === 'dup' ? DUPLICATE_STARDUST[rarity] : 0

    // Log the pull
    const newTotal = state.total_pulls + 1
    await supabase.from('gacha_pull_log').insert({
      user_id: user.id, banner_id: bannerId, item_id: item.id, rarity, pull_number: newTotal,
    })

    // Update pity counters
    const newState = {
      total_pulls: newTotal,
      pulls_since_epic: rarity === 'epic' || rarity === 'legendary' ? 0 : state.pulls_since_epic + 1,
      pulls_since_legendary: rarity === 'legendary' ? 0 : state.pulls_since_legendary + 1,
      stardust: state.stardust + stardustGained,
    }
    await supabase.from('user_gacha_state').update(newState).eq('user_id', user.id)
    setState(prev => prev ? { ...prev, ...newState } : prev)

    setPulling(false)
    return { item, isNew, stardustGained, isPity }
  }, [user?.id, state, pulling, coins, spendCoins]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ten-pull ──
  const pullTen = useCallback(async (bannerId: string): Promise<GachaPullResult[] | null> => {
    if (!user?.id || !state || pulling) return null
    if (PULL_COST_TEN > 0) {
      if (coins < PULL_COST_TEN) return null
      const ok = await spendCoins(PULL_COST_TEN)
      if (!ok) return null
    }

    setPulling(true)
    const results: GachaPullResult[] = []

    let pse = state.pulls_since_epic
    let psl = state.pulls_since_legendary
    let tp = state.total_pulls
    let sd = state.stardust

    for (let i = 0; i < 10; i++) {
      // On pull 10, guarantee at least rare
      let rarity = rollRarity(pse, psl)
      if (i === 9 && rarity === 'common') rarity = 'rare'

      const item = rollItem(rarity, bannerId)
      const isPity = (rarity === 'epic' && pse >= 29) || (rarity === 'legendary' && psl >= 99)

      tp++
      if (rarity === 'epic' || rarity === 'legendary') pse = 0; else pse++
      if (rarity === 'legendary') psl = 0; else psl++

      const outcome = await resolveDrop(supabase, user.id, item.id)
      const isNew = outcome === 'new'
      let stardustGained = 0
      if (outcome === 'dup') {
        stardustGained = DUPLICATE_STARDUST[rarity]
        sd += stardustGained
      }

      // Log
      await supabase.from('gacha_pull_log').insert({
        user_id: user.id, banner_id: bannerId, item_id: item.id, rarity, pull_number: tp,
      })

      results.push({ item, isNew, stardustGained, isPity })
    }

    // Update state
    const newState = { total_pulls: tp, pulls_since_epic: pse, pulls_since_legendary: psl, stardust: sd }
    await supabase.from('user_gacha_state').update(newState).eq('user_id', user.id)
    setState(prev => prev ? { ...prev, ...newState } : prev)

    setPulling(false)
    return results
  }, [user?.id, state, pulling, coins, spendCoins]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    state, pulling, pullSingle, pullTen, coins,
    stardust: state?.stardust ?? 0,
    pityEpic: state ? state.pulls_since_epic : 0,
    pityLegendary: state ? state.pulls_since_legendary : 0,
    tickets: (state as unknown as Record<string, number>)?.gacha_tickets ?? 0,
    refetch: fetchState,
  }
}
