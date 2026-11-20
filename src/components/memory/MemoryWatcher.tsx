'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { createMemoryEventCheck } from '@/lib/memoryChecks'
import { createMemoryCheckQueue } from '@/lib/memoryCheckQueue'
import { onForeground } from '@/lib/onForeground'
import type { ActionType } from '@/lib/memoryCatalogue'

const CARE_ACTIONS = new Set<string>(['feed', 'play', 'sleep', 'wash', 'medicine'])

export default function MemoryWatcher() {
  const { user, profile } = useAuth()
  const userId = user?.id
  const householdId = profile?.household_id

  useEffect(() => {
    if (!userId || !householdId || profile?.id !== userId) return
    const queue = createMemoryCheckQueue(createMemoryEventCheck(createClient(), householdId, userId))
    const listeners: Record<string, (e: Event) => void> = {
      'eren:my-action': e => {
        const detail = (e as CustomEvent<{ household_id?: string; user_id?: string; action_type?: string }>).detail
        if (!detail?.action_type || !CARE_ACTIONS.has(detail.action_type)) return
        if ((detail.user_id && detail.user_id !== userId) || (detail.household_id && detail.household_id !== householdId)) return
        queue.enqueue({ type: 'action', actionType: detail.action_type as ActionType })
      },
      'eren:pet': e => {
        const actor = (e as CustomEvent<{ user_id?: string }>).detail?.user_id
        if (!actor || actor === userId) queue.enqueue({ type: 'pet' })
      },
      'eren:nudge-sent': () => queue.enqueue({ type: 'nudge' }),
      'eren:journal-delivered': () => queue.enqueue({ type: 'delivery' }),
      'eren:minigame-done': () => queue.enqueue({ type: 'minigame' }),
      'eren:wish-granted': e => {
        const detail = (e as CustomEvent<{ by?: string; householdId?: string }>).detail
        if (detail?.householdId && detail.householdId !== householdId) return
        queue.enqueue({ type: 'wish', by: detail?.by })
      },
      'eren:message-sent': () => queue.enqueue({ type: 'message' }),
      'eren:mood-logged': () => queue.enqueue({ type: 'mood' }),
    }
    for (const [event, listener] of Object.entries(listeners)) window.addEventListener(event, listener)
    const offForeground = onForeground(queue.resume)
    window.addEventListener('online', queue.resume)
    return () => {
      queue.dispose()
      offForeground()
      window.removeEventListener('online', queue.resume)
      for (const [event, listener] of Object.entries(listeners)) window.removeEventListener(event, listener)
    }
  }, [userId, householdId, profile?.id])

  return null
}
