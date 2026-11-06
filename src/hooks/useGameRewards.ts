'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth, PROFILE_UPDATED_EVENT, type ProfileUpdatedDetail } from '@/hooks/useAuth'
import { onForeground } from '@/lib/onForeground'
import { prepareGameResult, pendingGameSaves, saveGameResult, validGameResult, gameSaveError, GAME_SAVED_EVENT, type ReportGameResultOpts } from '@/lib/gameSaves'
import type { PendingSavedRequest } from '@/lib/savedRpc'
import type { GameType } from '@/types'
import { receiveRewardNews } from '@/lib/rewardNews'

export type { ReportGameResultOpts } from '@/lib/gameSaves'
export interface GameRewardResult {
  requestId: string
  status: 'saving' | 'error' | 'saved'
  coins: number; blocked: boolean; energy: number; balance: number; scoreSaved?: boolean; error?: string
}

/** Confirm score + wallet together. Each new round keeps its own recoverable receipt. */
export function useGameRewards(gameType?: GameType) {
  const { user, profile } = useAuth()
  const householdId = profile?.household_id
  const supabase = createClient()
  const [reward, setReward] = useState<GameRewardResult | null>(null)
  const [pending, setPending] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const scope = useRef({ actor: user?.id, householdId, gameType })
  scope.current = { actor: user?.id, householdId, gameType }
  const run = useRef<PendingSavedRequest | null>(null)
  const activeCount = useRef(0)
  const recoveryLock = useRef<symbol | null>(null)
  const epoch = useRef(0)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const perform = useCallback(async (request: PendingSavedRequest) => {
    const actor = user?.id
    const generation = epoch.current
    const active = () => mounted.current && epoch.current === generation && scope.current.actor === actor && scope.current.householdId === householdId && scope.current.gameType === gameType
    if (!actor || !householdId || !active()) return false
    activeCount.current++; setBusy(true); setError(null)
    if (run.current?.id === request.id) setReward(old => old?.requestId === request.id ? { ...old, status: 'saving', error: undefined } : old)
    try {
      const result = await saveGameResult(supabase, actor, request, active)
      if (!active()) return false
      if (!result.ok || !validGameResult(result, actor, request)) {
        const message = gameSaveError(result.reason)
        setError(message)
        if (run.current?.id === request.id) setReward(old => old?.requestId === request.id ? { ...old, status: 'error', error: message } : old)
        return false
      }
      window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, { detail: { id: actor, patch: { coins: result.coins! } } }))
      window.dispatchEvent(new CustomEvent(GAME_SAVED_EVENT, { detail: { userId: actor, gameType: result.game_type, score: result.score } }))
      if (run.current?.id !== request.id && result.awarded! > 0) receiveRewardNews(actor, 'play', `run:${request.id}`)
      if (run.current?.id === request.id) setReward({ requestId: request.id, status: 'saved', coins: result.awarded!,
        blocked: result.blocked!, energy: result.energy!, balance: result.coins!, scoreSaved: Boolean(result.score_id) })
      return true
    } finally {
      if (active()) {
        activeCount.current--; setBusy(activeCount.current > 0)
        setPending(pendingGameSaves(actor, householdId, gameType).length)
      }
    }
  }, [user?.id, householdId, gameType]) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(async () => {
    const actor = user?.id
    if (!actor || !householdId || recoveryLock.current || scope.current.actor !== actor || scope.current.householdId !== householdId) return
    const token = Symbol('game-recovery'); recoveryLock.current = token
    const generation = epoch.current
    try {
      for (const request of pendingGameSaves(actor, householdId, gameType)) {
        if (!mounted.current || epoch.current !== generation || scope.current.actor !== actor || scope.current.householdId !== householdId) break
        await perform(request)
      }
    } finally { if (recoveryLock.current === token) recoveryLock.current = null }
  }, [user?.id, householdId, gameType, perform])

  useEffect(() => {
    run.current = null; recoveryLock.current = null; activeCount.current = 0
    setReward(null); setError(null); setBusy(false)
    setPending(user?.id && householdId ? pendingGameSaves(user.id, householdId, gameType).length : 0)
    void retry()
    const off = onForeground(() => { void retry() })
    return () => { epoch.current++; off() }
  }, [user?.id, householdId, gameType, retry])

  const reportGameResult = useCallback((opts: ReportGameResultOpts) => {
    if (!user?.id || !householdId || run.current || !mounted.current
      || scope.current.actor !== user.id || scope.current.householdId !== householdId || (gameType && opts.gameType !== gameType)) return
    try {
      const request = prepareGameResult(user.id, householdId, opts)
      run.current = request
      setReward({ requestId: request.id, status: 'saving', coins: 0, blocked: false, energy: 0, balance: 0 })
      setPending(pendingGameSaves(user.id, householdId, gameType).length)
      void perform(request)
    } catch {
      setReward({ requestId: 'invalid', status: 'error', coins: 0, blocked: false, energy: 0, balance: 0, error: gameSaveError('bad_result') })
    }
  }, [user?.id, householdId, gameType, perform])
  const clearReward = useCallback(() => { run.current = null; setReward(null) }, [])
  return { reportGameResult, reward, clearReward, retry, pending, busy, error }
}
