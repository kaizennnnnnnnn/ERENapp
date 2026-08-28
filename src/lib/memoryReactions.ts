// ═════════════════════════════════════════════════════════════════════════════
// MEMORY REACTIONS — Phase 3 PR 7
//
// Helper for tapping a heart on a memory frame. The reaction is stored in the
// memory_frames.reaction jsonb keyed by user_id, so each partner can react
// independently. Last-write-wins is fine here — reactions are rare and the
// realtime UPDATE settles the UI within the same RTT.
//
// Heart convention matches the rest of the app:
//   • brown_heart 🤎 — the partner who created the household
//   • pink_heart  🩷 — the partner who joined it
//   • sparkle     ✨ — neutral, used when both partners want to react identically
//
// The colour lives on profiles.heart and is stamped at onboarding. It used to
// be decided by comparing the user's address to a hardcoded personal email,
// which gave every household but the original one two pink partners.
// ═════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReactionEmoji } from '@/hooks/useMemoryFrames'

/** The viewer's own heart, from their profile. Falls back to pink so a
 *  not-yet-loaded profile still renders a valid reaction. */
export function heartOf(heart: string | null | undefined): ReactionEmoji {
  return heart === 'brown_heart' ? 'brown_heart' : heart === 'sparkle' ? 'sparkle' : 'pink_heart'
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
