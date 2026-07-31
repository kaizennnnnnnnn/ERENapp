'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from './useAuth'
import type { UserInventoryItem } from '@/types'
import { GACHA_ITEMS } from '@/lib/gacha'
import { useErenStats } from './useErenStats'

export function useInventory() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const [inventory, setInventory] = useState<UserInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  // Flips true after the FIRST successful fetch (stays true thereafter). Lets
  // callers tell "loaded, owns nothing" apart from "fetch 503'd, empty by
  // default" — `loading` goes false in both cases. The new-skin badge seeds
  // its baseline only once this is true so a transient outage can't make the
  // whole collection look brand-new.
  const [loaded, setLoaded] = useState(false)

  // True when the last fetch hit a Supabase outage that outlasted
  // withRetry's backoff — the focus listener below uses it to refetch.
  const loadFailedRef = useRef(false)

  const fetchInventory = useCallback(async () => {
    if (!user?.id) return
    const { data, error } = await withRetry(() => supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', user.id))
    if (error) {
      // Keep whatever inventory we already have — a 503 must not read as
      // "owns nothing" (it blanked equipped cosmetics and the collection).
      loadFailedRef.current = true
      setLoading(false)
      return
    }
    loadFailedRef.current = false
    if (data) setInventory(data)
    setLoaded(true)
    setLoading(false)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchInventory() }, [fetchInventory])

  // Self-heal after an outage: nothing else refetches the inventory (the
  // equip/use refetches need items the user can no longer see).
  useEffect(() => {
    return onForeground(() => { if (loadFailedRef.current) fetchInventory() })
  }, [fetchInventory])

  const ownsItem = useCallback((itemId: string) => {
    return inventory.some(i => i.item_id === itemId)
  }, [inventory])

  const getQuantity = useCallback((itemId: string) => {
    return inventory.find(i => i.item_id === itemId)?.quantity ?? 0
  }, [inventory])

  // No equip API any more. Equipping only ever applied to the emoji outfit /
  // decoration / background / frame items, which are gone; skins are assigned
  // per-room in the Closet (eren_stats.room_skins) and consumables are used.
  // The `equipped` column is left alone — old rows are harmless.

  // Use a consumable item (apply buff, decrement quantity)
  const useItem = useCallback(async (itemId: string): Promise<{ success: boolean; message: string }> => {
    if (!user?.id || !profile?.household_id) return { success: false, message: 'Not logged in' }
    const item = GACHA_ITEMS.find(g => g.id === itemId)
    if (!item || item.category !== 'consumable' || !item.buff) return { success: false, message: 'Not a consumable' }
    const inv = inventory.find(i => i.item_id === itemId)
    if (!inv || inv.quantity <= 0) return { success: false, message: 'You don\'t have this item' }

    // Read current stats BEFORE consuming the item. The old order
    // decremented first, so a transient 503 on the stat read destroyed the
    // consumable with zero effect (and the partial all-stat branch computed
    // NaN from the failed read, voiding the whole update). A full restore
    // needs no read at all.
    const amount = item.buff.amount
    const isFullRestore = item.buff.stat === 'all' && amount >= 100
    let current: Record<string, number> = {}
    if (!isFullRestore) {
      const cols = item.buff.stat === 'all'
        ? 'happiness, hunger, energy, sleep_quality, cleanliness'
        : item.buff.stat
      const { data, error } = await withRetry(() => supabase
        .from('eren_stats').select(cols).eq('household_id', profile.household_id).maybeSingle())
      if (error || !data) return { success: false, message: 'Connection hiccup — nothing used, try again' }
      current = data as Record<string, number>
    }

    // Apply buff to eren_stats
    const update: Record<string, number> = {}
    if (item.buff.stat === 'all') {
      for (const stat of ['happiness', 'hunger', 'energy', 'sleep_quality', 'cleanliness']) {
        update[stat] = isFullRestore ? 100 : Math.min(100, (current[stat] ?? 0) + amount)
      }
    } else {
      update[item.buff.stat] = Math.min(100, (current[item.buff.stat] ?? 0) + amount)
    }
    const { error: buffError } = await supabase.from('eren_stats')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('household_id', profile.household_id)
    if (buffError) return { success: false, message: 'Connection hiccup — nothing used, try again' }

    // Consume only after the buff landed.
    if (inv.quantity === 1) {
      await supabase.from('user_inventory').delete().eq('id', inv.id)
    } else {
      await supabase.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('id', inv.id)
    }

    await fetchInventory()
    return { success: true, message: `Used ${item.name}!` }
  }, [user?.id, profile?.household_id, inventory, fetchInventory]) // eslint-disable-line react-hooks/exhaustive-deps

  // Collection stats
  // Count only rows whose item still exists. Deleting the emoji tiers left
  // real inventory rows pointing at ids that are gone; counting those would
  // push the collection past 100% (and the bar past its track).
  const catalogue = new Set(GACHA_ITEMS.map(i => i.id))
  const ownedCount = new Set(inventory.map(i => i.item_id).filter(id => catalogue.has(id))).size
  const totalItems = GACHA_ITEMS.length
  const collectionPct = Math.round((ownedCount / totalItems) * 100)

  return { inventory, loading, loaded, ownsItem, getQuantity, useItem, collectionPct, ownedCount, totalItems, refetch: fetchInventory }
}
