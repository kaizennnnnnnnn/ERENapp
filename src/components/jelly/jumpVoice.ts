// ─── jumpVoice ──────────────────────────────────────────────────────────────
// The chain, made audible.
//
// The chain is a headline system that was completely mute. Every plain landing
// played the identical jl_bounce sweep, so the most repeated event in the game
// carried ZERO information — you could not hear whether you were one link from
// a free storey or standing at nothing. And the chain BREAKING had no feedback
// of any kind.
//
// So the bounce climbs a semitone per link. Eight links walk the tonic up to
// the fifth, and jl_chain — the payoff — is [523, 659, 784, 1047], C-E-G-C:
// the ladder arrives at the fifth and the reward drops back onto the root with
// the whole chord under it. The base sweep's endpoints are IMPORTED rather than
// retyped, so re-voicing jl_bounce re-voices the ladder with it.
//
// This lives in its own module because page.tsx is 1,700 lines and a pitch
// table is not gameplay.

import { SYNTH_RECIPES } from '@/lib/soundRecipes'
import type { SynthRecipe } from '@/lib/soundSynth'

const base = SYNTH_RECIPES.jl_bounce
const LO = base && base.type === 'sweep' ? base.freq[0] : 300
const HI = base && base.type === 'sweep' ? base.freq[1] : 520
const MS = base && base.type === 'sweep' ? base.duration : 110

/** Equal temperament, 2^(n/12). Eight rungs: the tonic up to the fifth. */
export const LADDER = [1, 1.0595, 1.1225, 1.1892, 1.2599, 1.3348, 1.4142, 1.4983]

/**
 * The gain TAPERS as the pitch climbs, and this is not fussiness.
 *
 * A rising pitch at constant amplitude is perceived as getting louder, so a
 * flat gain would make the crescendo double as a volume ramp — which is
 * precisely the way an eight-step climb on the most repeated sound in the game
 * turns from exciting into nagging by the third sitting. Holding the PERCEIVED
 * level flat is what lets the pitch carry the information on its own.
 */
const GAIN_LO = 0.70
const GAIN_HI = 0.55

/**
 * One rung of the ladder.
 *
 * SYRUP is weighted OFF the pitch axis — a longer, triangle-shaped sweep at the
 * same rung, never a transposition. Dropping it four semitones (the obvious
 * idea) collides EXACTLY with the ladder's own steps: syrup at link 4 would be
 * numerically identical to a plain landing at link 0, and four of the eight
 * rungs would be ambiguous. Worse, a syrup landing is a CLEAN climb, so a
 * lowered pitch would tell the player they had just lost links at the moment
 * they gained one. One channel cannot carry two encodings on the same axis.
 */
export function bounceRung(link: number, syrup: boolean): SynthRecipe {
  const i = Math.max(0, Math.min(LADDER.length - 1, link))
  const r = LADDER[i]
  const t = i / (LADDER.length - 1)
  return {
    type: 'sweep',
    freq: [LO * r, HI * r],
    duration: syrup ? 170 : MS,
    shape: syrup ? 'triangle' : 'sine',
    gain: GAIN_LO + (GAIN_HI - GAIN_LO) * t,
  }
}

/**
 * The chain coming apart, pitched from where it FELL FROM.
 *
 * Deliberately not a descending sine sweep in jl_hit's register: jl_hit is
 * `sweep [520,160] square`, and the comment on it in soundRecipes.ts states the
 * invariant this would break — it is meant to be the only falling figure in the
 * shaft that is not the run ending. Two notes, sine, landing on the base tonic.
 */
export function unwindVoice(lost: number): SynthRecipe {
  const r = LADDER[Math.max(0, lost) % LADDER.length]
  return { type: 'arp', notes: [HI * r, LO], step: 70, noteDur: 110, shape: 'sine', gain: 0.55 }
}
