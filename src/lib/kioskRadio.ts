// ═══════════════════════════════════════════════════════════════════════════
// THE RADIO ON THE COUNTER — three stations, none of them real.
// ──────────────────────────────────────────────────────────────────────────
// Not files. Each station is a short loop of notes scheduled straight onto the
// audio clock, a bar at a time, the same way Purr Beat schedules its bed — so
// three stations of night-shift music cost nothing to download and can't drift
// out of time with themselves.
//
// It goes through playSynthAt, so the app's volume slider and mute apply, and
// it stays quiet on purpose: this is a small speaker on a counter, behind the
// street and the fridge, not a soundtrack.
// ═══════════════════════════════════════════════════════════════════════════

import { audioNow, unlockAudio } from './soundSynth'
import { playSynthAt } from './sounds'

/** One note in a station's loop. */
interface Note {
  /** Beat within the loop. */
  b: number
  /** MIDI note. */
  m: number
  /** Length, ms. */
  d: number
  g: number
  s: 'sine' | 'square' | 'triangle'
}

export interface Station {
  id: string
  /** Printed on the little strip above the radio when you tune to it. */
  name: string
  bpm: number
  /** Beats before the loop comes round again. */
  beats: number
  notes: Note[]
}

/** Well under everything else in the room. A radio you notice is a radio
 *  you'd turn off. */
const RADIO_VOL = 0.3

export const STATIONS: Station[] = [
  {
    id: 'night-bus',
    name: 'NIGHT BUS',
    bpm: 72,
    beats: 8,
    // An A-minor seventh, taken apart and handed round slowly.
    notes: [
      { b: 0,   m: 45, d: 900, g: 0.22, s: 'triangle' },
      { b: 0,   m: 57, d: 420, g: 0.18, s: 'sine' },
      { b: 1,   m: 64, d: 380, g: 0.16, s: 'sine' },
      { b: 2,   m: 67, d: 380, g: 0.16, s: 'sine' },
      { b: 3,   m: 64, d: 340, g: 0.14, s: 'sine' },
      { b: 4,   m: 41, d: 900, g: 0.22, s: 'triangle' },
      { b: 4,   m: 60, d: 420, g: 0.18, s: 'sine' },
      { b: 5,   m: 67, d: 380, g: 0.15, s: 'sine' },
      { b: 6,   m: 64, d: 380, g: 0.15, s: 'sine' },
      { b: 7,   m: 60, d: 420, g: 0.13, s: 'sine' },
    ],
  },
  {
    id: 'grease-fm',
    name: 'GREASE FM',
    bpm: 106,
    beats: 8,
    // Something with a bounce in it, for when the queue is moving.
    notes: [
      { b: 0,   m: 48, d: 220, g: 0.24, s: 'triangle' },
      { b: 0,   m: 60, d: 150, g: 0.17, s: 'square' },
      { b: 0.5, m: 64, d: 150, g: 0.15, s: 'square' },
      { b: 1,   m: 67, d: 190, g: 0.17, s: 'square' },
      { b: 1.5, m: 69, d: 150, g: 0.15, s: 'square' },
      { b: 2,   m: 67, d: 190, g: 0.16, s: 'square' },
      { b: 2,   m: 48, d: 220, g: 0.20, s: 'triangle' },
      { b: 3,   m: 64, d: 220, g: 0.14, s: 'square' },
      { b: 4,   m: 53, d: 220, g: 0.24, s: 'triangle' },
      { b: 4,   m: 65, d: 150, g: 0.17, s: 'square' },
      { b: 4.5, m: 69, d: 150, g: 0.15, s: 'square' },
      { b: 5,   m: 72, d: 190, g: 0.17, s: 'square' },
      { b: 6,   m: 69, d: 190, g: 0.15, s: 'square' },
      { b: 6,   m: 53, d: 220, g: 0.20, s: 'triangle' },
      { b: 7,   m: 67, d: 260, g: 0.14, s: 'square' },
    ],
  },
  {
    id: 'late-show',
    name: 'THE LATE SHOW',
    bpm: 58,
    beats: 8,
    // Mostly silence, which at four in the morning is the right amount.
    notes: [
      { b: 0,   m: 38, d: 1400, g: 0.22, s: 'triangle' },
      { b: 2,   m: 57, d: 520,  g: 0.15, s: 'sine' },
      { b: 3.5, m: 60, d: 420,  g: 0.13, s: 'sine' },
      { b: 4,   m: 41, d: 1400, g: 0.22, s: 'triangle' },
      { b: 6,   m: 64, d: 620,  g: 0.14, s: 'sine' },
      { b: 7,   m: 57, d: 520,  g: 0.12, s: 'sine' },
    ],
  },
]

function freq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/**
 * Tune in. Returns a stop().
 *
 * The loop is scheduled a bar ahead on the audio clock rather than played by a
 * timer, so it keeps time even when the main thread is busy carving meat. If
 * the tab was backgrounded and the timer comes back late, the cursor is pushed
 * forward to NOW instead of dumping every bar it missed.
 */
export function startRadio(index: number): () => void {
  if (typeof window === 'undefined') return () => {}
  const station = STATIONS[index]
  if (!station) return () => {}
  unlockAudio()

  const beat = 60 / station.bpm
  const loop = beat * station.beats
  let stopped = false
  let next = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const tick = () => {
    if (stopped) return
    const now = audioNow()
    if (now == null) { timer = setTimeout(tick, 300); return }
    // Behind (or never started): pick the loop up from here.
    if (next < now + 0.05) next = now + 0.15
    while (next < now + loop) {
      for (const n of station.notes) {
        playSynthAt(
          { type: 'blip', freq: freq(n.m), duration: n.d, shape: n.s, gain: n.g },
          next + n.b * beat,
          RADIO_VOL,
        )
      }
      next += loop
    }
    timer = setTimeout(tick, loop * 500)
  }

  tick()
  return () => {
    stopped = true
    if (timer !== null) clearTimeout(timer)
  }
}
