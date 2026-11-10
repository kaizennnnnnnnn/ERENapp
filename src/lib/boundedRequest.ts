/** A signal alone cannot bound time spent waiting for an SDK auth lock. */
export async function boundedRequest<T>(
  run: (signal: AbortSignal) => PromiseLike<T>,
  { timeoutMs = 8000, signal }: { timeoutMs?: number; signal?: AbortSignal | null } = {},
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined, cancel: (() => void) | undefined
  const stopped = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new DOMException('Request cancelled', 'AbortError')) }
    if (signal?.aborted) { cancel(); return }
    signal?.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new Error('Connection timed out')) }, timeoutMs)
  })
  try {
    let operation: PromiseLike<T>
    try {
      if (controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError')
      operation = run(controller.signal)
    } catch (error) { operation = Promise.reject(error) }
    return await Promise.race([stopped, operation])
  } finally {
    clearTimeout(timer)
    if (cancel) signal?.removeEventListener('abort', cancel)
  }
}

/** Bound auth reads/refreshes, never an unrelated purchase or account creation. */
export function createAuthFetch(fetcher: typeof fetch, baseUrl: string): typeof fetch {
  return (input, init) => {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null
    const url = new URL(request?.url ?? String(input), baseUrl)
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
    const authRead = method === 'GET' && url.pathname === '/auth/v1/user'
    const refresh = method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token'
    if (url.origin !== new URL(baseUrl).origin || (!authRead && !refresh)) return fetcher(input, init)
    return boundedRequest(signal => fetcher(input, { ...init, signal }), { timeoutMs: 10000, signal: init?.signal ?? request?.signal })
  }
}
