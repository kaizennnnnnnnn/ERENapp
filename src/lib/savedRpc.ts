import type { createClient } from './supabase/client'
import { writeWithRetry } from './supabaseRetry'

interface SavedRequest { id: string; args: Record<string, unknown> }
export interface PendingSavedRequest extends SavedRequest { slot: string }
interface SavedResult { ok: boolean; reason?: string }
const pending = new Map<string, SavedRequest>()

export function pendingSavedRpcs(userId: string, name: string): PendingSavedRequest[] {
  const prefix = `eren:saved-rpc:v1:${userId}:${name}:`
  const keys = new Set(Array.from(pending.keys()).filter(key => key.startsWith(prefix)))
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(prefix)) keys.add(key)
    }
  } catch { /* In-memory journal remains usable. */ }
  return Array.from(keys).flatMap(key => {
    const request = readPending(key)
    return request ? [{ ...request, slot: key.slice(prefix.length) }] : []
  })
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

/** Record intent before a caller joins a queue, not only when networking starts. */
export function prepareSavedRpc(userId: string, name: string, slot: string, args: Record<string, unknown>): SavedRequest {
  const key = `eren:saved-rpc:v1:${userId}:${name}:${slot}`
  const request = readPending(key) ?? { id: crypto.randomUUID(), args }
  pending.set(key, request)
  try { sessionStorage.setItem(key, JSON.stringify(request)) } catch { /* In-memory retries still work. */ }
  return request
}

/** A retry replays the same receipt, even after a lost response or tab reload. */
export async function savedRpc<T extends SavedResult>(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  name: string,
  slot: string,
  args: Record<string, unknown>,
  retainIntent = false,
  validate?: (value: T) => boolean,
): Promise<T | { ok: false; reason: 'not_ready' | 'connection' }> {
  const key = `eren:saved-rpc:v1:${userId}:${name}:${slot}`
  const request = prepareSavedRpc(userId, name, slot, args)
  const { data, error } = await writeWithRetry(
    signal => supabase.rpc(name, { ...request.args, p_request_id: request.id }).abortSignal(signal),
    2,
    e => !['PGRST202', '42883', '42501', '22023'].includes(e.code ?? ''),
  )
  if (error || !data || typeof data.ok !== 'boolean' || (data.ok && validate && !validate(data as T))) {
    const missing = error?.code === 'PGRST202' || error?.code === '42883'
    // Missing functions cannot have committed anything. Other failures may
    // have lost the response AFTER commit, so keep the id for the next tap.
    if (missing && !retainIntent) {
      pending.delete(key)
      try { sessionStorage.removeItem(key) } catch { /* unavailable */ }
    }
    return { ok: false, reason: missing ? 'not_ready' : 'connection' }
  }
  // Games keep an unsaved run recoverable even if its stats row is not ready yet.
  if (!data.ok && retainIntent) return data as T
  pending.delete(key)
  try { sessionStorage.removeItem(key) } catch { /* unavailable */ }
  return data as T
}
