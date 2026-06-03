// ═════════════════════════════════════════════════════════════════════════════
// MEMORY UNLOCKS — tryUnlock CAS helper (Phase 3 PR 6)
//
// Single entry point for inserting into memory_frames. The PK
// (household_id, frame_id) means a duplicate INSERT raises a Postgres 23505
// unique-violation; we treat that as "already unlocked" and return false so
// callers can fan-out idempotent checks without coordinating.
//
// memory_unlocks (the push-batching queue) is filled automatically by the
// `queue_memory_unlock` trigger added in migration_phase3_memory_trigger.sql,
// so this helper never touches that table directly.
//
// Works against any Supabase client — the browser client for in-app unlocks,
// the admin client for sweep unlocks fired from /api/decay.
// ═════════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FrameKind, Rarity } from './memoryCatalogue'

export interface TryUnlockArgs {
  householdId: string
  frameId:     string
  kind:        FrameKind
  rarity:      Rarity
  /** The partner who tripped the unlock. Null when the sweep cron unlocks a
   *  date-based frame (no single user "earned" it). */
  unlockedBy:  string | null
  payload?:    Record<string, unknown>
  /** Override unlocked_at — used by the backdated catchup sweep in PR 8 to
   *  stamp historical frames at their original time. Defaults to NOW(). */
  unlockedAt?: string
}

/** Postgres unique_violation. Surfaced through Supabase as `error.code`. */
const PG_UNIQUE_VIOLATION = '23505'

/** Insert a memory_frames row. Returns true when this call won the race
 *  (newly unlocked), false when the frame was already unlocked.
 *
 *  Any non-conflict error is swallowed and logged — Memory Wall is best-effort,
 *  a missed unlock here shouldn't break the action that triggered it. */
export async function tryUnlock(
  supabase: SupabaseClient,
  args: TryUnlockArgs,
): Promise<boolean> {
  const row: Record<string, unknown> = {
    household_id: args.householdId,
    frame_id:     args.frameId,
    kind:         args.kind,
    rarity:       args.rarity,
    unlocked_by:  args.unlockedBy,
    payload:      args.payload ?? {},
  }
  if (args.unlockedAt) row.unlocked_at = args.unlockedAt

  const { data, error } = await supabase
    .from('memory_frames')
    .insert(row)
    .select('frame_id')
    .maybeSingle()

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) return false
    // Real failure (RLS denial, network, schema mismatch) — log & swallow.
    if (typeof console !== 'undefined') {
      console.warn('[memoryUnlocks] tryUnlock failed', args.frameId, error.message)
    }
    return false
  }

  if (!data) return false

  // Newly unlocked — let the in-app UI animate immediately. The push-batching
  // queue is filled by the DB trigger, so we don't dispatch the wall refresh
  // on the server side (no window there).
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('eren:memory-unlocked', {
        detail: { frameId: args.frameId, rarity: args.rarity, unlockedBy: args.unlockedBy },
      }))
    } catch { /* ignore */ }
  }

  return true
}
