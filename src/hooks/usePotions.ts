'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { useOptionalErenStats } from './useErenStats'
import { livePotion, POTION_MS, POTIONS, type ActivePotion, type PotionDef } from '@/lib/potions'

// ─── Potions: what's been found, and what he's on ────────────────────────────
// Both live on the household row (eren_stats.potions_found / .potion), so a
// potion either of you finds is in both books and the one she gives him is on
// your screen too. Until migration_potions.sql is pasted those columns aren't
// there, and the mixer still works: it keeps both on this phone instead (and a
// window event keeps every mounted reader on this phone in step).

const LOCAL_FOUND = 'eren_potions_found'
const LOCAL_ACTIVE = 'eren_potion_active'
const LOCAL_EVENT = 'eren:potions-local'

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch { return fallback }
}

function writeLocal(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* not kept this time */ }
  window.dispatchEvent(new Event(LOCAL_EVENT))
}

/** This phone's copy, read after mount and kept in step with other readers. */
function useLocalPotions() {
  const [found, setFound] = useState<string[]>([])
  const [active, setActive] = useState<ActivePotion | null>(null)
  useEffect(() => {
    const read = () => {
      const f = readLocal<unknown>(LOCAL_FOUND, [])
      setFound(Array.isArray(f) ? f.filter((x): x is string => typeof x === 'string') : [])
      setActive(readLocal<ActivePotion | null>(LOCAL_ACTIVE, null))
    }
    read()
    window.addEventListener(LOCAL_EVENT, read)
    window.addEventListener('storage', read)
    return () => { window.removeEventListener(LOCAL_EVENT, read); window.removeEventListener('storage', read) }
  }, [])
  return { found, active }
}

/**
 * The potion he's on right now, or null. Light enough for every room's Eren:
 * reads the household row (or this phone), and sets one timer for the moment
 * it lapses so the effect leaves on time on a quiet screen.
 */
export function useActivePotion() {
  const stats = useOptionalErenStats()?.stats ?? null
  const shared = Array.isArray(stats?.potions_found)
  const local = useLocalPotions()
  const raw = shared ? stats?.potion ?? null : local.active

  const [, bump] = useState(0)
  const until = raw?.until
  useEffect(() => {
    if (!until) return
    const left = new Date(until).getTime() - Date.now()
    if (!(left > 0)) return
    const t = setTimeout(() => bump(n => n + 1), left + 50)
    return () => clearTimeout(t)
  }, [until])

  return livePotion(raw)
}

/** The mixer's side: the book, and giving him a potion. */
export function usePotions() {
  const { user } = useAuth()
  const ctx = useOptionalErenStats()
  const stats = ctx?.stats ?? null
  const shared = Array.isArray(stats?.potions_found)
  const local = useLocalPotions()
  const foundList = shared ? stats!.potions_found! : local.found
  const found = useMemo(() => new Set(foundList), [foundList])
  const active = useActivePotion()

  /** Into the book. Says whether it was new, and whether the book is now full. */
  const discover = useCallback(async (id: string): Promise<{ isNew: boolean; complete: boolean }> => {
    if (found.has(id)) return { isNew: false, complete: false }
    const next = [...Array.from(found), id]
    if (shared) await ctx?.savePotionsFound(next)
    else writeLocal(LOCAL_FOUND, next)
    return { isNew: true, complete: POTIONS.every(p => next.includes(p.id)) }
  }, [found, shared, ctx])

  /** He drinks it: on him for an hour, in every room, on both phones. */
  const give = useCallback(async (def: PotionDef, color: string, sparkle: boolean) => {
    const next: ActivePotion = {
      id: def.id, color, sparkle, by: user?.id ?? '',
      until: new Date(Date.now() + POTION_MS).toISOString(),
    }
    if (shared) await ctx?.savePotion(next)
    else writeLocal(LOCAL_ACTIVE, next)
  }, [shared, ctx, user?.id])

  return { found, active, discover, give, shared }
}
