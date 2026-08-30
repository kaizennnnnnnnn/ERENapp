'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useTrophyEffects — the household's live privileges.
//
// One provider, because four unrelated surfaces need the same rows: the daily
// scorer (double hour, point steal), the decay loop (freeze), Eren's speech
// bubble (Eren Says) and the shop's own "already running" state.
//
// Realtime, because a privilege fired on her phone has to change what happens
// on yours — a Point Steal that only showed up on the buyer's screen would be
// a lie about a shared scoreboard.
// ═══════════════════════════════════════════════════════════════════════════

import {
  useState, useEffect, useCallback, useRef,
  createContext, useContext, createElement, type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from './useAuth'
import {
  fetchEffects, fireEffect, scoreModsFor, erenSaysFor, decayFrozenUntil, liveOf,
  publishDecayFreeze,
  type TrophyEffectRow, type EffectKind, type ScoreMods,
} from '@/lib/trophyEffects'

/** How far back to read. A day covers every effect that can still be live. */
const LOOKBACK_MS = 36 * 60 * 60 * 1000

export interface TrophyEffectsState {
  rows: TrophyEffectRow[]
  /** Adjustments for TODAY, ready for scoreDaily. */
  mods: ScoreMods
  /** The line my partner paid to have Eren say to me, or null. */
  erenSays: string | null
  /** Epoch ms the stat decay is frozen until; 0 when it is not. */
  frozenUntil: number
  /** Is one of my own double hours running right now? */
  myDoubleLive: boolean
  fire(kind: EffectKind, minutes: number, payload?: Record<string, unknown>): Promise<boolean>
  refresh(): Promise<void>
}

const Ctx = createContext<TrophyEffectsState | null>(null)

let _chan = 0

function useImpl(): TrophyEffectsState {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const hh = profile?.household_id ?? null
  const [rows, setRows] = useState<TrophyEffectRow[]>([])
  // Effects expire on the clock, not on an event, so the derived values have
  // to be recomputed periodically or a finished Double Hour keeps scoring.
  const [, setTick] = useState(0)
  const suffix = useRef(`tfx_${++_chan}`)

  const refresh = useCallback(async () => {
    if (!hh) return
    const since = new Date(Date.now() - LOOKBACK_MS).toISOString()
    setRows(await fetchEffects(supabase, hh, since))
  }, [hh]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => onForeground(() => { void refresh() }), [refresh])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!hh) return
    const ch = supabase
      .channel(`trophy_effects:${hh}:${suffix.current}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'trophy_effects',
        filter: `household_id=eq.${hh}`,
      }, payload => {
        const row = payload.new as TrophyEffectRow
        setRows(prev => (prev.some(r => r.id === row.id) ? prev : [...prev, row]))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [hh]) // eslint-disable-line react-hooks/exhaustive-deps

  const fire = useCallback(async (
    kind: EffectKind, minutes: number, payload: Record<string, unknown> = {},
  ) => {
    if (!hh || !user?.id) return false
    const ok = await fireEffect(supabase, hh, user.id, kind, minutes, payload)
    if (ok) await refresh()
    return ok
  }, [hh, user?.id, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const dayStart = start.getTime()
  const frozenUntil = decayFrozenUntil(rows)

  // Hand the freeze to the decay loop, which sits above this provider and so
  // cannot read it through context.
  useEffect(() => { publishDecayFreeze(frozenUntil) }, [frozenUntil])

  return {
    rows,
    mods: scoreModsFor(rows, dayStart, dayStart + 86_400_000),
    erenSays: user?.id ? erenSaysFor(rows, user.id) : null,
    frozenUntil,
    myDoubleLive: !!user?.id && liveOf(rows, 'double_hour').some(r => r.user_id === user.id),
    fire,
    refresh,
  }
}

export function TrophyEffectsProvider({ children }: { children: ReactNode }) {
  return createElement(Ctx.Provider, { value: useImpl() }, children)
}

export function useTrophyEffects(): TrophyEffectsState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTrophyEffects must be used inside <TrophyEffectsProvider>')
  return ctx
}
