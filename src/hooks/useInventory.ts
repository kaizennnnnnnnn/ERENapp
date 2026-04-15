'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { UserInventoryItem, GachaCategory } from '@/types'
import { GACHA_ITEMS } from '@/lib/gacha'
import { useErenStats } from './useErenStats'

export function useInventory() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const [inventory, setInventory] = useState<UserInventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInventory = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', user.id)
    if (data) setInventory(data)
    setLoading(false)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchInventory() }, [fetchInventory])

  const ownsItem = useCallback((itemId: string) => {
    return inventory.some(i => i.item_id === itemId)
  }, [inventory])

  const getQuantity = useCallback((itemId: string) => {
    return inventory.find(i => i.item_id === itemId)?.quantity ?? 0
  }, [inventory])

  const getEquipped = useCallback((category: GachaCategory) => {
    const equipped = inventory.find(i => i.equipped && GACHA_ITEMS.find(g => g.id === i.item_id)?.category === category)
    return equipped ? GACHA_ITEMS.find(g => g.id === equipped.item_id) : null
  }, [inventory])

  const equipItem = useCallback(async (itemId: string) => {
    if (!user?.id) return
    const item = GACHA_ITEMS.find(g => g.id === itemId)
    if (!item) return

    // Unequip all in same category
    const sameCategory = inventory.filter(i => {
      const def = GACHA_ITEMS.find(g => g.id === i.item_id)
      return def?.category === item.category && i.equipped
    })
    for (const i of sameCategory) {
      await supabase.from('user_inventory').update({ equipped: false }).eq('id', i.id)
    }

    // Equip the new one
    await supabase.from('user_inventory').update({ equipped: true }).eq('user_id', user.id).eq('item_id', itemId)
    await fetchInventory()
  }, [user?.id, inventory, fetchInventory]) // eslint-disable-line react-hooks/exhaustive-deps

  const unequipItem = useCallback(async (itemId: string) => {
    if (!user?.id) return
    await supabase.from('user_inventory').update({ equipped: false }).eq('user_id', user.id).eq('item_id', itemId)
    await fetchInventory()
  }, [user?.id, fetchInventory]) // eslint-disable-line react-hooks/exhaustive-deps

  // Use a consumable item (apply buff, decrement quantity)
  const useItem = useCallback(async (itemId: string): Promise<{ success: boolean; message: string }> => {
    if (!user?.id || !profile?.household_id) return { success: false, message: 'Not logged in' }
    const item = GACHA_ITEMS.find(g => g.id === itemId)
    if (!item || item.category !== 'consumable' || !item.buff) return { success: false, message: 'Not a consumable' }
    const inv = inventory.find(i => i.item_id === itemId)
    if (!inv || inv.quantity <= 0) return { success: false, message: 'You don\'t have this item' }

    // Decrement quantity (or delete if last one)
    if (inv.quantity === 1) {
      await supabase.from('user_inventory').delete().eq('id', inv.id)
    } else {
      await supabase.from('user_inventory').update({ quantity: inv.quantity - 1 }).eq('id', inv.id)
    }

    // Apply buff to eren_stats
    if (item.buff.stat === 'all') {
      const amount = item.buff.amount
      const isFullRestore = amount >= 100
      const update = isFullRestore
        ? { happiness: 100, hunger: 100, energy: 100, sleep_quality: 100, cleanliness: 100 }
        : {
            happiness: Math.min(100, (await supabase.from('eren_stats').select('happiness').eq('household_id', profile.household_id).single()).data?.happiness + amount),
            hunger: Math.min(100, (await supabase.from('eren_stats').select('hunger').eq('household_id', profile.household_id).single()).data?.hunger + amount),
            energy: Math.min(100, (await supabase.from('eren_stats').select('energy').eq('household_id', profile.household_id).single()).data?.energy + amount),
            sleep_quality: Math.min(100, (await supabase.from('eren_stats').select('sleep_quality').eq('household_id', profile.household_id).single()).data?.sleep_quality + amount),
            cleanliness: Math.min(100, (await supabase.from('eren_stats').select('cleanliness').eq('household_id', profile.household_id).single()).data?.cleanliness + amount),
          }
      await supabase.from('eren_stats').update({ ...update, updated_at: new Date().toISOString() }).eq('household_id', profile.household_id)
    } else {
      // Single stat buff
      const { data: current } = await supabase.from('eren_stats').select(item.buff.stat).eq('household_id', profile.household_id).single()
      if (current) {
        const val = Math.min(100, (current as unknown as Record<string, number>)[item.buff.stat] + item.buff.amount)
        await supabase.from('eren_stats').update({ [item.buff.stat]: val, updated_at: new Date().toISOString() }).eq('household_id', profile.household_id)
      }
    }

    await fetchInventory()
    return { success: true, message: `${item.icon} Used ${item.name}!` }
  }, [user?.id, profile?.household_id, inventory, fetchInventory]) // eslint-disable-line react-hooks/exhaustive-deps

  // Collection stats
  const ownedCount = new Set(inventory.map(i => i.item_id)).size
  const totalItems = GACHA_ITEMS.length
  const collectionPct = Math.round((ownedCount / totalItems) * 100)

  return { inventory, loading, ownsItem, getQuantity, getEquipped, equipItem, unequipItem, useItem, collectionPct, ownedCount, totalItems, refetch: fetchInventory }
}
