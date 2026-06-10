'use client'

// ═════════════════════════════════════════════════════════════════════════════
// useMemoryFrames — Phase 3 PR 7
//
// Loads + realtime-subscribes the household's unlocked memory_frames rows.
// Returns the list keyed for the Memory Wall grid plus a small helper to
// optimistically replace a single frame's reaction jsonb so the detail modal
// flips instantly without waiting for the realtime UPDATE.
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'

let _memoryChannelCounter = 0

export type ReactionEmoji = 'brown_heart' | 'pink_heart' | 'sparkle'

export interface MemoryFrameRow {
  household_id: string
  frame_id:     string
  kind:         string
  rarity:       'common' | 'rare' | 'epic'
  unlocked_at:  string
  unlocked_by:  string | null
  payload:      Record<string, unknown>
  reaction:     Record<string, ReactionEmoji>
}

export function useMemoryFrames(householdId: string | null): {
  frames: MemoryFrameRow[]
  loading: boolean
  /** Locally replace a frame's reaction map. The realtime UPDATE will overwrite
   *  shortly; we set first so the modal's UI never lags. */
  applyReaction: (frameId: string, reaction: Record<string, ReactionEmoji>) => void
  refresh: () => Promise<void>
} {
  const supabase = createClient()
  const channelSuffix = useRef(`${++_memoryChannelCounter}_${Math.random().toString(36).slice(2, 8)}`)

  const [frames, setFrames] = useState<MemoryFrameRow[]>([])
  const [loading, setLoading] = useState(true)
  // True when the last fetchAll hit a Supabase outage that outlasted
  // withRetry's backoff — the foreground listener uses it to refetch.
  const loadFailedRef = useRef(false)

  const fetchAll = useCallback(async () => {
    if (!householdId) { setFrames([]); setLoading(false); return }
    setLoading(true)
    // Error-checked: a transient 503 resolves as { data: null, error } and
    // must not read as "no frames" — that would wipe the wall to its empty
    // state. Keep the prior list and let the foreground listener refetch.
    const { data, error } = await withRetry(() => supabase
      .from('memory_frames')
      .select('household_id, frame_id, kind, rarity, unlocked_at, unlocked_by, payload, reaction')
      .eq('household_id', householdId)
      .order('unlocked_at', { ascending: false }))
    if (error) {
      loadFailedRef.current = true
      setLoading(false)
      return
    }
    loadFailedRef.current = false
    setFrames((data ?? []) as MemoryFrameRow[])
    setLoading(false)
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchAll() }, [fetchAll])

  // Self-heal: the mount-time load only runs once and realtime has no
  // backfill, so a failed fetch would persist until a full reload. Retry on
  // return to foreground (focus alone misses iOS standalone, which only
  // fires visibilitychange).
  useEffect(() => onForeground(() => { if (loadFailedRef.current) void fetchAll() }), [fetchAll])

  useEffect(() => {
    if (!householdId) return
    const ch = supabase
      .channel(`memory_frames:${householdId}:${channelSuffix.current}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'memory_frames',
        filter: `household_id=eq.${householdId}`,
      }, payload => {
        const next = (payload.new ?? null) as MemoryFrameRow | null
        const old  = (payload.old ?? null) as { frame_id?: string } | null
        if (payload.eventType === 'INSERT' && next) {
          setFrames(prev => prev.some(f => f.frame_id === next.frame_id) ? prev : [next, ...prev])
        } else if (payload.eventType === 'UPDATE' && next) {
          setFrames(prev => prev.map(f => f.frame_id === next.frame_id ? next : f))
        } else if (payload.eventType === 'DELETE' && old?.frame_id) {
          setFrames(prev => prev.filter(f => f.frame_id !== old.frame_id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [householdId]) // eslint-disable-line react-hooks/exhaustive-deps

  const applyReaction = useCallback((frameId: string, reaction: Record<string, ReactionEmoji>) => {
    setFrames(prev => prev.map(f => f.frame_id === frameId ? { ...f, reaction } : f))
  }, [])

  return { frames, loading, applyReaction, refresh: fetchAll }
}
