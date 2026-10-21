'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useBucketList — the household's plans, live on both phones.
//
// One read of bucket_list, refetched when a row changes (your partner adding a
// plan shows up while you look at the list). Writes are plain table writes
// under household RLS; the table's trigger stamps who ticked a plan and hangs
// it in the Hallway. After a write that the partner should hear about, the
// route /api/notify-bucket sends the push from the stored row.
//
// `missing` is true until supabase/migration_bucket_list.sql has been run: the
// home button and the page then say so instead of looking empty.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { cleanPlan, type PlanInput, type PlanRow } from '@/lib/bucketList'

let _bucketChannelCounter = 0

export type PlanResult = { ok: true; id?: string } | { ok: false; reason: string }

export interface BucketListState {
  loading: boolean
  /** The table isn't there yet (migration not run). */
  missing: boolean
  /** The last read failed; `plans` holds whatever was read before. */
  failed: boolean
  /** Newest first. */
  plans: PlanRow[]
  add: (input: PlanInput) => Promise<PlanResult>
  edit: (id: string, input: PlanInput) => Promise<PlanResult>
  setDone: (id: string, done: boolean) => Promise<PlanResult>
  remove: (id: string) => Promise<PlanResult>
}

/** PostgREST's "no such table" (schema cache) and Postgres's own. */
function isMissingTable(code: string | undefined): boolean {
  return code === 'PGRST205' || code === '42P01'
}

function notify(itemId: string, event: 'added' | 'done') {
  fetch('/api/notify-bucket', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ item_id: itemId, event }),
  }).catch(() => { /* best-effort */ })
}

export function useBucketList(householdId: string | null, userId: string | null): BucketListState {
  const supabase = useMemo(() => createClient(), [])
  const channelSuffix = useRef(`${++_bucketChannelCounter}_${Math.random().toString(36).slice(2, 8)}`)

  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [failed, setFailed] = useState(false)
  const failedRef = useRef(false)

  const fetchAll = useCallback(async () => {
    if (!householdId) { setPlans([]); setLoading(false); return }
    const { data, error } = await withRetry(() => supabase
      .from('bucket_list')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(500))
    const gone = isMissingTable(error?.code)
    failedRef.current = !!error && !gone
    setMissing(gone)
    setFailed(!!error && !gone)
    // Keep what we had on a failed read: an outage must not empty the list.
    if (!error) setPlans((data as PlanRow[] | null) ?? [])
    setLoading(false)
  }, [householdId, supabase])

  useEffect(() => { void fetchAll() }, [fetchAll])
  // Every return to the app rereads: cheap, and it catches anything realtime
  // missed while the phone slept.
  useEffect(() => onForeground(() => { void fetchAll() }), [fetchAll])

  useEffect(() => {
    if (!householdId || missing) return
    let t: ReturnType<typeof setTimeout> | null = null
    const refetch = () => {
      if (t) clearTimeout(t)
      t = setTimeout(() => { void fetchAll() }, 250)
    }
    // Realtime can't filter DELETE events (the old row carries only its id),
    // so removals come in on their own unfiltered listener and drop the plan
    // by id; an id from another household matches nothing here.
    const ch = supabase.channel(`bucket_list:${householdId}:${channelSuffix.current}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bucket_list', filter: `household_id=eq.${householdId}` }, refetch)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bucket_list', filter: `household_id=eq.${householdId}` }, refetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bucket_list' }, payload => {
        const id = (payload.old as { id?: string } | null)?.id
        if (!id) return
        setPlans(prev => prev.filter(p => p.id !== id))
      })
      .subscribe()
    return () => { if (t) clearTimeout(t); supabase.removeChannel(ch) }
  }, [householdId, missing, supabase, fetchAll])

  const add = useCallback(async (input: PlanInput): Promise<PlanResult> => {
    const plan = cleanPlan(input)
    if (!plan) return { ok: false, reason: 'empty' }
    if (!householdId || !userId) return { ok: false, reason: 'signed_out' }
    const { data, error } = await supabase.from('bucket_list')
      .insert({ household_id: householdId, created_by: userId, ...plan })
      .select('*').single()
    if (error || !data) return { ok: false, reason: isMissingTable(error?.code) ? 'missing' : 'offline' }
    const row = data as PlanRow
    setPlans(prev => [row, ...prev.filter(p => p.id !== row.id)])
    notify(row.id, 'added')
    return { ok: true, id: row.id }
  }, [householdId, userId, supabase])

  const patch = useCallback(async (id: string, changes: Partial<PlanRow>): Promise<PlanResult> => {
    const { data, error } = await supabase.from('bucket_list')
      .update(changes).eq('id', id).select('*').maybeSingle()
    if (error || !data) return { ok: false, reason: 'offline' }
    const row = data as PlanRow
    setPlans(prev => prev.map(p => (p.id === row.id ? row : p)))
    return { ok: true, id: row.id }
  }, [supabase])

  const edit = useCallback(async (id: string, input: PlanInput): Promise<PlanResult> => {
    const plan = cleanPlan(input)
    if (!plan) return { ok: false, reason: 'empty' }
    return patch(id, plan)
  }, [patch])

  // done_at only needs to be non-null: the trigger stamps the real time and
  // the person, so a phone with a wrong clock can't backdate a tick.
  const setDone = useCallback(async (id: string, done: boolean): Promise<PlanResult> => {
    const r = await patch(id, { done_at: done ? new Date().toISOString() : null })
    if (r.ok && done) notify(id, 'done')
    return r
  }, [patch])

  const remove = useCallback(async (id: string): Promise<PlanResult> => {
    const { error } = await supabase.from('bucket_list').delete().eq('id', id)
    if (error) return { ok: false, reason: 'offline' }
    setPlans(prev => prev.filter(p => p.id !== id))
    return { ok: true }
  }, [supabase])

  return { loading, missing, failed, plans, add, edit, setDone, remove }
}
