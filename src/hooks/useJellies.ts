'use client'

import { useCallback, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { useInventory } from './useInventory'
import { useErenStats } from './useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { grantSkin } from '@/lib/skinGrant'
import {
  JELLIES, JELLY_COUNT, JELLY_SKIN_ID, itemIdToJellyId, jellyItemId,
  rollEffect, rollJelly, type JellyDef, type JellyEffect,
} from '@/lib/jellies'

// ─── useJellies ─────────────────────────────────────────────────────────────
// Owns the jelly collection: what you have, and what happens when a Parlour
// round pays one out.
//
// Storage is user_inventory rows (`jelly_red`, …) — see lib/jellies.ts for why
// that needs no migration. It also means the award path is the same insert-first
// shape as a skin grant: attempt the insert blind and let the unique constraint
// answer "is this my first one", so two devices finishing a round at the same
// moment can't both think they completed the set.
//
// The effect is applied through feedWithFood with zero hunger/joy/weight, which
// turns it into a pure buff channel — the jelly's own MonstaBuff is the only
// thing that lands. Coins are the one field eren_stats can't hold, so they're
// paid through TaskContext, and only AFTER the stat write succeeds: a failed
// round must not mint money.

const UNIQUE_VIOLATION = '23505'

export interface JellyWin {
  jelly: JellyDef
  effect: JellyEffect
  /** First one of this flavour — the collection shelf lights it up. */
  isNew: boolean
  /** This win completed all five and Eren Jelly was granted just now. */
  completedSet: boolean
}

export function useJellies() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { inventory, loaded, loading, refetch } = useInventory()
  const { feedWithFood } = useErenStats(profile?.household_id ?? null)
  const { addCoins } = useTasks()
  const [awarding, setAwarding] = useState(false)

  const owned = useMemo(() => {
    const s = new Set<string>()
    for (const row of inventory) {
      const id = itemIdToJellyId(row.item_id)
      if (id) s.add(id)
    }
    return s
  }, [inventory])

  const ownsSkin = useMemo(
    () => inventory.some(r => r.item_id === `skin_${JELLY_SKIN_ID}`),
    [inventory],
  )

  /**
   * Pay out one jelly for a finished round. Returns null only when the write
   * genuinely failed — the caller shows nothing rather than a fake prize.
   */
  const awardJelly = useCallback(async (): Promise<JellyWin | null> => {
    if (!user?.id || awarding) return null
    setAwarding(true)
    try {
      const jelly = rollJelly(owned)
      const effect = rollEffect(jelly)
      const itemId = jellyItemId(jelly.id)

      // Insert-first: the constraint, not a prior read, decides "is this new".
      const { error } = await supabase
        .from('user_inventory')
        .insert({ user_id: user.id, item_id: itemId, quantity: 1, equipped: false })
      let isNew = !error
      if (error) {
        if (error.code !== UNIQUE_VIOLATION) return null
        // Duplicate — still a win, it just bumps the pile. The effect fires
        // either way, so a repeat flavour is never a wasted round.
        const { data: row } = await supabase
          .from('user_inventory')
          .select('id, quantity')
          .eq('user_id', user.id).eq('item_id', itemId).maybeSingle()
        if (row) await supabase.from('user_inventory').update({ quantity: row.quantity + 1 }).eq('id', row.id)
        isNew = false
      }

      // The jelly does its thing. Zero hunger/joy/weight → only the buff lands.
      const result = await feedWithFood(user.id, 0, 0, 0, effect.buff)
      if (result.success && effect.buff.coins) void addCoins(effect.buff.coins)

      // Set complete? `owned` is the pre-award snapshot, so add this one first.
      const after = new Set(owned); after.add(jelly.id)
      let completedSet = false
      if (after.size >= JELLY_COUNT && !ownsSkin) {
        completedSet = (await grantSkin(user.id, JELLY_SKIN_ID)) === 'new'
      }

      void refetch()
      return { jelly, effect, isNew, completedSet }
    } finally {
      setAwarding(false)
    }
  }, [user?.id, awarding, owned, ownsSkin, supabase, feedWithFood, addCoins, refetch])

  return {
    /** Flavour ids the user owns. */
    owned,
    ownedCount: owned.size,
    total: JELLY_COUNT,
    complete: owned.size >= JELLY_COUNT,
    ownsSkin,
    /** Catalogue in display order, each flagged with whether it's yours. */
    shelf: JELLIES.map(j => ({ jelly: j, owned: owned.has(j.id) })),
    loading,
    loaded,
    awarding,
    awardJelly,
  }
}
