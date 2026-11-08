'use client'

import { useEffect, useMemo, useState } from 'react'
import { onForeground } from '@/lib/onForeground'
import { dateKey } from '@/lib/wishes'
import { nightlySpecialFor } from './kioskSpecials'
import type { MenuState } from './kioskShift'

/** Street-board preview; entry replaces this with the session's confirmed day. */
export function useNightlySpecial(menu: MenuState, confirmedDate?: string | null) {
  const [date, setDate] = useState<string | null>(null)
  useEffect(() => {
    if (confirmedDate) return
    const refresh = () => setDate(dateKey(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone))
    refresh()
    const timer = setInterval(refresh, 60_000)
    const off = onForeground(refresh)
    return () => { clearInterval(timer); off() }
  }, [confirmedDate])
  const key = confirmedDate ?? date
  return useMemo(() => key ? nightlySpecialFor(key, menu) : null, [key, menu])
}
