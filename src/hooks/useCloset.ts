'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from './useAuth'
import { useErenStats } from './useErenStats'
import { itemIdToSkinId, SKINNABLE_ROOMS } from '@/lib/skins'

// Closet data: which skins the HOUSEHOLD owns (union of both partners' gacha
// inventories) + the shared room → skin assignment on eren_stats. Ownership is
// per-user; the assignment is per-household (the cat is shared), so either
// partner may dress any skin either of them owns.
//
// The room_skins map is read from the single realtime-synced source of truth
// (useErenStats' provider stats) — NOT a private fetched copy — so a partner's
// concurrent re-dress is visible immediately and never clobbered. A local
// `pending` overlay gives instant feedback on tap and is cleared per-room once
// the realtime echo confirms it, so later partner edits to the same room still
// show through.
export function useCloset() {
  const supabase = createClient()
  const { profile } = useAuth()
  const hh = profile?.household_id ?? null
  const { stats } = useErenStats()

  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [ownedLoading, setOwnedLoading] = useState(true)
  // Flips true after the FIRST successful owned fetch (stays true thereafter).
  // Distinguishes "loaded, owns nothing" from "fetch 503'd, empty by default" —
  // the new-skin badge marks seen only once this is true so an outage can't blank
  // the seen-set.
  const [ownedLoaded, setOwnedLoaded] = useState(false)
  const [pending, setPending] = useState<Record<string, string | null>>({})
  const failedRef = useRef(false)

  const liveMap = (stats?.room_skins ?? {}) as Record<string, string>

  // Effective assignment = live map with this session's un-echoed edits applied.
  const roomSkins = useMemo(() => {
    const m: Record<string, string> = { ...liveMap }
    for (const [k, v] of Object.entries(pending)) { if (v == null) delete m[k]; else m[k] = v }
    return m
  }, [liveMap, pending])

  // Drop pending entries once the live map reflects them (realtime echo landed),
  // so a partner's later change to the same room is no longer masked.
  useEffect(() => {
    setPending(prev => {
      const next = { ...prev }
      let changed = false
      for (const [k, v] of Object.entries(prev)) {
        if ((v == null && liveMap[k] === undefined) || liveMap[k] === v) { delete next[k]; changed = true }
      }
      return changed ? next : prev
    })
  }, [liveMap])

  // Owned skins — union of both household members' gacha inventories.
  const loadOwned = useCallback(async () => {
    if (!hh) return
    const { data: members, error: mErr } = await withRetry(() =>
      supabase.from('profiles').select('id').eq('household_id', hh))
    if (mErr) { failedRef.current = true; setOwnedLoading(false); return }
    const ids = (members ?? []).map(m => m.id)
    const set = new Set<string>()
    if (ids.length) {
      const { data: inv, error: iErr } = await withRetry(() =>
        supabase.from('user_inventory').select('item_id').in('user_id', ids))
      if (iErr) { failedRef.current = true; setOwnedLoading(false); return }
      for (const r of inv ?? []) { const sid = itemIdToSkinId(r.item_id); if (sid) set.add(sid) }
    }
    failedRef.current = false
    setOwned(set)
    setOwnedLoaded(true)
    setOwnedLoading(false)
  }, [hh]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadOwned() }, [loadOwned])
  useEffect(() => onForeground(() => { if (failedRef.current) loadOwned() }), [loadOwned])

  // Assign a skin to a room (skinId null → revert to the room's default look).
  // The write is built from the freshest live+pending map, so a partner's
  // already-synced assignment to another room is preserved (no whole-column
  // clobber). Writes only room_skins → no decay bump (see useErenStats merge).
  const assign = useCallback(async (roomId: string, skinId: string | null) => {
    if (!hh) return
    setPending(p => ({ ...p, [roomId]: skinId }))
    const next: Record<string, string> = { ...roomSkins }
    if (!skinId) delete next[roomId]; else next[roomId] = skinId
    await supabase.from('eren_stats').update({ room_skins: next }).eq('household_id', hh)
  }, [hh, roomSkins]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dress EVERY skinnable room in one look (skinId null → revert them all to
  // default). One write builds the whole map from scratch, so partner edits to
  // individual rooms are intentionally overwritten — "wear everywhere" is a
  // deliberate household-wide reset. Pending overlay covers all rooms for instant
  // feedback until the realtime echo lands.
  const assignAll = useCallback(async (skinId: string | null) => {
    if (!hh) return
    const roomIds = SKINNABLE_ROOMS.map(r => r.id)
    setPending(p => {
      const n = { ...p }
      for (const r of roomIds) n[r] = skinId
      return n
    })
    const next: Record<string, string> = {}
    if (skinId) for (const r of roomIds) next[r] = skinId
    await supabase.from('eren_stats').update({ room_skins: next }).eq('household_id', hh)
    // supabase is a per-render createClient() call returning a stable singleton —
    // intentionally excluded; roomSkins is intentionally NOT a dep (full reset).
  }, [hh]) // eslint-disable-line react-hooks/exhaustive-deps

  return { owned, roomSkins, assign, assignAll, loading: ownedLoading || !stats, loaded: ownedLoaded, refetch: loadOwned }
}
