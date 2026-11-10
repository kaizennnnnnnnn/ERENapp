import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types'
import type { createClient } from './supabase/client'
import { boundedRequest } from './boundedRequest'
import { onForeground } from './onForeground'

export const PROFILE_UPDATED_EVENT = 'eren:profile-updated'
export interface ProfileUpdatedDetail { id: string; patch: Partial<Profile> }
export interface AuthSnapshot {
  user: User | null; profile: Profile | null; loading: boolean; error: 'connection' | 'profile_missing' | null; retrying: boolean
}
export const INITIAL_AUTH: AuthSnapshot = { user: null, profile: null, loading: true, error: null, retrying: false }

/** One verified identity/profile per browser tab, shared by every useAuth reader. */
export function createAuthState(client: ReturnType<typeof createClient>) {
  let state = INITIAL_AUTH, started = false, disposed = false, generation = 0
  let active: { token: symbol; controller: AbortController; promise: Promise<void>; patch: Partial<Profile> } | null = null
  let unsubscribeAuth: (() => void) | undefined, offForeground: (() => void) | undefined
  let deferred: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const publish = (next: AuthSnapshot) => { if (!disposed) { state = next; listeners.forEach(fn => fn()) } }
  function invalidate() { generation++; active?.controller.abort(); active = null; clearTimeout(deferred) }

  function retry(): Promise<void> {
    if (disposed) return Promise.resolve()
    if (active) return active.promise
    const token = Symbol(), controller = new AbortController(), epoch = generation
    const current = () => !disposed && generation === epoch && active?.token === token
    const job = { token, controller, promise: Promise.resolve(), patch: {} as Partial<Profile> }
    active = job
    publish({ ...state, retrying: true })
    job.promise = (async () => {
      const deadline = Date.now() + 10000
      try {
        let user = state.user
        if (!user) {
          const response = await boundedRequest(() => client.auth.getUser(), { timeoutMs: 10000, signal: controller.signal })
          if (!current()) return
          const error = response.error
          if (error && error.name !== 'AuthSessionMissingError' && error.status !== 401) throw error
          user = response.data.user
          if (!user) { publish({ user: null, profile: null, loading: false, error: null, retrying: false }); return }
          publish({ user, profile: null, loading: true, error: null, retrying: true })
        }
        const actor = user.id
        const { data, error } = await boundedRequest(signal => client.from('profiles').select('*').eq('id', actor).abortSignal(signal).maybeSingle(),
          { timeoutMs: Math.max(1, deadline - Date.now()), signal: controller.signal })
        if (!current() || state.user?.id !== actor) return
        if (error) throw error
        if (!data || data.id !== actor) { publish({ ...state, loading: true, error: 'profile_missing', retrying: false }); return }
        publish({ user: state.user, profile: { ...data, ...job.patch, id: actor }, loading: false, error: null, retrying: false })
      } catch {
        // Unavailable is NOT signed out. Legacy guards must not redirect on it.
        if (current()) publish({ ...state, loading: true, error: 'connection', retrying: false })
      } finally {
        if (current()) active = null
      }
    })()
    return job.promise
  }

  function onUpdated(event: Event) {
    const detail = (event as CustomEvent<ProfileUpdatedDetail>).detail
    if (!detail || state.user?.id !== detail.id) return
    if (active) active.patch = { ...active.patch, ...detail.patch }
    if (state.profile) publish({ ...state, profile: { ...state.profile, ...detail.patch, id: detail.id } })
  }
  function recover() { if (state.error && !active) void retry() }
  function start() {
    if (started || disposed) return
    started = true
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return // getUser is the single authoritative bootstrap.
      if (event === 'SIGNED_OUT') { invalidate(); publish({ user: null, profile: null, loading: false, error: null, retrying: false }); return }
      if (!session?.user) return
      if (state.user?.id === session.user.id) {
        publish({ ...state, user: session.user })
        if (state.error && !active) deferred = setTimeout(() => { void retry() }, 0)
        return
      }
      invalidate()
      publish({ user: session.user, profile: null, loading: true, error: null, retrying: false })
      // SDK auth callbacks run under its lock: never await another SDK call here.
      deferred = setTimeout(() => { void retry() }, 0)
    })
    unsubscribeAuth = () => subscription.unsubscribe()
    offForeground = onForeground(recover)
    window.addEventListener('online', recover)
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdated)
    void retry()
  }
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); start(); return () => { listeners.delete(fn) } },
    retry,
    async signOut() { await client.auth.signOut() },
    dispose() { disposed = true; invalidate(); unsubscribeAuth?.(); offForeground?.(); window.removeEventListener('online', recover); window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdated); listeners.clear() },
  }
}
