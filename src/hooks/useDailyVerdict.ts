'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useDailyVerdict — settles yesterday and decides whether to show the result
// screen this morning.
//
// Two jobs, deliberately separate:
//
//   SETTLE  sweeps EVERY finished day I have not been paid for, oldest first,
//           not just yesterday — a day whose row was written by a later
//           backfill (open Monday, skip Tuesday, open Wednesday) would
//           otherwise never be claimed by anything. settle_daily_battle is
//           one-shot per (user, date) server-side, so the trophies land
//           whether or not anyone ever looks at the screen, and re-sweeping
//           costs nothing when nothing is owed.
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
  fetchDailyRow, claimDailyTrophy, markVerdictSeen, unsettledDates,
  type DailyBattleRow, type TrophySettlement,
} from '@/lib/battleResults'
import { twistForDate, type TwistDef } from '@/lib/dailyTwist'
import { useTrophies } from './useTrophies'
import { useTrophyCosmetics } from './useTrophyCosmetics'

/** The accessory a win puts on Eren for the day, if the winner owns it. */
const WINNERS_CROWN = 'acc_crown'

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
  const trophies = useTrophies()
  const cos = useTrophyCosmetics()

  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')

  const [row, setRow] = useState<DailyBattleRow | null>(null)
  const [settlement, setSettlement] = useState<TrophySettlement | null>(null)
  const [show, setShow] = useState(false)
  const settledRef = useRef<string | null>(null)

  const settle = useCallback(async () => {
    if (!user?.id || !partner?.id) return
    if (settledRef.current === yesterday) return

    // Every finished day I have not been paid for, oldest first — not just
    // yesterday. A day whose row was written by a LATER backfill (open the app
    // Monday, skip Tuesday, open it Wednesday) would otherwise never be
    // claimed by anything, and the trophies for a real win would evaporate.
    const owed = await unsettledDates(supabase, user.id, today)
    if (owed.length === 0 && !(await fetchDailyRow(supabase, user.id, yesterday))) {
      // No row for yesterday and nothing outstanding: either nobody played or
      // the backfill has not run. Stay silent and wait for the next signal.
      return
    }
    settledRef.current = yesterday

    let paidYesterday: TrophySettlement | null = null
    let transient = false
    for (const date of owed) {
      const paid = await claimDailyTrophy(supabase, date)
      if (paid.ok) {
        window.dispatchEvent(new CustomEvent('eren:trophy-payout', {
          detail: { trophies: paid.trophies, balance: paid.balance, tier: paid.tier },
        }))
        if (date === yesterday) paidYesterday = paid
      } else if (paid.reason && paid.reason !== 'already_claimed'
                 && paid.reason !== 'too_old' && paid.reason !== 'not_finished') {
        // A genuine failure (offline, 503). Allow one more attempt later.
        transient = true
      }
    }
    if (transient) settledRef.current = null

    // Re-read after settling: the RPC RE-SCORES the day and corrects the row,
    // so the screen must show what the server actually paid rather than what
    // the client had computed.
    const current = await fetchDailyRow(supabase, user.id, yesterday)
    if (!current) return

    setRow(current)
    setSettlement(paidYesterday)

    let alreadySeen = current.verdict_seen === true
    try {
      if (localStorage.getItem(seenKey(user.id, yesterday))) alreadySeen = true
    } catch { /* storage blocked — the server flag still covers it */ }
    if (!alreadySeen) setShow(true)
  }, [user?.id, partner?.id, yesterday, today]) // eslint-disable-line react-hooks/exhaustive-deps

  // `settle` is rebuilt when `yesterday` changes, so a session left open
  // across local midnight re-runs for the day that just ended.
  useEffect(() => { if (ready) void settle() }, [ready, settle])

  // The row is written by useCouple's backfill, which may land after our first
  // read — especially right after midnight, and on a cold start.
  useEffect(() => {
    if (!ready) return
    const onBackfill = () => { void settle() }
    window.addEventListener('eren:battle-backfilled', onBackfill)
    return () => window.removeEventListener('eren:battle-backfilled', onBackfill)
  }, [ready, settle])

  // The winner's crown. Yesterday's winner finds it on the cat this morning,
  // and so does the loser — which is the entire joke. Only ever put on a BARE
  // cat: silently replacing an accessory someone deliberately chose would be a
  // reward that takes something away.
  const crownedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!ready || !row || row.outcome !== 'win') return
    if (crownedRef.current === yesterday) return
    if (!trophies.loaded || !trophies.mine(WINNERS_CROWN)) return
    if (cos.accessory) return
    crownedRef.current = yesterday
    void cos.wear(WINNERS_CROWN)
  }, [ready, row, yesterday, trophies.loaded, cos.accessory]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => {
    setShow(false)
    if (!user?.id) return
    // Mark the row seen in local state as well as in both stores: if
    // localStorage is blocked AND the write is slow, a re-render before the
    // round-trip lands would otherwise put the screen straight back up.
    setRow(prev => (prev ? { ...prev, verdict_seen: true } : prev))
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
