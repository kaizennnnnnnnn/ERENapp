'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { Profile, JournalMessage, Interaction, GiftItem } from '@/types'
import { computeLoveMeter, getAnniversaryInfo, type LoveMeterResult, type AnniversaryInfo } from '@/lib/couple'

export function useCouple() {
  const supabase = createClient()
  const { user, profile } = useAuth()

  const [partner, setPartner] = useState<Profile | null>(null)
  const [loveMeter, setLoveMeter] = useState<LoveMeterResult | null>(null)
  const [anniversary, setAnniversary] = useState<AnniversaryInfo | null>(null)
  const [journal, setJournal] = useState<JournalMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [newMessage, setNewMessage] = useState<JournalMessage | null>(null) // for popup
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<string>(`couple_${Date.now()}`)

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

    // Anniversary
    const { data: household } = await supabase
      .from('households')
      .select('created_at')
      .eq('id', profile.household_id)
      .single()
    if (household) {
      setAnniversary(getAnniversaryInfo(household.created_at))
    }

    // Love meter — get interactions for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('household_id', profile.household_id)
      .gte('created_at', thirtyDaysAgo)

    if (interactions && p) {
      setLoveMeter(computeLoveMeter(
        interactions as Interaction[],
        user.id, profile.name,
        p.id, p.name,
      ))
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

  return {
    partner, loveMeter, anniversary, journal, unreadCount,
    newMessage, dismissPopup,
    sendMessage, markAllRead, loading,
    refetch: fetchAll,
  }
}
