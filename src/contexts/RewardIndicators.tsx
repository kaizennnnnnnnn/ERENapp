'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth, PROFILE_UPDATED_EVENT } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from './TaskContext'
import { createClient } from '@/lib/supabase/client'
import { withRetry, writeWithRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { freeFoodWait, untilFree, readSeenGames, unseenGames, seenGamesKey, REWARD_INDICATORS_CHANGED } from '@/lib/rewardIndicators'
import { pendingGameSaves, GAME_SAVED_EVENT } from '@/lib/gameSaves'
import { PLAYABLE_MINIGAME_IDS } from '@/lib/minigames'
import type { GameType } from '@/types'
import { useCare } from './CareContext'
import { readRewardNews, markRewardNewsSeen, rewardNewsKey, REWARD_NEWS_CHANGED, type RewardNewsTarget } from '@/lib/rewardNews'
import { readKioskNight, validKioskNight, nightRemaining, kioskNotice, pendingKioskBonuses, type KioskNight } from '@/lib/kioskNights'
import { pendingKioskSaves } from '@/lib/kioskSaves'
import { pendingSuperJellyFeeds } from '@/lib/superJellySaves'

export interface RewardAlerts {
  places: Partial<Record<'/gacha' | '/bakery' | '/jelly' | '/shawarma', string>>
  tabs: Partial<Record<'home' | 'play' | 'me', string>>
  newGames: GameType[]
  news: Partial<Record<RewardNewsTarget, boolean>>
  markNewsSeen: (target: RewardNewsTarget) => void
}
const EMPTY: RewardAlerts = { places: {}, tabs: {}, newGames: [], news: {}, markNewsSeen: () => {} }
const Context = createContext<RewardAlerts>(EMPTY)

export function RewardIndicatorsProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const home = profile?.household_id ?? null
  const { stats, loading: statsLoading } = useErenStats()
  const { pendingRewards, level, loading } = useTasks()
  const { activeScene } = useCare()
  const path = usePathname()
  const [now, setNow] = useState(0)
  const [rows, setRows] = useState<{ owner: string; gacha: Record<string, unknown> | null; supers: number; weekly: number } | null>(null)
  const [kiosk, setKiosk] = useState<KioskNight | null>(null)
  const [local, setLocal] = useState<{ owner: string; home: string | null; newGames: GameType[]; pending: number; kioskSaves: number; kioskBonuses: number; jellyFeeds: number; news: RewardAlerts['news'] } | null>(null)
  const seen = useRef<{ owner: string; ids: Set<string> } | null>(null)
  const current = useRef(user?.id); current.current = user?.id
  const currentHome = useRef(home); currentHome.current = home
  const version = useRef(0)
  const markNewsSeen = useCallback((target: RewardNewsTarget) => {
    if (user?.id && current.current === user.id) markRewardNewsSeen(user.id, target)
  }, [user?.id])
  const refresh = useCallback(async () => {
    const actor = user?.id
    if (!actor || current.current !== actor) return
    const read = ++version.current, db = createClient()
    const [response, nightStatus] = await Promise.all([
      writeWithRetry(signal => db.rpc('read_reward_indicators', { p_expected_user: actor }).abortSignal(signal),
        2, error => !['PGRST202', '42883'].includes(error.code ?? '')),
      home ? readKioskNight(db, actor, home) : Promise.resolve(null),
    ])
    if (current.current !== actor || currentHome.current !== home || read !== version.current) return
    setKiosk(home && nightStatus && !nightStatus.error && validKioskNight(nightStatus.data as KioskNight, actor, home)
      ? { ...(nightStatus.data as KioskNight), receivedAt: performance.now() } : null)
    if (!response.error) {
      const data = response.data
      const valid = data?.ok && data.user_id === actor && data.gacha && typeof data.gacha === 'object'
        && Number.isSafeInteger(data.supers) && data.supers >= 0 && Number.isSafeInteger(data.weekly) && data.weekly >= 0
      setRows(valid ? { owner: actor, gacha: data.gacha, supers: data.supers, weekly: data.weekly } : null)
      setNow(Date.now())
      return
    }
    if (!['PGRST202', '42883'].includes(response.error.code ?? '')) { setRows(null); return }
    // Old SQL still supports donut/Jelly badges; the new food offer stays off.
    const [gacha, jelly, weekly] = await Promise.all([
      withRetry(() => db.from('user_gacha_state').select('*').eq('user_id', actor).maybeSingle()),
      withRetry(() => db.from('jelly_progress').select('supers').eq('user_id', actor).maybeSingle()),
      withRetry(() => db.from('weekly_game_results').select('payout_coins').eq('user_id', actor).eq('payout_paid', false).gt('payout_coins', 0).limit(20)),
    ])
    if (current.current !== actor || read !== version.current) return
    setRows({ owner: actor, gacha: gacha.error ? null : gacha.data ?? { last_free_donut: null, gacha_tickets: 0 },
      supers: !jelly.error && Number.isSafeInteger(jelly.data?.supers) ? Math.max(0, jelly.data!.supers) : 0,
      weekly: weekly.error ? 0 : weekly.data?.length ?? 0 })
    setNow(Date.now())
  }, [user?.id, home])

  useEffect(() => {
    if (!kiosk || kiosk.user_id !== user?.id || kiosk.household_id !== home) return
    const timer = setTimeout(() => { void refresh() }, nightRemaining(kiosk) + 100)
    return () => clearTimeout(timer)
  }, [kiosk, user?.id, home, refresh])

  useEffect(() => {
    const actor = user?.id
    if (!actor) { setRows(null); setLocal(null); setKiosk(null); return }
    let dead = false, timer: ReturnType<typeof setTimeout> | undefined
    const syncLocal = () => {
      if (dead || current.current !== actor) return
      let storage: Storage | null = null
      try { storage = localStorage } catch { /* Optional. */ }
      if (seen.current?.owner !== actor) seen.current = { owner: actor, ids: readSeenGames(storage, actor) }
      const opened = PLAYABLE_MINIGAME_IDS.find(id => path === '/games/' + id.replaceAll('_', '-'))
      if (opened) seen.current.ids.add(opened)
      try { storage?.setItem(seenGamesKey(actor), JSON.stringify(Array.from(seen.current.ids))) } catch { /* Memory remains current. */ }
      if (path === '/profile' && !loading) markRewardNewsSeen(actor, 'profile', false)
      if (path === '/games') markRewardNewsSeen(actor, 'play', false)
      if (activeScene === 'feed') markRewardNewsSeen(actor, 'kitchen', false)
      if (path === '/shawarma') markRewardNewsSeen(actor, 'kiosk', false)
      const news = readRewardNews(actor)
      setLocal({ owner: actor, home, newGames: unseenGames(seen.current.ids), pending: home ? pendingGameSaves(actor, home).length : 0,
        kioskSaves: home ? pendingKioskSaves(actor, home).length : 0, kioskBonuses: home ? pendingKioskBonuses(actor, home).length : 0,
        jellyFeeds: home ? pendingSuperJellyFeeds(actor, home).length : 0,
        news: Object.fromEntries(Object.entries(news).map(([target, group]) => [target, group.unread.length > 0])) })
    }
    const sync = () => { if (!dead) { syncLocal(); void refresh() } }
    const changed = () => { clearTimeout(timer); timer = setTimeout(sync, 150) }
    const storageChanged = (event: StorageEvent) => {
      if (event.key === seenGamesKey(actor)) { seen.current = null; syncLocal() }
      if (event.key === rewardNewsKey(actor)) syncLocal()
    }
    const newsChanged = (event: Event) => { if ((event as CustomEvent<{ actor: string }>).detail?.actor === actor) syncLocal() }
    sync()
    const off = onForeground(sync)
    const poll = setInterval(() => { if (document.visibilityState === 'visible') sync() }, 60_000)
    const clock = setInterval(() => { if (document.visibilityState === 'visible') setNow(Date.now()) }, 15_000)
    const events = [REWARD_INDICATORS_CHANGED, PROFILE_UPDATED_EVENT, GAME_SAVED_EVENT, 'eren:rewards-claimed']
    events.forEach(name => window.addEventListener(name, changed))
    window.addEventListener('storage', storageChanged)
    window.addEventListener(REWARD_NEWS_CHANGED, newsChanged)
    return () => { dead = true; version.current++; clearTimeout(timer); clearInterval(poll); clearInterval(clock); off()
      events.forEach(name => window.removeEventListener(name, changed)); window.removeEventListener('storage', storageChanged); window.removeEventListener(REWARD_NEWS_CHANGED, newsChanged) }
  }, [user?.id, profile?.household_id, path, activeScene, loading, refresh])

  const known = rows?.owner === user?.id ? rows : null
  const localKnown = local && local.owner === user?.id && local.home === home ? local : null
  const places: RewardAlerts['places'] = {}
  if (known?.gacha) {
    if (untilFree(known.gacha.last_free_donut, now) === 0) places['/bakery'] = 'A free donut is ready'
    const free = freeFoodWait(known.gacha, now) === 0
    const tickets = typeof known.gacha.gacha_tickets === 'number' && known.gacha.gacha_tickets > 0
    if (free || tickets) places['/gacha'] = free ? 'A free food pull is ready' : 'Gacha tickets are ready to use'
  }
  if (known && known.supers > 0) places['/jelly'] = `${known.supers} Super ${known.supers === 1 ? 'Jelly is' : 'Jellies are'} ready`
  if (localKnown?.jellyFeeds) places['/jelly'] = 'A Super Jelly feed needs confirmation'
  const kioskNight = kiosk?.user_id === user?.id && kiosk?.household_id === home ? kiosk : null
  const energy = !statsLoading && stats?.household_id === home && typeof stats.energy === 'number' ? stats.energy : null
  const kioskAlert = kioskNotice(kioskNight, energy, localKnown?.kioskSaves ?? 0, localKnown?.kioskBonuses ?? 0, Boolean(localKnown?.news.kiosk))
  if (kioskAlert) places['/shawarma'] = kioskAlert
  const tabs: RewardAlerts['tabs'] = {}
  if (Object.keys(places).length || pendingRewards > 0 || localKnown?.news.quests || localKnown?.news.kitchen || localKnown?.news.menu) tabs.home = 'A free or newly received reward is waiting'
  if (localKnown?.newGames.length || known?.weekly || localKnown?.pending || localKnown?.news.play) tabs.play = localKnown?.newGames.length ? 'New games are waiting' : 'A game reward is waiting'
  if (!loading && profile && profile.id === user?.id && typeof profile.claimed_level === 'number' && level > profile.claimed_level) tabs.me = 'Level rewards are waiting'
  if (localKnown?.news.profile) tabs.me = 'New rewards are ready to view'
  return <Context.Provider value={{ places, tabs, newGames: localKnown?.newGames ?? [], news: localKnown?.news ?? {}, markNewsSeen }}>{children}</Context.Provider>
}
export const useRewardIndicators = () => useContext(Context)
