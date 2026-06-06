// ═════════════════════════════════════════════════════════════════════════════
// CHIPTUNE WEB-AUDIO SYNTH
//
// Game SFX for the 11 mini-games are synthesised live via Web Audio rather than
// shipped as mp3 files. The reasons:
//  - Each game gets a genuinely unique sound by construction (different waveform
//    families, frequency ranges, envelopes), instead of all routing to the same
//    fallback file. Pre-fix, every "catch" event in catch-mouse fell back to
//    `care_eat` because the mp3 didn't exist — Eren chewing mid-game.
//  - Zero binary bloat in the repo (~50 KB × 73 sounds saved).
//  - The chiptune aesthetic is what these synths are FOR. Square waves with
//    tight envelopes ARE the retro-game palette.
//
// The recipes themselves live in `soundRecipes.ts` so this file stays focused
// on the audio plumbing.
// ═════════════════════════════════════════════════════════════════════════════

type Shape = 'sine' | 'square' | 'triangle' | 'sawtooth'

export type SynthRecipe =
  // Single tone with attack + exponential decay.
  | { type: 'blip'; freq: number; duration: number; shape?: Shape; gain?: number }
  // Frequency sweep from `freq[0]` to `freq[1]` over `duration` ms.
  | { type: 'sweep'; freq: [number, number]; duration: number; shape?: Shape; gain?: number; curve?: 'linear' | 'exponential' }
  // Arpeggio — a sequence of notes spaced `step` ms apart.
  | { type: 'arp'; notes: number[]; step: number; noteDur?: number; shape?: Shape; gain?: number }
  // Repeated pulses of the same frequency — for warnings + timers.
  | { type: 'pulse'; freq: number; pulses: number; step: number; pulseDur?: number; shape?: Shape; gain?: number }
  // White-noise burst with optional lowpass / highpass filters.
  | { type: 'noise'; duration: number; gain?: number; lowpass?: number; highpass?: number }
  // Crash = noise + (optional) low tone. Used for collisions.
  | { type: 'crash'; noise: { duration: number; gain?: number; lowpass?: number }; tone?: { freq: number; duration: number; shape?: Shape; gain?: number } }
  // Chord — multiple notes simultaneously (each note's gain auto-scaled by 1/N).
  | { type: 'chord'; freqs: number[]; duration: number; shape?: Shape; gain?: number }
  // Composite — multiple sub-recipes scheduled with offsets. Use for richer
  // sounds that combine arp + noise, sweep + chord, etc.
  | { type: 'seq'; parts: Array<{ at: number; recipe: SynthRecipe }> }

// ─── AudioContext bootstrap ──────────────────────────────────────────────────
// Lazily created on first call so SSR doesn't choke and so we don't spin up the
// audio graph before the user has interacted with the page.
let _ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (_ctx) return _ctx
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    _ctx = new AC()
    return _ctx
  } catch {
    return null
  }
}

// ─── Individual voices ───────────────────────────────────────────────────────

function scheduleTone(
  ctx: AudioContext,
  master: AudioNode,
  startSec: number,
  freq: number,
  durationMs: number,
  shape: Shape,
  gain: number,
  glide?: number,
  glideCurve: 'linear' | 'exponential' = 'linear',
): number {
  const dur = Math.max(0.005, durationMs / 1000)
  const osc = ctx.createOscillator()
  osc.type = shape
  osc.frequency.setValueAtTime(freq, startSec)
  if (glide != null && glide !== freq) {
    // exponentialRampToValueAtTime requires strictly-positive values; clamp.
    const target = Math.max(1, glide)
    if (glideCurve === 'exponential') osc.frequency.exponentialRampToValueAtTime(target, startSec + dur)
    else osc.frequency.linearRampToValueAtTime(target, startSec + dur)
  }
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, startSec)
  // Hard pixel attack — 4 ms is fast enough to feel instantaneous but avoids
  // the click you get from setting gain at the exact start.
  env.gain.linearRampToValueAtTime(gain, startSec + 0.004)
  // Exponential tail so the decay sounds natural rather than choppy. Ramp to
  // 0.0005 instead of 0 (exponentialRamp can't touch 0) then snap to silence.
  const tail = Math.max(startSec + 0.008, startSec + dur)
  env.gain.exponentialRampToValueAtTime(0.0005, tail)
  env.gain.setValueAtTime(0, tail + 0.001)
  osc.connect(env)
  env.connect(master)
  osc.start(startSec)
  osc.stop(tail + 0.01)
  return tail + 0.01
}

function scheduleNoise(
  ctx: AudioContext,
  master: AudioNode,
  startSec: number,
  durationMs: number,
  gain: number,
  lowpass?: number,
  highpass?: number,
): number {
  const dur = Math.max(0.005, durationMs / 1000)
  const samples = Math.max(1, Math.ceil(ctx.sampleRate * dur))
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  let node: AudioNode = src
  if (lowpass) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = lowpass
    node.connect(f)
    node = f
  }
  if (highpass) {
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = highpass
    node.connect(f)
    node = f
  }
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, startSec)
  env.gain.linearRampToValueAtTime(gain, startSec + 0.004)
  const tail = Math.max(startSec + 0.008, startSec + dur)
  env.gain.exponentialRampToValueAtTime(0.0005, tail)
  env.gain.setValueAtTime(0, tail + 0.001)
  node.connect(env)
  env.connect(master)
  src.start(startSec)
  src.stop(tail + 0.01)
  return tail + 0.01
}

// ─── Recipe dispatcher ───────────────────────────────────────────────────────

function scheduleRecipe(
  ctx: AudioContext,
  master: AudioNode,
  startSec: number,
  recipe: SynthRecipe,
): number {
  switch (recipe.type) {
    case 'blip': {
      return scheduleTone(ctx, master, startSec, recipe.freq, recipe.duration, recipe.shape ?? 'square', recipe.gain ?? 1)
    }
    case 'sweep': {
      return scheduleTone(ctx, master, startSec, recipe.freq[0], recipe.duration, recipe.shape ?? 'square', recipe.gain ?? 1, recipe.freq[1], recipe.curve ?? 'linear')
    }
    case 'arp': {
      const noteDur = recipe.noteDur ?? recipe.step
      const shape = recipe.shape ?? 'square'
      const gain = recipe.gain ?? 0.9
      let end = startSec
      for (let i = 0; i < recipe.notes.length; i++) {
        const t = startSec + (i * recipe.step) / 1000
        const e = scheduleTone(ctx, master, t, recipe.notes[i], noteDur, shape, gain)
        if (e > end) end = e
      }
      return end
    }
    case 'pulse': {
      const noteDur = recipe.pulseDur ?? Math.min(recipe.step * 0.6, 80)
      const shape = recipe.shape ?? 'square'
      const gain = recipe.gain ?? 0.85
      let end = startSec
      for (let i = 0; i < recipe.pulses; i++) {
        const t = startSec + (i * recipe.step) / 1000
        const e = scheduleTone(ctx, master, t, recipe.freq, noteDur, shape, gain)
        if (e > end) end = e
      }
      return end
    }
    case 'noise': {
      return scheduleNoise(ctx, master, startSec, recipe.duration, recipe.gain ?? 0.5, recipe.lowpass, recipe.highpass)
    }
    case 'crash': {
      const a = scheduleNoise(ctx, master, startSec, recipe.noise.duration, recipe.noise.gain ?? 0.6, recipe.noise.lowpass)
      let b = startSec
      if (recipe.tone) {
        b = scheduleTone(ctx, master, startSec, recipe.tone.freq, recipe.tone.duration, recipe.tone.shape ?? 'square', recipe.tone.gain ?? 0.8)
      }
      return Math.max(a, b)
    }
    case 'chord': {
      const perNote = (recipe.gain ?? 0.8) / Math.max(1, recipe.freqs.length)
      let end = startSec
      for (const f of recipe.freqs) {
        const e = scheduleTone(ctx, master, startSec, f, recipe.duration, recipe.shape ?? 'triangle', perNote)
        if (e > end) end = e
      }
      return end
    }
    case 'seq': {
      let end = startSec
      for (const part of recipe.parts) {
        const e = scheduleRecipe(ctx, master, startSec + part.at / 1000, part.recipe)
        if (e > end) end = e
      }
      return end
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

// Shared accessor so the mp3-sample player in sounds.ts uses the SAME
// AudioContext as the synth engine — one context per page (mobile browsers
// cap concurrent contexts and dislike spinning up extras).
export function getAudioContext(): AudioContext | null {
  return getCtx()
}

// Play a pre-decoded mp3 (AudioBuffer) through Web Audio. Replaces the old
// HTMLAudioElement.cloneNode() playback, which made Chrome re-hit its media
// cache on every play and log `net::ERR_CACHE_OPERATION_NOT_SUPPORTED`. A
// buffer source touches the network/cache zero times, overlaps cleanly, and
// frees its nodes on `ended`.
export function playBuffer(buffer: AudioBuffer, volume: number): void {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => { /* first play before a gesture may be lost */ })
  }
  try {
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = Math.max(0, Math.min(1, volume))
    src.connect(gain)
    gain.connect(ctx.destination)
    src.onended = () => {
      try { src.disconnect(); gain.disconnect() } catch { /* ignore */ }
    }
    src.start()
  } catch {
    /* AudioContext might still be locked — ignore */
  }
}

export function playSynth(recipe: SynthRecipe, volume: number): void {
  const ctx = getCtx()
  if (!ctx) return
  // Browsers gate AudioContext behind user gesture; resume on every play call
  // (it's a no-op if already running).
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => { /* silent — first play after page load may lose */ })
  }
  try {
    const master = ctx.createGain()
    master.gain.value = Math.max(0, Math.min(1, volume))
    master.connect(ctx.destination)
    const startSec = ctx.currentTime + 0.001
    const endSec = scheduleRecipe(ctx, master, startSec, recipe)
    // Disconnect the master node after the sound finishes so we don't leak
    // nodes (browsers eventually GC, but explicit is friendlier on mobile).
    setTimeout(() => {
      try { master.disconnect() } catch { /* ignore */ }
    }, Math.max(50, (endSec - startSec) * 1000 + 100))
  } catch {
    /* AudioContext might still be locked — ignore */
  }
}
