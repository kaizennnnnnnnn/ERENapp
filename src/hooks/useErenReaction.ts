'use client'

// ═════════════════════════════════════════════════════════════════════════════
// useErenReaction — beat-driven reaction runner for the care scenes.
//
// A care reaction (eat, sleep, pet, pounce, shake-dry…) is a short sequence of
// timed BEATS. Each beat has a name the scene maps to CSS animations / particle
// renders, an optional onEnter side-effect (play a sound, swap a pose sticker,
// spawn crumbs), and a duration in ms until the next beat. The hook walks the
// list with chained setTimeouts, exposing the current beat `phase` so the scene
// re-renders ~once per beat (not per frame) — cheap enough to coexist with the
// memoised Eren sprites.
//
// Why a hook and not CSS animation chains: beats need to fire sounds and swap
// sprite stickers at boundaries, which CSS can't do. Why not an event-driven
// component like ErenGrantBurst: reactions need scene-local data (the dragged
// food's colour, the tapped side, the ball position) that lives in the scene.
//
// Re-triggers while a reaction is active are ignored, so spamming the feed drag
// can't stack two eat sequences. Everything is cleared on unmount.
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'

export interface ReactionBeat {
  /** Beat label the scene maps to animations / particle visibility. */
  name: string
  /** Milliseconds this beat lasts before the next begins. */
  ms: number
  /** Fired once when the beat begins — sounds, pose swaps, particle spawns. */
  onEnter?: () => void
}

export interface UseErenReaction {
  /** Current beat name, or null when idle. */
  phase: string | null
  /** True from play() until the last beat completes. */
  active: boolean
  /** Start a reaction. Ignored if one is already running. */
  play: (beats: ReactionBeat[]) => void
  /** Abort the running reaction and return to idle (also runs on unmount). */
  cancel: () => void
}

export function useErenReaction(): UseErenReaction {
  const [phase, setPhase] = useState<string | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  // Mirrors `phase != null` without waiting for a render, so play() can guard
  // against re-entry synchronously even if called twice in one tick.
  const activeRef = useRef(false)

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
  }, [])

  const cancel = useCallback(() => {
    clearTimers()
    activeRef.current = false
    setPhase(null)
  }, [clearTimers])

  const play = useCallback((beats: ReactionBeat[]) => {
    if (activeRef.current || beats.length === 0) return
    activeRef.current = true
    clearTimers()

    let elapsed = 0
    beats.forEach(beat => {
      // First beat (elapsed 0) fires synchronously via a 0ms timer so all
      // beats share one scheduling path and onEnter ordering is deterministic.
      timersRef.current.push(setTimeout(() => {
        setPhase(beat.name)
        beat.onEnter?.()
      }, elapsed))
      elapsed += beat.ms
    })

    // Tail timer returns to idle after the final beat's duration.
    timersRef.current.push(setTimeout(() => {
      activeRef.current = false
      setPhase(null)
    }, elapsed))
  }, [clearTimers])

  useEffect(() => cancel, [cancel])

  return { phase, active: phase !== null, play, cancel }
}
