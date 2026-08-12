'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useErenIdle — the small involuntary life that makes a sprite read as a cat
// rather than a sticker.
//
// Every game draws its own Eren, but they all want the same two things: he
// blinks now and then, and an ear flicks. Doing that per game means six
// slightly different blink rhythms; doing it here means he feels like the same
// animal everywhere, and a game only has to say which rects to change.
//
// The rhythm matters more than the drawing. Blinks land on an irregular beat
// (a metronome blink reads as a machine) and sometimes double up, which is what
// real cats do and is the single cutest half-second in the whole thing.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

export interface ErenIdle {
  blink: boolean   // eyes closed this instant — swap the eye rects for a lid line
  twitch: boolean  // an ear is flicking — nudge one ear a pixel
  glance: number   // -1 / 0 / +1 — shift the eye group this many pixels sideways
}

const BLINK_GAP  = [2400, 6200] as const  // ms between blinks
const BLINK_HOLD = 120                    // ms the eyes stay shut
const DOUBLE_GAP = 170                    // ms between the two halves of a double blink
const DOUBLE_ODDS = 0.28
const TWITCH_GAP  = [5000, 12000] as const
const TWITCH_HOLD = 320
const GLANCE_GAP  = [4200, 9500] as const
const GLANCE_HOLD = 720

function between([lo, hi]: readonly [number, number]): number {
  return lo + Math.random() * (hi - lo)
}

/** Idle blink + ear twitch on a natural, irregular beat.
 *
 *  Pass `active: false` while the sprite is doing something deliberate (mid
 *  cheer, mid crash) so an involuntary blink can't stomp a pose the player is
 *  meant to read. Returns all-false under `prefers-reduced-motion`. */
export function useErenIdle(active = true): ErenIdle {
  const reduced = useReducedMotion()
  const [blink, setBlink] = useState(false)
  const [twitch, setTwitch] = useState(false)
  const [glance, setGlance] = useState(0)

  useEffect(() => {
    if (!active || reduced) {
      setBlink(false)
      setTwitch(false)
      setGlance(0)
      return
    }

    const pending = new Set<ReturnType<typeof setTimeout>>()
    // Every timeout goes through here so cleanup can cancel the whole chain —
    // these loops re-arm themselves, so a missed id would outlive the mount.
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { pending.delete(id); fn() }, ms)
      pending.add(id)
      return id
    }
    // A background tab shouldn't re-render the sprite; skip the beat, keep the loop.
    const awake = () => typeof document === 'undefined' || !document.hidden

    const blinkLoop = () => later(() => {
      if (awake()) {
        setBlink(true)
        later(() => {
          setBlink(false)
          if (Math.random() < DOUBLE_ODDS) {
            later(() => {
              setBlink(true)
              later(() => { setBlink(false); blinkLoop() }, BLINK_HOLD)
            }, DOUBLE_GAP)
          } else {
            blinkLoop()
          }
        }, BLINK_HOLD)
      } else {
        blinkLoop()
      }
    }, between(BLINK_GAP))

    const twitchLoop = () => later(() => {
      if (awake()) {
        setTwitch(true)
        later(() => { setTwitch(false); twitchLoop() }, TWITCH_HOLD)
      } else {
        twitchLoop()
      }
    }, between(TWITCH_GAP))

    const glanceLoop = () => later(() => {
      if (awake()) {
        setGlance(Math.random() < 0.5 ? -1 : 1)
        later(() => { setGlance(0); glanceLoop() }, GLANCE_HOLD)
      } else {
        glanceLoop()
      }
    }, between(GLANCE_GAP))

    blinkLoop()
    twitchLoop()
    glanceLoop()
    return () => { pending.forEach(clearTimeout); pending.clear() }
  }, [active, reduced])

  return { blink, twitch, glance }
}
