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
 *
 * Signed-out visitors go to the Welcome (/onboarding), not the login form.
 * The installed app starts at /home, so a brand-new install arrives here
 * first, and someone with no account yet needs "Adopt your cat", not a
 * password box. The Welcome's "Log in" button is one tap for everyone else.
 *
 * A signed-in account with its own onboarding marker (PENDING_KEY) goes back
 * there too: it started moving in and never reached the launch. The installed
 * app starts here, so a PWA evicted mid-create cold-started past the resume,
 * and the cat built in onboarding never reached the home. One localStorage
 * read; onboarding clears the marker on every way out, so this can't loop.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { registerSW } from '@/lib/reminders'
import { readPending } from '@/components/onboarding/flow'

export default function AppGuard() {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => { registerSW() }, [])

  useEffect(() => {
    if (loading) return
    if (!user || readPending(user.id)) router.replace('/onboarding')
  }, [user, loading, router])

  return null
}
