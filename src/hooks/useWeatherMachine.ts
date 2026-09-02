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
// 2. `loaded` IS NOT A DETAIL. The wallet starts empty and STAYS empty through
//    a Supabase 503 (useTrophies keeps its last good data and never flips
//    `loaded`), so drawing "not built" off an unanswered read would rip a
//    finished machine out of the room every time the project blips. And
//    `loaded` deliberately also waits for the couple to settle, because the
//    wallet's query is `.in('user_id', [me, partner?.id])` and a read taken
//    before the partner id lands is a me-only read that would make `ours()`
//    answer as `mine()` — see the note on TrophiesState.loaded, which is where
//    that invariant is enforced for every consumer, not just this one.
//
//    Consumers must treat `!loaded` as "don't know yet" and hold what they
//    have — and must never allow a WRITE on it.
// ═══════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react'
import { useTrophies } from './useTrophies'
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
  const { owned, ours, loaded } = trophies

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
