'use client'

import { useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createAuthState, INITIAL_AUTH } from '@/lib/authState'
export { PROFILE_UPDATED_EVENT } from '@/lib/authState'
export type { ProfileUpdatedDetail } from '@/lib/authState'

let shared: ReturnType<typeof createAuthState> | undefined
const store = () => shared ?? (shared = createAuthState(createClient()))
const subscribe = (fn: () => void) => store().subscribe(fn)
const snapshot = () => store().getSnapshot()
const serverSnapshot = () => INITIAL_AUTH
const retry = () => store().retry()
const signOut = () => store().signOut()

export function useAuth() {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  return { ...state, retry, signOut }
}
