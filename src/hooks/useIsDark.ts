'use client'

import { useEffect, useState } from 'react'
import { isDarkOutside, tzCoords } from '@/lib/timeOfDay'

// Returns true when it's "dark outside" by the user's local sunset and
// sunrise. Coords are derived from the browser's IANA timezone (no
// permission prompt) — accurate to ~30 min anywhere in the world, which
// is well below the threshold where a room-background swap is noticeable.
// Re-evaluates every minute and on visibilitychange so the swap happens
// live without a reload.
export function useIsDark(): boolean {
  const [dark, setDark] = useState<boolean>(() => isDarkOutside(tzCoords()))

  useEffect(() => {
    const tick = () => setDark(isDarkOutside(tzCoords()))
    tick()
    const id = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  return dark
}
