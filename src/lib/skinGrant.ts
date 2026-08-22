'use client'

// ═══════════════════════════════════════════════════════════════════════════
// SKIN GRANTS — earning a look outside the gacha.
//
// Pouring a SPECIAL EDITION can (Rainbow / Golden Eren, see `unlock` in
// lib/skins.ts) hands out a skin directly and needs two answers — did I just
// earn this, and can I wear it everywhere — so both live here. Eren Jelly is
// earned too, but its grant happens SERVER-side inside feed_super_jelly()
// because it has to be atomic with spending the fifth Super Jelly; it still
// uses wearSkinEverywhere below once the cinematic offers it.
//
// "First time" needs no new column. The inventory row IS the record: the insert
// is attempted blind, and the unique(user_id, item_id) constraint is what tells
// us this is the first one. That's the same insert-first shape the stardust
// purchase RPC uses, and it's race-safe by construction — two devices earning it
// at the same moment produce exactly one 'new', so the cinematic plays once.
//
// Ownership is per-user (each partner earns their own), while the room_skins
// assignment is per-household — so "wear it" below dresses the shared cat.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client'
import { skinItemId, SKINNABLE_ROOMS } from '@/lib/skins'

/** Postgres unique_violation — the row was already there, so this isn't a first. */
const UNIQUE_VIOLATION = '23505'

export type SkinGrant = 'new' | 'owned' | 'failed'

/**
 * Grant a skin to a user. Returns 'new' ONLY on the call that actually created
 * the row — callers gate a celebration on that, so a connection hiccup must read
 * as 'failed' (no celebration) rather than 'new'.
 */
export async function grantSkin(userId: string, skinId: string): Promise<SkinGrant> {
  const supabase = createClient()
  const { error } = await supabase
    .from('user_inventory')
    .insert({ user_id: userId, item_id: skinItemId(skinId), quantity: 1, equipped: false })

  if (!error) return 'new'
  return error.code === UNIQUE_VIOLATION ? 'owned' : 'failed'
}

/**
 * Put the freshly-unlocked look in every skinnable room — the "WEAR IT" button
 * on the cinematic. Deliberately a full reset of room_skins (the same contract
 * as the closet's wear-everywhere), so it's one write and the realtime echo
 * dresses the partner's session too.
 */
export async function wearSkinEverywhere(householdId: string, skinId: string): Promise<void> {
  const supabase = createClient()
  const next: Record<string, string> = {}
  for (const r of SKINNABLE_ROOMS) next[r.id] = skinId
  await supabase.from('eren_stats').update({ room_skins: next }).eq('household_id', householdId)
}
