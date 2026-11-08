'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, PROFILE_UPDATED_EVENT } from './useAuth'
import { useErenStats } from './useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { createClient } from '@/lib/supabase/client'
import { onForeground } from '@/lib/onForeground'
import { notifyRewardIndicators } from '@/lib/rewardIndicators'
import { getJelly, type JellyGame } from '@/lib/jellies'
import { JELLY_ROUND_SAVED_EVENT, pendingJellyRounds, prepareJellyRound, saveJellyRound, jellyRoundError, type JellyRoundSave } from '@/lib/jellyRoundSaves'
import type { PendingSavedRequest } from '@/lib/savedRpc'
import type { JellyWin } from './useJellies'

export interface JellyRoundResult extends JellyRoundSave { prizes: JellyWin[]; trayCount: number }
export function useJellyRound(game: JellyGame) {
  const { user, profile } = useAuth(), actor = user?.id, home = profile?.household_id
  const { refetch } = useErenStats(home ?? null)
  const { completeTask } = useTasks()
  const [result, setResult] = useState<JellyRoundResult | null>(null)
  const [pending, setPending] = useState(0), [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null)
  const scope = useRef({ actor, home, game }); scope.current = { actor, home, game }
  const epoch = useRef(0), mounted = useRef(true), lock = useRef<symbol | null>(null), run = useRef<PendingSavedRequest | null>(null)
  const sync = useCallback(() => { setPending(actor && home ? pendingJellyRounds(actor, home, game).length : 0) }, [actor, home, game])
  useEffect(() => {
    mounted.current = true; run.current = null; lock.current = null
    setResult(null); setError(null); setSaving(false); sync()
    const off = onForeground(sync)
    return () => { mounted.current = false; epoch.current++; off() }
  }, [actor, home, game, sync])

  const perform = useCallback(async (request: PendingSavedRequest) => {
    const generation = epoch.current
    const active = () => mounted.current && epoch.current === generation && scope.current.actor === actor && scope.current.home === home && scope.current.game === game
    if (!actor || !home || !active() || lock.current) return
    const token = Symbol('jelly-round'); lock.current = token; setSaving(true); setError(null)
    try {
      const response = await saveJellyRound(createClient(), actor, request, active)
      if (!active()) return
      if (!response.ok) { setError(jellyRoundError(response.reason)); return }
      const saved = response as JellyRoundSave
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { id: actor, patch: { coins: saved.coins } } }))
      window.dispatchEvent(new CustomEvent(JELLY_ROUND_SAVED_EVENT, { detail: { user_id: actor, household_id: home, game } }))
      if (saved.score > 0) { void completeTask('daily_game'); void refetch() }
      setResult({ ...saved, prizes: saved.wins.map(w => ({ jelly: getJelly(w.flavour)!, effect: getJelly(w.flavour)!.effects[w.effect], isNew: w.is_new, mintedSuper: w.minted_super, trayCount: w.tray_count })),
        trayCount: saved.current_day === new Date().toISOString().slice(0, 10) ? saved.current_flavours.length : 0 })
    } catch {
      if (active()) setError(jellyRoundError())
    } finally {
      if (lock.current === token) lock.current = null
      if (active()) { setSaving(false); sync(); notifyRewardIndicators() }
    }
  }, [actor, home, game, completeTask, refetch, sync])

  const finish = useCallback(async (score: number) => {
    if (!actor || !home || !mounted.current || scope.current.actor !== actor || scope.current.home !== home || scope.current.game !== game || lock.current || run.current) return
    const old = pendingJellyRounds(actor, home, game)[0]
    if (old) { sync(); setError(jellyRoundError()); return }
    try { run.current = prepareJellyRound(actor, home, game, score); sync(); notifyRewardIndicators(); await perform(run.current) }
    catch { if (mounted.current && scope.current.actor === actor && scope.current.home === home && scope.current.game === game) setError(jellyRoundError()) }
  }, [actor, home, game, perform, sync])
  const retry = useCallback(async () => {
    if (!actor || !home || !mounted.current || lock.current || scope.current.actor !== actor || scope.current.home !== home || scope.current.game !== game) return
    const request = pendingJellyRounds(actor, home, game)[0]
    if (request) { run.current = request; await perform(request) }
  }, [actor, home, game, perform])
  const clear = useCallback(() => {
    if (!actor || !home || !mounted.current || lock.current || scope.current.actor !== actor || scope.current.home !== home || scope.current.game !== game || pendingJellyRounds(actor, home, game).length) return false
    run.current = null; setResult(null); setError(null); return true
  }, [actor, home, game])
  const visibleResult = result?.user_id === actor && result?.household_id === home && result?.game === game ? result : null
  return { result: visibleResult, pending, saving, error, finish, retry, clear }
}
