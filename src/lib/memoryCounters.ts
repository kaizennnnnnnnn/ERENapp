import type { SupabaseClient } from '@supabase/supabase-js'
import { boundedRequest } from './boundedRequest'
import type { ActionType } from './memoryCatalogue'

export type MemoryCounter = ActionType | 'cares' | 'both-care' | 'nudges' | 'traded' | 'games' | 'wishes'
export type MemoryCounts = Partial<Record<MemoryCounter, number>>

export function memoryRead<T>(signal: AbortSignal, run: (signal: AbortSignal) => PromiseLike<T>) {
  return boundedRequest(run, { signal, timeoutMs: 5000 })
}

async function finishReads<T>(reads: Promise<T>[]): Promise<T[]> {
  // A failed branch must not release the batch while its siblings are active.
  return (await Promise.allSettled(reads)).map(read => {
    if (read.status === 'rejected') throw read.reason
    return read.value
  })
}

/** During rollout, query only the needed counters even on the old schema. */
async function readLegacyCounters(
  db: SupabaseClient, home: string, keys: MemoryCounter[], signal: AbortSignal,
): Promise<MemoryCounts> {
  const count = async (run: (signal: AbortSignal) => PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await memoryRead(signal, run)
    if (error || count == null) throw new Error('Could not count memory milestones')
    return count
  }
  const journal = () => db.from('couple_journal').select('sender_id', { count: 'exact', head: true })
    .eq('household_id', home).eq('via_eren', true)
  const members = async () => {
    const { data, error } = await memoryRead(signal, s => db.from('profiles').select('id').eq('household_id', home).abortSignal(s))
    if (error) throw new Error('Could not read household members')
    return (data ?? []).map(row => row.id as string)
  }
  const needMembers = keys.includes('games') || keys.includes('traded') ? members() : null
  const pairs = await finishReads(keys.map(async (key): Promise<[MemoryCounter, number]> => {
    if (key === 'wishes') {
      const { data, error } = await memoryRead(signal, s => db.from('households').select('wishes_granted_count')
        .eq('id', home).abortSignal(s).maybeSingle())
      if (error || !data) throw new Error('Could not read granted wishes')
      return [key, data.wishes_granted_count as number]
    }
    if (key === 'nudges') return [key, await count(s => journal().abortSignal(s))]
    if (key === 'games' || key === 'traded') {
      const ids = await needMembers!
      if (key === 'games') return [key, ids.length ? await count(s => db.from('game_scores').select('id', { count: 'exact', head: true })
        .in('user_id', ids).abortSignal(s)) : 0]
      const sent = (await finishReads(ids.map(id => count(s => journal().eq('sender_id', id).abortSignal(s))))).filter(n => n > 0)
      return [key, sent.length >= 2 ? Math.min(...sent) : 0]
    }
    if (key === 'both-care') {
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      const { data, error } = await memoryRead(signal, s => db.from('interactions').select('user_id')
        .eq('household_id', home).gte('created_at', today.toISOString()).abortSignal(s))
      if (error) throw new Error('Could not read today\'s care')
      return [key, new Set((data ?? []).map(row => row.user_id)).size]
    }
    return [key, await count(s => {
      const q = db.from('interactions').select('id', { count: 'exact', head: true }).eq('household_id', home)
      return (key === 'cares' ? q : q.eq('action_type', key)).abortSignal(s)
    })]
  }))
  return Object.fromEntries(pairs)
}

export function createMemoryCounterReader(db: SupabaseClient, home: string) {
  let legacy = false
  return async (keys: MemoryCounter[], signal: AbortSignal): Promise<MemoryCounts> => {
    if (keys.length === 0) return {}
    if (!legacy) {
      const { data, error } = await memoryRead(signal, s => db.rpc('read_memory_counters', {
        p_household_id: home, p_keys: keys,
      }).abortSignal(s))
      if (!error) {
        if (!data || keys.some(key => !Number.isSafeInteger(data[key]) || data[key] < 0)) throw new Error('Invalid memory counts')
        return data as MemoryCounts
      }
      // A slow or unauthorized RPC must not trigger a second wave of reads.
      if (error.code !== 'PGRST202' && error.code !== '42883') throw new Error('Could not read memory counts')
      legacy = true
    }
    return readLegacyCounters(db, home, keys, signal)
  }
}
