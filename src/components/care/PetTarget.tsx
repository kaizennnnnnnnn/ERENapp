'use client'

// ─── PetTarget ───────────────────────────────────────────────────────────────
// Makes a room's Eren pettable: tap him and he trembles a purr, exactly like
// the living room. Wrap whatever the room already renders as its idle sprite.
//
// The purr rides the SCENE'S reaction runner rather than a private one, which
// buys three things for free: useErenReaction ignores play() while a reaction
// is active, so a tap can't cut into an eat / scrub / medicine sequence; the
// scene's existing `disabled={reaction.active}` keeps the idle layer paused
// through the purr; and the beat shows up in the same `reaction.phase` switch
// the room already reads.
//
// Behaviour only — the hearts and the "PURRR" live in <PurrFx/> so each scene
// can place them with its own reaction particles. PlayScene needs that split:
// its Eren sits inside a scaleX flip that would render the word mirrored.

import { useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { playSound } from '@/lib/sounds'
import { WORD_COLOR } from '@/lib/erenReactions'
import type { UseErenReaction } from '@/hooks/useErenReaction'
import SoundWord from '@/components/SoundWord'
import { Hearts } from '@/components/care/ReactionFx'

/** Beat name the rooms match on to render <PurrFx/>. */
export const PURR = 'purr'

/** Long enough that tap-spam can't auto-grant a pet wish. Matches home. */
const COOLDOWN_MS = 1500

interface Props {
  /** The room's own reaction runner, so the purr queues behind care beats. */
  reaction: UseErenReaction
  /** The idle sprite stack — usually the whole <ErenIdleLayer>. */
  children: ReactNode
  /** Room reasons he can't be petted right now: asleep, mid-scrub, mid-checkup. */
  disabled?: boolean
}

export default function PetTarget({ reaction, children, disabled }: Props) {
  const { user } = useAuth()
  const lastPetAt = useRef(0)

  const pet = useCallback((e: React.MouseEvent) => {
    // Some rooms put a tap on the whole scene to work (PlayScene throws the
    // ball at wherever you tapped). Petting him is the more specific intent,
    // so it swallows the tap.
    e.stopPropagation()
    if (disabled) return
    const now = Date.now()
    if (now - lastPetAt.current < COOLDOWN_MS) return
    lastPetAt.current = now
    reaction.play([{ name: PURR, ms: 1000, onEnter: () => playSound('pet_purr') }])
    try {
      window.dispatchEvent(new CustomEvent('eren:pet', { detail: { user_id: user?.id } }))
    } catch { /* SSR/no-window */ }
  }, [disabled, reaction, user?.id])

  return (
    <div
      role="button"
      aria-label="Pet Eren"
      onClick={pet}
      style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
    >
      <div style={{
        animation: reaction.phase === PURR ? 'erenPurrShiver 150ms ease-in-out 6' : undefined,
        transformOrigin: 'bottom center',
      }}>
        {children}
      </div>
    </div>
  )
}

/** Hearts + "PURRR", anchored to the room's Eren box like its other reaction FX. */
export function PurrFx({ bottom = '58%' }: { bottom?: string }) {
  return (
    <>
      <Hearts count={3} bottom={bottom} />
      <SoundWord word="PURRR" color={WORD_COLOR.purr} left={50} top={6} />
    </>
  )
}
