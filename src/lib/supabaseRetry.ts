// Retry wrapper for idempotent Supabase reads.
//
// The hosted Supabase REST endpoint intermittently returns 503 while the
// project restarts. supabase-js resolves that as { data: null, error }
// without throwing, so callers that only check `data` confuse "request
// failed" with "no rows" — at best the UI loads empty, at worst an
// init-on-missing-row path overwrites real data.
//
// Only wrap reads where an error is abnormal (plain selects, or
// .maybeSingle() lookups). Don't wrap .single() calls that rely on the
// 0-rows error (PGRST116) as a signal — every attempt would burn the
// full backoff before reporting it.

import { boundedRequest } from './boundedRequest'

interface RetryableError {
  code?: string
  message?: string
}

export async function withRetry<T>(
  run: () => PromiseLike<{ data: T; error: RetryableError | null }>,
  retries = 2,
): Promise<{ data: T; error: RetryableError | null }> {
  let last: { data: T; error: RetryableError | null } | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * 2 ** (attempt - 1)))
    try {
      last = await run()
    } catch (e) {
      // fetch-level failure (offline, DNS) — same treatment as a 5xx
      last = { data: null as T, error: { message: e instanceof Error ? e.message : String(e) } }
      continue
    }
    // PGRST116 = .single() found 0 rows. Retrying can't conjure the row —
    // report it immediately instead of burning the backoff.
    if (!last.error || last.error.code === 'PGRST116') break
  }
  return last!
}

// Retry + per-attempt timeout for eren_stats WRITES. A write differs from a
// read in two ways: the caller's button sits in a disabled busy state until
// the promise settles (so a stalled request must be aborted, not waited out),
// and it must only be used for idempotent updates: absolute values or a
// receipt-keyed RPC, so an ambiguous failure can't double-apply.
//
// `run` receives an AbortSignal and must build a FRESH query each call
// (supabase-js builders are single-use thenables) with `.abortSignal(signal)`
// attached.
//
// `shouldRetry` lets a caller return an error it knows is permanent (a column
// the database doesn't have yet) at once instead of after the full backoff.
// Without it every error is retried, as before.
// Receipt-backed callers can cap the whole retry sequence with budgetMs.
const WRITE_TIMEOUT_MS = 6000

export async function writeWithRetry<T>(
  run: (signal: AbortSignal) => PromiseLike<{ data: T; error: RetryableError | null }>,
  retries = 2,
  shouldRetry: (error: RetryableError) => boolean = () => true,
  options: { budgetMs?: number } = {},
): Promise<{ data: T; error: RetryableError | null }> {
  let last: { data: T; error: RetryableError | null } | null = null
  const deadline = options.budgetMs === undefined ? Infinity : Date.now() + options.budgetMs
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const backoff = 800 * 2 ** (attempt - 1)
      if (Date.now() + backoff >= deadline) break
      await new Promise(r => setTimeout(r, backoff))
    }
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    try {
      last = await boundedRequest(run, { timeoutMs: Math.min(WRITE_TIMEOUT_MS, remaining) })
    } catch (e) {
      // abort (timeout) or fetch-level failure — retry
      last = { data: null as T, error: { message: e instanceof Error ? e.message : String(e) } }
    }
    if (!last.error || !shouldRetry(last.error)) break
  }
  return last ?? { data: null as T, error: { message: 'Save timed out' } }
}
