'use client'

// ═════════════════════════════════════════════════════════════════════════════
// erenReactions — shared building blocks for care-scene reactions.
//
// The per-scene choreography lives in each scene (next to the render that
// interprets each beat's `phase`), but the pieces every scene shares live here:
//   - WORD_COLOR tokens so "NOM NOM" / "PURRR" / "SPLASH!" read in one palette
//   - happyFinisherBeats(): the common hop + hearts + word punctuation that
//     ends feed / play / wash / vet, so every action lands the same way
//
// A "word" is the tiny pixel sound-effect text that pops near Eren's head. It's
// rendered by the scene from a small WordState the beats set via onEnter, so the
// finisher can name its own word without the scene hard-coding it per phase.
// ═════════════════════════════════════════════════════════════════════════════

import { playSound } from './sounds'
import type { ReactionBeat } from '@/hooks/useErenReaction'

// Sound-word palette — warm/food amber, purr pink, water blue, sleepy lavender,
// medicine purple, happy green. Hard-edged retro tones, not pastels.
export const WORD_COLOR = {
  food:     '#E8A020',
  purr:     '#FF6B9D',
  water:    '#5BA3D9',
  sleep:    '#A5B4FC',
  medicine: '#AB47BC',
  happy:    '#4ADE80',
  curious:  '#F5C842',
} as const

export interface WordState {
  /** Re-keyed per pop so the same text repeated still restarts the keyframe. */
  key: number
  text: string
  color: string
  /** Anchor as % of the Eren wrapper; defaults suit a head-height pop. */
  left?: number
  top?: number
}

/** Setter the beats use to pop a sound-word; the scene renders from this. */
export type SetWord = (w: Omit<WordState, 'key'>) => void

/**
 * Shared finisher: a single ~900ms beat that hops Eren (reusing erenIdleHop),
 * plays the bright care_happy chirp, and pops a sound-word. The scene renders
 * the hop animation + a couple of floating hearts while `phase === 'finish'`.
 */
export function happyFinisherBeats(
  word: string,
  color: string,
  setWord: SetWord,
): ReactionBeat[] {
  return [{
    name: 'finish',
    ms: 900,
    onEnter: () => {
      playSound('care_happy')
      setWord({ text: word, color, left: 50, top: -2 })
    },
  }]
}
