'use client'

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

// Reactive `prefers-reduced-motion`, mirroring useIsDark's matchMedia shape.
// Used to gate decorative / idle / crash motion in the minigames — screen
// shake, red vignette flashes, infinite idle loops, particle storms — for
// players whose OS asks to reduce motion. Meaning-bearing instant state
// changes (a card flip, a tap flash) stay on; only the spectacle is dropped.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
