'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { useAuth } from './useAuth'
import { useTasks } from '@/contexts/TaskContext'
import type { FortuneGiftDef } from '@/types'
import { rollFortuneGift, canClaimFortune } from '@/lib/fortune'

export function useFortune() {
  const supabase = createClient()
  const { user } = useAuth()
  const { addCoins } = useTasks()

  const [canClaim, setCanClaim] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [lastGift, setLastGift] = useState<FortuneGiftDef | null>(null)

  // Check if fortune is claimable today — prefer localStorage for instant sync
  const checkClaimable = useCallback(async () => {
    if (!user?.id) return

    // Check localStorage first (instant, shared across all hook instances in same tab)
    const localLast = localStorage.getItem(`eren_fortune_last_${user.id}`)
    if (localLast && !canClaimFortune(localLast)) {
      setCanClaim(false)
      return
    }

    // Fallback to DB check. maybeSingle + error check: a transient 503 must
    // not read as "never claimed" — on any device without the localStorage
    // stamp that used to show the fortune as claimable again and allow a
    // duplicate daily claim. On error keep the current value; the focus
    // listener and 60s poll are the natural retry.
    const { data, error } = await supabase
      .from('user_gacha_state')
      .select('last_free_fortune')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) return

    if (!data) {
      setCanClaim(true)
    } else {
      const claimable = canClaimFortune(data.last_free_fortune)
      setCanClaim(claimable)
      // Sync DB value to localStorage so other hook instances stay in sync
      if (data.last_free_fortune) {
        localStorage.setItem(`eren_fortune_last_${user.id}`, data.last_free_fortune)
      }
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { checkClaimable() }, [checkClaimable])

  // Re-check on window focus + on a storage event (when another hook instance claims)
  useEffect(() => {
    const onFocus = () => checkClaimable()
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('eren_fortune_last_')) checkClaimable()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    // Backup poll — focus/storage events are the primary sync paths, but this
    // is the ONLY path that clears a stale claimable button after the partner
    // claims on another device, so it must keep running. 60s + visible-only
    // instead of an unconditional 5s: that was ~720 radio wakes/hour on the
    // idle home screen for a sync whose worst case is a once-a-day claim.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') checkClaimable()
    }, 60_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
      clearInterval(interval)
    }
  }, [checkClaimable])

  const claimFortune = useCallback(async (): Promise<FortuneGiftDef | null> => {
    if (!user?.id || !canClaim || claiming) return null
    setCanClaim(false) // Immediately prevent double-claim
    setClaiming(true)

    const gift = rollFortuneGift()

    // Read everything the grant needs BEFORE stamping the claim. These reads
    // used to run after last_free_fortune was written, so a transient 503
    // consumed the day's fortune while silently skipping the payout (the gift
    // animation still played). Aborting here is safe: nothing is written yet,
    // so the fortune stays claimable and the user can simply tap again.
    let balances: Record<string, number> = {}
    if (gift.stardustValue || gift.gachaTickets) {
      const { data, error } = await withRetry(() => supabase
        .from('user_gacha_state')
        .select('stardust, gacha_tickets')
        .eq('user_id', user.id)
        .maybeSingle())
      if (error) {
        setClaiming(false)
        setCanClaim(true)
        return null
      }
      balances = (data ?? {}) as Record<string, number>
    }

    // Keepsake gifts need the owned-row lookup up front too. maybeSingle so
    // a brand-new item (0 rows) doesn't 406.
    const isKeepsake = !gift.coinValue && !gift.stardustValue && !gift.gachaTickets
    let existingKeepsake: { id: string; quantity: number } | null = null
    if (isKeepsake) {
      const { data: existing, error } = await withRetry(() => supabase
        .from('user_inventory')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('item_id', gift.id)
        .maybeSingle())
      if (error) {
        setClaiming(false)
        setCanClaim(true)
        return null
      }
      existingKeepsake = existing
    }

    // Save to localStorage FIRST so all hook instances instantly see it's claimed
    const now = new Date().toISOString()
    localStorage.setItem(`eren_fortune_last_${user.id}`, now)
    // Re-assert: a checkClaimable poll/focus tick may have resolved true while
    // the pre-claim reads above were in flight, overriding the false at entry.
    setCanClaim(false)

    // Ensure gacha state row exists (upsert)
    await supabase.from('user_gacha_state').upsert({
      user_id: user.id,
      last_free_fortune: now,
    }, { onConflict: 'user_id' })

    // Apply gift effects
    if (gift.coinValue) {
      await addCoins(gift.coinValue)
    }

    if (gift.stardustValue) {
      await supabase.from('user_gacha_state')
        .update({ stardust: (balances.stardust ?? 0) + (gift.stardustValue ?? 0) })
        .eq('user_id', user.id)
    }

    if (gift.gachaTickets) {
      await supabase.from('user_gacha_state')
        .update({ gacha_tickets: (balances.gacha_tickets ?? 0) + gift.gachaTickets })
        .eq('user_id', user.id)
    }

    if (isKeepsake) {
      if (existingKeepsake) {
        await supabase.from('user_inventory').update({ quantity: existingKeepsake.quantity + 1 }).eq('id', existingKeepsake.id)
      } else {
        await supabase.from('user_inventory').insert({ user_id: user.id, item_id: gift.id, quantity: 1, equipped: false })
      }
    }

    setClaiming(false)
    setLastGift(gift)
    return gift
  }, [user?.id, canClaim, claiming, addCoins]) // eslint-disable-line react-hooks/exhaustive-deps

  return { canClaim, claiming, claimFortune, lastGift }
}
