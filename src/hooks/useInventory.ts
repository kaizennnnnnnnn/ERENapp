'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from './useAuth'
import type { UserInventoryItem } from '@/types'
import { GACHA_ITEMS } from '@/lib/gacha'
import { useErenStats } from './useErenStats'
import { pendingInventoryItem, saveInventoryItem, inventoryItemError } from '@/lib/inventoryItemSaves'

export function useInventory() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { acceptInventoryItemSave } = useErenStats()
  const actor = user?.id ?? null, home = profile?.household_id ?? null
  const scope = useRef({ actor, home })
  if (scope.current.actor !== actor || scope.current.home !== home) scope.current = { actor, home }
  const currentScope = scope.current
  const mounted = useRef(false), epoch = useRef(0), readVersion = useRef(0), lock = useRef<symbol | null>(null)
  const [usingItemId, setUsingItemId] = useState<string | null>(null)
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [useError, setUseError] = useState<string | null>(null)
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
    if (!actor || scope.current !== currentScope) return
    const version = ++readVersion.current, generation = epoch.current
    const { data, error } = await withRetry(() => supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', actor))
    if (!mounted.current || scope.current !== currentScope || generation !== epoch.current || version !== readVersion.current) return
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
  }, [currentScope]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mounted.current = true; lock.current = null; readVersion.current++
    setInventory([]); setLoaded(false); setLoading(Boolean(actor)); setUsingItemId(null); setUseError(null)
    const sync = () => setPendingItemId(actor && home ? pendingInventoryItem(actor, home)?.itemId ?? null : null)
    sync(); void fetchInventory()
    const off = onForeground(() => { sync(); if (loadFailedRef.current) void fetchInventory() })
    return () => { mounted.current = false; epoch.current++; readVersion.current++; off() }
  }, [actor, home, fetchInventory])

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

  const useItem = useCallback(async (itemId: string, recover = false): Promise<{ success: boolean; message: string }> => {
    const failure = (reason: string) => ({ success: false, message: inventoryItemError(reason) })
    if (!actor || !home || scope.current !== currentScope || !mounted.current) return failure('session_changed')
    if (lock.current) return failure('busy')
    const pending = pendingInventoryItem(actor, home)
    const item = GACHA_ITEMS.find(g => g.id === (recover ? pending?.itemId : itemId) && g.category === 'consumable')
    if (!item) return failure('no_stock')
    const token = Symbol(), generation = epoch.current
    lock.current = token; setUsingItemId(item.id); setUseError(null)
    const active = () => mounted.current && scope.current === currentScope && epoch.current === generation
    try {
      const result = await saveInventoryItem(supabase, actor, home, item.id, recover)
      if (!active()) return failure('session_changed')
      if (!result.ok) {
        const message = inventoryItemError(result.reason)
        setUseError(message)
        if (result.reason === 'no_stock') void fetchInventory()
        return { success: false, message }
      }
      // The confirmed response is sufficient: no blocking follow-up fetch.
      readVersion.current++
      setInventory(prev => [...prev.filter(i => i.item_id !== result.item_id), ...(result.inventory_item ? [result.inventory_item] : [])])
      acceptInventoryItemSave(result)
      // Recovery is available before the first inventory read has finished.
      // Replace that now-invalidated read without holding the action open.
      if (!loaded) void fetchInventory()
      return { success: true, message: `Used ${item.name}!` }
    } catch {
      if (active()) setUseError(inventoryItemError())
      return failure('connection')
    } finally {
      if (active() && lock.current === token) {
        lock.current = null; setUsingItemId(null)
        setPendingItemId(pendingInventoryItem(actor, home)?.itemId ?? null)
      }
    }
  }, [actor, home, currentScope, acceptInventoryItemSave, fetchInventory, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Collection stats
  // Count only rows whose item still exists. Deleting the emoji tiers left
  // real inventory rows pointing at ids that are gone; counting those would
  // push the collection past 100% (and the bar past its track).
  const catalogue = new Set(GACHA_ITEMS.map(i => i.id))
  const ownedCount = new Set(inventory.map(i => i.item_id).filter(id => catalogue.has(id))).size
  const totalItems = GACHA_ITEMS.length
  const collectionPct = Math.round((ownedCount / totalItems) * 100)

  return { inventory, loading, loaded, ownsItem, getQuantity, useItem, usingItemId, pendingItemId, useError,
    collectionPct, ownedCount, totalItems, refetch: fetchInventory }
}
