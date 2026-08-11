'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DRINK UNLOCKS — the two looks you can't pull for.
//
// Rainbow Eren and Golden Eren are out of every banner and out of the stardust
// shop (see `unlock` in lib/skins.ts). The ONLY way to wear them is to hand Eren
// the matching SPECIAL EDITION can and watch him finish it. This module is the
// grant half of that: FeedScene calls `grantDrinkSkin` once the can is down, and
// the answer decides whether the unlock cinematic plays.
//
// "First time" needs no new column. The inventory row IS the record: the insert
// is attempted blind, and the unique(user_id, item_id) constraint is what tells
// us this is the first pour. That's the same insert-first shape the stardust
// purchase RPC uses, and it's race-safe by construction — two devices pouring at
// once produce exactly one 'new'.
//
// Ownership is per-user (each partner earns their own), while the room_skins
// assignment is per-household — so "wear it" below dresses the shared cat.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/client'
import { skinItemId, SKINNABLE_ROOMS } from '@/lib/skins'

/** Postgres unique_violation — the row was already there, so this isn't a first. */
const UNIQUE_VIOLATION = '23505'

export type DrinkGrant = 'new' | 'owned' | 'failed'

/**
 * Grant a drink-unlock skin to a user. Returns 'new' ONLY on the pour that
 * actually created the row — the caller uses that to gate the cinematic, so a
 * connection hiccup must read as 'failed' (no celebration) rather than 'new'.
 */
export async function grantDrinkSkin(userId: string, skinId: string): Promise<DrinkGrant> {
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
