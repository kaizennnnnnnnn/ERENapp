'use client'

// ═════════════════════════════════════════════════════════════════════════════
// WishContext — Phase 3.
//
// One useDailyWish instance for the whole app, shared via context. WishCloud,
// WishChip, and WishHintBanner all read from here, so we don't end up with
// three concurrent realtime channels racing for the same row.
// ═════════════════════════════════════════════════════════════════════════════

import { createContext, useContext, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useErenStats } from '@/hooks/useErenStats'
import { useDailyWish, type UseDailyWishResult } from '@/hooks/useDailyWish'

const WishContext = createContext<UseDailyWishResult | null>(null)

const EMPTY_SET: Set<string> = new Set()

export function WishProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const { partner, lifetimeWLT } = useCouple()
  const { stats } = useErenStats(profile?.household_id ?? null)

  // Derive leader name from W-L-T (null on tie / zero games — `isEligible`
  // takes care of skipping leader-only wishes when this is null).
  const leaderName = useMemo<string | null>(() => {
    const myWins = lifetimeWLT?.myWins ?? 0
    const partnerWins = lifetimeWLT?.partnerWins ?? 0
    if (myWins > partnerWins) return profile?.name ?? null
    if (partnerWins > myWins) return partner?.name ?? null
    return null
  }, [lifetimeWLT, profile?.name, partner?.name])

  // Union of both partners' fridge food keys — drives the "don't roll a
  // salmon wish when neither of you has salmon" gate.
  const fridgeKeys = useMemo<Set<string>>(() => {
    const byUser = stats?.food_by_user ?? {}
    const set = new Set<string>()
    for (const userId of Object.keys(byUser)) {
      const pile = byUser[userId] ?? {}
      for (const k of Object.keys(pile)) {
        const qty = (pile as Record<string, number | undefined>)[k]
        if (typeof qty === 'number' && qty > 0) set.add(k)
      }
    }
    return set.size > 0 ? set : EMPTY_SET
  }, [stats?.food_by_user])

  // Timezone — pulled from the browser until households.tz is wired in PR 9.
  // dateKey() falls back to UTC if this is null, which is fine for v1.
  const tz = useMemo<string | null>(() => {
    if (typeof Intl === 'undefined') return null
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return null }
  }, [])

  const result = useDailyWish({
    householdId: profile?.household_id ?? null,
    userId: user?.id ?? null,
    partnerId: partner?.id ?? null,
    tz,
    leaderName,
    viewerName: profile?.name ?? '',
    fridgeKeys,
  })

  return <WishContext.Provider value={result}>{children}</WishContext.Provider>
}

/** Returns the shared useDailyWish result. Returns null when the provider
 *  hasn't loaded yet (or the user isn't in a household). */
export function useWish(): UseDailyWishResult | null {
  return useContext(WishContext)
}
