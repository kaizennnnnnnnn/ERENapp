'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { useTasks } from '@/contexts/TaskContext'
import type { UserGachaState, GachaPullResult } from '@/types'
import { rollRarity, rollItem, DUPLICATE_STARDUST, PULL_COST_SINGLE, PULL_COST_TEN, getItemById } from '@/lib/gacha'

export function useGacha() {
  const supabase = createClient()
  const { user } = useAuth()
  const { coins, spendCoins } = useTasks()

  const [state, setState] = useState<UserGachaState | null>(null)
  const [pulling, setPulling] = useState(false)

  // ── Load or init gacha state ──
  const fetchState = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('user_gacha_state')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setState(data)
    } else {
      // Create initial state
      const init: UserGachaState = {
        user_id: user.id,
        stardust: 0,
        pulls_since_epic: 0,
        pulls_since_legendary: 0,
        total_pulls: 0,
        last_free_fortune: null,
      }
      await supabase.from('user_gacha_state').insert(init)
      setState(init)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchState() }, [fetchState])

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
      if (coins < PULL_COST_SINGLE) return null
      const ok = await spendCoins(PULL_COST_SINGLE)
      if (!ok) return null
    }

    setPulling(true)

    // Roll
    const rarity = rollRarity(state.pulls_since_epic, state.pulls_since_legendary)
    const item = rollItem(rarity, bannerId)
    const isPity = (rarity === 'epic' && state.pulls_since_epic >= 29) ||
                   (rarity === 'legendary' && state.pulls_since_legendary >= 99)

    // Check if user already owns this item
    const { data: existing } = await supabase
      .from('user_inventory')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('item_id', item.id)
      .single()

    const isNew = !existing
    let stardustGained = 0

    if (existing) {
      // Duplicate → give stardust
      stardustGained = DUPLICATE_STARDUST[rarity]
      await supabase.from('user_inventory').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
    } else {
      // New item
      await supabase.from('user_inventory').insert({ user_id: user.id, item_id: item.id, quantity: 1, equipped: false })
    }

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
    if (coins < PULL_COST_TEN) return null
    const ok = await spendCoins(PULL_COST_TEN)
    if (!ok) return null

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

      // Inventory
      const { data: existing } = await supabase
        .from('user_inventory')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('item_id', item.id)
        .single()

      const isNew = !existing
      let stardustGained = 0

      if (existing) {
        stardustGained = DUPLICATE_STARDUST[rarity]
        sd += stardustGained
        await supabase.from('user_inventory').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
      } else {
        await supabase.from('user_inventory').insert({ user_id: user.id, item_id: item.id, quantity: 1, equipped: false })
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
