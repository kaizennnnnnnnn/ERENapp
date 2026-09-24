'use client'

// ─── Bottom-nav visibility ───────────────────────────────────────────────────
// The nav decides for itself which routes it belongs on and hides during a
// care scene. Pages only need this for moments of their own when the bar would
// be in the way: home's MoodGate, the morning verdict, a full-screen loader.
//
//   useHideBottomNav(showingMoodGate)
//
// Every caller holds its own hide request while its flag is true and drops it
// on unmount, so two overlapping reasons can't un-hide each other. The actions
// live in their own context and never change identity, so a page that hides
// the nav does not re-render when the nav's visibility changes.

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react'

interface NavVisibilityActions {
  hide: (id: string) => void
  release: (id: string) => void
}

const ActionsContext = createContext<NavVisibilityActions | null>(null)
const HiddenContext = createContext(false)

export function NavVisibilityProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<ReadonlySet<string>>(() => new Set())

  const hide = useCallback((id: string) => {
    setRequests(prev => (prev.has(id) ? prev : new Set(prev).add(id)))
  }, [])
  const release = useCallback((id: string) => {
    setRequests(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])
  const actions = useMemo(() => ({ hide, release }), [hide, release])

  return (
    <ActionsContext.Provider value={actions}>
      <HiddenContext.Provider value={requests.size > 0}>
        {children}
      </HiddenContext.Provider>
    </ActionsContext.Provider>
  )
}

/**
 * Hide the bottom nav while `hidden` is true. Safe to call outside the (app)
 * layout (onboarding, auth): there is no nav there, so it does nothing.
 */
export function useHideBottomNav(hidden: boolean): void {
  const actions = useContext(ActionsContext)
  const id = useId()
  useEffect(() => {
    if (!actions || !hidden) return
    actions.hide(id)
    return () => actions.release(id)
  }, [actions, hidden, id])
}

/** True while any page has asked the nav to step aside. */
export function useBottomNavHiddenByPage(): boolean {
  return useContext(HiddenContext)
}
