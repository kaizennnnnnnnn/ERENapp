// ═══════════════════════════════════════════════════════════════════════════
// PURR BEAT — the music engine.
//
// The old version played one sine thud per beat, fired from inside the rAF
// loop the instant the loop noticed a beat had passed. Two things were wrong
// with that, and they are the same thing:
//
//   1. rAF resolution is ~16 ms and irregular. A beat scheduled "now, from a
//      frame callback" lands anywhere in a 16 ms window, so the pulse audibly
//      stumbles. On a metronome you hear it immediately.
//   2. The game clock was a rAF accumulator (`gameTime += dt`), which drifts
//      away from the audio hardware clock. So the note the player SEES touch
//      the line and the kick the player HEARS were measured against different
//      clocks — in a game whose PERFECT window is 60 ms.
//
// Both are fixed by the standard two-clocks pattern: game time comes from
// AudioContext.currentTime, and every musical event is handed to Web Audio
// with an exact future timestamp, a couple of hundred milliseconds before it
// is due. rAF is demoted to what it is good at — drawing.
//
// The bed itself is a real arrangement rather than a click track. Four layers
// enter over the first minute so the track BUILDS as the run goes on, and a
// four-bar chord loop (C–G–Am–F) underpins it. The four lanes are the notes
// of a C major triad, so the melody the player produces by hitting them is
// consonant with the bed no matter what order they arrive in.
// ═══════════════════════════════════════════════════════════════════════════

import { playSynthAt } from './sounds'
import { audioNow, getSynthBus, getAudioContext, unlockAudio } from './soundSynth'
import type { SynthRecipe } from './soundSynth'

// ─── Tempo ──────────────────────────────────────────────────────────────────
const BPM_BASE = 92
const BPM_MAX = 152
const BPM_RAMP = 0.62          // BPM gained per second of survival
const BEATS_PER_BAR = 4

export function bpmAt(t: number): number {
  return Math.min(BPM_MAX, BPM_BASE + t * BPM_RAMP)
}

/** Grow the beat-time grid until it covers `upto` seconds of game time. The
 *  grid is walked rather than computed because the tempo ramps: each beat's
 *  length depends on where the PREVIOUS beat landed. */
export function extendGrid(beats: number[], upto: number): void {
  while (beats[beats.length - 1] < upto) {
    const last = beats[beats.length - 1]
    beats.push(last + 60 / bpmAt(last))
  }
}

// ─── Harmony ────────────────────────────────────────────────────────────────
// One chord per bar, looping every four bars. Bass roots are two octaves down
// from the pad so the low end stays out of the melody's way.
interface Chord { root: number; triad: number[] }

const PROGRESSION: Chord[] = [
  { root: 65.41,  triad: [261.63, 329.63, 392.00] }, // C  — C4 E4 G4
  { root: 98.00,  triad: [246.94, 293.66, 392.00] }, // G  — B3 D4 G4
  { root: 110.00, triad: [261.63, 329.63, 440.00] }, // Am — C4 E4 A4
  { root: 87.31,  triad: [261.63, 349.23, 440.00] }, // F  — C4 F4 A4
]

export function chordForBeat(beatIndex: number): Chord {
  return PROGRESSION[Math.floor(beatIndex / BEATS_PER_BAR) % PROGRESSION.length]
}

/** The four lane tones — a C major triad plus its octave, panned across the
 *  stereo field to match the lanes' left-to-right order on screen. */
export const LANE_FREQ = [523.25, 659.25, 783.99, 1046.50]
export const LANE_PAN = [-0.55, -0.18, 0.18, 0.55]

// ─── Voices ─────────────────────────────────────────────────────────────────
// Each returns a plain recipe. They are built per-hit rather than looked up
// from SYNTH_RECIPES because velocity, pitch and pan all vary with gameplay,
// and a static table cannot express that.

function kick(vel: number): SynthRecipe {
  return {
    type: 'seq',
    parts: [
      // The beater click. This is the whole difference between a kick drum and
      // a low sine "boop" — without a transient up top the ear places the hit
      // late, which in a rhythm game reads as the game being unresponsive.
      { at: 0, recipe: { type: 'noise', duration: 14, gain: 0.3 * vel, highpass: 1600 } },
      { at: 0, recipe: { type: 'sweep', freq: [155, 44], duration: 140, shape: 'sine', gain: 0.95 * vel, curve: 'exponential' } },
      { at: 0, recipe: { type: 'sweep', freq: [420, 70], duration: 38, shape: 'triangle', gain: 0.3 * vel, curve: 'exponential' } },
    ],
  }
}

function snare(vel: number): SynthRecipe {
  return {
    type: 'seq',
    parts: [
      { at: 0, recipe: { type: 'noise', duration: 115, gain: 0.42 * vel, highpass: 1500, lowpass: 7500 } },
      { at: 0, recipe: { type: 'blip', freq: 196, duration: 62, shape: 'triangle', gain: 0.34 * vel } },
    ],
  }
}

function hat(vel: number, open: boolean): SynthRecipe {
  return { type: 'noise', duration: open ? 85 : 24, gain: (open ? 0.15 : 0.2) * vel, highpass: 7600, pan: 0.28 }
}

function bass(freq: number, durationMs: number, vel: number): SynthRecipe {
  // Sawtooth for body, then a low corner to shave the harmonics that would
  // otherwise crowd the lane tones. An unfiltered saw bass is all buzz.
  return { type: 'blip', freq, duration: durationMs, shape: 'sawtooth', gain: 0.5 * vel, lowpass: 300 }
}

function pad(triad: number[], durationMs: number): SynthRecipe {
  return { type: 'chord', freqs: triad, duration: durationMs, shape: 'triangle', gain: 0.3, lowpass: 1700 }
}

function crash(): SynthRecipe {
  return { type: 'noise', duration: 400, gain: 0.22, highpass: 5200 }
}

/** Hit tone for a lane. Rises an octave in four steps as the combo multiplier
 *  climbs, so a long streak literally sounds like it is going somewhere. */
export function laneTone(lane: number, mult: number): SynthRecipe {
  const step = Math.max(0, Math.min(3, mult - 1))
  return {
    type: 'seq',
    parts: [
      { at: 0, recipe: { type: 'blip', freq: LANE_FREQ[lane] * (1 + step * 0.085), duration: 150, shape: 'triangle', gain: 0.62, pan: LANE_PAN[lane] } },
      // A quiet fifth above gives the pluck some sparkle without another note.
      { at: 0, recipe: { type: 'blip', freq: LANE_FREQ[lane] * 1.5, duration: 90, shape: 'sine', gain: 0.22, pan: LANE_PAN[lane] } },
    ],
  }
}

/** The PERFECT sting — a bright two-note flick over the lane tone. */
export function perfectSting(lane: number): SynthRecipe {
  const f = LANE_FREQ[lane] * 2
  return {
    type: 'seq',
    parts: [
      { at: 0, recipe: { type: 'blip', freq: f, duration: 55, shape: 'triangle', gain: 0.3, pan: LANE_PAN[lane] } },
      { at: 42, recipe: { type: 'blip', freq: f * 1.5, duration: 90, shape: 'triangle', gain: 0.34, pan: LANE_PAN[lane] } },
    ],
  }
}

/** Missed note — a detuned stumble, deliberately ugly and deliberately SHORT
 *  so it doesn't mask the next beat. */
export function missTone(): SynthRecipe {
  return {
    type: 'seq',
    parts: [
      { at: 0, recipe: { type: 'sweep', freq: [330, 98], duration: 200, shape: 'sawtooth', gain: 0.45, lowpass: 1400 } },
      { at: 0, recipe: { type: 'noise', duration: 90, gain: 0.2, lowpass: 900 } },
    ],
  }
}

/** Multiplier step-up fanfare — an upward arp, higher for each tier. */
export function multiplierTone(mult: number): SynthRecipe {
  const base = 523.25 * (1 + (mult - 2) * 0.25)
  return { type: 'arp', notes: [base, base * 1.26, base * 1.5, base * 2], step: 52, noteDur: 110, shape: 'triangle', gain: 0.5 }
}

// ─── Arrangement ────────────────────────────────────────────────────────────
// Layers enter over the first ~50 seconds. A track that is already at full
// density in bar one has nowhere to go, and a run that lasts three minutes
// then feels like the same eight bars ninety times over.
export type Intensity = 0 | 1 | 2 | 3

export function intensityAt(t: number): Intensity {
  if (t < 8) return 0    // kick + hats — the count-in groove
  if (t < 24) return 1   // + snare backbeat, + bass
  if (t < 50) return 2   // + pad, + syncopated kick
  return 3               // + double-time hats, + bar crashes
}

// Per-layer trim, applied on top of the user's global volume. The bed has to
// sit UNDER the lane tones — the player's own playing is the melody, and the
// drums are there to tell them where the beat is.
const MIX = { drums: 0.5, bass: 0.42, pad: 0.3, accent: 0.4 }

// How far ahead of the audio clock musical events are handed to the hardware.
// Long enough that a dropped frame or a slow GC pause can't starve the
// scheduler; short enough that stopping the music never leaves more than a
// blink of it still queued.
const LOOKAHEAD = 0.22

export interface Conductor {
  /** Begin the run. Captures the audio-clock origin. */
  start(leadIn: number): void
  /** Fade the bed out and stop scheduling. */
  stop(): void
  pause(): void
  resume(): void
  /** Game time in seconds, measured on the clock the player is listening to. */
  now(): number
  /** Schedule every musical event that falls inside the lookahead window.
   *  Safe (and expected) to call once per animation frame. */
  pump(combo: number): void
  /** The beat-time grid, in game-time seconds. Shared with the note chart so
   *  notes and drums cannot possibly disagree about where a beat is. */
  readonly beats: number[]
  /** Index of the most recent beat that has sounded, and its game time — the
   *  visuals pulse off these so the screen throbs with the actual kick. */
  lastBeat(): { index: number; time: number }
}

export function createConductor(): Conductor {
  const beats: number[] = [0]
  let origin = 0                 // audio-clock time of game-time zero
  let pausedAt: number | null = null
  let musicGain: GainNode | null = null
  let schedIdx = 0               // next beat index not yet handed to the hardware
  let running = false
  let barsSinceCrash = 0
  // Fallback clock for the (rare) case where Web Audio is unavailable entirely.
  // The game stays playable, just silent.
  let usePerf = false

  const rawNow = (): number => {
    if (usePerf) return performance.now() / 1000
    const a = audioNow()
    return a == null ? performance.now() / 1000 : a
  }

  function now(): number {
    if (pausedAt != null) return pausedAt - origin
    return rawNow() - origin
  }

  function emit(recipe: SynthRecipe, gameTime: number, scale: number) {
    playSynthAt(recipe, origin + gameTime, scale, musicGain ?? undefined)
  }

  /** Ramp the whole bed's level. Used to duck the music across a pause and to
   *  fade it out on game over. */
  function setBusGain(value: number, seconds: number) {
    const ctx = getAudioContext()
    if (!musicGain || !ctx) return
    try {
      const t = ctx.currentTime
      musicGain.gain.cancelScheduledValues(t)
      musicGain.gain.setValueAtTime(musicGain.gain.value, t)
      musicGain.gain.linearRampToValueAtTime(value, t + seconds)
    } catch { /* node already torn down */ }
  }

  function scheduleBeat(i: number, combo: number) {
    const t = beats[i]
    const beatInBar = i % BEATS_PER_BAR
    const chord = chordForBeat(i)
    const level = intensityAt(t)
    const beatLen = (beats[i + 1] ?? t + 0.5) - t

    // Kick — 1 and 3, with the "and of 4" pickup once the track is dense.
    if (beatInBar === 0 || beatInBar === 2) emit(kick(beatInBar === 0 ? 1 : 0.86), t, MIX.drums)
    if (level >= 2 && beatInBar === 3) emit(kick(0.6), t + beatLen * 0.5, MIX.drums)

    // Snare — the backbeat. Its arrival at 8s is the moment the track "starts".
    if (level >= 1 && (beatInBar === 1 || beatInBar === 3)) emit(snare(beatInBar === 3 ? 1 : 0.9), t, MIX.drums)

    // Hats — 8ths, doubling to 16ths at full density. Downbeats accented.
    emit(hat(beatInBar === 0 ? 1 : 0.7, false), t, MIX.drums)
    emit(hat(0.5, beatInBar === 3), t + beatLen * 0.5, MIX.drums)
    if (level >= 3) {
      emit(hat(0.34, false), t + beatLen * 0.25, MIX.drums)
      emit(hat(0.34, false), t + beatLen * 0.75, MIX.drums)
    }

    // Bass — driving 8ths on the root, with the fifth as a turnaround on 4.
    if (level >= 1) {
      const octave = beatInBar === 3 ? chord.root * 1.5 : chord.root
      emit(bass(chord.root, beatLen * 480, 1), t, MIX.bass)
      emit(bass(octave, beatLen * 380, 0.7), t + beatLen * 0.5, MIX.bass)
    }

    // Pad — one sustained chord per bar, under everything.
    if (level >= 2 && beatInBar === 0) emit(pad(chord.triad, beatLen * 3800), t, MIX.pad)

    // Crash on every fourth bar boundary — the arrangement's punctuation.
    if (beatInBar === 0) {
      barsSinceCrash++
      if (level >= 3 && barsSinceCrash >= 4) { barsSinceCrash = 0; emit(crash(), t, MIX.accent) }
    }

    // A streak earns its own layer: a sparkling counter-melody on the off-beats
    // that only exists while the player is holding a long combo. Dropping it is
    // as audible as earning it, which is the point.
    if (combo >= 25 && beatInBar % 2 === 1) {
      const note = chord.triad[(i / 2 | 0) % chord.triad.length] * 4
      emit({ type: 'blip', freq: note, duration: 90, shape: 'sine', gain: 0.3, pan: -0.3 }, t + beatLen * 0.5, MIX.accent)
    }
  }

  return {
    beats,

    start(leadIn: number) {
      // The context is the game clock; a suspended one means a frozen run.
      unlockAudio()
      const ctx = getAudioContext()
      usePerf = ctx == null
      beats.length = 0
      beats.push(leadIn)
      schedIdx = 0
      barsSinceCrash = 0
      pausedAt = null
      origin = rawNow()
      running = true
      if (ctx) {
        const g = ctx.createGain()
        g.gain.value = 1
        const bus = getSynthBus()
        if (bus) g.connect(bus)
        else g.connect(ctx.destination)
        musicGain = g
      }
    },

    stop() {
      running = false
      // Everything inside the lookahead window is already committed to the
      // hardware and cannot be un-started, so the bed is faded instead. Without
      // this, a fifth of a second of drums plays on over the results panel.
      setBusGain(0, 0.12)
      const dying = musicGain
      musicGain = null
      setTimeout(() => { try { dying?.disconnect() } catch { /* ignore */ } }, 400)
    },

    pause() {
      if (pausedAt != null) return
      pausedAt = rawNow()
      // Mute the bed rather than trying to un-schedule it. Everything inside
      // the lookahead window is already committed to the audio hardware and
      // cannot be cancelled; muting is what makes the rewind in resume() safe.
      // Without it, a hide/show round trip SHORTER than the lookahead leaves
      // those nodes still pending, and rescheduling the same beats produces an
      // audible doubled hit.
      setBusGain(0, 0.03)
    },

    resume() {
      if (pausedAt == null) return
      origin += rawNow() - pausedAt
      pausedAt = null
      unlockAudio()
      // Rewind to the first beat still ahead of us. Safe now that whatever was
      // committed during the pause was muted rather than heard.
      const t = now()
      while (schedIdx > 0 && beats[schedIdx - 1] >= t) schedIdx--
      setBusGain(1, 0.05)
    },

    now,

    pump(combo: number) {
      if (!running || pausedAt != null) return
      const t = now()
      extendGrid(beats, t + LOOKAHEAD + 4)
      while (schedIdx < beats.length - 1 && beats[schedIdx] < t + LOOKAHEAD) {
        // A beat already behind the audio clock would be clamped forward and
        // land in a clump; skip it instead. Only reachable after a stall.
        if (beats[schedIdx] > t - 0.05) scheduleBeat(schedIdx, combo)
        schedIdx++
      }
    },

    lastBeat() {
      const t = now()
      // beats is short and this walks from the scheduling cursor, so it is a
      // handful of comparisons per frame, not a scan.
      let i = Math.min(schedIdx, beats.length - 1)
      while (i > 0 && beats[i] > t) i--
      return { index: i, time: beats[i] }
    },
  }
}
