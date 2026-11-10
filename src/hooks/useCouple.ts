'use client'

import { useEffect, useState, useCallback, useRef, useMemo, createContext, useContext, createElement, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { writeWithRetry } from '@/lib/supabaseRetry'
import { boundedRequest } from '@/lib/boundedRequest'
import { createCoupleReadQueue } from '@/lib/coupleReads'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from './useAuth'
import { useCat } from './useCat'
import type { Profile, JournalMessage, Interaction, GiftItem, UserMood, StreakData } from '@/types'
import { subDays } from 'date-fns'
import { computeLoveMeter, getAnniversaryInfo, startOfWeek, type LoveMeterResult, type AnniversaryInfo } from '@/lib/couple'
import { resolveNudgeMessage, isNudgeRow, type NudgeDef } from '@/lib/nudges'
import { moodDateKey } from '@/lib/moods'
import { FOOD_META } from '@/lib/foodMeta'
import {
  backfillDailyResults, fetchLifetimeRows, computeLifetimeWLT,
  ensureLastWeekResult, claimWeeklyPayout, acknowledgeWeeklyResult,
  WEEKLY_PAYOUT_COINS, lastIsoWeek,
  type LifetimeWLT, type WeeklyBattleRow,
} from '@/lib/battleResults'
import {
  countCoopByUser, claimCoopReward, thisIsoWeekKey, coopTargetFor,
  COOP_REWARD_COINS,
  type CoopGoalRow, type CoopGoalState,
} from '@/lib/coopGoal'
import { EREN_OPPONENT_ID, erenWeeklyPace } from '@/lib/erenOpponent'

// Module-level counter so every useCouple instance picks a unique
// realtime channel name even when several mount in the same React
// commit (very common — the home page alone has ~5 consumers).
let _coupleChannelCounter = 0

// Internal implementation. Only the provider below calls this — every
// consumer of useCouple() (home, hallway, couple, ThoughtCloud, JealousEren,
// WishProvider, DailyBattlePop via useDailyBattle) used to mount its own
// realtime channel on `couple_journal`. The shared layout had 5+ of them
// listening simultaneously, which is half of the WAL-routing IO cost.
function useCoupleImpl() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const cat = useCat()

  const [partner, setPartner] = useState<Profile | null>(null)
  const [partnerStreak, setPartnerStreak] = useState<StreakData | null>(null)
  const [loveMeter, setLoveMeter] = useState<LoveMeterResult | null>(null)
  const [anniversary, setAnniversary] = useState<AnniversaryInfo | null>(null)
  const [householdSince, setHouseholdSince] = useState<string | null>(null)
  const [journal, setJournal] = useState<JournalMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [newMessage, setNewMessage] = useState<JournalMessage | null>(null) // for popup
  // ── Note board ──
  // Everything Eren delivered (via_eren): ThoughtCloud notes, food gifts and
  // nudges. A separate keepsake surface from the chat — these rows never
  // enter `journal`, and unlike the popup they're kept forever.
  const [notes, setNotes] = useState<JournalMessage[]>([])
  // When I last opened the board. Unread is DERIVED from this rather than
  // counted, so a note arriving while the board is open can't desync it.
  const [notesReadAt, setNotesReadAt] = useState(0)
  // When I was last SHOWN the gifts waiting for me. Deliberately a different
  // marker from notesReadAt: the welcome-back tray must not silence an unread
  // written note, and opening the board must not swallow the tray. null means
  // "not resolved yet" -- nothing may render off this until it is a number,
  // or the tray flashes up for a frame on every mount.
  const [giftsSeenAt, setGiftsSeenAt] = useState<number | null>(null)
  const [partnerMood, setPartnerMood] = useState<UserMood | null>(null)
  const [partnerMoodWeek, setPartnerMoodWeek] = useState<{ date: string; mood: UserMood | null }[]>([])
  const [lifetimeWLT, setLifetimeWLT] = useState<LifetimeWLT | null>(null)
  const [weeklyChampion, setWeeklyChampion] = useState<WeeklyBattleRow | null>(null)
  // "We Cared" co-op goal — combined useful care actions this week (derived
  // from the same interactions the love meter reads) + my claim row for the week.
  const [coopCombined, setCoopCombined] = useState(0)
  const [coopMine, setCoopMine] = useState(0)
  const [coopPartner, setCoopPartner] = useState(0)
  const [coopRow, setCoopRow] = useState<CoopGoalRow | null>(null)
  // True once my coop-row has been successfully read this session. coopRow null
  // is ambiguous (never-claimed OR read-failed/not-yet-loaded), so consumers
  // that surface an "unclaimed reward" cue must wait for this before trusting it.
  const [coopRowLoaded, setCoopRowLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  // Per-instance channel name. useCouple is currently instantiated by
  // 5+ components on the home screen (page, ThoughtCloud, JealousEren,
  // DailyBattleHUD/Pop via useDailyBattle). Date.now() alone collides
  // when several instances mount in the same React commit, which
  // Supabase rejects with "cannot add `postgres_changes` callbacks
  // after `subscribe()`" because the second instance gets the
  // already-subscribed channel back. The counter + random suffix
  // guarantees uniqueness.
  const channelRef = useRef<string>(`couple_${++_coupleChannelCounter}_${Math.random().toString(36).slice(2, 8)}`)
  // The partner read specifically failed, as opposed to returning no rows.
  // A ref cannot carry this: `isSolo` is computed during render and has to
  // re-evaluate when the answer changes, so it needs state.
  const [partnerUnknown, setPartnerUnknown] = useState(false)
  const readScope = useRef({ actor: user?.id, home: profile?.household_id })
  if (readScope.current.actor !== user?.id || readScope.current.home !== profile?.household_id) readScope.current = { actor: user?.id, home: profile?.household_id }
  const currentReadScope = readScope.current
  const [dataScope, setDataScope] = useState(currentReadScope)
  const mounted = useRef(true)
  const isCurrent = useCallback(() => mounted.current && readScope.current === currentReadScope, [currentReadScope])
  const reads = useMemo(() => createCoupleReadQueue(isCurrent), [isCurrent])
  const partnerRead = useRef<{ ready: boolean; value: Profile | null }>({ ready: false, value: null })
  const householdDate = useRef<string | null>(null)
  const historyStamp = useRef<string | null>(null)
  const myName = useRef(profile?.name ?? ''); myName.current = profile?.name ?? ''
  const seenMessages = useRef(new Set<string>())

  useEffect(() => {
    mounted.current = true
    setDataScope(currentReadScope)
    partnerRead.current = { ready: false, value: null }; householdDate.current = null; historyStamp.current = null; seenMessages.current.clear()
    setPartner(null); setPartnerStreak(null); setPartnerUnknown(false); setLoading(true)
    setAnniversary(null); setHouseholdSince(null); setLoveMeter(null); setJournal([]); setNotes([]); setUnreadCount(0); setNewMessage(null)
    setPartnerMood(null); setPartnerMoodWeek([]); setLifetimeWLT(null); setWeeklyChampion(null)
    setCoopCombined(0); setCoopMine(0); setCoopPartner(0); setCoopRow(null); setCoopRowLoaded(false)
    setNotesReadAt(0); setGiftsSeenAt(null)
    return () => { mounted.current = false; reads.dispose() }
  }, [reads, currentReadScope])

  const refreshHousehold = useCallback(() => reads.run('household', async accept => {
    if (!currentReadScope.home) return
    if (!householdDate.current) {
      const { data, error } = await writeWithRetry(signal => supabase.from('households').select('created_at').eq('id', currentReadScope.home!).abortSignal(signal).maybeSingle(), 2, undefined, { budgetMs: 6000 })
      if (!accept() || error) return
      if (data?.created_at) { householdDate.current = data.created_at; setHouseholdSince(data.created_at) }
    }
    if (accept() && householdDate.current) setAnniversary(getAnniversaryInfo(householdDate.current))
  }), [reads, currentReadScope]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshMessages = useCallback(() => reads.run('messages', async accept => {
    const { actor, home } = currentReadScope
    if (!actor || !home) return
    const [chat, board] = await Promise.all([
      writeWithRetry(signal => supabase.from('couple_journal').select('*, profile:profiles!sender_id(*)').eq('household_id', home)
        .or('via_eren.is.null,via_eren.eq.false').order('created_at', { ascending: false }).limit(50).abortSignal(signal), 2, undefined, { budgetMs: 6000 }),
      writeWithRetry(signal => supabase.from('couple_journal').select('*, profile:profiles!sender_id(*)').eq('household_id', home)
        .eq('via_eren', true).is('eren_state', null).order('created_at', { ascending: false }).limit(200).abortSignal(signal), 2, undefined, { budgetMs: 6000 }),
    ])
    if (!accept()) return
    // Successful empty lists reconcile deletions; failures retain the previous lists.
    if (!chat.error) {
      const rows = (chat.data ?? []) as JournalMessage[]
      rows.forEach(row => seenMessages.current.add(row.id))
      setJournal(rows)
      let lastRead = 0
      try { lastRead = Date.parse(localStorage.getItem(`eren_journal_read_${actor}`) ?? '') || 0 } catch { /* Optional storage. */ }
      setUnreadCount(rows.filter(row => row.sender_id !== actor && Date.parse(row.created_at) > lastRead).length)
      setNewMessage(previous => previous && !previous.via_eren && !rows.some(row => row.id === previous.id) ? null : previous)
    }
    if (!board.error) {
      const rows = (board.data ?? []) as JournalMessage[]
      rows.forEach(row => seenMessages.current.add(row.id))
      setNotes(rows)
      setNewMessage(previous => previous?.via_eren && !isNudgeRow(previous) && !rows.some(row => row.id === previous.id) ? null : previous)
    }
  }), [reads, currentReadScope]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPartner = useCallback(() => reads.run('partner', async accept => {
    const { actor, home } = currentReadScope
    if (!actor || !home) return
    const { data, error } = await writeWithRetry(signal => supabase.from('profiles').select('*').eq('household_id', home).neq('id', actor).abortSignal(signal), 2, undefined, { budgetMs: 6000 })
    if (!accept()) return
    if (error) {
      partnerRead.current.ready = false
      setPartnerUnknown(true); setLoading(false)
      return
    }
    const value = (data?.[0] ?? null) as Profile | null
    partnerRead.current = { ready: true, value }
    setPartner(value); setPartnerStreak((value?.streak as StreakData | undefined) ?? null)
    setPartnerUnknown(false); setLoading(false)
  }), [reads, currentReadScope]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshMoods = useCallback(() => {
    const p = partnerRead.current.value
    return reads.run(`moods:${p?.id ?? 'solo'}`, async accept => {
      if (!partnerRead.current.ready) return
      if (!p) { if (accept()) { setPartnerMoodWeek([]); setPartnerMood(null) }; return }
      const day = moodDateKey()
      const { data, error } = await writeWithRetry(signal => supabase.from('daily_moods').select('mood, date').eq('user_id', p.id)
        .gte('date', moodDateKey(subDays(new Date(), 6))).abortSignal(signal), 2, undefined, { budgetMs: 6000 })
      if (!accept() || error || partnerRead.current.value?.id !== p.id) return
      if (day !== moodDateKey()) { reads.invalidate(`moods:${p.id}`); return }
      const byDate = new Map<string, UserMood>((data ?? []).map(row => [row.date, row.mood as UserMood]))
      setPartnerMoodWeek(Array.from({ length: 7 }, (_, i) => {
        const date = moodDateKey(subDays(new Date(), 6 - i))
        return { date, mood: byDate.get(date) ?? null }
      }))
      setPartnerMood(byDate.get(moodDateKey()) ?? null)
    })
  }, [reads]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshCare = useCallback((changed = false) => reads.run('care', async accept => {
    const { actor, home } = currentReadScope
    if (!actor || !home || !partnerRead.current.ready) return
    const week = thisIsoWeekKey()
    const [care, claim] = await Promise.all([
      writeWithRetry(signal => supabase.from('interactions').select('*').eq('household_id', home).gte('created_at', startOfWeek().toISOString()).abortSignal(signal), 2, undefined, { budgetMs: 6000 }),
      writeWithRetry(signal => supabase.from('weekly_coop_results').select('*').eq('user_id', actor).eq('iso_week', week).abortSignal(signal).maybeSingle(), 2, undefined, { budgetMs: 6000 }),
    ])
    if (!accept() || !partnerRead.current.ready) return
    if (week !== thisIsoWeekKey()) { reads.invalidate('care'); return }
    const p = partnerRead.current.value
    if (!care.error) {
      const rows = (care.data ?? []) as Interaction[]
      setLoveMeter(p ? computeLoveMeter(rows, actor, myName.current, p.id, p.name)
        : computeLoveMeter(rows, actor, myName.current, EREN_OPPONENT_ID, '',
          erenWeeklyPace(week, (Date.now() - startOfWeek().getTime()) / (7 * 86400000))))
      const coop = countCoopByUser(rows, actor, p?.id ?? '')
      setCoopMine(coop.mine); setCoopPartner(coop.partner); setCoopCombined(coop.combined)
    }
    if (!claim.error) { setCoopRow((claim.data as CoopGoalRow | null) ?? null); setCoopRowLoaded(true) }
  }, changed), [reads, currentReadScope]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshResults = useCallback((force = false) => reads.run('results', async accept => {
    const { actor, home } = currentReadScope
    if (!actor || !home || !partnerRead.current.ready) return
    const p = partnerRead.current.value, stamp = `${moodDateKey()}:${p?.id ?? 'solo'}`
    if (!force && historyStamp.current === stamp) {
      // Claims can change on another device, even though yesterday's history cannot.
      const { data, error } = await writeWithRetry(signal => supabase.from('weekly_battle_results').select('*').eq('user_id', actor)
        .eq('iso_week', lastIsoWeek().key).abortSignal(signal).maybeSingle(), 2, undefined, { budgetMs: 6000 })
      if (!accept() || error || !partnerRead.current.ready) return
      if (`${moodDateKey()}:${partnerRead.current.value?.id ?? 'solo'}` !== stamp) { reads.invalidate('results'); return }
      setWeeklyChampion((data as WeeklyBattleRow | null) ?? null)
      return
    }
    const [lifetime, weekly] = await Promise.all([
      boundedRequest(async () => {
        await backfillDailyResults(supabase, home, actor, p?.id ?? '')
        if (!accept()) return undefined
        window.dispatchEvent(new Event('eren:battle-backfilled'))
        return fetchLifetimeRows(supabase, actor)
      }, { timeoutMs: 8000 }).catch(() => undefined),
      boundedRequest(() => ensureLastWeekResult(supabase, home, actor, p?.id ?? ''), { timeoutMs: 8000 }).catch(() => undefined),
    ])
    if (!accept() || !partnerRead.current.ready) return
    if (`${moodDateKey()}:${partnerRead.current.value?.id ?? 'solo'}` !== stamp) { reads.invalidate('results'); return }
    if (lifetime !== undefined) setLifetimeWLT(computeLifetimeWLT(lifetime))
    if (weekly !== undefined) setWeeklyChampion(weekly)
    if (lifetime !== undefined && weekly !== undefined) historyStamp.current = stamp
  }, force), [reads, currentReadScope]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async (force = false) => {
    if (!currentReadScope.actor || !currentReadScope.home || !isCurrent()) return
    // Messages are never held behind a stalled partner/history request.
    const independent = Promise.all([refreshMessages(), refreshHousehold()])
    await refreshPartner()
    if (isCurrent() && partnerRead.current.ready) await Promise.all([refreshMoods(), refreshCare(), refreshResults(force)])
    await independent
  }, [currentReadScope, isCurrent, refreshMessages, refreshHousehold, refreshPartner, refreshMoods, refreshCare, refreshResults])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const refetch = useCallback(() => fetchAll(true), [fetchAll])

  // Re-fetch on window focus + listen for read-timestamp changes
  useEffect(() => {
    if (!user?.id) return
    const recount = () => {
      if (!isCurrent()) return
      const lastReadMs = new Date(localStorage.getItem(`eren_journal_read_${user.id}`) ?? 0).getTime()
      setJournal(prev => {
        const unread = prev.filter(m => m.sender_id !== user.id && new Date(m.created_at).getTime() > lastReadMs).length
        setUnreadCount(unread)
        return prev
      })
    }
    const onActive = () => {
      recount()
      // Refetch unconditionally, not just after an outage. The realtime
      // channel subscribes to INSERT only, so a message the sender DELETED
      // stays on the other person's screen indefinitely — including one
      // deleted precisely because it should not have been sent. Returning to
      // the app is the natural moment to reconcile, and it also self-heals a
      // load that failed during a Supabase outage.
      void fetchAll()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === `eren_journal_read_${user.id}`) recount()
    }
    const onMarkedRead = () => recount()
    const offForeground = onForeground(onActive)
    window.addEventListener('storage', onStorage)
    window.addEventListener('eren:journal-read', onMarkedRead)
    const interval = setInterval(recount, 3000)
    return () => {
      offForeground()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('eren:journal-read', onMarkedRead)
      clearInterval(interval)
    }
  }, [user?.id, fetchAll, isCurrent])

  // ── Note board read marker ──
  // Mirrors localStorage into state so `unreadNotes` can be derived. Synced on
  // mount, on focus, on a write from another tab, and on markNotesRead() here.
  useEffect(() => {
    if (!user?.id) return
    const key = `eren_notes_read_${user.id}`
    const sync = () => { if (isCurrent()) setNotesReadAt(new Date(localStorage.getItem(key) ?? 0).getTime()) }
    sync()
    const onStorage = (e: StorageEvent) => { if (e.key === key) sync() }
    const offForeground = onForeground(sync)
    window.addEventListener('storage', onStorage)
    window.addEventListener('eren:notes-read', sync)
    return () => {
      offForeground()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('eren:notes-read', sync)
    }
  }, [user?.id, isCurrent])

  // ── Gift tray marker ──
  // Same mirroring contract as the board marker above, with one extra rule:
  // an ABSENT key is seeded to now rather than read as 0. Every gift already
  // in the pile predates this tray, so a missing marker would greet a
  // long-running household with its entire history on the next launch.
  // Seeding costs at most one delivery — a gift sent in the minutes before
  // that first launch — and that one is still pinned to the board.
  useEffect(() => {
    if (!user?.id) return
    const key = `eren_gifts_seen_${user.id}`
    const sync = () => {
      if (!isCurrent()) return
      const raw = localStorage.getItem(key)
      if (raw === null) {
        const now = new Date().toISOString()
        localStorage.setItem(key, now)
        setGiftsSeenAt(new Date(now).getTime())
        return
      }
      setGiftsSeenAt(new Date(raw).getTime())
    }
    sync()
    const onStorage = (e: StorageEvent) => { if (e.key === key) sync() }
    const offForeground = onForeground(sync)
    window.addEventListener('storage', onStorage)
    window.addEventListener('eren:gifts-seen', sync)
    return () => {
      offForeground()
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('eren:gifts-seen', sync)
    }
  }, [user?.id, isCurrent])

  // ── Realtime: listen for new journal messages ──
  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    const ch = supabase
      .channel(channelRef.current)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'couple_journal',
        filter: `household_id=eq.${profile.household_id}`,
      }, payload => {
        const msg = payload.new as JournalMessage
        if (!isCurrent() || msg.household_id !== profile.household_id || seenMessages.current.has(msg.id)) return
        seenMessages.current.add(msg.id)
        // A snapshot started before this INSERT must not erase it on completion.
        reads.invalidate('messages')
        // Eren-delivered rows are NOTES, not chat: they get pinned to the
        // board and pop the ErenMessagePopup, and they return before the
        // setJournal below — falling through to it is what used to make a
        // note show up inside the heart-button chat.
        if (msg.via_eren) {
          // …but only written notes and gifts get pinned. A nudge still pops,
          // it just leaves nothing behind.
          if (!isNudgeRow(msg)) {
            setNotes(prev => [msg, ...prev].slice(0, 200))
          }
          if (msg.sender_id !== user.id) {
            // Read localStorage rather than notesReadAt — this handler is
            // built once per household and would close over a stale value.
            const lastSeen = new Date(localStorage.getItem(`eren_notes_read_${user.id}`) ?? 0).getTime()
            if (isNudgeRow(msg) || new Date(msg.created_at).getTime() > lastSeen) setNewMessage(msg)
          }
          return
        }
        if (msg.sender_id !== user.id) {
          // Only count if the incoming message is newer than our read marker
          const lastReadMs = new Date(localStorage.getItem(`eren_journal_read_${user.id}`) ?? 0).getTime()
          if (new Date(msg.created_at).getTime() > lastReadMs) {
            setNewMessage(msg)
            setUnreadCount(c => c + 1)
          }
        }
        setJournal(prev => [msg, ...prev].slice(0, 50))
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED' && isCurrent()) { reads.invalidate('messages'); void refreshMessages() }
      })

    return () => { supabase.removeChannel(ch) }
  }, [profile?.household_id, user?.id, isCurrent, reads, refreshMessages]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send message (with optional food-gift attachment) ──
  // `gift` is moved from sender's per-user food pile → partner's pile BEFORE
  // calling this, so by the time the row lands, both fridges are already
  // consistent. The journal row just records the attachment for display.
  // An empty message body is allowed when a gift is attached.
  //
  // `viaEren` flag: when true, the message was sent through the
  // home-screen ThoughtCloud. The row is stamped with via_eren=true so
  // both the journal filter and the realtime handler route it to the
  // ErenMessagePopup only — and the push notification hides the body
  // and just says "Eren has a message for you".
  //
  // Resolves true only once the row exists. A failed insert used to resolve
  // like a success, so the journal sheet cleared the draft and a 503 or RLS
  // refusal lost the message with nothing on screen. Not wrapped in
  // withRetry: an insert whose response was lost may already have landed,
  // and a retry would post it twice. The journal sheet keeps the draft and
  // says so instead.
  const sendMessage = useCallback(async (text: string, gift?: GiftItem | null, viaEren = false): Promise<boolean> => {
    if (!user?.id || !profile?.household_id || !isCurrent()) return false
    const trimmed = text.trim()
    if (!trimmed && !gift) return false
    // The id comes back because the push route now needs it: a notification
    // may only mirror a message that already exists, so there is nothing to
    // announce until the row does.
    const { data: row, error } = await supabase.from('couple_journal').insert({
      household_id: profile.household_id,
      sender_id: user.id,
      message: trimmed,
      gift_item: gift ?? null,
      via_eren: viaEren,
    }).select('id').single()
    if (!isCurrent()) return false
    if (error || !row) {
      console.error('[useCouple] message insert failed', error)
      return false
    }
    // Memory Wall: signal first:message + any future message-frame predicates.
    // Skip the dispatch when this row is actually a nudge (via_eren) — those
    // already unlock first:nudge via the eren:nudge-sent event, no need to
    // double-fire first:message on the same insert.
    if (!viaEren) {
      try { window.dispatchEvent(new Event('eren:message-sent')) } catch { /* ignore */ }
    }
    // Fire-and-forget web-push to the partner. Works even when their PWA is
    // fully closed; the in-app realtime channel only fires when their tab is
    // alive, so this is the only path that covers a backgrounded-and-killed
    // app on iOS/Android.
    fetch('/api/notify-message', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message_id: row.id,
        // An Eren-delivered message keeps its text back so the partner has
        // to open the app to read it.
        hide_text: viaEren,
        // Deep-link a delivered note straight to the board. Tapping the push
        // used to land on /couple, i.e. the chat, which is not where the note is.
        to_notes: viaEren,
      }),
    }).catch(() => { /* best-effort */ })
    return true
  }, [user?.id, profile?.household_id, isCurrent]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send an Eren nudge (one-tap affectionate gesture) ──
  // Inserts a via_eren journal row carrying the SketchEren pose so the
  // recipient popup shows Eren striking that pose. Unlike sendMessage, the
  // push is sent with via_eren=false so the sweet line is *shown* in the
  // notification ("💌 {sender}: ...") rather than hidden. The DB via_eren
  // flag still routes it to the popup only (out of the journal list).
  // No cooldown — spamming nudges is part of the fun.
  const sendNudge = useCallback(async (nudge: NudgeDef): Promise<boolean> => {
    if (!user?.id || !profile?.household_id || !isCurrent()) return false

    // The "Thinking" nudge picks its heart emoji from the sender's own
    // profile colour rather than a hardcoded address.
    const messageText = resolveNudgeMessage(nudge, profile.heart)

    const { data: row, error } = await supabase.from('couple_journal').insert({
      household_id: profile.household_id,
      sender_id: user.id,
      message: messageText,
      via_eren: true,
      eren_state: nudge.state,
    }).select('id').single()
    if (!isCurrent() || error || !row) return false

    fetch('/api/notify-message', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message_id: row.id,
        // A nudge's whole point is the line itself, so unlike an Eren-delivered
        // message it is SHOWN in the banner. The row is still via_eren, which
        // is what keeps it out of the chat list and routes it to the popup.
        hide_text: false,
        // Not to_notes: a nudge is never pinned, so the push opens /couple —
        // where you'd send one back — and its text is already in the banner.
      }),
    }).catch(() => { /* best-effort */ })

    // Daily-quest + first-nudge achievement live in TaskContext; signal
    // both via a window event so we keep useCouple free of TaskContext.
    // Phase 3: detail carries the nudge id so useDailyWish can match
    // nudge-specific wishes (kiss, loveyou). Existing listeners ignore
    // the detail field — backwards compatible.
    try {
      window.dispatchEvent(new CustomEvent('eren:nudge-sent', { detail: { nudgeId: nudge.id } }))
    } catch { /* ignore */ }

    return true
  }, [user?.id, profile?.household_id, profile?.heart, isCurrent]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark all as read (saves timestamp to localStorage) ──
  const markAllRead = useCallback(() => {
    if (!user?.id || !isCurrent()) return
    // Stamp slightly in the future so lexicographic comparisons can't leave
    // an edge-case unread message from the same millisecond.
    localStorage.setItem(`eren_journal_read_${user.id}`, new Date(Date.now() + 1000).toISOString())
    setUnreadCount(0)
    setJournal(prev => prev.map(m => m.sender_id !== user.id ? { ...m, is_read: true } : m))
    // Notify other useCouple instances in the same tab — storage events
    // don't fire in the tab that did the write.
    try { window.dispatchEvent(new Event('eren:journal-read')) } catch { /* ignore */ }
  }, [user?.id, isCurrent])

  // ── Mark the note board as seen ──
  const markNotesRead = useCallback(() => {
    if (!user?.id || !isCurrent()) return
    const stamp = Date.now() + 1000
    localStorage.setItem(`eren_notes_read_${user.id}`, new Date(stamp).toISOString())
    setNotesReadAt(stamp)
    try { window.dispatchEvent(new Event('eren:notes-read')) } catch { /* ignore */ }
  }, [user?.id, isCurrent])

  // Stamp the gift tray as seen. The tray passes nothing — it showed
  // everything that was pending, so "now" is honest. The realtime popup
  // passes the one row it actually put on screen, so a second gift that
  // arrived in the same moment and never got its own popup is still waiting
  // in the tray next launch. Monotonic on purpose: the marker only ever
  // moves forward, whichever caller writes it.
  const markGiftsSeen = useCallback((through?: string) => {
    if (!user?.id || !isCurrent()) return
    const key = `eren_gifts_seen_${user.id}`
    const at = through ? new Date(through).getTime() : Date.now() + 1000
    const stamp = Math.max(at, new Date(localStorage.getItem(key) ?? 0).getTime())
    localStorage.setItem(key, new Date(stamp).toISOString())
    setGiftsSeenAt(stamp)
    try { window.dispatchEvent(new Event('eren:gifts-seen')) } catch { /* ignore */ }
  }, [user?.id, isCurrent])

  // ── Clear popup + mark as read ──
  // The popup carries any of the three kinds, so it clears whichever marker it
  // actually belongs to: dismissing a note must not silence the chat, and a
  // nudge — which is on no list at all — must not silence either.
  const dismissPopup = useCallback(() => {
    if (!isCurrent()) return
    const msg = newMessage
    setNewMessage(null)
    if (!user?.id || !msg) return
    if (msg.via_eren) {
      if (!isNudgeRow(msg)) markNotesRead()
      // A gift that popped live has already been delivered to their face.
      // Settling it here is what stops the welcome-back tray greeting them
      // with the same gift on the next launch.
      if (msg.gift_item) markGiftsSeen(msg.created_at)
      return
    }
    localStorage.setItem(`eren_journal_read_${user.id}`, new Date(Date.now() + 1000).toISOString())
    setUnreadCount(0)
    try { window.dispatchEvent(new Event('eren:journal-read')) } catch { /* ignore */ }
  }, [user?.id, newMessage, markNotesRead, markGiftsSeen, isCurrent])

  // ── Claim the weekly Care Battle payout + dismiss the popup ─────────────
  // Pays the 100-coin bonus on first successful claim (atomic via CAS on
  // payout_paid). Always stamps acknowledged=true so the popup never re-fires.
  const claimWeeklyChampion = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !weeklyChampion || !isCurrent()) return false
    reads.invalidate('results')
    let paid = false
    if (weeklyChampion.outcome === 'win' && !weeklyChampion.payout_paid) {
      paid = await claimWeeklyPayout(supabase, user.id, weeklyChampion.iso_week)
      if (paid) {
        window.dispatchEvent(new CustomEvent('eren:weekly-payout', {
          detail: { coins: WEEKLY_PAYOUT_COINS, isoWeek: weeklyChampion.iso_week },
        }))
      }
    }
    await acknowledgeWeeklyResult(supabase, user.id, weeklyChampion.iso_week)
    if (!isCurrent()) return paid
    reads.invalidate('results')
    setWeeklyChampion({ ...weeklyChampion, payout_paid: paid || weeklyChampion.payout_paid, acknowledged: true })
    return paid
  }, [user?.id, weeklyChampion, isCurrent, reads]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Claim my share of the "We Cared" co-op reward ──────────────────────────
  // Pays COOP_REWARD_COINS once (atomic CAS on payout_paid) when the household
  // has hit the shared target this week. Returns true if I was just paid.
  const claimCoopGoal = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !profile?.household_id || !isCurrent()) return false
    const target = coopTargetFor(!!partner)
    if (coopCombined < target) return false
    if (coopRow?.payout_paid) return false
    const coins = await claimCoopReward(supabase, profile.household_id, user.id, coopCombined, target)
    if (coins > 0) {
      window.dispatchEvent(new CustomEvent('eren:coop-payout', { detail: { coins } }))
    }
    if (!isCurrent()) return coins > 0
    reads.invalidate('care')
    // Stamp locally so the bar flips to "complete" without a refetch (CAS is
    // the source of truth; a sibling tab that lost the race just shows complete).
    setCoopRow({
      household_id: profile.household_id,
      user_id: user.id,
      iso_week: thisIsoWeekKey(),
      combined_actions: coopCombined,
      goal: target,
      payout_coins: COOP_REWARD_COINS,
      payout_paid: true,
    })
    setCoopRowLoaded(true)
    return coins > 0
  }, [user?.id, profile?.household_id, coopCombined, coopRow, partner, isCurrent, reads]) // eslint-disable-line react-hooks/exhaustive-deps

  // Delete one of your own messages. /terms §10 says you may remove
  // individual items before deleting your account; for journal rows that was
  // untrue until now, because the table had no DELETE policy for anyone.
  //
  // Own rows only, enforced by RLS as well as here. Both the chat and the
  // note board are backed by this table, so one function covers both — the
  // local removal touches both lists rather than guessing which the row is in.
  const deleteMessage = useCallback(async (id: string): Promise<boolean> => {
    if (!user?.id || !isCurrent()) return false
    const { error } = await supabase.from('couple_journal').delete().eq('id', id)
    if (!isCurrent() || error) return false
    reads.invalidate('messages')
    setJournal(prev => prev.filter(m => m.id !== id))
    setNotes(prev => prev.filter(m => m.id !== id))
    setNewMessage(prev => prev?.id === id ? null : prev)
    return true
  }, [user?.id, isCurrent, reads]) // eslint-disable-line react-hooks/exhaustive-deps

  const coopGoal: CoopGoalState = {
    combined: coopCombined,
    mine: coopMine,
    partner: coopPartner,
    target: coopTargetFor(!!partner),
    reward: COOP_REWARD_COINS,
    goalMet: coopCombined >= coopTargetFor(!!partner),
    claimed: !!coopRow?.payout_paid,
    loaded: coopRowLoaded,
  }

  // Notes from my partner that landed after my last visit to the board.
  const unreadNotes = notes.reduce((n, m) => (
    n + (m.sender_id !== user?.id && new Date(m.created_at).getTime() > notesReadAt ? 1 : 0)
  ), 0)

  // Gifts my partner left while I was away, oldest first so the tray reads in
  // the order they were given. Everything here is ALREADY in my fridge — the
  // qty moved at send time — so this is presentation, never a transaction.
  // Empty until the marker resolves, or the tray flashes on every mount.
  const giftArrivals = giftsSeenAt === null ? [] : notes
    .filter(m => (
      m.sender_id !== user?.id
      && !!m.gift_item
      && !!FOOD_META[m.gift_item.key]
      && new Date(m.created_at).getTime() > giftsSeenAt
    ))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Solo, the second seat is the household's cat, called whatever it is called
  // right now. Memoised so the meter keeps its identity between renders.
  const namedLoveMeter = useMemo(() => loveMeter ? { ...loveMeter,
    user1: { ...loveMeter.user1, name: profile?.name ?? '' },
    user2: { ...loveMeter.user2, name: loveMeter.user2.id === EREN_OPPONENT_ID ? cat.name : partner?.name ?? loveMeter.user2.name },
  } : null, [loveMeter, cat.name, profile?.name, partner?.name])

  const readyScope = dataScope === currentReadScope

  return {
    // A household of one, KNOWN to be so. Deliberately false while the fetch
    // is still in flight AND while the partner read is failing: `partner` is
    // null in both cases too, and anything that persists or pays out (trophy
    // settlement, the battle snapshot) must not treat a not-yet-loaded couple
    // as solo and settle them against Eren. `partnerUnknown` is the outage
    // half of that — see the bail in fetchAll.
    isSolo: readyScope && !loading && !partner && !partnerUnknown,
    partner: readyScope ? partner : null, partnerStreak: readyScope ? partnerStreak : null,
    loveMeter: readyScope ? namedLoveMeter : null, anniversary: readyScope ? anniversary : null,
    householdSince: readyScope ? householdSince : null, journal: readyScope ? journal : [], unreadCount: readyScope ? unreadCount : 0,
    notes: readyScope ? notes : [], unreadNotes: readyScope ? unreadNotes : 0, markNotesRead,
    giftArrivals: readyScope ? giftArrivals : [], markGiftsSeen,
    newMessage: readyScope ? newMessage : null, dismissPopup,
    partnerMood: readyScope ? partnerMood : null, partnerMoodWeek: readyScope ? partnerMoodWeek : [],
    lifetimeWLT: readyScope ? lifetimeWLT : null, weeklyChampion: readyScope ? weeklyChampion : null, claimWeeklyChampion,
    coopGoal: readyScope ? coopGoal : { ...coopGoal, loaded: false, claimed: false, goalMet: false, combined: 0, mine: 0, partner: 0 }, claimCoopGoal,
    sendMessage, sendNudge, deleteMessage, markAllRead, loading: !readyScope || loading,
    refetch,
  }
}

type CoupleApi = ReturnType<typeof useCoupleImpl>

const CoupleContext = createContext<CoupleApi | null>(null)

// Singleton provider — mounted once at (app)/layout.tsx. Owns the only
// realtime channel on `couple_journal` and the only journal/partner fetch.
export function CoupleProvider({ children }: { children: ReactNode }) {
  const value = useCoupleImpl()
  return createElement(CoupleContext.Provider, { value }, children)
}

// Public hook. Throws when used outside the provider so a missing wrap
// surfaces loudly rather than silently re-opening a per-consumer channel.
export function useCouple(): CoupleApi {
  const ctx = useContext(CoupleContext)
  if (!ctx) throw new Error('useCouple must be used inside <CoupleProvider>')
  return ctx
}
