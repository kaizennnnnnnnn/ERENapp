'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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

    // Fallback to DB check
    const { data } = await supabase
      .from('user_gacha_state')
      .select('last_free_fortune')
      .eq('user_id', user.id)
      .single()

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
    const interval = setInterval(checkClaimable, 5000) // poll every 5s as backup
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

    // Save to localStorage FIRST so all hook instances instantly see it's claimed
    const now = new Date().toISOString()
    localStorage.setItem(`eren_fortune_last_${user.id}`, now)

    // Ensure gacha state row exists (upsert)
    await supabase.from('user_gacha_state').upsert({
      user_id: user.id,
      last_free_fortune: now,
    }, { onConflict: 'user_id' })

    const gift = rollFortuneGift()

    // Apply gift effects
    if (gift.coinValue) {
      await addCoins(gift.coinValue)
    }

    if (gift.stardustValue) {
      const { data } = await supabase
        .from('user_gacha_state')
        .select('stardust')
        .eq('user_id', user.id)
        .single()
      if (data) {
        await supabase.from('user_gacha_state')
          .update({ stardust: (data.stardust ?? 0) + (gift.stardustValue ?? 0) })
          .eq('user_id', user.id)
      }
    }

    if (gift.gachaTickets) {
      const { data } = await supabase
        .from('user_gacha_state')
        .select('gacha_tickets')
        .eq('user_id', user.id)
        .single()
      if (data) {
        await supabase.from('user_gacha_state')
          .update({ gacha_tickets: ((data as Record<string, number>).gacha_tickets ?? 0) + gift.gachaTickets })
          .eq('user_id', user.id)
      }
    }

    // If it's a decorative keepsake, add to inventory
    if (!gift.coinValue && !gift.stardustValue && !gift.gachaTickets) {
      const { data: existing } = await supabase
        .from('user_inventory')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('item_id', gift.id)
        .single()

      if (existing) {
        await supabase.from('user_inventory').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
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
