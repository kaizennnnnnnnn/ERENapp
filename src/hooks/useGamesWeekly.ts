'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { useAuth } from '@/hooks/useAuth'
import {
  ensureLastWeekGameResult,
  claimWeeklyGamePayout,
  acknowledgeWeeklyGameResult,
  weeklyStandings,
  type WeeklyGameRow,
  type WeeklyStandings,
} from '@/lib/gameWeekly'

// Drives the arcade weekly competition: settles last week on load (idempotent,
// no cron — mirrors useCouple's weekly champion), exposes the live this-week
// standings, and a one-shot claim that credits coins via the TaskContext
// 'eren:games-payout' listener.
export function useGamesWeekly() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [weeklyChampion, setWeeklyChampion] = useState<WeeklyGameRow | null>(null)
  const [standings, setStandings] = useState<WeeklyStandings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id || !profile) return
    let cancelled = false
    ;(async () => {
      // Resolve the partner (the other household member), if any.
      let pId: string | null = null
      if (profile.household_id) {
        const { data: profiles } = await withRetry(() => supabase
          .from('profiles').select('id, name').eq('household_id', profile.household_id!))
        const partner = (profiles ?? []).find((p: { id: string }) => p.id !== user.id) as { id: string; name: string } | undefined
        pId = partner?.id ?? null
        if (!cancelled) setPartnerName(partner?.name ?? null)
      }
      if (cancelled) return
      setPartnerId(pId)

      // Live this-week standings for the leaderboard.
      const st = await weeklyStandings(supabase, user.id, pId).catch(() => null)
      if (!cancelled && st) setStandings(st)

      // Settle last week (needs a partner to compete against).
      if (profile.household_id && pId) {
        const champ = await ensureLastWeekGameResult(supabase, profile.household_id, user.id, pId).catch(() => null)
        if (!cancelled) setWeeklyChampion(champ)
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user?.id, profile?.id, profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Claim + acknowledge in one shot. Credits whatever this user is owed
  // (champion/tie 100, loser 25) exactly once via the CAS guard, then stamps
  // the popup as seen. Returns coins credited.
  const claim = useCallback(async (): Promise<number> => {
    if (!user?.id || !weeklyChampion) return 0
    let credited = 0
    if (!weeklyChampion.payout_paid && weeklyChampion.payout_coins > 0) {
      credited = await claimWeeklyGamePayout(supabase, user.id, weeklyChampion.iso_week)
      if (credited > 0) {
        window.dispatchEvent(new CustomEvent('eren:games-payout', {
          detail: { coins: credited, isoWeek: weeklyChampion.iso_week },
        }))
      }
    }
    await acknowledgeWeeklyGameResult(supabase, user.id, weeklyChampion.iso_week)
    setWeeklyChampion({ ...weeklyChampion, payout_paid: true, acknowledged: true })
    return credited
  }, [user?.id, weeklyChampion, supabase])

  return { weeklyChampion, standings, partnerId, partnerName, loading, claim }
}
