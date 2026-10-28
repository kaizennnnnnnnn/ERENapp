import type { createClient } from './supabase/client'
import { writeWithRetry } from './supabaseRetry'

interface SavedRequest { id: string; args: Record<string, unknown> }
interface SavedResult { ok: boolean; reason?: string }
const pending = new Map<string, SavedRequest>()

export function pendingSavedRpcs(userId: string, name: string): SavedRequest[] {
  const prefix = `eren:saved-rpc:v1:${userId}:${name}:`
  const keys = new Set(Array.from(pending.keys()).filter(key => key.startsWith(prefix)))
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(prefix)) keys.add(key)
    }
  } catch { /* In-memory journal remains usable. */ }
  return Array.from(keys).map(readPending).filter((value): value is SavedRequest => !!value)
}

function readPending(key: string): SavedRequest | undefined {
  if (pending.has(key)) return pending.get(key)
  try {
    const raw = sessionStorage.getItem(key)
    if (raw) {
      const value = JSON.parse(raw) as SavedRequest
      if (typeof value.id === 'string' && value.args && typeof value.args === 'object') return value
    }
  } catch { /* Storage can be unavailable in private browsing. */ }
}

/** A retry replays the same receipt, even after a lost response or tab reload. */
export async function savedRpc<T extends SavedResult>(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  name: string,
  slot: string,
  args: Record<string, unknown>,
): Promise<T | { ok: false; reason: 'not_ready' | 'connection' }> {
  const key = `eren:saved-rpc:v1:${userId}:${name}:${slot}`
  const request = readPending(key) ?? { id: crypto.randomUUID(), args }
  pending.set(key, request)
  try { sessionStorage.setItem(key, JSON.stringify(request)) } catch { /* In-memory retries still work. */ }
  const { data, error } = await writeWithRetry(
    signal => supabase.rpc(name, { ...request.args, p_request_id: request.id }).abortSignal(signal),
    2,
    e => !['PGRST202', '42883', '42501', '22023'].includes(e.code ?? ''),
  )
  if (error || !data || typeof data.ok !== 'boolean') {
    const missing = error?.code === 'PGRST202' || error?.code === '42883'
    // Missing functions cannot have committed anything. Other failures may
    // have lost the response AFTER commit, so keep the id for the next tap.
    if (missing) {
      pending.delete(key)
      try { sessionStorage.removeItem(key) } catch { /* unavailable */ }
    }
    return { ok: false, reason: missing ? 'not_ready' : 'connection' }
  }
  pending.delete(key)
  try { sessionStorage.removeItem(key) } catch { /* unavailable */ }
  return data as T
}
