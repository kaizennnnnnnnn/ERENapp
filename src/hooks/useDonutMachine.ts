'use client'

// ─── useDonutMachine ─────────────────────────────────────────────────────────
// Owns the one thing about the bakery machine that has to outlive the page: the
// free spin. Everything else (what it rolled, the reel) is throwaway UI state.
//
// The server read decides whether a free spin can be offered. Cached timestamps
// are optional hints only; a failed read must never become "never spun".

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { writeWithRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { msUntilFreeSpin } from '@/lib/donuts'

const lsKey = (userId: string) => `eren_donut_free_${userId}`

export function useDonutMachine(userId: string | null | undefined) {
  // createClient() returns the browser singleton, so this is stable across
  // renders and safe to leave out of the callback deps below.
  const supabase = createClient()
  // undefined = not read yet. Distinguishing that from "never spun" stops
  // the machine flashing a FREE badge it's about to take away.
  const [lastFree, setLastFree] = useState<string | null | undefined>(undefined)
  const [loaded, setLoaded] = useState(false)
  const [readError, setReadError] = useState(false)
  const version = useRef(0)
  const alive = useRef(true)
  const activeUser = useRef(userId)
  activeUser.current = userId

  function cache(stamp: string | null) {
    if (!userId) return
    try {
      if (stamp) localStorage.setItem(lsKey(userId), stamp)
      else localStorage.removeItem(lsKey(userId))
    } catch { /* Storage is optional; the server owns the cooldown. */ }
  }

  const read = useCallback(async () => {
    if (!userId) return
    const ticket = ++version.current
    setReadError(false)

    // This project 503s intermittently, and supabase-js reports that
    // as { data: null, error } rather than throwing — an unretried blip would
    // read as "never spun" and hand out a second free donut.
    const { data, error } = await writeWithRetry(signal => supabase
      .from('user_gacha_state')
      .select('last_free_donut')
      .eq('user_id', userId)
      .abortSignal(signal).maybeSingle())
    if (!alive.current || activeUser.current !== userId || ticket !== version.current) return
    // Keep the timestamp, but withhold the offer until a read confirms it.
    if (error) { setReadError(true); setLoaded(false); return }

    const stamp = (data?.last_free_donut as string | null | undefined) ?? null
    setLastFree(stamp)
    setLoaded(true)
    setReadError(false)
    cache(stamp)
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    alive.current = true
    setLoaded(false)
    setReadError(false)
    setLastFree(undefined)
    void read()
    return () => { alive.current = false; version.current++ }
  }, [read])
  // Coming back to the tab after the cooldown expired is the whole point.
  useEffect(() => onForeground(read), [read])

  /** Accept only the timestamp returned by the saved spin, never stamp a local guess. */
  const acceptSavedSpin = useCallback((stamp: string | null) => {
    if (!alive.current || activeUser.current !== userId) return
    version.current++
    setLastFree(stamp)
    setLoaded(true)
    setReadError(false)
    cache(stamp)
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    /** undefined while the first read is in flight. */
    lastFree,
    loaded,
    readError,
    msUntilFree: msUntilFreeSpin(lastFree ?? null),
    freeReady: loaded && msUntilFreeSpin(lastFree ?? null) === 0,
    acceptSavedSpin,
    refresh: read,
  }
}
