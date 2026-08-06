'use client'

// ═════════════════════════════════════════════════════════════════════════════
// /talk — texting Eren.
//
// A private thread per person: RLS scopes every row to its owner, so this page
// never has to think about who's looking. That privacy is also why his
// remembered facts are per-user — a shared brain would let him repeat one
// person's secret into the other's thread.
//
// Wiring only. TalkView owns the surface; MemorySheet owns the notebook.
// ═════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCare } from '@/contexts/CareContext'
import { useErenStats } from '@/hooks/useErenStats'
import { useErenChat } from '@/hooks/useErenChat'
import { useErenMemories } from '@/hooks/useErenMemories'
import { usePageReady } from '@/hooks/usePageReady'
import { isBrownSender } from '@/lib/nudges'
import { playSound } from '@/lib/sounds'
import TalkView, { BROWN, PINK } from '@/components/talk/TalkView'
import MemorySheet from '@/components/talk/MemorySheet'
import PageLoader from '@/components/PageLoader'
import type { ErenMood } from '@/types'

/** Header status, read off his real stats — the same mood the rest of the app
 *  is showing. A hardcoded "online" would be a lie the app can disprove two
 *  screens away. */
const MOOD_STATUS: Record<ErenMood, string> = {
  idle:    'awake. mostly.',
  happy:   'in a very good mood',
  hungry:  'thinking about food',
  sleepy:  'half asleep',
  playful: 'full of beans',
  angry:   'in a mood',
}

export default function TalkPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  const { stats } = useErenStats()
  const { messages, streaming, sending, loading, error, savedTick, send } = useErenChat()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { memories, loading: memLoading, loaded: memLoaded, refresh, forget } = useErenMemories(sheetOpen)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  usePageReady(!loading)

  // He filed something away. The only tell, by design — he's instructed never
  // to say he remembered something, so the notebook glows instead of him telling.
  useEffect(() => {
    if (savedTick === 0) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 2600)
    return () => clearTimeout(t)
  }, [savedTick])

  if (loading) return <PageLoader label="FINDING EREN" />

  return (
    <>
      <TalkView
        messages={messages}
        streaming={streaming}
        sending={sending}
        error={error}
        status={sending ? 'typing…' : MOOD_STATUS[(stats?.mood as ErenMood) ?? 'idle']}
        myName={profile?.name?.split(' ')[0] ?? 'You'}
        mySkin={isBrownSender(true, user?.email) ? BROWN : PINK}
        flash={flash}
        onSend={send}                    // owns the chat_send sound
        onOpenMemories={() => { playSound('ui_modal_open'); setSheetOpen(true); void refresh() }}
        onExit={() => {
          playSound('ui_swipe_room')
          // Reachable from a push notification, which lands with no in-app
          // history — back() would no-op and the door would look dead.
          router.replace('/home')
        }}
      />

      <MemorySheet
        open={sheetOpen}
        memories={memories}
        loading={memLoading}
        loaded={memLoaded}
        onForget={forget}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
