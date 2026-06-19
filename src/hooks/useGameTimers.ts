'use client'

import { useCallback, useEffect, useRef } from 'react'

export interface GameTimers {
  /** Tracked setTimeout — auto-deregisters when it fires. */
  setTimeout: (fn: () => void, ms: number) => number
  /** Tracked setInterval. */
  setInterval: (fn: () => void, ms: number) => number
  clearTimeout: (id: number) => void
  clearInterval: (id: number) => void
  /** Cancel every pending timeout + interval (call on restart). */
  clearAll: () => void
}

// A tracked timeout/interval scheduler for the minigames. Every id is recorded
// so a single clearAll() flushes them on restart (AGAIN), and an unmount effect
// flushes them on the back button — killing the class of bugs where a stale
// match-resolve / flip-back / count-up / next-round timer fires into the fresh
// round or calls setState after the component is gone.
export function useGameTimers(): GameTimers {
  const timeouts = useRef<Set<number>>(new Set())
  const intervals = useRef<Set<number>>(new Set())

  const setT = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeouts.current.delete(id)
      fn()
    }, ms)
    timeouts.current.add(id)
    return id
  }, [])

  const setI = useCallback((fn: () => void, ms: number) => {
    const id = window.setInterval(fn, ms)
    intervals.current.add(id)
    return id
  }, [])

  const clearT = useCallback((id: number) => {
    window.clearTimeout(id)
    timeouts.current.delete(id)
  }, [])

  const clearI = useCallback((id: number) => {
    window.clearInterval(id)
    intervals.current.delete(id)
  }, [])

  const clearAll = useCallback(() => {
    timeouts.current.forEach(id => window.clearTimeout(id))
    timeouts.current.clear()
    intervals.current.forEach(id => window.clearInterval(id))
    intervals.current.clear()
  }, [])

  // Flush everything on unmount (e.g. back button mid-animation).
  useEffect(() => clearAll, [clearAll])

  return {
    setTimeout: setT,
    setInterval: setI,
    clearTimeout: clearT,
    clearInterval: clearI,
    clearAll,
  }
}
