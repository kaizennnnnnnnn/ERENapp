'use client'

// ─── "Hear from {cat}": the real notification opt-in ─────────────────────────
// The old flow promised notifications and then only asked the browser: nothing
// subscribed the phone for push, so a closed app never heard from the cat.
// This asks, then subscribes (push_subscriptions), and only reports success
// once both happened. Every other ending is said plainly on the screen.

import { useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'
import { registerSW } from '@/lib/reminders'
import { requestNotificationPermission } from '@/lib/statNotifications'
import { subscribeToPush } from '@/lib/pushSubscription'
import type { NotifyState } from './HomeSteps'

// serviceWorker.ready never settles for a worker that failed to install; don't
// leave the button spinning forever on it.
const SUBSCRIBE_TIMEOUT_MS = 10000

export function useNotifyStep({ userId, householdId, demo, onDone }: {
  userId: string | null
  householdId: string | null
  /** Preview mode: ask the browser, but save nothing. */
  demo: boolean
  onDone: () => void
}) {
  const [state, setState] = useState<NotifyState>('idle')
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  async function enable() {
    if (state === 'asking') return
    // iOS Safari has none of these until the app is on the home screen.
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    setState('asking')
    // The worker registers in parallel: subscribeToPush awaits
    // serviceWorker.ready, which would hang on an unregistered worker. The
    // permission prompt goes first, inside the tap, because Safari only shows
    // it from a user gesture.
    void registerSW()
    const granted = await requestNotificationPermission()
    if (!granted) {
      setState('denied')
      return
    }
    if (!demo) {
      if (!userId || !householdId) { setState('failed'); return }
      const saved = await Promise.race([
        subscribeToPush(userId, householdId),
        new Promise<boolean>(res => setTimeout(() => res(false), SUBSCRIBE_TIMEOUT_MS)),
      ])
      if (!saved) {
        setState('failed')
        return
      }
    }
    playSound('quest_complete')
    setState('idle')
    doneRef.current()
  }

  return { state, enable }
}
