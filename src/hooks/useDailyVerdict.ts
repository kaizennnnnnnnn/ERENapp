'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useDailyVerdict — settles yesterday and decides whether to show the result
// screen this morning.
//
// Two jobs, deliberately separate:
//
//   SETTLE  runs always, the moment yesterday's snapshot row is readable.
//           Calls claim_daily_trophy, which is one-shot server-side, so the
//           trophies land whether or not anyone ever looks at the screen.
//
//   SHOW    gates the screen to once per local day, on the FIRST entry after
//           the mood check-in. Guarded twice: a date-stamped localStorage key
//           (instant, survives a reload) and `verdict_seen` on the row (so the
//           other device doesn't show it again). Same belt-and-braces the mood
//           gate itself uses.
//
// The row does not exist at midnight — it is written by backfillDailyResults
// inside useCouple's fetchAll, which fires on mount and on every foreground.
// So this hook reads once and then re-reads on `eren:battle-backfilled`.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import { useCouple } from './useCouple'
import {
  fetchDailyRow, claimDailyTrophy, markVerdictSeen,
  type DailyBattleRow, type TrophySettlement,
} from '@/lib/battleResults'
import { twistForDate, type TwistDef } from '@/lib/dailyTwist'

export interface DailyVerdict {
  /** Render the screen. False until settlement has actually resolved. */
  show: boolean
  row: DailyBattleRow | null
  /** What the claim paid. null when it was already claimed on another device
   *  — the screen then reads the amount off `row.trophies_awarded`. */
  settlement: TrophySettlement | null
  /** Trophies this day is worth to me, claimed here or earlier. */
  awarded: number
  /** Consecutive wins ending yesterday. 0 when I did not win. */
  streak: number
  yesterdayTwist: TwistDef
  todayTwist: TwistDef
  dismiss(): void
}

function seenKey(userId: string, date: string) {
  return `eren_verdict_${userId}_${date}`
}

/**
 * @param ready hold everything until the caller says the app is past its own
 *   gates. The home page passes "mood is in and the room has decoded", so the
 *   screen never renders under the splash or in front of the mood picker.
 */
export function useDailyVerdict(ready: boolean): DailyVerdict {
  const supabase = createClient()
  const { user } = useAuth()
  const { partner, lifetimeWLT } = useCouple()

  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  const [row, setRow] = useState<DailyBattleRow | null>(null)
  const [settlement, setSettlement] = useState<TrophySettlement | null>(null)
  const [show, setShow] = useState(false)
  const settledRef = useRef<string | null>(null)

  const settle = useCallback(async () => {
    if (!user?.id || !partner?.id) return
    if (settledRef.current === yesterday) return

    const existing = await fetchDailyRow(supabase, user.id, yesterday)
    // No row means one of: nobody played yesterday, or the backfill has not
    // run yet. Either way there is nothing to settle — stay silent and wait
    // for the next `eren:battle-backfilled`.
    if (!existing) return
    settledRef.current = yesterday

    let current = existing
    let paid: TrophySettlement | null = null
    if (!existing.trophy_claimed) {
      paid = await claimDailyTrophy(supabase, yesterday)
      if (paid.ok) {
        current = {
          ...existing,
          trophy_claimed: true,
          trophy_tier: paid.tier,
          trophies_awarded: paid.trophies,
        }
        window.dispatchEvent(new CustomEvent('eren:trophy-payout', {
          detail: { trophies: paid.trophies, balance: paid.balance, tier: paid.tier },
        }))
      } else if (paid.reason === 'already_claimed') {
        // The other tab beat us. Re-read so the screen shows the real amount.
        current = (await fetchDailyRow(supabase, user.id, yesterday)) ?? existing
        paid = null
      } else {
        // no_row / not_finished / a transient failure. Let the next signal
        // retry rather than showing a screen with a blank prize on it.
        settledRef.current = null
        return
      }
    }

    setRow(current)
    setSettlement(paid)

    let alreadySeen = current.verdict_seen === true
    try {
      if (localStorage.getItem(seenKey(user.id, yesterday))) alreadySeen = true
    } catch { /* storage blocked — the server flag still covers it */ }
    if (!alreadySeen) setShow(true)
  }, [user?.id, partner?.id, yesterday]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (ready) void settle() }, [ready, settle])

  // The row is written by useCouple's backfill, which may land after our first
  // read — especially right after midnight, and on a cold start.
  useEffect(() => {
    if (!ready) return
    const onBackfill = () => { void settle() }
    window.addEventListener('eren:battle-backfilled', onBackfill)
    return () => window.removeEventListener('eren:battle-backfilled', onBackfill)
  }, [ready, settle])

  const dismiss = useCallback(() => {
    setShow(false)
    if (!user?.id) return
    try { localStorage.setItem(seenKey(user.id, yesterday), '1') } catch { /* ignore */ }
    void markVerdictSeen(supabase, user.id, yesterday)
  }, [user?.id, yesterday]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    show,
    row,
    settlement,
    awarded: settlement?.trophies ?? row?.trophies_awarded ?? 0,
    // The RPC reports the streak it counted. When the other device claimed
    // first there is no report, so fall back to the lifetime aggregate — its
    // newest row IS yesterday (today has none yet), so its myStreak is the
    // same number.
    streak: settlement?.streak ?? (row?.outcome === 'win' ? lifetimeWLT?.myStreak ?? 0 : 0),
    yesterdayTwist: twistForDate(yesterday),
    todayTwist: twistForDate(today),
    dismiss,
  }
}
