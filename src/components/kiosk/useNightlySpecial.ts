'use client'

import { useEffect, useMemo, useState } from 'react'
import { onForeground } from '@/lib/onForeground'
import { dateKey } from '@/lib/wishes'
import { nightlySpecialFor } from './kioskSpecials'
import type { MenuState } from './kioskShift'

/** Street-board preview; entry replaces this with the session's confirmed day. */
export function useNightlySpecial(menu: MenuState) {
  const [date, setDate] = useState<string | null>(null)
  useEffect(() => {
    const refresh = () => setDate(dateKey(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone))
    refresh()
    const timer = setInterval(refresh, 60_000)
    const off = onForeground(refresh)
    return () => { clearInterval(timer); off() }
  }, [])
  return useMemo(() => date ? nightlySpecialFor(date, menu) : null, [date, menu])
}
