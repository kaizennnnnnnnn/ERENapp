'use client'

import { useEffect, useRef } from 'react'

// Fire `onHide` when the tab/app goes to the background and `onShow` when it
// returns. Backgrounding is the COMMON mobile case (a notification, an
// app-switch), and an unpaused game loop drains its countdown unseen, spikes a
// wall-clock difficulty ramp to max, and dumps a teleported backlog of items on
// return. Games use this to cancel their rAF + intervals on hide and rebase
// their timestamps on show. Callbacks are read through refs so passing fresh
// closures each render doesn't re-subscribe the listener.
export function useVisibilityPause(onHide?: () => void, onShow?: () => void): void {
  const hideRef = useRef(onHide)
  const showRef = useRef(onShow)

  useEffect(() => {
    hideRef.current = onHide
    showRef.current = onShow
  })

  useEffect(() => {
    function onVis() {
      if (document.hidden) hideRef.current?.()
      else showRef.current?.()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
}
