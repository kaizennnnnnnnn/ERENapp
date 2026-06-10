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
    if (!last.error) break
  }
  return last!
}
