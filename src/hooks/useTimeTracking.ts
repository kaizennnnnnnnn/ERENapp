'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useTimeTracking(userId: string | null) {
  const supabase     = createClient()
  const sessionIdRef = useRef<string | null>(null)
  const startRef     = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return

    // Start session
    async function startSession() {
      const start = new Date().toISOString()
      startRef.current = start
      const { data } = await supabase
        .from('time_spent')
        .insert({ user_id: userId, session_start: start, date: start.split('T')[0] })
        .select('id')
        .single()
      if (data) sessionIdRef.current = data.id
    }

    // End session
    async function endSession() {
      if (!sessionIdRef.current) return
      await supabase
        .from('time_spent')
        .update({ session_end: new Date().toISOString() })
        .eq('id', sessionIdRef.current)
      sessionIdRef.current = null
    }

    startSession()

    // End on tab close / page leave
    window.addEventListener('beforeunload', endSession)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') endSession()
      if (document.visibilityState === 'visible') startSession()
    })

    return () => {
      endSession()
      window.removeEventListener('beforeunload', endSession)
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps
}
