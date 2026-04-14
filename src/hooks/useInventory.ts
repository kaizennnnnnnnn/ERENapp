'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { UserInventoryItem, GachaCategory } from '@/types'
import { GACHA_ITEMS } from '@/lib/gacha'

export function useInventory() {
  const supabase = createClient()
  const { user } = useAuth()
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

  // Collection stats
  const ownedCount = new Set(inventory.map(i => i.item_id)).size
  const totalItems = GACHA_ITEMS.length
  const collectionPct = Math.round((ownedCount / totalItems) * 100)

  return { inventory, loading, ownsItem, getQuantity, getEquipped, equipItem, unequipItem, collectionPct, ownedCount, totalItems, refetch: fetchInventory }
}
