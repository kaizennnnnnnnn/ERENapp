'use client'

import { useEffect, useState, useCallback, useRef, createContext, useContext, createElement, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { Profile, JournalMessage, Interaction, GiftItem, UserMood, StreakData } from '@/types'
import { format, subDays } from 'date-fns'
import { computeLoveMeter, getAnniversaryInfo, startOfWeek, type LoveMeterResult, type AnniversaryInfo } from '@/lib/couple'
import { resolveNudgeMessage, type NudgeDef } from '@/lib/nudges'
import {
  backfillDailyResults, fetchLifetimeRows, computeLifetimeWLT,
  ensureLastWeekResult, claimWeeklyPayout, acknowledgeWeeklyResult,
  WEEKLY_PAYOUT_COINS,
  type LifetimeWLT, type WeeklyBattleRow,
} from '@/lib/battleResults'

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

  const [partner, setPartner] = useState<Profile | null>(null)
  const [partnerStreak, setPartnerStreak] = useState<StreakData | null>(null)
  const [loveMeter, setLoveMeter] = useState<LoveMeterResult | null>(null)
  const [anniversary, setAnniversary] = useState<AnniversaryInfo | null>(null)
  const [journal, setJournal] = useState<JournalMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [newMessage, setNewMessage] = useState<JournalMessage | null>(null) // for popup
  const [partnerMood, setPartnerMood] = useState<UserMood | null>(null)
  const [partnerMoodWeek, setPartnerMoodWeek] = useState<{ date: string; mood: UserMood | null }[]>([])
  const [lifetimeWLT, setLifetimeWLT] = useState<LifetimeWLT | null>(null)
  const [weeklyChampion, setWeeklyChampion] = useState<WeeklyBattleRow | null>(null)
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

  // ── Load partner, love meter, anniversary, journal ──
  const fetchAll = useCallback(async () => {
    if (!profile?.household_id || !user?.id) return

    // Partner
    const { data: members } = await supabase
      .from('profiles')
      .select('*')
      .eq('household_id', profile.household_id)
      .neq('id', user.id)
    const p = members?.[0] ?? null
    setPartner(p)
    setPartnerStreak((p?.streak as StreakData | undefined) ?? null)

    // Partner's recent moods — today's mood + a 7-day strip (gaps = null).
    if (p) {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const weekStartStr = format(subDays(new Date(), 6), 'yyyy-MM-dd')
      const { data: moodRows } = await supabase
        .from('daily_moods')
        .select('mood, date')
        .eq('user_id', p.id)
        .gte('date', weekStartStr)
      const byDate = new Map<string, UserMood>((moodRows ?? []).map(m => [m.date, m.mood as UserMood]))
      const week = Array.from({ length: 7 }, (_, i) => {
        const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
        return { date: d, mood: byDate.get(d) ?? null }
      })
      setPartnerMoodWeek(week)
      setPartnerMood(byDate.get(todayStr) ?? null)
    } else {
      setPartnerMoodWeek([])
      setPartnerMood(null)
    }

    // Anniversary
    const { data: household } = await supabase
      .from('households')
      .select('created_at')
      .eq('id', profile.household_id)
      .single()
    if (household) {
      setAnniversary(getAnniversaryInfo(household.created_at))
    }

    // Love meter — interactions since Monday 00:00. The window is
    // weekly so the scoreboard resets every Monday automatically: a
    // partner can come back from behind without staring down a
    // 30-day deficit.
    const weekStart = startOfWeek().toISOString()
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('household_id', profile.household_id)
      .gte('created_at', weekStart)

    if (interactions && p) {
      setLoveMeter(computeLoveMeter(
        interactions as Interaction[],
        user.id, profile.name,
        p.id, p.name,
      ))
    }

    // Lifetime W-L-T: backfill any missing daily snapshots in the lookback
    // window, then aggregate. Backfill is idempotent (ignoreDuplicates).
    if (p) {
      try {
        await backfillDailyResults(supabase, profile.household_id, user.id, p.id)
        const rows = await fetchLifetimeRows(supabase, user.id)
        setLifetimeWLT(computeLifetimeWLT(rows))
      } catch { /* ignore — UI hides empty W-L-T */ }
    }

    // Last week's Care Battle result. Computed once and persisted; if I won
    // and haven't been paid yet, the consumer surfaces the popup.
    if (p) {
      try {
        const wk = await ensureLastWeekResult(supabase, profile.household_id, user.id, p.id)
        setWeeklyChampion(wk)
      } catch { /* ignore */ }
    }

    // Journal messages.
    //
    // Eren-delivered messages (via_eren = true) are filtered out here so
    // they never appear in the heart-button journal — they're a separate
    // channel that fires the ErenMessagePopup once and disappears.
    const { data: msgs } = await supabase
      .from('couple_journal')
      .select('*, profile:profiles!sender_id(*)')
      .eq('household_id', profile.household_id)
      .or('via_eren.is.null,via_eren.eq.false')
      .order('created_at', { ascending: false })
      .limit(50)
    if (msgs) {
      setJournal(msgs)
      // Count messages from partner that arrived AFTER the last time user read
      const lastReadMs = new Date(localStorage.getItem(`eren_journal_read_${user.id}`) ?? 0).getTime()
      const unread = msgs.filter((m: JournalMessage) => m.sender_id !== user.id && new Date(m.created_at).getTime() > lastReadMs).length
      setUnreadCount(unread)
    }

    setLoading(false)
  }, [profile?.household_id, user?.id, profile?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

  // Re-fetch on window focus + listen for read-timestamp changes
  useEffect(() => {
    if (!user?.id) return
    const recount = () => {
      const lastReadMs = new Date(localStorage.getItem(`eren_journal_read_${user.id}`) ?? 0).getTime()
      setJournal(prev => {
        const unread = prev.filter(m => m.sender_id !== user.id && new Date(m.created_at).getTime() > lastReadMs).length
        setUnreadCount(unread)
        return prev
      })
    }
    const onFocus = () => recount()
    const onStorage = (e: StorageEvent) => {
      if (e.key === `eren_journal_read_${user.id}`) recount()
    }
    const onMarkedRead = () => recount()
    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    window.addEventListener('eren:journal-read', onMarkedRead)
    const interval = setInterval(recount, 3000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('eren:journal-read', onMarkedRead)
      clearInterval(interval)
    }
  }, [user?.id])

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
        if (msg.sender_id !== user.id) {
          // Eren-delivered messages get the popup only — never the
          // heart-button counter or the journal list. Regular messages
          // go through both channels.
          if (msg.via_eren) {
            const lastReadMs = new Date(localStorage.getItem(`eren_journal_read_${user.id}`) ?? 0).getTime()
            if (new Date(msg.created_at).getTime() > lastReadMs) {
              setNewMessage(msg)
            }
            return
          }
          // Only count if the incoming message is newer than our read marker
          const lastReadMs = new Date(localStorage.getItem(`eren_journal_read_${user.id}`) ?? 0).getTime()
          if (new Date(msg.created_at).getTime() > lastReadMs) {
            setNewMessage(msg)
            setUnreadCount(c => c + 1)
          }
        }
        setJournal(prev => [msg, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [profile?.household_id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const sendMessage = useCallback(async (text: string, gift?: GiftItem | null, viaEren = false) => {
    if (!user?.id || !profile?.household_id) return
    const trimmed = text.trim()
    if (!trimmed && !gift) return
    await supabase.from('couple_journal').insert({
      household_id: profile.household_id,
      sender_id: user.id,
      message: trimmed,
      gift_item: gift ?? null,
      via_eren: viaEren,
    })
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
        household_id: profile.household_id,
        sender_id: user.id,
        sender_name: profile.name ?? '',
        message: trimmed || (gift ? `sent a ${gift.key}!` : ''),
        via_eren: viaEren,
      }),
    }).catch(() => { /* best-effort */ })
  }, [user?.id, profile?.household_id, profile?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send an Eren nudge (one-tap affectionate gesture) ──
  // Inserts a via_eren journal row carrying the SketchEren pose so the
  // recipient popup shows Eren striking that pose. Unlike sendMessage, the
  // push is sent with via_eren=false so the sweet line is *shown* in the
  // notification ("💌 {sender}: ...") rather than hidden. The DB via_eren
  // flag still routes it to the popup only (out of the journal list).
  // No cooldown — spamming nudges is part of the fun.
  const sendNudge = useCallback(async (nudge: NudgeDef): Promise<boolean> => {
    if (!user?.id || !profile?.household_id) return false

    // The "Thinking" nudge picks its heart emoji from the sender's email.
    const messageText = resolveNudgeMessage(nudge, user.email)

    const { error } = await supabase.from('couple_journal').insert({
      household_id: profile.household_id,
      sender_id: user.id,
      message: messageText,
      via_eren: true,
      eren_state: nudge.state,
    })
    if (error) return false

    fetch('/api/notify-message', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        household_id: profile.household_id,
        sender_id: user.id,
        sender_name: profile.name ?? '',
        message: messageText,
        via_eren: false,
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
  }, [user?.id, profile?.household_id, profile?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark all as read (saves timestamp to localStorage) ──
  const markAllRead = useCallback(() => {
    if (!user?.id) return
    // Stamp slightly in the future so lexicographic comparisons can't leave
    // an edge-case unread message from the same millisecond.
    localStorage.setItem(`eren_journal_read_${user.id}`, new Date(Date.now() + 1000).toISOString())
    setUnreadCount(0)
    setJournal(prev => prev.map(m => m.sender_id !== user.id ? { ...m, is_read: true } : m))
    // Notify other useCouple instances in the same tab — storage events
    // don't fire in the tab that did the write.
    try { window.dispatchEvent(new Event('eren:journal-read')) } catch { /* ignore */ }
  }, [user?.id])

  // ── Clear popup + mark all as read ──
  const dismissPopup = useCallback(() => {
    setNewMessage(null)
    if (!user?.id) return
    localStorage.setItem(`eren_journal_read_${user.id}`, new Date(Date.now() + 1000).toISOString())
    setUnreadCount(0)
    try { window.dispatchEvent(new Event('eren:journal-read')) } catch { /* ignore */ }
  }, [user?.id])

  // ── Claim the weekly Care Battle payout + dismiss the popup ─────────────
  // Pays the 100-coin bonus on first successful claim (atomic via CAS on
  // payout_paid). Always stamps acknowledged=true so the popup never re-fires.
  const claimWeeklyChampion = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !weeklyChampion) return false
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
    setWeeklyChampion({ ...weeklyChampion, payout_paid: paid || weeklyChampion.payout_paid, acknowledged: true })
    return paid
  }, [user?.id, weeklyChampion]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    partner, partnerStreak,
    loveMeter, anniversary, journal, unreadCount,
    newMessage, dismissPopup,
    partnerMood, partnerMoodWeek,
    lifetimeWLT, weeklyChampion, claimWeeklyChampion,
    sendMessage, sendNudge, markAllRead, loading,
    refetch: fetchAll,
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
