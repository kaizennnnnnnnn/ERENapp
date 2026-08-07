'use client'

// ─── THE ATTIC ───────────────────────────────────────────────────────────────
// The room Eren talks back in.
//
// Every other room is a place you do something TO him — feed, wash, medicate,
// quiz. This one has no care action, no stat, no timer, and nothing to finish:
// a rug, a lantern, and a conversation. That emptiness is the point, so resist
// adding a chore to it later.
//
// Two ways to talk, one conversation. The bottom slab folds into a one-line
// composer and his answer arrives in a bubble over his head; the scroll button
// opens the whole transcript. ErenChatProvider is what makes those the same
// thread rather than two that happen to share a table — see ErenChatContext.

import { useEffect, useState } from 'react'
import BlinkingEren from '@/components/BlinkingEren'
import { useRoomEren } from '@/hooks/useRoomEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import PetTarget, { PurrFx, PURR } from '@/components/care/PetTarget'
import HangingDonut from '@/components/care/HangingDonut'
import { useErenReaction } from '@/hooks/useErenReaction'
import LightSwitch from '@/components/LightSwitch'
import { useIsDark } from '@/hooks/useIsDark'
import { useCare } from '@/contexts/CareContext'
import { ErenChatProvider } from '@/contexts/ErenChatContext'
import { playSound } from '@/lib/sounds'
import RoomComposer from '@/components/talk/RoomComposer'
import ErenSpeechBubble from '@/components/talk/ErenSpeechBubble'
import TalkSurface from '@/components/talk/TalkSurface'

interface Props { onClose: () => void }

// No themed pose for the attic yet — he sits as himself, which is also the
// right look for the one room where he isn't wearing a job.
const ATTIC_EREN_FALLBACK = {
  src: '/erenGood_notail.png', tailSrc: '/erenGood_tail.png',
}

// Where he sits, and how big. Shared with the speech bubble so the tail always
// lands on his head — measured against the art: any higher and his feet reach
// the rug's far edge and he reads as standing against the bed.
const EREN_BOTTOM = '14%'
const EREN_SIZE = 210
/**
 * How far the bubble reaches down into his sprite box. The box has ~29px of
 * empty space above his ears (the art is 13.8% transparent at the top), and
 * the tail hangs ~10px below the bubble — so 22 lands the tail's point on his
 * ears instead of floating above them.
 */
const EREN_HEADROOM = 22

export default function TalkScene(props: Props) {
  // The provider re-renders on every streamed token. `children` is a prop, so
  // the room, the cat and the donut below are NOT re-rendered with it — only
  // the composer and the speech bubble, which are the parts that read it.
  return (
    <ErenChatProvider>
      <Attic {...props} />
    </ErenChatProvider>
  )
}

function Attic(_props: Props) {
  void _props
  const atticEren = useRoomEren('talk', ATTIC_EREN_FALLBACK)
  const isDark = useIsDark()
  // No care action here — this runner exists purely so he still purrs when you
  // tap him, like every other room.
  const reaction = useErenReaction()
  const { setHideStats } = useCare()
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  // The transcript has its own header at the top of the screen; StatsHeader
  // (z-60) would sit straight on top of it.
  useEffect(() => {
    if (!transcriptOpen) return
    setHideStats(true)
    return () => setHideStats(false)
  }, [transcriptOpen, setHideStats])

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${isDark ? '/AtticNight.png' : '/AtticDay.png'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
      }} />

      {/* ══ DONUT ══ on its rope, under Eren's z so a hard swing passes
          behind him rather than across his face. */}
      <HangingDonut />

      {/* ══ EREN ══ sits on the rug. */}
      <div className="absolute z-10" style={{ bottom: EREN_BOTTOM, left: '50%', transform: 'translateX(-50%)' }}>
        <PetTarget reaction={reaction}>
          <ErenIdleLayer disabled={reaction.active}>
            <BlinkingEren size={EREN_SIZE} {...atticEren} />
          </ErenIdleLayer>
        </PetTarget>

        {reaction.phase === PURR && <PurrFx bottom="60%" />}
      </div>

      {/* ══ WHAT HE SAYS ══ anchored to the top of his sprite box, growing
          upward. Above the donut's z so a long answer isn't cut in half by it;
          the wrapper stays click-through so an empty bubble isn't an invisible
          lid over the room. */}
      <div
        className="absolute z-[15] flex justify-center pointer-events-none px-5"
        style={{
          left: 0, right: 0,
          bottom: `calc(${EREN_BOTTOM} + ${EREN_SIZE - EREN_HEADROOM}px)`,
        }}
      >
        <ErenSpeechBubble />
      </div>

      {/* ══ BOTTOM BAR ══ TALK slab ⇄ composer, plus the transcript button. */}
      <RoomComposer onOpenTranscript={() => { playSound('ui_modal_open'); setTranscriptOpen(true) }} />

      <LightSwitch targetBottom="18%" targetLeft="50%" persistKey="talk" />

      {/* ══ THE WHOLE CONVERSATION ══
          Swallows touches so scrolling the transcript or dragging across the
          keyboard doesn't swipe the host into the next room. Above the nav
          dots and room label (z-50 / z-55), which belong to the room. */}
      {transcriptOpen && (
        <div
          className="fixed inset-0 z-[70]"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <TalkSurface onExit={() => setTranscriptOpen(false)} />
        </div>
      )}
    </div>
  )
}
