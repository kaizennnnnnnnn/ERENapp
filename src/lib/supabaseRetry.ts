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
// and it must only be used for idempotent updates — ones that set absolute
// values, so a retry after an ambiguous failure can't double-apply.
//
// `run` receives an AbortSignal and must build a FRESH query each call
// (supabase-js builders are single-use thenables) with `.abortSignal(signal)`
// attached.
const WRITE_TIMEOUT_MS = 6000

export async function writeWithRetry<T>(
  run: (signal: AbortSignal) => PromiseLike<{ data: T; error: RetryableError | null }>,
  retries = 2,
): Promise<{ data: T; error: RetryableError | null }> {
  let last: { data: T; error: RetryableError | null } | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 800 * 2 ** (attempt - 1)))
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), WRITE_TIMEOUT_MS)
    try {
      last = await run(ctrl.signal)
    } catch (e) {
      // abort (timeout) or fetch-level failure — retry
      last = { data: null as T, error: { message: e instanceof Error ? e.message : String(e) } }
    } finally {
      clearTimeout(timer)
    }
    if (!last.error) break
  }
  return last!
}
