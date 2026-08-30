'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useTrophyCosmetics — equipping what the Trophy Shop sold.
//
// Split by WHO it belongs to, which is not the same question as who bought it:
//
//   accessory  household  there is one cat; if she puts the crown on him you
//                         should find it on him. eren_stats.equipped_accessory
//   decor      household  same reasoning, per room. eren_stats.room_decor
//   title      per user   it sits next to YOUR name. profiles.equipped_title
//   frame      per user   likewise. profiles.equipped_frame
//
// The household half writes eren_stats the way the closet writes room_skins —
// a bare column update with no decay bump — and rides the same realtime
// channel, so a change lands on the other phone without a reload.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { useErenStats } from './useErenStats'
import type { DecorRoom } from '@/lib/trophyShop'

export interface TrophyCosmetics {
  /** Accessory id Eren is wearing, or null. */
  accessory: string | null
  /** room id → decor item id. */
  decor: Record<string, string>
  myTitle: string | null
  myFrame: string | null
  wear(accessoryId: string | null): Promise<void>
  place(room: DecorRoom, itemId: string | null): Promise<void>
  setTitle(itemId: string | null): Promise<void>
  setFrame(itemId: string | null): Promise<void>
}

export function useTrophyCosmetics(): TrophyCosmetics {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const hh = profile?.household_id ?? null
  const { stats } = useErenStats(hh)

  // Optimistic overlays. The realtime echo is the source of truth but arrives
  // a round-trip later, and a cosmetic that lags a tap feels broken — same
  // `pending` pattern the closet uses for room skins.
  const [pendingAcc, setPendingAcc] = useState<string | null | undefined>(undefined)
  const [pendingDecor, setPendingDecor] = useState<Record<string, string | null>>({})
  const [myTitle, setMyTitle] = useState<string | null>(null)
  const [myFrame, setMyFrame] = useState<string | null>(null)

  useEffect(() => {
    setMyTitle(profile?.equipped_title ?? null)
    setMyFrame(profile?.equipped_frame ?? null)
  }, [profile?.equipped_title, profile?.equipped_frame])

  const liveAcc = stats?.equipped_accessory ?? null
  const liveDecor = (stats?.room_decor ?? {}) as Record<string, string>

  // Drop an overlay once the server agrees with it.
  useEffect(() => {
    if (pendingAcc !== undefined && pendingAcc === liveAcc) setPendingAcc(undefined)
  }, [liveAcc, pendingAcc])

  const accessory = pendingAcc !== undefined ? pendingAcc : liveAcc

  const decor: Record<string, string> = { ...liveDecor }
  for (const [room, id] of Object.entries(pendingDecor)) {
    if (id === null) delete decor[room]
    else decor[room] = id
  }

  const wear = useCallback(async (accessoryId: string | null) => {
    if (!hh) return
    setPendingAcc(accessoryId)
    await supabase.from('eren_stats').update({ equipped_accessory: accessoryId }).eq('household_id', hh)
  }, [hh]) // eslint-disable-line react-hooks/exhaustive-deps

  const place = useCallback(async (room: DecorRoom, itemId: string | null) => {
    if (!hh) return
    setPendingDecor(p => ({ ...p, [room]: itemId }))
    // Rebuilt from the live map rather than a jsonb merge: two partners
    // redecorating different rooms in the same second is not a scenario worth
    // a server function, and last-write-wins on a whole map is what room_skins
    // already does.
    const next = { ...liveDecor }
    if (itemId === null) delete next[room]
    else next[room] = itemId
    await supabase.from('eren_stats').update({ room_decor: next }).eq('household_id', hh)
  }, [hh, liveDecor]) // eslint-disable-line react-hooks/exhaustive-deps

  const setTitle = useCallback(async (itemId: string | null) => {
    if (!user?.id) return
    setMyTitle(itemId)
    await supabase.from('profiles').update({ equipped_title: itemId }).eq('id', user.id)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFrame = useCallback(async (itemId: string | null) => {
    if (!user?.id) return
    setMyFrame(itemId)
    await supabase.from('profiles').update({ equipped_frame: itemId }).eq('id', user.id)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return { accessory, decor, myTitle, myFrame, wear, place, setTitle, setFrame }
}
