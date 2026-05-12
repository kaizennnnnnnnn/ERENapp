'use client'

import { useEffect, useState } from 'react'
import { isDarkOutside } from '@/lib/timeOfDay'

// Returns true when it's "dark outside" by local time. Re-evaluates every
// minute and on visibility change so backgrounds flip automatically as the
// sun goes down without forcing a page reload.
export function useIsDark(): boolean {
  const [dark, setDark] = useState<boolean>(() => isDarkOutside())

  useEffect(() => {
    const tick = () => setDark(isDarkOutside())
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
