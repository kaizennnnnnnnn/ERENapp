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

  // Check if fortune is claimable today
  const checkClaimable = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('user_gacha_state')
      .select('last_free_fortune')
      .eq('user_id', user.id)
      .single()

    if (!data) {
      // No state row yet — can claim
      setCanClaim(true)
    } else {
      setCanClaim(canClaimFortune(data.last_free_fortune))
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { checkClaimable() }, [checkClaimable])

  const claimFortune = useCallback(async (): Promise<FortuneGiftDef | null> => {
    if (!user?.id || !canClaim || claiming) return null
    setCanClaim(false) // Immediately prevent double-claim
    setClaiming(true)

    // Ensure gacha state row exists (upsert)
    await supabase.from('user_gacha_state').upsert({
      user_id: user.id,
      last_free_fortune: new Date().toISOString(),
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
