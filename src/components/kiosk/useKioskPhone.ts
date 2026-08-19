'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE PAYPHONE — when it rings, and what happens when it does.
// ──────────────────────────────────────────────────────────────────────────
// A minute into a shift the phone rings, and every five minutes after that.
// You can pick it up while it's ringing; if you don't, the machine takes it
// after ten seconds and plays the message anyway — you never lose one.
//
// This lives in KioskInterior rather than in the back wall's overlay, because
// the phone has to ring whichever way you're facing. The wall only ever draws
// what this says is happening.
//
// The schedule is a self-rescheduling timeout rather than an interval: an
// interval keeps firing while the tab is in the background and dumps a queue
// of missed calls the moment you come back. This one stops when you leave and
// starts the wait again when you return.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import {
  KIOSK_CALLS, RING_MS, RING_EVERY_MS, FIRST_CALL_MS, CALL_EVERY_MS,
  TYPE_MS, HOLD_MS, type KioskCall,
} from './kioskCalls'

export type PhoneState = 'idle' | 'ringing' | 'playing'

/** The three keystroke pitches, cycled — they stand in for a voice until the
 *  real recordings land. */
const BLIPS = ['chat_type1', 'chat_type2', 'chat_type3'] as const

export interface KioskPhone {
  state: PhoneState
  /** True only when YOU picked up. The machine taking a call leaves the
   *  handset in its cradle, and the wall draws it that way. */
  lifted: boolean
  /** Who's on the line — set from the first ring until the message ends. */
  call: KioskCall | null
  /** The message so far, one character at a time. Empty until it's answered. */
  spoken: string
  /** Picking up early. Does nothing unless it's actually ringing. */
  answer: () => void
}

/** Draw every call once before any repeats, then reshuffle. */
function makeDeck(): KioskCall[] {
  const deck = [...KIOSK_CALLS]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

export function useKioskPhone(): KioskPhone {
  const [state, setState] = useState<PhoneState>('idle')
  const [lifted, setLifted] = useState(false)
  const [call, setCall] = useState<KioskCall | null>(null)
  const [spoken, setSpoken] = useState('')

  const deck = useRef<KioskCall[]>([])
  /** The card currently dealt. Held so an interruption can put it back
   *  rather than burn it. */
  const inFlight = useRef<KioskCall | null>(null)
  /** So a fresh deck can't open with the call that just played. */
  const lastId = useRef<string | null>(null)
  const nextCall = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringLoop = useRef<ReturnType<typeof setInterval> | null>(null)
  const ringOut = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typer = useRef<ReturnType<typeof setInterval> | null>(null)
  const ending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const stateRef = useRef<PhoneState>('idle')

  const setPhase = useCallback((next: PhoneState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const stopRinging = useCallback(() => {
    if (ringLoop.current !== null) clearInterval(ringLoop.current)
    if (ringOut.current !== null) clearTimeout(ringOut.current)
    ringLoop.current = null
    ringOut.current = null
  }, [])

  // ── the message itself ──────────────────────────────────────────────────
  const hangUp = useCallback(() => {
    if (typer.current !== null) clearInterval(typer.current)
    if (ending.current !== null) clearTimeout(ending.current)
    typer.current = null
    ending.current = null
    audio.current?.pause()
    audio.current = null
    setPhase('idle')
    setCall(null)
    setSpoken('')
  }, [setPhase])

  /** `byHand` is you lifting the handset; otherwise the machine took it, and
   *  it announces itself with its own tone instead of a cradle click. */
  const play = useCallback((who: KioskCall, byHand: boolean) => {
    stopRinging()
    setPhase('playing')
    setLifted(byHand)
    playSound(byHand ? 'kiosk_pickup' : 'kiosk_beep')

    // A recording plays for real; without one the line types itself out with
    // the chat blips, which is a placeholder you can actually read.
    if (who.voice) {
      const el = new Audio(who.voice)
      el.volume = 0.9
      audio.current = el
      el.play().catch(() => {})
    }

    let i = 0
    typer.current = setInterval(() => {
      i += 1
      setSpoken(who.text.slice(0, i))
      // Every third character, so a sentence sounds like speech rather than a
      // machine gun, and cycling the three pitches so it doesn't read as a
      // fault. Skipped entirely once there's a real voice on the line.
      if (!who.voice && i % 3 === 0 && who.text[i - 1] !== ' ') {
        playSound(BLIPS[(i / 3) % BLIPS.length])
      }
      if (i >= who.text.length) {
        if (typer.current !== null) clearInterval(typer.current)
        typer.current = null
        ending.current = setTimeout(() => {
          // Delivered in full — the card is spent for real now.
          inFlight.current = null
          playSound('kiosk_beep')
          hangUp()
        }, HOLD_MS)
      }
    }, TYPE_MS)
  }, [hangUp, setPhase, stopRinging])

  // ── ringing ─────────────────────────────────────────────────────────────
  const ring = useCallback(() => {
    if (!deck.current.length) {
      deck.current = makeDeck()
      // A fresh deck can open with the card that just played, which would
      // break the promise in kioskCalls. Nudge it back into the pack.
      if (deck.current.length > 1 && deck.current[0].id === lastId.current) {
        const j = 1 + Math.floor(Math.random() * (deck.current.length - 1))
        ;[deck.current[0], deck.current[j]] = [deck.current[j], deck.current[0]]
      }
    }
    const who = deck.current.shift() as KioskCall
    inFlight.current = who
    lastId.current = who.id

    setCall(who)
    setPhase('ringing')
    playSound('kiosk_ring')
    ringLoop.current = setInterval(() => playSound('kiosk_ring'), RING_EVERY_MS)
    // Nobody picked up, so the machine does. The message plays either way —
    // a call you can miss is a call you'd never hear.
    ringOut.current = setTimeout(() => play(who, false), RING_MS)
  }, [play, setPhase])

  const answer = useCallback(() => {
    if (stateRef.current !== 'ringing' || !call) return
    play(call, true)
  }, [call, play])

  // ── the schedule ────────────────────────────────────────────────────────
  const arm = useCallback((delay: number) => {
    if (nextCall.current !== null) clearTimeout(nextCall.current)
    nextCall.current = setTimeout(() => {
      nextCall.current = null
      ring()
      arm(CALL_EVERY_MS)
    }, delay)
  }, [ring])

  useEffect(() => {
    arm(FIRST_CALL_MS)
    return () => {
      if (nextCall.current !== null) clearTimeout(nextCall.current)
      if (ringLoop.current !== null) clearInterval(ringLoop.current)
      if (ringOut.current !== null) clearTimeout(ringOut.current)
      if (typer.current !== null) clearInterval(typer.current)
      if (ending.current !== null) clearTimeout(ending.current)
      audio.current?.pause()
    }
  }, [arm])

  // Backgrounding the tab shouldn't ring a phone you can't hear, and it
  // shouldn't bank the ring either. Drop whatever is mid-call and start the
  // wait over when the kiosk is in front of you again — but PUT THE CARD
  // BACK first. It was already dealt, and an app-switch is far commoner than
  // ignoring a ring; without this, glancing at a notification silently costs
  // you that message until the whole deck has turned over.
  useVisibilityPause(
    useCallback(() => {
      if (nextCall.current !== null) clearTimeout(nextCall.current)
      nextCall.current = null
      if (inFlight.current) {
        deck.current.unshift(inFlight.current)
        inFlight.current = null
      }
      stopRinging()
      hangUp()
    }, [hangUp, stopRinging]),
    useCallback(() => arm(CALL_EVERY_MS), [arm]),
  )

  return { state, lifted, call, spoken, answer }
}
