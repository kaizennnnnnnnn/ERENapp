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

// Messages are written in the SENDER's voice — these are the words YOU are
// sending; Eren only delivers them. The popup + push attribute them to you.
export const NUDGE_DEFS: NudgeDef[] = [
  { id: 'loveyou', label: 'I Love You', state: 'love', message: 'I love you so much!' },
  { id: 'kiss',    label: 'Kiss',       state: 'kiss', message: 'Sending you a big kiss!' },
  { id: 'miss',    label: 'Miss You',   state: 'shy',  message: 'I miss you so much!' },
  { id: 'think',   label: 'Thinking',   state: 'wink', message: "I'm thinking about you right now!" },
]

// Nudges are intentionally spammable — the partner-side popup is the
// fun moment. No cooldown.
