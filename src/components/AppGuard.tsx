'use client'

/**
 * Two things every authenticated route needs, moved off the home page.
 *
 * The signed-out redirect used to live only in home/page.tsx, which was fine
 * while home was the only way in. It is not any more: push notifications
 * deep-link straight to /notes, /couple and /hallway, and once the app is a
 * TWA those are cold starts with no browser chrome to escape from. A push
 * tapped after the session expired landed the user on an authenticated screen
 * with no data and no way out.
 *
 * registerSW() was in the same place and had the same problem — it is what
 * calls reg.update() to re-check /sw.js, so entering anywhere but home never
 * checked for a new service worker.
 *
 * Renders nothing. Deliberately does NOT redirect on a null profile: that is
 * also what a Supabase outage looks like in useAuth, and bouncing a healthy
 * signed-in user to the login screen during a 503 would be worse than waiting.
 * Only a definitively absent `user` after loading settles counts.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { registerSW } from '@/lib/reminders'

export default function AppGuard() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => { registerSW() }, [])

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login')
  }, [user, loading, router])

  return null
}
