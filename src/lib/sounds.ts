// ═══════════════════════════════════════════════════════════════════════════
// SOUND HELPER — minimal playback layer for UI sound effects.
//
// Usage:
//   import { playSound } from '@/lib/sounds'
//   onClick={() => playSound('ui_tap')}
//
// Files live in /public/sounds/<bucket>/<name>.mp3 and are looked up by the
// SOUNDS map below. Each call clones the cached <audio> element so rapid
// successive triggers don't cut each other off (important for tap clicks).
//
// Volume + mute can be controlled per-call or globally via setVolume / setMuted.
// State is in-memory only — wire it to localStorage if you want it to persist.
// ═══════════════════════════════════════════════════════════════════════════

export const SOUNDS = {
  // UI / navigation
  ui_tap:               '/sounds/ui/ui_tap.mp3',
  ui_back:              '/sounds/ui/ui_back.mp3',
  ui_modal_open:        '/sounds/ui/ui_modal_open.mp3',
  ui_modal_close:       '/sounds/ui/ui_modal_close.mp3',
  ui_swipe_room:        '/sounds/ui/ui_swipe_room.mp3',
  ui_loading:           '/sounds/ui/ui_loading.mp3',
  ui_notification_ping: '/sounds/ui/ui_notification_ping.mp3',
} as const

export type SoundName = keyof typeof SOUNDS

const cache = new Map<SoundName, HTMLAudioElement>()
let globalVolume = 0.55
let muted = false

function getBase(name: SoundName): HTMLAudioElement {
  let base = cache.get(name)
  if (!base) {
    base = new Audio(SOUNDS[name])
    base.preload = 'auto'
    cache.set(name, base)
  }
  return base
}

export function playSound(name: SoundName, opts: { volume?: number } = {}) {
  if (muted) return
  if (typeof window === 'undefined') return
  try {
    const base = getBase(name)
    const a = base.cloneNode(true) as HTMLAudioElement
    a.volume = Math.max(0, Math.min(1, opts.volume ?? globalVolume))
    a.play().catch(() => { /* autoplay rejected — ignore */ })
  } catch {
    /* ignore */
  }
}

export function setVolume(v: number) {
  globalVolume = Math.max(0, Math.min(1, v))
}

export function setMuted(m: boolean) { muted = m }
export function isMuted() { return muted }

/** Preload every sound so the first play has zero latency. Call once on app boot. */
export function preloadSounds() {
  if (typeof window === 'undefined') return
  for (const name of Object.keys(SOUNDS) as SoundName[]) {
    getBase(name)
  }
}
