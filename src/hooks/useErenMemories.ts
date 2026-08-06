'use client'

// ═════════════════════════════════════════════════════════════════════════════
// useErenMemories — read/delete what Eren has quietly filed away about you.
//
// He writes these himself through the `remember` tool and is instructed never
// to mention that he did, which is lovely right up until he keeps something
// wrong. This hook is the correction path: without it a bad fact rides in
// every prompt forever and there's no way to reach it from inside the app.
//
// Deletes go straight through RLS — the policy scopes both tables to
// auth.uid(), so there is no owner check to write here and no way to reach
// someone else's row.
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import type { ErenChatMemory } from '@/types'

export function useErenMemories(enabled: boolean) {
  const supabase = createClient()
  const [memories, setMemories] = useState<ErenChatMemory[]>([])
  const [loading, setLoading]   = useState(false)
  // Distinguishes "fetched, he knows nothing yet" from "never fetched" — an
  // empty list on a failed read must not render as a confident "no memories".
  const [loaded, setLoaded]     = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await withRetry(() => supabase
        .from('eren_chat_memories')
        .select('*')
        .order('created_at', { ascending: false }))
      if (error) return
      setMemories((data ?? []) as ErenChatMemory[])
      setLoaded(true)
    } catch {
      // Leave `loaded` false so the sheet shows a retry, not "nothing here".
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (enabled) void refresh() }, [enabled, refresh])

  const forget = useCallback(async (id: string) => {
    const prev = memories
    setMemories((m) => m.filter((x) => x.id !== id))   // optimistic
    const { error } = await supabase.from('eren_chat_memories').delete().eq('id', id)
    if (error) setMemories(prev)                        // put it back
  }, [memories]) // eslint-disable-line react-hooks/exhaustive-deps

  return { memories, loading, loaded, refresh, forget }
}
