'use client'

// ═════════════════════════════════════════════════════════════════════════════
// MemoryWatcher — Phase 3 PR 6
//
// Single global listener that ties the in-app event stream to the Memory Wall
// data layer. Mounted once at the (app)/layout.tsx level. Receives:
//
//   eren:my-action       → care action — fires checkOnEventUnlocks
//   eren:pet             → pet action
//   eren:nudge-sent      → nudge sent
//   eren:minigame-done   → minigame completed
//   eren:wish-granted    → wish granted
//   eren:message-sent    → couple_journal message inserted (NEW in PR 6)
//   eren:mood-logged     → MoodGate insert landed (NEW in PR 6)
//
// Events are debounced: a single user action often fires several of these in
// quick succession (feed → wish-granted → coin-credited), and running a fresh
// 5-query snapshot per event piles concurrent reads on the auth-token Web
// Lock, surfacing as "lock not released within 5000ms" warnings. We collapse
// any burst within 1.2s into a single check and only evaluate the LAST event
// — the snapshot covers everything that happened up to that point anyway.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { checkOnEventUnlocks, type UnlockEvent } from '@/lib/memoryChecks'

const BURST_DEBOUNCE_MS = 1200

export default function MemoryWatcher() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const pendingEventRef = useRef<UnlockEvent | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user?.id || !profile?.household_id) return
    const householdId = profile.household_id
    const userId = user.id

    // Collapse a burst of events into one check. Snapshot of the counter
    // state at fire-time covers every event in the burst, so we lose nothing
    // by only evaluating against the last one queued.
    const dispatchCheck = (evt: UnlockEvent) => {
      pendingEventRef.current = evt
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        const pending = pendingEventRef.current
        pendingEventRef.current = null
        if (pending) void checkOnEventUnlocks(supabase, pending)
      }, BURST_DEBOUNCE_MS)
    }

    const onMyAction = (e: Event) => {
      const detail = (e as CustomEvent).detail as { household_id?: string, user_id?: string, action_type?: string } | undefined
      if (!detail?.action_type) return
      const at = detail.action_type
      if (!['feed','play','sleep','wash','medicine'].includes(at)) return
      dispatchCheck({
        type: 'action',
        householdId: detail.household_id ?? householdId,
        userId:      detail.user_id ?? userId,
        actionType:  at as 'feed'|'play'|'sleep'|'wash'|'medicine',
      })
    }
    const onPet = (e: Event) => {
      const detail = (e as CustomEvent).detail as { user_id?: string } | undefined
      dispatchCheck({ type: 'pet', householdId, userId: detail?.user_id ?? userId })
    }
    const onNudge = () => {
      dispatchCheck({ type: 'nudge', householdId, userId })
    }
    const onMinigame = () => {
      dispatchCheck({ type: 'minigame', householdId, userId })
    }
    const onWish = (e: Event) => {
      const detail = (e as CustomEvent).detail as { by?: string } | undefined
      dispatchCheck({ type: 'wish', householdId, userId: detail?.by ?? userId })
    }
    const onMessage = () => {
      dispatchCheck({ type: 'message', householdId, userId })
    }
    const onMood = () => {
      dispatchCheck({ type: 'mood', householdId, userId })
    }

    window.addEventListener('eren:my-action',     onMyAction)
    window.addEventListener('eren:pet',           onPet)
    window.addEventListener('eren:nudge-sent',    onNudge)
    window.addEventListener('eren:minigame-done', onMinigame)
    window.addEventListener('eren:wish-granted',  onWish)
    window.addEventListener('eren:message-sent',  onMessage)
    window.addEventListener('eren:mood-logged',   onMood)
    return () => {
      window.removeEventListener('eren:my-action',     onMyAction)
      window.removeEventListener('eren:pet',           onPet)
      window.removeEventListener('eren:nudge-sent',    onNudge)
      window.removeEventListener('eren:minigame-done', onMinigame)
      window.removeEventListener('eren:wish-granted',  onWish)
      window.removeEventListener('eren:message-sent',  onMessage)
      window.removeEventListener('eren:mood-logged',   onMood)
    }
  }, [user?.id, profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
