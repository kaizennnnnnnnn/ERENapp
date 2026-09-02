'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useWeatherMachine — how much of the machine in the Lab is actually there.
//
// One reader for five surfaces (the shop's shelf counter, the shelf strip, the
// prop standing in the Lab, the panel's gate, and the buy sheet's refusal), so
// none of them can arrive at its own idea of "built".
//
// TWO THINGS IT IS CAREFUL ABOUT:
//
// 1. IT ASKS THE HOUSEHOLD, NOT ME. Parts are per-user rows because that is
//    what the shop writes, but the machine is one object in a room two people
//    share. `ours` is deliberately un-filtered by user id — she buys the dish,
//    he walks into a lab with a dish in it.
//
// 2. `loaded` IS NOT A DETAIL, AND THE WALLET'S OWN FLAG IS NOT ENOUGH. The
//    wallet starts empty and STAYS empty through a Supabase 503 (useTrophies
//    keeps its last good data and never flips `loaded`), so drawing "not built"
//    off an unanswered read would rip a finished machine out of the room every
//    time the project blips.
//
//    Worse, and subtler: useTrophies fetches `.in('user_id', [me, partner?.id])`
//    and the partner id arrives from useCouple a beat LATER. The first read is
//    therefore me-only, and it sets `loaded` — so for that beat `ours()` is
//    really `mine()`, and a machine SHE built reads as a husk with four live BUY
//    buttons on parts the household has already paid for. So this hook waits
//    for the couple to settle too. Consumers must treat `!loaded` as "don't know
//    yet" and hold what they have — and must never allow a WRITE on it.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react'
import { useTrophies } from './useTrophies'
import { useCouple } from './useCouple'
import {
  MACHINE_PARTS, machineBuilt, machineRemaining, partsInstalled, partFitted,
  type MachinePartId,
} from '@/lib/weatherMachine'

export interface WeatherMachineState {
  /** False until the wallet has answered once. Never draw a verdict on it. */
  loaded: boolean
  /** Parts the household has, 0–4. */
  installed: number
  total: number
  built: boolean
  has(part: MachinePartId): boolean
  /** Who paid for it, so the rack can say she fitted this one. */
  fitterOf(part: MachinePartId): string | null
  /** Trophies still owed on the parts nobody has bought. */
  remaining: number
}

export function useWeatherMachine(): WeatherMachineState {
  const trophies = useTrophies()
  const { loading: coupleLoading } = useCouple()
  const { owned, ours, loaded: walletLoaded } = trophies
  const loaded = walletLoaded && !coupleLoading

  return useMemo(() => {
    const byPart = new Map(MACHINE_PARTS.map(p => [p.id, p.itemId]))
    const has = (part: MachinePartId) => {
      const itemId = byPart.get(part)
      return itemId ? partFitted(ours, itemId) : false
    }
    return {
      loaded,
      installed: partsInstalled(ours),
      total: MACHINE_PARTS.length,
      built: machineBuilt(ours),
      has,
      fitterOf: (part: MachinePartId) => {
        const itemId = byPart.get(part)
        if (!itemId) return null
        return owned.find(o => o.itemId === itemId && o.quantity > 0)?.userId ?? null
      },
      remaining: machineRemaining(ours),
    }
  }, [owned, ours, loaded])
}
