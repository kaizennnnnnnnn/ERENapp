'use client'

// ─── useDonutMachine ─────────────────────────────────────────────────────────
// Owns the one thing about the bakery machine that has to outlive the page: the
// free spin. Everything else (what it rolled, the reel) is throwaway UI state.
//
// Same two-tier read as the daily fortune (see useFortune): localStorage answers
// instantly and keeps sibling hook instances in this tab in sync, the DB is the
// truth that survives a reinstall and reaches the other phone. The DB read is
// authoritative when it disagrees, and an ERROR is never treated as "never spun"
// — a transient 503 must not hand out a second free donut.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { msUntilFreeSpin } from '@/lib/donuts'

const lsKey = (userId: string) => `eren_donut_free_${userId}`

export function useDonutMachine(userId: string | null | undefined) {
  // createClient() returns the browser singleton, so this is stable across
  // renders and safe to leave out of the callback deps below.
  const supabase = createClient()
  // null = not read yet. Distinguishing that from "never spun" is what stops
  // the machine flashing a FREE badge it's about to take away.
  const [lastFree, setLastFree] = useState<string | null | undefined>(undefined)

  const read = useCallback(async () => {
    if (!userId) return
    const cached = localStorage.getItem(lsKey(userId))
    if (cached) setLastFree(cached)

    // withRetry: this project 503s intermittently, and supabase-js reports that
    // as { data: null, error } rather than throwing — an unretried blip would
    // read as "never spun" and hand out a second free donut.
    const { data, error } = await withRetry(() => supabase
      .from('user_gacha_state')
      .select('last_free_donut')
      .eq('user_id', userId)
      .maybeSingle())
    // Keep whatever we had. The foreground listener is the natural retry, and
    // guessing "ready" here is the one wrong answer.
    if (error) { if (!cached) setLastFree(null); return }

    const stamp = (data?.last_free_donut as string | null | undefined) ?? null
    setLastFree(stamp)
    if (stamp) localStorage.setItem(lsKey(userId), stamp)
    else localStorage.removeItem(lsKey(userId))
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { read() }, [read])
  // Coming back to the tab after the cooldown expired is the whole point.
  useEffect(() => onForeground(read), [read])

  /** Stamp the free spin as used, locally first so the badge clears on tap. */
  const consumeFreeSpin = useCallback(async () => {
    if (!userId) return
    const nowIso = new Date().toISOString()
    setLastFree(nowIso)
    localStorage.setItem(lsKey(userId), nowIso)
    // upsert, not update: user_gacha_state is created lazily by the gacha, and
    // someone can reach the bakery having never opened a capsule machine.
    await supabase
      .from('user_gacha_state')
      .upsert({ user_id: userId, last_free_donut: nowIso }, { onConflict: 'user_id' })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    /** undefined while the first read is in flight. */
    lastFree,
    loaded: lastFree !== undefined,
    msUntilFree: msUntilFreeSpin(lastFree ?? null),
    freeReady: lastFree !== undefined && msUntilFreeSpin(lastFree ?? null) === 0,
    consumeFreeSpin,
    refresh: read,
  }
}
