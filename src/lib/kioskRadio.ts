// ═══════════════════════════════════════════════════════════════════════════
// THE RADIO ON THE COUNTER — three stations, none of them real.
// ──────────────────────────────────────────────────────────────────────────
// Not files. Each station is a four-bar chord loop scheduled straight onto the
// audio clock, a bar at a time, the same way Purr Beat schedules its bed — so
// three stations of night-shift music cost nothing to download and can't drift
// out of time with themselves.
//
// Two things make it sound like a RADIO rather than like chiptune:
//
//  1. Everything is arranged, not just played. A bar carries a pad, a bass, a
//     tune and a kit, and the tune is written in DEGREES of the bar's chord
//     rather than in absolute notes — so a four-chord progression moves under
//     it and nothing can ever land out of key.
//  2. Everything then goes through one small speaker: high-passed so there is
//     no real bass, low-passed so there is no air, and a peak at 1.9 kHz for
//     the boxy honk a plastic radio has. Under it all sits a breath of hiss,
//     because the giveaway that a radio is fake is that its silence is
//     perfect.
//
// The whole station hangs off a gain node this module owns. That is not
// tidiness — it is the only way to STOP. Notes are scheduled up to two bars
// ahead, so before this existed, turning the radio off (or changing station,
// or walking out of the kiosk) left the last bar playing to the end, and
// tuning played both stations at once for several seconds.
// ═══════════════════════════════════════════════════════════════════════════

import {
  audioNow, getAudioContext, getSynthBus, scheduleSynthAt, unlockAudio,
  type SynthRecipe,
} from './soundSynth'
import { registerAmbience } from './sounds'

type Shape = 'sine' | 'square' | 'triangle' | 'sawtooth'

/** A note, written as a DEGREE of whatever chord the bar is on. `i` indexes
 *  the chord and wraps up an octave past the top, so a tune can't fall out of
 *  key when the progression moves under it. */
interface Note {
  /** Beat within the bar. */
  b: number
  /** Chord degree. */
  i: number
  /** Length, ms. */
  d: number
  /** Trim, if this note wants to sit under its neighbours. */
  g?: number
}

type DrumId = 'kick' | 'snare' | 'hat' | 'rim' | 'shake'
interface Hit { b: number; k: DrumId; g?: number }

export interface Station {
  id: string
  /** Printed on the little strip above the radio when you tune to it. */
  name: string
  bpm: number
  /** Beats in a bar. Every pattern below is written against ONE bar. */
  bar: number
  /** One chord per bar, root first. MIDI. The loop is this long. */
  prog: number[][]
  /** Chord degrees the pad holds, and for how long. */
  pad: number[]
  padHold: number
  padGain: number
  padShape: Shape
  bass: Note[]
  bassShape: Shape
  lead: Note[]
  leadShape: Shape
  drums: Hit[]
  /** How much of a shuffle. 0 is straight; 0.16 is a lazy swing. */
  swing?: number
}

export const STATIONS: Station[] = [
  {
    id: 'night-bus',
    name: 'NIGHT BUS',
    bpm: 74,
    bar: 8,
    // Am7 – Fmaj7 – Dm7 – E7. The loop everyone half-remembers from a bus
    // window at midnight.
    prog: [
      [45, 52, 60, 64, 67],
      [41, 48, 60, 65, 69],
      [38, 50, 57, 62, 65],
      [40, 47, 59, 64, 68],
    ],
    pad: [1, 2, 3], padHold: 2900, padGain: 0.075, padShape: 'triangle',
    bassShape: 'triangle',
    bass: [
      { b: 0,   i: 0, d: 780 },
      { b: 3,   i: 0, d: 420, g: 0.8 },
      { b: 4.5, i: 1, d: 620 },
    ],
    leadShape: 'sine',
    lead: [
      { b: 1,   i: 3, d: 540 },
      { b: 2.5, i: 4, d: 440, g: 0.85 },
      { b: 4,   i: 3, d: 620 },
      { b: 6,   i: 2, d: 820, g: 0.9 },
    ],
    drums: [
      { b: 0, k: 'kick' }, { b: 4, k: 'kick' },
      { b: 2, k: 'shake' }, { b: 6, k: 'shake' },
      { b: 1, k: 'hat', g: 0.6 }, { b: 3, k: 'hat', g: 0.6 },
      { b: 5, k: 'hat', g: 0.6 }, { b: 7, k: 'hat', g: 0.6 },
    ],
    swing: 0.1,
  },
  {
    id: 'grease-fm',
    name: 'GREASE FM',
    bpm: 108,
    bar: 8,
    // C – Am – F – G, and a square wave with somewhere to be.
    prog: [
      [48, 55, 64, 67, 72],
      [45, 52, 64, 69, 72],
      [41, 53, 65, 69, 72],
      [43, 55, 62, 67, 71],
    ],
    pad: [1, 2], padHold: 900, padGain: 0.06, padShape: 'triangle',
    bassShape: 'triangle',
    bass: [
      { b: 0,   i: 0, d: 200 }, { b: 1,   i: 0, d: 160, g: 0.75 },
      { b: 2,   i: 1, d: 200 }, { b: 3,   i: 0, d: 160, g: 0.75 },
      { b: 4,   i: 0, d: 200 }, { b: 5,   i: 0, d: 160, g: 0.75 },
      { b: 6,   i: 1, d: 200 }, { b: 6.5, i: 2, d: 160, g: 0.7 },
    ],
    leadShape: 'square',
    lead: [
      { b: 0,   i: 2, d: 170 }, { b: 0.5, i: 3, d: 170, g: 0.85 },
      { b: 1,   i: 4, d: 200 }, { b: 1.5, i: 3, d: 160, g: 0.8 },
      { b: 2,   i: 2, d: 280 }, { b: 3,   i: 4, d: 220, g: 0.9 },
      { b: 4,   i: 3, d: 170 }, { b: 4.5, i: 4, d: 170, g: 0.85 },
      { b: 5,   i: 5, d: 230 }, { b: 6,   i: 4, d: 200, g: 0.9 },
      { b: 7,   i: 2, d: 320, g: 0.85 },
    ],
    drums: [
      { b: 0, k: 'kick' }, { b: 2.5, k: 'kick', g: 0.8 },
      { b: 4, k: 'kick' }, { b: 6.5, k: 'kick', g: 0.7 },
      { b: 2, k: 'snare' }, { b: 6, k: 'snare' },
      ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap(n => ([
        { b: n,       k: 'hat' as DrumId, g: 0.85 },
        { b: n + 0.5, k: 'hat' as DrumId, g: 0.5  },
      ])),
    ],
    swing: 0.14,
  },
  {
    id: 'late-show',
    name: 'THE LATE SHOW',
    bpm: 58,
    bar: 8,
    // Cmaj9 – Am9 – Dm9 – G13. Mostly silence, which at four in the morning
    // is the right amount.
    prog: [
      [48, 55, 64, 71, 76],
      [45, 52, 64, 67, 71],
      [50, 57, 65, 72, 76],
      [43, 55, 65, 71, 74],
    ],
    pad: [1, 2, 3, 4], padHold: 4200, padGain: 0.085, padShape: 'sine',
    bassShape: 'sine',
    bass: [{ b: 0, i: 0, d: 1500 }, { b: 5, i: 1, d: 900, g: 0.7 }],
    leadShape: 'sine',
    lead: [
      { b: 2,   i: 3, d: 980 },
      { b: 5.5, i: 4, d: 760, g: 0.8 },
    ],
    drums: [{ b: 3, k: 'shake', g: 0.7 }, { b: 6, k: 'rim' }],
  },
]

// ── the kit ────────────────────────────────────────────────────────────────
// Written for a 5 kHz ceiling. A hat with all its air taken away is a "ts",
// which is what a hat sounds like out of a radio on a shelf.
const DRUMS: Record<DrumId, (g: number) => SynthRecipe> = {
  kick: g => ({ type: 'seq', parts: [
    { at: 0, recipe: { type: 'sweep', freq: [230, 78], duration: 130, shape: 'sine', gain: 0.75 * g, curve: 'exponential' } },
    { at: 0, recipe: { type: 'noise', duration: 18, gain: 0.16 * g, lowpass: 3200, highpass: 400 } },
  ] }),
  snare: g => ({ type: 'seq', parts: [
    { at: 0, recipe: { type: 'noise', duration: 135, gain: 0.3 * g, lowpass: 4600, highpass: 1100 } },
    { at: 0, recipe: { type: 'blip', freq: 196, duration: 80, shape: 'triangle', gain: 0.16 * g } },
  ] }),
  hat:   g => ({ type: 'noise', duration: 42, gain: 0.17 * g, lowpass: 9500, highpass: 3800 }),
  rim:   g => ({ type: 'blip', freq: 1046, duration: 40, shape: 'square', gain: 0.1 * g }),
  shake: g => ({ type: 'noise', duration: 90, gain: 0.11 * g, lowpass: 6500, highpass: 2600 }),
}

/** Where the radio sits under everything else in the room. A radio you notice
 *  is a radio you'd turn off. */
const RADIO_VOL = 0.42
/** Hiss under the music. Almost nothing — but its absence is audible. */
const HISS_GAIN = 0.016
/** How far ahead notes are placed. Two bars of slack means the music survives
 *  a main thread busy carving meat; it costs nothing, because the gain node
 *  can silence whatever is already out there. */
const HORIZON_BARS = 2
/** Fades. Long enough not to click, short enough that OFF means off. */
const FADE_IN = 0.28
const FADE_OUT = 0.16

function freq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** A chord degree, wrapping up an octave each time it runs off the top. */
function degree(chord: number[], i: number): number {
  const n = chord.length
  const k = ((i % n) + n) % n
  return chord[k] + 12 * Math.floor(i / n)
}

/** Radio hiss: white noise, looped. Built once per context. */
let hissBuffer: AudioBuffer | null = null
function getHiss(ctx: AudioContext): AudioBuffer {
  if (hissBuffer && hissBuffer.sampleRate === ctx.sampleRate) return hissBuffer
  const len = Math.floor(ctx.sampleRate * 2)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const fade = Math.floor(ctx.sampleRate * 0.05)
  for (let i = 0; i < fade; i++) {
    const t = i / fade
    d[i] = d[i] * t + d[len - fade + i] * (1 - t)
  }
  hissBuffer = buf
  return buf
}

/**
 * Tune in. Returns a stop().
 *
 * The loop is scheduled ahead on the audio clock rather than played by a
 * timer, so it keeps time even when the main thread is busy. If the tab was
 * backgrounded and the timer comes back late, the cursor is pushed forward to
 * NOW and the progression restarts from its first bar, rather than dumping
 * every bar it missed.
 */
export function startRadio(index: number): () => void {
  if (typeof window === 'undefined') return () => {}
  const station = STATIONS[index]
  if (!station) return () => {}
  unlockAudio()

  const ctx = getAudioContext()
  const bus = getSynthBus()
  if (!ctx || !bus) return () => {}

  // ── the speaker ─────────────────────────────────────────────────────────
  // out → honk → lowpass → highpass → limiter bus.
  const out = ctx.createGain()
  out.gain.value = 0
  const honk = ctx.createBiquadFilter()
  honk.type = 'peaking'; honk.frequency.value = 1900; honk.Q.value = 1.1; honk.gain.value = 4.5
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 5000; lp.Q.value = 0.9
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'; hp.frequency.value = 220; hp.Q.value = 0.7
  out.connect(honk); honk.connect(lp); lp.connect(hp); hp.connect(bus)

  const hiss = ctx.createBufferSource()
  hiss.buffer = getHiss(ctx)
  hiss.loop = true
  const hissBand = ctx.createBiquadFilter()
  hissBand.type = 'bandpass'; hissBand.frequency.value = 2600; hissBand.Q.value = 0.6
  const hissGain = ctx.createGain()
  hissGain.gain.value = HISS_GAIN
  hiss.connect(hissBand); hissBand.connect(hissGain); hissGain.connect(out)
  hiss.start()

  // The app's volume slider and mute reach the station through here — which
  // also means a bar already scheduled goes quiet the instant you mute,
  // instead of playing itself out.
  let level = 0
  let stopped = false
  const applyLevel = () => {
    const now = ctx.currentTime
    out.gain.cancelScheduledValues(now)
    out.gain.setValueAtTime(out.gain.value, now)
    out.gain.linearRampToValueAtTime(stopped ? 0 : level * RADIO_VOL, now + FADE_IN)
  }
  const unregister = registerAmbience(v => { level = v; applyLevel() })

  // ── the clock ───────────────────────────────────────────────────────────
  const beat = 60 / station.bpm
  const barSec = beat * station.bar
  const swing = station.swing ?? 0
  let next = 0
  let barNo = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  /** Offbeat eighths land late, by `swing` of a beat. */
  const at = (bar: number, b: number) =>
    bar + (b + (Math.abs(b % 1 - 0.5) < 1e-6 ? swing : 0)) * beat

  const fire = (recipe: SynthRecipe, when: number) => scheduleSynthAt(recipe, 1, when, out)

  const playBar = (bar: number) => {
    const chord = station.prog[barNo % station.prog.length]

    fire({
      type: 'chord',
      freqs: station.pad.map(i => freq(degree(chord, i))),
      duration: station.padHold,
      shape: station.padShape,
      gain: station.padGain,
      lowpass: 2400,
    }, bar)

    for (const n of station.bass) {
      fire({
        type: 'blip', freq: freq(degree(chord, n.i)), duration: n.d,
        shape: station.bassShape, gain: 0.24 * (n.g ?? 1), lowpass: 1400,
      }, at(bar, n.b))
    }
    for (const n of station.lead) {
      fire({
        type: 'blip', freq: freq(degree(chord, n.i)), duration: n.d,
        shape: station.leadShape, gain: 0.15 * (n.g ?? 1),
      }, at(bar, n.b))
    }
    for (const h of station.drums) fire(DRUMS[h.k](h.g ?? 1), at(bar, h.b))
    barNo += 1
  }

  const tick = () => {
    if (stopped) return
    const now = audioNow()
    if (now == null) { timer = setTimeout(tick, 300); return }
    // Behind, or never started: pick the loop up from here, at the top of the
    // progression. A restart mid-phrase sounds like a fault; a restart on bar
    // one sounds like the song came round again.
    if (next < now + 0.05) { next = now + 0.2; barNo = 0 }
    while (next < now + barSec * HORIZON_BARS) {
      playBar(next)
      next += barSec
    }
    timer = setTimeout(tick, barSec * 600)
  }

  // Coming back to the tab shouldn't cost most of a bar of silence.
  const wake = () => {
    if (stopped || document.visibilityState !== 'visible') return
    if (timer !== null) clearTimeout(timer)
    tick()
  }
  document.addEventListener('visibilitychange', wake)

  tick()

  return () => {
    if (stopped) return
    stopped = true
    unregister()
    document.removeEventListener('visibilitychange', wake)
    if (timer !== null) clearTimeout(timer)
    const now = ctx.currentTime
    out.gain.cancelScheduledValues(now)
    out.gain.setValueAtTime(out.gain.value, now)
    out.gain.linearRampToValueAtTime(0, now + FADE_OUT)
    // Everything scheduled ahead is still out there — it is just being played
    // into silence now, and these nodes go once the fade has finished.
    setTimeout(() => {
      try { hiss.stop() } catch { /* already gone */ }
      try { out.disconnect() } catch { /* already gone */ }
    }, (FADE_OUT + 0.1) * 1000)
  }
}
