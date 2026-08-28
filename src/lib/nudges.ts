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
  { id: 'think',   label: 'Thinking',   state: 'wink', message: "Just I'm thinking about you" },
]

/**
 * The household's per-sender colour, derived from the VIEWER's own
 * profiles.heart so any surface can colour a message without reading the
 * sender's profile row (realtime inserts arrive without the joined profile).
 *
 * A household has exactly two partners and exactly two colours, so "not mine"
 * is always the other one. This used to compare against a hardcoded personal
 * email, which made the viewer's own colour depend on who the app was
 * originally written for.
 */
export function isBrownSender(
  senderIsMe: boolean,
  myHeart: string | null | undefined,
): boolean {
  return senderIsMe === (myHeart === 'brown_heart')
}

export function resolveNudgeMessage(
  nudge: NudgeDef,
  senderHeart: string | null | undefined,
): string {
  if (nudge.id !== 'think') return nudge.message
  const heart = senderHeart === 'brown_heart' ? '🤎' : senderHeart === 'sparkle' ? '✨' : '🩷'
  return `${nudge.message} ${heart}`
}

// Nudges are intentionally spammable — the partner-side popup is the
// fun moment. No cooldown.

/**
 * A nudge is a one-tap gesture with a canned line, identified by the
 * SketchEren pose it carries. The note board keeps things we actually wrote
 * or gave, so it filters these out — the same rule as the `eren_state IS NULL`
 * clause on the board's query in useCouple.
 */
export const isNudgeRow = (m: { eren_state?: string | null }): boolean => !!m.eren_state
