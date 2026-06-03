'use client'

// ═════════════════════════════════════════════════════════════════════════════
// useEventToday — Phase 3 PR 10
//
// Returns the first calendar event whose MM-DD matches today's local date,
// in priority order: eren_birthday → couple_anniversary → my_birthday →
// partner_birthday. Used by ErenPartyHat overlay on home.
//
// Pure derived state — no queries, just compares stored dates against today.
// ═════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react'

export type EventReason = 'eren_birthday' | 'couple_anniversary' | 'my_birthday' | 'partner_birthday'

export function useEventToday(opts: {
  erenBirthday:      string | null | undefined
  coupleAnniversary: string | null | undefined
  myBirthday:        string | null | undefined
  partnerBirthday:   string | null | undefined
}): EventReason | null {
  return useMemo(() => {
    const today = new Date()
    const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const match = (d: string | null | undefined) => !!d && d.slice(5) === mmdd
    if (match(opts.erenBirthday))      return 'eren_birthday'
    if (match(opts.coupleAnniversary)) return 'couple_anniversary'
    if (match(opts.myBirthday))        return 'my_birthday'
    if (match(opts.partnerBirthday))   return 'partner_birthday'
    return null
  }, [opts.erenBirthday, opts.coupleAnniversary, opts.myBirthday, opts.partnerBirthday])
}
