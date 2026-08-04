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
// A "word" is the tiny pixel sound-effect text that pops near Eren's head. Each
// scene renders its own <SoundWord> while the matching beat's `phase` is active,
// so the words stay next to the render that positions them.
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

/**
 * Shared finisher beat (~900ms): plays the bright care_happy chirp. The scene
 * renders the hop (erenIdleHop) + a couple of floating hearts + its own word
 * while `phase === 'finish'`, so every action lands the same way.
 */
export function happyFinisherBeats(): ReactionBeat[] {
  return [{ name: 'finish', ms: 900, onEnter: () => playSound('care_happy') }]
}
