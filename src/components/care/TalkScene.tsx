'use client'

// ─── THE ATTIC ───────────────────────────────────────────────────────────────
// The room Eren talks back in.
//
// Every other room is a place you do something TO him — feed, wash, medicate,
// quiz. This one has no care action, no stat, no timer, and nothing to finish:
// a rug, a lantern, and a button that opens the conversation. That emptiness is
// the point, so resist adding a chore to it later.
//
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
import { playSound } from '@/lib/sounds'
import TalkButton from '@/components/talk/TalkButton'
import TalkSurface from '@/components/talk/TalkSurface'

interface Props { onClose: () => void }

// No themed pose for the attic yet — he sits as himself, which is also the
// right look for the one room where he isn't wearing a job.
const ATTIC_EREN_FALLBACK = {
  src: '/erenGood_notail.png', tailSrc: '/erenGood_tail.png',
}

export default function TalkScene(_props: Props) {
  void _props
  const atticEren = useRoomEren('talk', ATTIC_EREN_FALLBACK)
  const isDark = useIsDark()
  // No care action here — this runner exists purely so he still purrs when you
  // tap him, like every other room.
  const reaction = useErenReaction()
  const { setHideStats } = useCare()
  const [chatOpen, setChatOpen] = useState(false)

  // The chat has its own header at the top of the screen; StatsHeader (z-60)
  // would sit straight on top of it.
  useEffect(() => {
    if (!chatOpen) return
    setHideStats(true)
    return () => setHideStats(false)
  }, [chatOpen, setHideStats])

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

      {/* ══ EREN ══ sits on the rug. Measured against the art, not guessed:
          any higher and his feet land on the rug's far edge, which reads as
          him standing against the bed rather than sitting in the room. */}
      <div className="absolute z-10" style={{ bottom: '14%', left: '50%', transform: 'translateX(-50%)' }}>
        <PetTarget reaction={reaction}>
          <ErenIdleLayer disabled={reaction.active}>
            <BlinkingEren size={210} {...atticEren} />
          </ErenIdleLayer>
        </PetTarget>

        {reaction.phase === PURR && <PurrFx bottom="60%" />}
      </div>

      {/* ══ BOTTOM ACTION BUTTON ══ */}
      <div className="absolute inset-x-0 flex justify-center z-20 px-8"
        style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <TalkButton onClick={() => { playSound('ui_tap'); setChatOpen(true) }} />
      </div>

      <LightSwitch targetBottom="18%" targetLeft="50%" persistKey="talk" />

      {/* ══ THE CONVERSATION ══
          Swallows touches so scrolling the transcript or dragging across the
          keyboard doesn't swipe the host into the next room. Above the nav
          dots and room label (z-50 / z-55), which belong to the room. */}
      {chatOpen && (
        <div
          className="fixed inset-0 z-[70]"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <TalkSurface onExit={() => setChatOpen(false)} />
        </div>
      )}
    </div>
  )
}
