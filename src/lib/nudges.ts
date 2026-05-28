import type { SketchErenState } from '@/components/SketchEren'

// A "Send Eren" nudge — a one-tap affectionate gesture delivered to the
// partner. Each picks a romantic SketchEren pose + a plain-text line (no
// emojis; the push title supplies the sender's name).
export interface NudgeDef {
  id: string
  label: string
  state: SketchErenState
  message: string
}

export const NUDGE_DEFS: NudgeDef[] = [
  { id: 'loveyou', label: 'I Love You', state: 'love', message: 'Eren came over to say I love you!' },
  { id: 'kiss',    label: 'Kiss',       state: 'kiss', message: 'Eren delivered a sweet little kiss!' },
  { id: 'miss',    label: 'Miss You',   state: 'shy',  message: 'Someone misses you a whole lot!' },
  { id: 'think',   label: 'Thinking',   state: 'wink', message: "You're on someone's mind right now!" },
]

// Light anti-spam: minimum gap between nudges, per user.
export const NUDGE_COOLDOWN_MS = 20_000
