'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { writeWithRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth, PROFILE_UPDATED_EVENT, type ProfileUpdatedDetail } from './useAuth'
import type { FortuneGiftDef } from '@/types'
import { FORTUNE_GIFTS, canClaimFortune } from '@/lib/fortune'
import { saveFortune, hasPendingFortune, fortuneSaveError, FORTUNE_SAVED_EVENT } from '@/lib/fortuneSaves'

export function useFortune() {
  const supabase = createClient()
  const { user } = useAuth()
  const [eligible, setEligible] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [readError, setReadError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoverable, setRecoverable] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [lastGift, setLastGift] = useState<FortuneGiftDef | null>(null)
  const alive = useRef(true)
  const activeUser = useRef(user?.id)
  const version = useRef(0)
  const lock = useRef<symbol | null>(null)
  activeUser.current = user?.id

  const cache = useCallback((stamp: string | null) => {
    if (!user?.id) return
    try {
      if (stamp) localStorage.setItem(`eren_fortune_last_${user.id}`, stamp)
      else localStorage.removeItem(`eren_fortune_last_${user.id}`)
    } catch { /* Cache is optional; only the server decides eligibility. */ }
  }, [user?.id])

  const refresh = useCallback(async () => {
    if (!user?.id || !alive.current || activeUser.current !== user.id || lock.current) return
    const ticket = ++version.current
    setRecoverable(hasPendingFortune(user.id))
    setReadError(false)
    const { data, error: failure } = await writeWithRetry(signal => supabase
      .from('user_gacha_state').select('last_free_fortune').eq('user_id', user.id)
      .abortSignal(signal).maybeSingle())
    if (!alive.current || activeUser.current !== user.id || version.current !== ticket) return
    const stamp = data ? data.last_free_fortune : null
    if (failure || stamp !== null && (typeof stamp !== 'string' || !Number.isFinite(Date.parse(stamp)))) {
      setReadError(true)
      setLoaded(false)
      return
    }
    setEligible(canClaimFortune(stamp))
    setLoaded(true)
    cache(stamp)
  }, [user?.id, cache]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    alive.current = true
    lock.current = null
    setLoaded(false); setReadError(false); setEligible(false); setError(null)
    setClaiming(false); setLastGift(null)
    setRecoverable(user?.id ? hasPendingFortune(user.id) : false)
    void refresh()
    return () => { alive.current = false; version.current++ }
  }, [user?.id, refresh])

  useEffect(() => {
    const off = onForeground(() => { void refresh() })
    const saved = (event: Event) => {
      if ((event as CustomEvent<{ userId: string }>).detail?.userId === user?.id) void refresh()
    }
    const storage = (event: StorageEvent) => {
      if (event.key === `eren_fortune_last_${user?.id}`) void refresh()
    }
    window.addEventListener(FORTUNE_SAVED_EVENT, saved)
    window.addEventListener('storage', storage)
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 60_000)
    return () => { off(); window.removeEventListener(FORTUNE_SAVED_EVENT, saved); window.removeEventListener('storage', storage); clearInterval(interval) }
  }, [user?.id, refresh])

  const canClaim = !!user?.id && (recoverable || loaded && !readError && eligible)
  const claimFortune = useCallback(async (): Promise<FortuneGiftDef | null> => {
    const actor = user?.id
    if (!actor || !alive.current || activeUser.current !== actor || lock.current || !canClaim) return null
    const token = Symbol('fortune')
    lock.current = token
    version.current++
    const active = () => alive.current && activeUser.current === actor && lock.current === token
    setClaiming(true); setError(null)
    try {
      const result = await saveFortune(supabase, actor)
      if (!active()) return null
      if (!result.ok) {
        setError(fortuneSaveError(result.reason))
        if (result.reason === 'cooldown' && typeof result.last_free_fortune === 'string') {
          setEligible(false); setLoaded(true); cache(result.last_free_fortune)
        }
        return null
      }
      const gift = FORTUNE_GIFTS.find(item => item.id === result.gift_id)
      if (result.user_id !== actor || !gift || !Number.isSafeInteger(result.coins)
        || typeof result.last_free_fortune !== 'string' || !Number.isFinite(Date.parse(result.last_free_fortune))) {
        setError(fortuneSaveError())
        return null
      }
      // The existing reveal owns the bag-to-counter shower on dismissal.
      if (gift.coinValue) window.dispatchEvent(new Event('eren:coin-claim'))
      window.dispatchEvent(new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, {
        detail: { id: actor, patch: { coins: result.coins } },
      }))
      setEligible(canClaimFortune(result.last_free_fortune)); setLoaded(true); setReadError(false)
      cache(result.last_free_fortune)
      setLastGift(gift)
      window.dispatchEvent(new CustomEvent(FORTUNE_SAVED_EVENT, { detail: { userId: actor } }))
      return gift
    } catch {
      if (active()) setError(fortuneSaveError())
      return null
    } finally {
      if (lock.current === token) {
        lock.current = null
        if (alive.current && activeUser.current === actor) {
          setClaiming(false)
          setRecoverable(hasPendingFortune(actor))
        }
      }
    }
  }, [user?.id, canClaim, cache]) // eslint-disable-line react-hooks/exhaustive-deps

  return { canClaim, claiming, claimFortune, lastGift, loaded, readError, error, recoverable, refresh }
}
