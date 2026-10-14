'use client'

// ═════════════════════════════════════════════════════════════════════════════
// TalkSurface — the conversation with Eren, wired up.
//
// Two places open it: the attic room you swipe to, and the /talk route (which
// is now only reachable by URL / a push notification). The wiring lives here
// rather than in either caller so the two can't drift — one place owns the
// notebook sheet and the saved-fact glow.
//
// The conversation itself comes from ErenChatProvider, not from a hook call
// here: in the attic the floor composer is already talking to Eren, and the
// transcript has to be that same conversation rather than a second one.
//
// TalkView is the surface; this is the plumbing.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useErenChatContext } from '@/contexts/ErenChatContext'
import { useErenMemories } from '@/hooks/useErenMemories'
import { useCat } from '@/hooks/useCat'
import { isTooSleepy } from '@/lib/chatAllowance'
import { playSound } from '@/lib/sounds'
import TalkView from './TalkView'
import MemorySheet from './MemorySheet'
import { M } from '@/components/meadow'
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

interface Props {
  /** Where the door leads — back to the attic, or out to /home. */
  onExit: () => void
  /** Fired once the transcript is in. The /talk route uses it to clear the
   *  app splash; the room doesn't need it, its own loader already ran. */
  onLoaded?: () => void
}

export default function TalkSurface({ onExit, onLoaded }: Props) {
  const { user, profile } = useAuth()
  const { stats } = useErenStats()
  const cat = useCat()
  const {
    messages, streaming, sending, loading, error, savedTick, send,
    spent,
  } = useErenChatContext()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { memories, loading: memLoading, loaded: memLoaded, refresh, forget } = useErenMemories(sheetOpen)
  const [flash, setFlash] = useState(false)

  // The gate players actually meet. Same threshold the arcade uses to stop
  // paying coins, so "too tired" means one thing across the whole app — and
  // it's fixed the same way: feed him, put him to bed. `spent` is the daily
  // backstop behind it, which should be rare enough that most people never
  // see it at all.
  const energy = stats?.energy ?? 100
  const sleepy = isTooSleepy(energy)

  useEffect(() => { if (!loading) onLoaded?.() }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // He filed something away. The only tell, by design — he's instructed never
  // to say he remembered something, so the notebook glows instead of him telling.
  useEffect(() => {
    if (savedTick === 0) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 2600)
    return () => clearTimeout(t)
  }, [savedTick])

  // A light loader, on the chat's own white: the obsidian PageLoader flashed a
  // dark screen in front of a white page every time the chat opened.
  if (loading) {
    return (
      <div className="meadow-root fixed inset-0 flex flex-col items-center justify-center" style={{ background: '#FFFFFF', gap: 14 }}>
        <img src="/erenGood.png" alt="" width={96} height={96}
          style={{ objectFit: 'contain', imageRendering: 'auto', animation: 'talkLoadBreathe 2.4s ease-in-out infinite' }} />
        <p role="status" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: M.text2 }}>{cat.t('Finding {name}…')}</p>
        <style>{`@keyframes talkLoadBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
      </div>
    )
  }

  return (
    <>
      <TalkView
        messages={messages}
        streaming={streaming}
        sending={sending}
        error={error}
        // Asleep either way, so his mood is beside the point — he's out.
        status={sleepy || spent ? 'out cold' : sending ? 'typing…' : MOOD_STATUS[(stats?.mood as ErenMood) ?? 'idle']}
        myName={profile?.name?.split(' ')[0] ?? 'You'}
        flash={flash}
        energy={energy}
        sleepy={sleepy}
        spent={spent}
        onSend={send}                    // owns the chat_send sound
        onOpenMemories={() => { playSound('ui_modal_open'); setSheetOpen(true); void refresh() }}
        onExit={() => { playSound('ui_swipe_room'); onExit() }}
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
