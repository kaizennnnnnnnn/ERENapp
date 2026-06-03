// ═════════════════════════════════════════════════════════════════════════════
// MEMORY REACTIONS — Phase 3 PR 7
//
// Helper for tapping a heart on a memory frame. The reaction is stored in the
// memory_frames.reaction jsonb keyed by user_id, so each partner can react
// independently. Last-write-wins is fine here — reactions are rare and the
// realtime UPDATE settles the UI within the same RTT.
//
// Heart convention matches the rest of the app (see [[project_heart_colors]]):
//   • brown_heart 🤎 — Jovan (jocaspinjo@gmail.com)
//   • pink_heart  🩷 — her
//   • sparkle     ✨ — neutral, used when both partners want to react identically
// ═════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReactionEmoji } from '@/hooks/useMemoryFrames'

export function heartForEmail(email: string | null | undefined): ReactionEmoji {
  return email === 'jocaspinjo@gmail.com' ? 'brown_heart' : 'pink_heart'
}

export const HEART_GLYPH: Record<ReactionEmoji, string> = {
  brown_heart: '🤎',
  pink_heart:  '🩷',
  sparkle:     '✨',
}

/** Toggle the calling user's reaction on a frame. Pass null to clear.
 *  Returns the merged reaction map after the write succeeds. */
export async function setMemoryReaction(
  supabase: SupabaseClient,
  args: {
    householdId: string
    frameId:     string
    userId:      string
    reaction:    ReactionEmoji | null
    /** Current reaction jsonb from the cached frame row — we merge against
     *  this so a partner reaction landed earlier in the same session isn't
     *  blown away. The realtime UPDATE will reconcile against the true row. */
    current:     Record<string, ReactionEmoji>
  },
): Promise<Record<string, ReactionEmoji> | null> {
  const next: Record<string, ReactionEmoji> = { ...args.current }
  if (args.reaction === null) {
    delete next[args.userId]
  } else {
    next[args.userId] = args.reaction
  }

  const { error } = await supabase
    .from('memory_frames')
    .update({ reaction: next })
    .eq('household_id', args.householdId)
    .eq('frame_id',     args.frameId)
  if (error) return null
  return next
}
