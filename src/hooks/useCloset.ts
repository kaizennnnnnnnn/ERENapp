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
  // This phone's hearts until the realtime echo lands (null = nothing pending).
  const [pendingFavs, setPendingFavs] = useState<string[] | null>(null)
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

  // Hearted looks, household-wide. null until migration_closet.sql is pasted
  // (the column is missing from the row), so the closet can leave hearts out
  // instead of offering a button whose every write would fail.
  const liveFavs = stats?.closet_favorites
  const favorites = useMemo(
    () => Array.isArray(liveFavs) ? new Set(pendingFavs ?? liveFavs) : null,
    [liveFavs, pendingFavs],
  )
  useEffect(() => {
    if (pendingFavs && Array.isArray(liveFavs) && liveFavs.length === pendingFavs.length
      && liveFavs.every(k => pendingFavs.includes(k))) setPendingFavs(null)
  }, [liveFavs, pendingFavs])

  /** Heart or un-heart a look. Resolves false when the write didn't land. */
  const toggleFavorite = useCallback(async (key: string): Promise<boolean> => {
    if (!hh || !favorites) return false
    const next = favorites.has(key) ? Array.from(favorites).filter(k => k !== key) : [...Array.from(favorites), key]
    setPendingFavs(next)
    const { error } = await supabase.from('eren_stats').update({ closet_favorites: next }).eq('household_id', hh)
    if (error) { setPendingFavs(null); return false }
    return true
  }, [hh, favorites]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Dress several rooms in one write: each entry is a room and its new look
  // (null → back to the room's default). Built from the freshest live+pending
  // map, so rooms left out (a partner's already-synced choice included) are
  // kept. Writes only room_skins → no decay bump (see useErenStats merge).
  const dress = useCallback(async (changes: Record<string, string | null>) => {
    if (!hh) return
    setPending(p => ({ ...p, ...changes }))
    const next: Record<string, string> = { ...roomSkins }
    for (const [roomId, skinId] of Object.entries(changes)) {
      if (!skinId) delete next[roomId]; else next[roomId] = skinId
    }
    await supabase.from('eren_stats').update({ room_skins: next }).eq('household_id', hh)
    // supabase is a per-render createClient() call returning a stable singleton.
  }, [hh, roomSkins]) // eslint-disable-line react-hooks/exhaustive-deps

  // One room (skinId null → revert to the room's default look).
  const assign = useCallback((roomId: string, skinId: string | null) => dress({ [roomId]: skinId }), [dress])

  // Every skinnable room in one look — a deliberate household-wide reset, so
  // partner choices in other rooms are overwritten (the closet offers Undo).
  const assignAll = useCallback((skinId: string | null) =>
    dress(Object.fromEntries(SKINNABLE_ROOMS.map(r => [r.id, skinId]))), [dress])

  return { owned, roomSkins, dress, assign, assignAll, favorites, toggleFavorite, loading: ownedLoading || !stats, loaded: ownedLoaded, refetch: loadOwned }
}
