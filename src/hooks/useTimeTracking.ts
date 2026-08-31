'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useTimeTracking(userId: string | null) {
  const supabase = createClient()
  const startRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return

    // Open a session in memory only. The row is written once, complete, when
    // the session ends — the old insert-then-update pattern made time_spent the
    // app's heaviest WAL producer (one insert + one update + one dead tuple per
    // visibility flip) and left an orphan row with a null session_end behind
    // every time two `visible` events arrived in a row.
    function startSession() {
      if (startRef.current) return
      startRef.current = new Date().toISOString()
    }

    async function endSession() {
      const start = startRef.current
      if (!start) return
      startRef.current = null
      const end = new Date().toISOString()
      await supabase.from('time_spent').insert({
        user_id:       userId,
        session_start: start,
        session_end:   end,
        date:          start.split('T')[0],
      })
    }

    startSession()

    // `hidden` is the only reliable close signal on a phone — a PWA killed from
    // the app switcher never fires beforeunload — so the row is written there.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') endSession()
      if (document.visibilityState === 'visible') startSession()
    }
    window.addEventListener('beforeunload', endSession)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      endSession()
      window.removeEventListener('beforeunload', endSession)
      // Without this, every visit leaked a listener whose dead closure kept
      // INSERTing ghost time_spent rows on visibility flips after unmount —
      // permanently inflating the profile's "time with Eren" totals.
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps
}
