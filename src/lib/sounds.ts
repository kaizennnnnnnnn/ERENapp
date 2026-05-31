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
  // UI / navigation — each entry is a distinct semantic moment, so a
  // button tap doesn't have to share audio with opening a sheet.
  //
  //  - ui_tap        : single tiny chiptune blip for any small button
  //  - ui_back       : descending blip pair for back / dismiss
  //  - ui_toggle     : soft pixel "tick" for on/off switches
  //  - ui_select     : chunkier pickup-style blip for list selections
  //  - ui_modal_open : ascending blip pair for sheets / detail panels
  //  - ui_modal_close: descending blip pair for closing sheets
  //  - ui_swipe_room : page-transition whoosh (user keeps this one)
  ui_tap:               '/sounds/ui/ui_tap.mp3',
  ui_back:              '/sounds/ui/ui_back.mp3',
  ui_toggle:            '/sounds/ui/ui_toggle.mp3',
  ui_select:            '/sounds/ui/ui_select.mp3',
  ui_modal_open:        '/sounds/ui/ui_modal_open.mp3',
  ui_modal_close:       '/sounds/ui/ui_modal_close.mp3',
  ui_swipe_room:        '/sounds/ui/ui_swipe_room.mp3',
  ui_loading:           '/sounds/ui/ui_loading.mp3',
  ui_notification_ping: '/sounds/ui/ui_notification_ping.mp3',

  // Progression — fired by TaskContext / battle modules via window events.
  quest_complete:       '/sounds/progression/quest_complete.mp3',
  level_up:             '/sounds/progression/level_up.mp3',
  coin_pickup:          '/sounds/progression/coin_pickup.mp3',

  // Care actions — fired by individual care scenes when Eren acts.
  care_eat:             '/sounds/care/care_eat.mp3',

  // Gacha — rarity-tiered reveal stingers.
  gacha_reveal_common:    '/sounds/gacha/gacha_reveal_common.mp3',
  gacha_reveal_rare:      '/sounds/gacha/gacha_reveal_rare.mp3',
  gacha_reveal_epic:      '/sounds/gacha/gacha_reveal_epic.mp3',
  gacha_reveal_legendary: '/sounds/gacha/gacha_reveal_legendary.mp3',
} as const

export type SoundName = keyof typeof SOUNDS

// Per-sound volume scaler in [0, 1]. Quiets the high-frequency UI clicks
// so they don't clip over background music; leaves payoff sounds
// (level_up, gacha reveals) at full volume for impact.
const VOLUME_SCALE: Partial<Record<SoundName, number>> = {
  ui_tap:         0.45,
  ui_back:        0.45,
  ui_toggle:      0.45,
  ui_select:      0.5,
  ui_modal_open:  0.5,
  ui_modal_close: 0.5,
  coin_pickup:    0.7,
  quest_complete: 0.7,
  level_up:       0.8,
}

// Fallbacks let new sound names ship safely before the audio files land
// — if /sounds/.../foo.mp3 returns 404, fall back to a close-cousin file
// the user has already generated. Mapping is keyed by SoundName.
const FALLBACK: Partial<Record<SoundName, SoundName>> = {
  ui_tap:                 'ui_modal_open',
  ui_back:                'ui_modal_close',
  ui_toggle:              'ui_modal_open',
  ui_select:              'ui_modal_open',
  quest_complete:         'ui_notification_ping',
  level_up:               'ui_notification_ping',
  coin_pickup:            'ui_notification_ping',
  gacha_reveal_common:    'ui_modal_open',
  gacha_reveal_rare:      'ui_notification_ping',
  gacha_reveal_epic:      'ui_notification_ping',
  gacha_reveal_legendary: 'ui_notification_ping',
}

const cache = new Map<SoundName, HTMLAudioElement>()
// Tracks names whose file is known to 404 — once we see a fail, route to
// the fallback for the rest of the session so the network tab stops
// spamming retries.
const knownMissing = new Set<SoundName>()
let globalVolume = 0.55
let muted = false

function resolveName(name: SoundName): SoundName {
  if (!knownMissing.has(name)) return name
  const fb = FALLBACK[name]
  return fb && !knownMissing.has(fb) ? fb : name
}

function getBase(name: SoundName): HTMLAudioElement {
  let base = cache.get(name)
  if (!base) {
    base = new Audio(SOUNDS[name])
    base.preload = 'auto'
    // First load failure marks the name missing so future calls go
    // straight to the fallback. We re-create the cached element using
    // the fallback path so subsequent plays don't hit the same 404.
    base.addEventListener('error', () => {
      knownMissing.add(name)
      const fb = FALLBACK[name]
      if (fb) {
        const fbBase = new Audio(SOUNDS[fb])
        fbBase.preload = 'auto'
        cache.set(name, fbBase)
      }
    }, { once: true })
    cache.set(name, base)
  }
  return base
}

export function playSound(name: SoundName, opts: { volume?: number } = {}) {
  if (muted) return
  if (typeof window === 'undefined') return
  try {
    const effective = resolveName(name)
    const base = getBase(effective)
    const a = base.cloneNode(true) as HTMLAudioElement
    const scale = VOLUME_SCALE[name] ?? 1
    a.volume = Math.max(0, Math.min(1, (opts.volume ?? globalVolume) * scale))
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
