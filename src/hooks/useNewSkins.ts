'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { itemIdToSkinId } from '@/lib/skins'
import type { UserInventoryItem } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// NEW-SKIN BADGE — the red count on the home Closet button. Surfaces "you won a
// skin you haven't looked at yet" and clears the moment you open the Closet.
//
// Source of truth for the COUNT: the user's own gacha inventory (the skins THEY
// pulled). We remember which skin ids the user has already "seen" in a per-user
// localStorage key; the badge count is owned-skins minus seen.
//
// Clearing is done by `markSkinsSeen` (called from the Closet page), which writes
// the set the Closet actually displayed — the HOUSEHOLD-union owned set from
// useCloset. That's a superset of the user's own skins, so it always drives the
// home count to 0, and it's gated on a SUCCESSFUL useCloset load so a transient
// 503 (empty owned) can't blank the seen-set and make the whole collection look
// new again. Marking is keyed by skin id, so over-marking only defers a future
// skin's badge — it can never falsely clear a genuinely-new one.
//
// Seeding: on the first run for a user with no seen-key yet, we seed only skins
// obtained BEFORE a 24h grace window as already-seen — so a player's EXISTING
// collection never flashes as brand-new, but a skin pulled just before the badge
// first loaded still counts (see FIRST_RUN_GRACE_MS). The `loaded` gate (a
// successful fetch, not just "not loading") keeps a 503 from seeding an empty
// baseline that would make the whole collection look new.
//
// useNewSkins takes the inventory as an argument rather than calling useInventory
// itself, so the home page (which already mounts useInventory) doesn't pay for a
// second identical fetch. Pass `loaded` from useInventory.
// ─────────────────────────────────────────────────────────────────────────────

const SEEN_EVENT = 'eren:closet-seen'
// v2: the first seed wrote the whole current collection as seen (it absorbed
// just-pulled skins). The grace-aware seed below supersedes it; bumping the key
// retires any stale v1 baseline so the corrected logic runs fresh.
const seenKey = (uid: string) => `eren_closet_seen_v2_${uid}`

// On the FIRST-EVER run for a user we seed their existing collection as "seen" so
// it doesn't all badge at once — but skins won within this window of that first
// run are kept UNSEEN, so a pull made right before the feature first loaded still
// shows up. Without it, anything you owned the instant the badge first mounted
// (including a skin you just pulled) would be silently absorbed into the baseline.
const FIRST_RUN_GRACE_MS = 24 * 60 * 60 * 1000

/** Raw read — returns the stored id list, or null when the key was never written. */
function readSeen(uid: string): string[] | null {
  try {
    const raw = localStorage.getItem(seenKey(uid))
    if (raw == null) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function writeSeen(uid: string, ids: string[]): void {
  try {
    localStorage.setItem(seenKey(uid), JSON.stringify(ids))
  } catch {
    /* private mode / quota — badge just won't persist, no crash */
  }
}

/**
 * Read the raw seen-skin id list for a user. Returns null on first run (the
 * localStorage key hasn't been written yet). Callers can use null to skip
 * per-card "NEW" badges rather than flagging every skin on first open.
 */
export function readSeenSkins(uid: string): string[] | null {
  return readSeen(uid)
}

/**
 * Mark a set of skin ids as seen for this user and notify any live useNewSkins
 * instances (same tab via the SEEN_EVENT; other tabs via the storage event).
 * Call this from the Closet page with the displayed owned set once it has
 * SUCCESSFULLY loaded — never with a fetch-failed empty set.
 */
export function markSkinsSeen(uid: string, ownedSkinIds: string[]): void {
  writeSeen(uid, ownedSkinIds)
  try { window.dispatchEvent(new Event(SEEN_EVENT)) } catch { /* SSR/no-window */ }
}

/** Count of owned skins the user hasn't seen in the Closet yet. */
export function useNewSkins(inventory: UserInventoryItem[], loaded: boolean): number {
  const { user } = useAuth()
  const uid = user?.id ?? null

  // Skin ids the user owns, derived from their inventory (non-skin items drop out).
  const ownedSkins = useMemo(
    () => inventory
      .map(i => itemIdToSkinId(i.item_id))
      .filter((id): id is string => id != null),
    [inventory],
  )

  // null until we've established a baseline (seeded or read from storage).
  const [seenSet, setSeenSet] = useState<Set<string> | null>(null)

  // Establish the baseline once we have a user and a successful load. On first
  // run, seed only skins obtained BEFORE the grace cutoff as already-seen — so a
  // pre-existing collection doesn't badge, but a skin pulled in the last 24h still
  // counts as new. Re-runs only on uid/loaded changes — NOT on every inventory
  // change — so it never re-seeds away a freshly-won skin. Reads `inventory` at
  // the moment `loaded` flips; useInventory sets inventory + loaded together, so
  // the snapshot is current.
  useEffect(() => {
    if (!uid || !loaded) return
    const stored = readSeen(uid)
    if (stored == null) {
      const cutoff = Date.now() - FIRST_RUN_GRACE_MS
      const seed = inventory
        .filter(i => itemIdToSkinId(i.item_id) != null && new Date(i.obtained_at).getTime() <= cutoff)
        .map(i => itemIdToSkinId(i.item_id)!)
      writeSeen(uid, seed)
      setSeenSet(new Set(seed))
    } else {
      setSeenSet(new Set(stored))
    }
  }, [uid, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resync when the Closet marks skins seen, or when another tab writes the key.
  // Keeps the home badge honest without waiting for a remount.
  useEffect(() => {
    if (!uid) return
    const sync = () => setSeenSet(new Set(readSeen(uid) ?? []))
    const onStorage = (e: StorageEvent) => { if (e.key === seenKey(uid)) sync() }
    window.addEventListener(SEEN_EVENT, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(SEEN_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [uid])

  return useMemo(() => {
    if (!seenSet) return 0
    return ownedSkins.reduce((n, id) => (seenSet.has(id) ? n : n + 1), 0)
  }, [seenSet, ownedSkins])
}
