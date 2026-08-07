'use client'

// ═════════════════════════════════════════════════════════════════════════════
// /talk — texting Eren, as a standalone page.
//
// The attic room is the way in now; this route stays because a URL and a push
// notification can both land straight here. TalkSurface owns everything —
// this file only decides what the door does.
// ═════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCare } from '@/contexts/CareContext'
import { usePageReady } from '@/hooks/usePageReady'
import TalkSurface from '@/components/talk/TalkSurface'

export default function TalkPage() {
  const router = useRouter()
  const { setHideStats } = useCare()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  usePageReady(loaded)

  return (
    <TalkSurface
      onLoaded={() => setLoaded(true)}
      // Reachable from a push notification, which lands with no in-app
      // history — back() would no-op and the door would look dead.
      onExit={() => router.replace('/home')}
    />
  )
}
