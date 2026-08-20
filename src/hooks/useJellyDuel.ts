'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from './useAuth'

// ─── useJellyDuel ───────────────────────────────────────────────────────────
// The competitive half of the Jelly Parlour: your all-time best, and today's
// head-to-head against your partner.
//
// Both facts are queries over jelly_scores rather than stored counters, so a
// best score can never disagree with the run that produced it.
//
// Taking today's lead earns a bonus jelly. That's decided by an INSERT into
// jelly_duel_leads, not by a read: the primary key (household, user, game, day)
// means the row either lands — you hadn't claimed today's bonus yet — or it
// doesn't. No read-then-write race, and no way to farm it by trading the lead
// back and forth all evening, because your second lead of the day hits the same
// key. She can still earn hers by taking it back, which is the point.

export type JellyGame = 'slice' | 'jump'
const UNIQUE_VIOLATION = '23505'

/** UTC day string, matching the table's `day` default so both agree at midnight. */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface DuelState {
  /** Your best score ever in this game. */
  best: number
  /** Your best today — what her score has to beat. */
  mineToday: number
  /** Her best today, and who she is. 0 when she hasn't played yet. */
  theirsToday: number
  theirName: string | null
  loaded: boolean
}

export interface SubmitResult {
  /** A new all-time personal best. */
  isBest: boolean
  /** This run put you ahead of her for today. */
  tookLead: boolean
  /** ...and it was your first lead today, so a bonus jelly is owed. */
  bonusJelly: boolean
}

export function useJellyDuel(game: JellyGame) {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const householdId = profile?.household_id ?? null
  const [state, setState] = useState<DuelState>({
    best: 0, mineToday: 0, theirsToday: 0, theirName: null, loaded: false,
  })

  const load = useCallback(async () => {
    if (!user?.id || !householdId) return
    const day = today()

    const [mine, todays] = await Promise.all([
      withRetry(() => supabase
        .from('jelly_scores').select('score')
        .eq('user_id', user.id).eq('game', game)
        .order('score', { ascending: false }).limit(1)),
      withRetry(() => supabase
        .from('jelly_scores').select('user_id, score, profiles:user_id(name)')
        .eq('household_id', householdId).eq('game', game).eq('day', day)
        .order('score', { ascending: false })),
    ])
    // An outage must not read as "no scores" — that would show a 0 best and
    // hand out a bonus jelly for beating a partner score we simply couldn't see.
    if (mine.error || todays.error) return

    const rows = (todays.data ?? []) as { user_id: string; score: number; profiles: { name: string } | null }[]
    const mineRows = rows.filter(r => r.user_id === user.id)
    const theirRows = rows.filter(r => r.user_id !== user.id)
    setState({
      best: mine.data?.[0]?.score ?? 0,
      mineToday: mineRows.length ? Math.max(...mineRows.map(r => r.score)) : 0,
      theirsToday: theirRows.length ? Math.max(...theirRows.map(r => r.score)) : 0,
      theirName: theirRows[0]?.profiles?.name ?? null,
      loaded: true,
    })
  }, [user?.id, householdId, game]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load() }, [load])
  // Self-heal after an outage that outlasted withRetry's backoff.
  useEffect(() => {
    if (state.loaded) return
    return onForeground(() => { void load() })
  }, [state.loaded, load])

  const submit = useCallback(async (score: number): Promise<SubmitResult> => {
    const none: SubmitResult = { isBest: false, tookLead: false, bonusJelly: false }
    if (!user?.id || !householdId || score <= 0) return none

    const { error } = await supabase.from('jelly_scores')
      .insert({ household_id: householdId, user_id: user.id, game, score })
    if (error) return none

    const isBest = score > state.best
    // Only a CONFIRMED board counts: with `loaded` false we never saw her
    // score, and "beating" an unknown 0 would mint a bonus jelly for nothing.
    const tookLead = state.loaded && score > state.theirsToday && state.theirsToday > 0

    let bonusJelly = false
    if (tookLead) {
      const { error: leadErr } = await supabase.from('jelly_duel_leads')
        .insert({ household_id: householdId, user_id: user.id, game, day: today() })
      // Key violation = today's bonus is already yours. Anything else is a real
      // failure, and an unearned jelly is worse than a missed one.
      bonusJelly = !leadErr
      if (leadErr && leadErr.code !== UNIQUE_VIOLATION) bonusJelly = false
    }

    setState(s => ({
      ...s,
      best: Math.max(s.best, score),
      mineToday: Math.max(s.mineToday, score),
    }))
    return { isBest, tookLead, bonusJelly }
  }, [user?.id, householdId, game, state.best, state.theirsToday, state.loaded, supabase])

  return { ...state, submit, reload: load }
}
