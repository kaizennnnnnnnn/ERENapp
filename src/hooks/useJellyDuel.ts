'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { JELLY_ROUND_SAVED_EVENT } from '@/lib/jellyRoundSaves'
import type { JellyGame } from '@/lib/jellies'
import { useAuth } from './useAuth'

export type { JellyGame } from '@/lib/jellies'
export interface DuelState { best: number; mineToday: number; theirsToday: number; theirName: string | null; loaded: boolean }
const EMPTY: DuelState = { best: 0, mineToday: 0, theirsToday: 0, theirName: null, loaded: false }

// Read-only. The round RPC owns the score and once-a-day bonus decision.
export function useJellyDuel(game: JellyGame) {
  const { user, profile } = useAuth(), actor = user?.id, home = profile?.household_id
  const [stored, setStored] = useState<{ actor: string; home: string; game: JellyGame; data: DuelState } | null>(null)
  const scope = useRef({ actor, home, game }); scope.current = { actor, home, game }
  const version = useRef(0), mounted = useRef(true)
  const load = useCallback(async () => {
    if (!actor || !home) return
    const read = ++version.current, db = createClient(), day = new Date().toISOString().slice(0, 10)
    const [mine, todays] = await Promise.all([
      withRetry(() => db.from('jelly_scores').select('score').eq('household_id', home).eq('user_id', actor).eq('game', game).order('score', { ascending: false }).limit(1)),
      withRetry(() => db.from('jelly_scores').select('user_id, score, profiles:user_id(name)').eq('household_id', home).eq('game', game).eq('day', day).order('score', { ascending: false })),
    ])
    if (!mounted.current || read !== version.current || scope.current.actor !== actor || scope.current.home !== home || scope.current.game !== game || mine.error || todays.error) return
    const rows = (todays.data ?? []) as { user_id: string; score: number; profiles: { name: string } | null }[]
    const mineRows = rows.filter(r => r.user_id === actor), theirs = rows.filter(r => r.user_id !== actor)
    setStored({ actor, home, game, data: { best: mine.data?.[0]?.score ?? 0, mineToday: mineRows.length ? Math.max(...mineRows.map(r => r.score)) : 0,
      theirsToday: theirs.length ? Math.max(...theirs.map(r => r.score)) : 0, theirName: theirs[0]?.profiles?.name ?? null, loaded: true } })
  }, [actor, home, game])
  useEffect(() => {
    mounted.current = true; void load()
    const off = onForeground(() => { void load() })
    const changed = (event: Event) => { const d = (event as CustomEvent).detail; if (d?.user_id === actor && d?.household_id === home && d?.game === game) void load() }
    window.addEventListener(JELLY_ROUND_SAVED_EVENT, changed)
    return () => { mounted.current = false; version.current++; off(); window.removeEventListener(JELLY_ROUND_SAVED_EVENT, changed) }
  }, [actor, home, game, load])
  return { ...(stored?.actor === actor && stored?.home === home && stored?.game === game ? stored.data : EMPTY), reload: load }
}
