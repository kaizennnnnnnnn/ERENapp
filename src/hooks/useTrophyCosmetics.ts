'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useTrophyCosmetics — equipping what the Trophy Shop sold.
//
// Split by WHO it belongs to, which is not the same question as who bought it:
//
//   weather    household  same reasoning, per room. eren_stats.room_weather
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
export interface TrophyCosmetics {
  /** room id → the WeatherId showing in that room's window. */
  weather: Record<string, string>
  /**
   * Write the WHOLE room→sky map in one go, and say whether it landed.
   *
   * Deliberately not a per-room setter. `room_weather` is a single jsonb
   * column, so every write is a write of the entire map, and a per-room
   * setter has to rebuild that map from the last value it saw. Two taps
   * inside one realtime round-trip both rebuild from the SAME stale copy and
   * the second silently erases the first -- which is exactly what "set this
   * sky in every window" did seven times over, leaving one room changed.
   */
  saveWeather(next: Record<string, string>): Promise<boolean>
  myTitle: string | null
  myFrame: string | null
  /** Equip (or clear, with null) the title slot. False means it did not land. */
  setTitle(itemId: string | null): Promise<boolean>
  /** Equip (or clear, with null) the frame slot. False means it did not land. */
  setFrame(itemId: string | null): Promise<boolean>
}

export function useTrophyCosmetics(): TrophyCosmetics {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const hh = profile?.household_id ?? null
  const { stats } = useErenStats(hh)

  // Optimistic overlays. The realtime echo is the source of truth but arrives
  // a round-trip later, and a cosmetic that lags a tap feels broken — same
  // `pending` pattern the closet uses for room skins.
  const [pendingWeather, setPendingWeather] = useState<Record<string, string> | null>(null)
  const [myTitle, setMyTitle] = useState<string | null>(null)
  const [myFrame, setMyFrame] = useState<string | null>(null)

  useEffect(() => {
    setMyTitle(profile?.equipped_title ?? null)
    setMyFrame(profile?.equipped_frame ?? null)
  }, [profile?.equipped_title, profile?.equipped_frame])

  const liveWeather = (stats?.room_weather ?? {}) as Record<string, string>

  // Drop the overlay once the realtime echo agrees with it.
  useEffect(() => {
    if (pendingWeather && sameMap(pendingWeather, liveWeather)) setPendingWeather(null)
  }, [liveWeather, pendingWeather])

  const weather = pendingWeather ?? liveWeather

  const saveWeather = useCallback(async (next: Record<string, string>) => {
    if (!hh) return false
    setPendingWeather(next)
    const { error } = await supabase
      .from('eren_stats').update({ room_weather: next }).eq('household_id', hh)
    if (error) {
      // Show the truth rather than a sky that is not really hanging anywhere.
      setPendingWeather(null)
      return false
    }
    return true
  }, [hh]) // eslint-disable-line react-hooks/exhaustive-deps

  // Both go through equip_prestige rather than updating the column.
  //
  // They used to write profiles.equipped_title / equipped_frame directly, with
  // no error check — and those two columns are the only ones on profiles that
  // were never granted to `authenticated` (migration_household_takeover_fix
  // revokes table-wide UPDATE and re-grants a fixed list; trophy_battle added
  // these two afterwards and nobody added them to it). So every equip was
  // refused by Postgres, the optimistic setState made it look equipped, and it
  // was gone on the next load — after 8 to 50 trophies, which are minted only
  // by winning the daily battle.
  //
  // The RPC checks ownership server-side, which a column grant could not.
  // Rolls the optimistic state back on failure, the same way saveWeather does.
  const setTitle = useCallback(async (itemId: string | null): Promise<boolean> => {
    if (!user?.id) return false
    const prev = myTitle
    setMyTitle(itemId)
    const { error } = await supabase.rpc('equip_prestige', { p_slot: 'title', p_item_id: itemId })
    if (error) { setMyTitle(prev); return false }
    return true
  }, [user?.id, myTitle]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFrame = useCallback(async (itemId: string | null): Promise<boolean> => {
    if (!user?.id) return false
    const prev = myFrame
    setMyFrame(itemId)
    const { error } = await supabase.rpc('equip_prestige', { p_slot: 'frame', p_item_id: itemId })
    if (error) { setMyFrame(prev); return false }
    return true
  }, [user?.id, myFrame]) // eslint-disable-line react-hooks/exhaustive-deps

  return { weather, saveWeather, myTitle, myFrame, setTitle, setFrame }
}

/** Shallow equality over a room→sky map. */
export function sameMap(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a), kb = Object.keys(b)
  return ka.length === kb.length && ka.every(k => a[k] === b[k])
}
