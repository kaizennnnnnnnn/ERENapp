import type { UnlockEvent } from './memoryChecks'

const DEBOUNCE_MS = 1200
const FAILURE_COOLDOWN_MS = 5000
const keyOf = (event: UnlockEvent) => event.type === 'action' ? event.actionType : event.type

/** Keep each event kind, including firsts that would be lost by a last-event debounce. */
export function createMemoryCheckQueue(check: (events: UnlockEvent[], signal: AbortSignal) => Promise<void>) {
  const scope = new AbortController()
  const pending = new Map<string, UnlockEvent>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let notBefore = 0

  function schedule() {
    if (scope.signal.aborted || timer !== undefined || running || pending.size === 0) return
    timer = setTimeout(() => {
      timer = undefined
      void drain()
    }, Math.max(DEBOUNCE_MS, notBefore - Date.now()))
  }

  async function drain() {
    const batch = Array.from(pending.values())
    pending.clear()
    running = true
    let followUp = false
    try {
      await check(batch, scope.signal)
      followUp = true
    } catch {
      if (!scope.signal.aborted) {
        followUp = pending.size > 0
        const newer = Array.from(pending.values())
        pending.clear()
        for (const event of [...batch, ...newer]) pending.set(keyOf(event), event)
        // Retry on the next event or return to the app, not in an outage loop.
        notBefore = Date.now() + FAILURE_COOLDOWN_MS
      }
    } finally {
      running = false
      if (followUp) schedule()
    }
  }

  return {
    enqueue(event: UnlockEvent) {
      if (scope.signal.aborted) return
      pending.set(keyOf(event), event)
      schedule()
    },
    resume: schedule,
    dispose() {
      scope.abort()
      clearTimeout(timer)
      pending.clear()
    },
  }
}
