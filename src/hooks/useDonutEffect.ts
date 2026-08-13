'use client'

import { useEffect, useState } from 'react'
import { useErenStats } from './useErenStats'
import { effectRemaining, liveDonutEffect, type DonutEffectDef } from '@/lib/donutEffects'

/**
 * The donut effect running on Eren right now, or null.
 *
 * Reads the household row through the stats context (so both people see the
 * same cat) and sets one timer for the moment it lapses — without that the
 * aura would linger until something unrelated happened to re-render the room,
 * which on a quiet bedroom screen can be a very long time.
 */
export function useDonutEffect(): DonutEffectDef | null {
  const { stats } = useErenStats()
  const active = stats?.donut_effect ?? null
  const id = active?.id
  const until = active?.until

  const [, bump] = useState(0)
  useEffect(() => {
    const left = effectRemaining(id && until ? { id, until } : null)
    if (left <= 0) return
    const t = setTimeout(() => bump(n => n + 1), left + 50)
    return () => clearTimeout(t)
  }, [id, until])

  return liveDonutEffect(active)
}
