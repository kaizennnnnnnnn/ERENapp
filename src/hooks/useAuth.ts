'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types'

// One in-flight profile fetch shared across every useAuth instance. The
// hook is mounted by dozens of components at once; during an outage all of
// them sit in the user-without-profile state, and without this dedup a
// single refocus would fire that many parallel retry chains at a backend
// that is still restarting.
let _profileFetch: Promise<Profile | null> | null = null
function fetchProfileShared(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Profile | null> {
  if (!_profileFetch) {
    _profileFetch = (async () => {
      try {
        const { data } = await withRetry(() => supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle())
        return (data as Profile | null) ?? null
      } finally {
        _profileFetch = null
      }
    })()
  }
  return _profileFetch
}

export function useAuth() {
  const supabase = createClient()
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const data = await fetchProfileShared(supabase, userId)
    if (data) setProfile(data)
  }

  useEffect(() => {
    // Hard timeout — never hang longer than 6s
    const timeout = setTimeout(() => setLoading(false), 6000)

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        if (user) await loadProfile(user.id)
      } catch {
        // network/supabase error — unblock the app
      } finally {
        clearTimeout(timeout)
        setLoading(false)
      }
    }
    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Self-heal: a logged-in user with no profile means the profile fetch hit
  // a Supabase outage that outlasted withRetry's backoff. The listener only
  // exists while in that broken state — one success removes it.
  useEffect(() => {
    if (!user || profile) return
    return onForeground(() => loadProfile(user.id))
  }, [user, profile]) // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { user, profile, loading, signOut }
}
