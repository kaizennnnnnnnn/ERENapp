// ═══════════════════════════════════════════════════════════════════════════
// THE SOUND OF STANDING IN THE KIOSK.
// ──────────────────────────────────────────────────────────────────────────
// A continuous bed rather than a cue: the street outside, the fridge on the
// back wall, the spit hissing on the wall you happen to be facing, and rain if
// it's that kind of night. Nothing here is a file — it's all noise and a
// couple of oscillators through filters, generated once and looped, so the bed
// costs nothing to download and can be mixed live as you turn around.
//
// The landlord phones to complain about the humming fridge. It seemed unfair
// that you couldn't hear it.
//
// Everything hangs off the shared synth bus, so it obeys the app's volume and
// mute like every other sound — see registerAmbience in sounds.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { getAudioContext, getSynthBus, unlockAudio } from './soundSynth'
import { registerAmbience } from './sounds'

export interface KioskAmbience {
  /** 0–1: how much of the rotisserie you can hear. Turn to face it and it
   *  comes up; turn away and it goes back to a suggestion. */
  setSizzle(level: number): void
  /** 0–1: rain on the roof. */
  setRain(level: number): void
  /** 0–1: wind through the hatch. Higher and drier than the rain, and it
   *  breathes — a flat hiss is a radiator, not weather. */
  setWind(level: number): void
  /** 0–1: the fridge, the lamps, the whole electrical bed. Goes to nothing
   *  when the street loses power, which is most of what a blackout IS. */
  setPower(level: number): void
  /** Fade the whole street out. */
  stop(): void
}

/** How long every level change takes. Slow enough that turning around is a
 *  crossfade rather than a switch. */
const RAMP = 0.45
/** Length of the noise loop. Long enough that the ear can't hear the seam. */
const NOISE_SECONDS = 3

const NO_AMBIENCE: KioskAmbience = {
  setSizzle() {}, setRain() {}, setWind() {}, setPower() {}, stop() {},
}

/** Brown-ish noise: white noise run through a leaky integrator, which tilts
 *  the spectrum down and turns a hiss into a rumble. Built once per context. */
let noiseBuffer: AudioBuffer | null = null
function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const len = Math.floor(ctx.sampleRate * NOISE_SECONDS)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let run = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    run = (run + 0.02 * white) / 1.02
    d[i] = run * 3.5
  }
  // Cross-fade the last tenth of a second into the first, so the loop point
  // isn't a click.
  const fade = Math.floor(ctx.sampleRate * 0.1)
  for (let i = 0; i < fade; i++) {
    const t = i / fade
    d[i] = d[i] * t + d[len - fade + i] * (1 - t)
  }
  noiseBuffer = buf
  return buf
}

interface Voice {
  gain: GainNode
  /** What this voice sits at when it's fully up. */
  peak: number
  nodes: AudioScheduledSourceNode[]
}

/**
 * Start the room. Returns a handle whose setters are safe to call every frame
 * — each one ramps rather than jumps.
 *
 * Returns a no-op handle when there's no audio context at all (a browser with
 * Web Audio off, or SSR), so callers never have to null-check.
 */
export function startKioskAmbience(): KioskAmbience {
  if (typeof window === 'undefined') return NO_AMBIENCE
  unlockAudio()
  const ctx = getAudioContext()
  const bus = getSynthBus()
  if (!ctx || !bus) return NO_AMBIENCE

  const noise = getNoise(ctx)
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(bus)

  const voices: Voice[] = []

  /** One looping noise voice through a filter pair. */
  function noiseVoice(peak: number, lowpass: number, highpass: number, q = 0.7): Voice {
    const src = ctx!.createBufferSource()
    src.buffer = noise
    src.loop = true
    const lp = ctx!.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = lowpass; lp.Q.value = q
    const hp = ctx!.createBiquadFilter()
    hp.type = 'highpass'; hp.frequency.value = highpass
    const g = ctx!.createGain()
    g.gain.value = 0
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(master)
    src.start()
    const v: Voice = { gain: g, peak, nodes: [src] }
    voices.push(v)
    return v
  }

  // ── the street ────────────────────────────────────────────────────────
  // Always there, always the loudest thing, always almost inaudible.
  const street = noiseVoice(0.085, 380, 40)
  street.gain.gain.setValueAtTime(street.peak, ctx.currentTime)

  // A slow swell over the top, so the road breathes instead of sitting flat.
  const swellOsc = ctx.createOscillator()
  swellOsc.type = 'sine'
  swellOsc.frequency.value = 0.06
  const swellAmt = ctx.createGain()
  swellAmt.gain.value = 0.03
  swellOsc.connect(swellAmt)
  swellAmt.connect(street.gain.gain)
  swellOsc.start()

  // ── the fridge ────────────────────────────────────────────────────────
  // Mains hum and its first harmonic, detuned a hair apart so they beat
  // against each other the way a tired compressor does.
  const humGain = ctx.createGain()
  humGain.gain.value = 0.02
  humGain.connect(master)
  const hums: OscillatorNode[] = []
  for (const [freq, level, shape] of [[50, 0.5, 'sine'], [100.6, 0.34, 'triangle'], [150, 0.12, 'sine']] as const) {
    const o = ctx.createOscillator()
    o.type = shape
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.value = level
    o.connect(g); g.connect(humGain)
    o.start()
    hums.push(o)
  }

  // ── the spit, and the weather ─────────────────────────────────────────
  const sizzle = noiseVoice(0.075, 7000, 1900, 0.5)
  const rain = noiseVoice(0.105, 3400, 700, 0.4)
  // Wind sits between the two: brighter than rain, wider than the spit, and
  // it swells on a slow oscillator so it gusts instead of hissing.
  const wind = noiseVoice(0.115, 1800, 220, 0.9)
  const gustOsc = ctx.createOscillator()
  gustOsc.type = 'sine'
  gustOsc.frequency.value = 0.13
  const gustAmt = ctx.createGain()
  gustAmt.gain.value = 0.055
  gustOsc.connect(gustAmt)
  gustAmt.connect(wind.gain.gain)
  gustOsc.start()

  const ramp = (node: GainNode, to: number) => {
    const now = ctx.currentTime
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(node.gain.value, now)
    node.gain.linearRampToValueAtTime(to, now + RAMP)
  }

  // The app's volume slider and mute reach the bed through here.
  const unregister = registerAmbience(v => {
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.linearRampToValueAtTime(v, now + RAMP)
  })

  let stopped = false

  return {
    setSizzle(level) {
      if (stopped) return
      ramp(sizzle.gain, sizzle.peak * Math.max(0, Math.min(1, level)))
    },
    setRain(level) {
      if (stopped) return
      ramp(rain.gain, rain.peak * Math.max(0, Math.min(1, level)))
    },
    setWind(level) {
      if (stopped) return
      ramp(wind.gain, wind.peak * Math.max(0, Math.min(1, level)))
    },
    setPower(level) {
      if (stopped) return
      // The hum is the whole electrical bed — fridge, lamps, the lot. When it
      // goes, what's left is the street, which is exactly right.
      ramp(humGain, 0.02 * Math.max(0, Math.min(1, level)))
    },
    stop() {
      if (stopped) return
      stopped = true
      unregister()
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, now + 0.35)
      // Let the fade finish before the sources go, or the last thing you hear
      // on the way out is a click.
      setTimeout(() => {
        swellOsc.stop()
        gustOsc.stop()
        hums.forEach(o => o.stop())
        voices.forEach(v => v.nodes.forEach(n => n.stop()))
        master.disconnect()
      }, 500)
    },
  }
}
