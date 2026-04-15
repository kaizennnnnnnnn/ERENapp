'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'
import type { Profile, JournalMessage, Interaction } from '@/types'
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

    // Journal messages
    const { data: msgs } = await supabase
      .from('couple_journal')
      .select('*, profile:profiles!sender_id(*)')
      .eq('household_id', profile.household_id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (msgs) {
      setJournal(msgs)
      setUnreadCount(msgs.filter((m: JournalMessage) => m.sender_id !== user.id && !m.is_read).length)
    }

    setLoading(false)
  }, [profile?.household_id, user?.id, profile?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

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
          // Partner sent a message! Show popup
          setNewMessage(msg)
          setUnreadCount(c => c + 1)
        }
        setJournal(prev => [msg, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [profile?.household_id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send message ──
  const sendMessage = useCallback(async (text: string) => {
    if (!user?.id || !profile?.household_id || !text.trim()) return
    await supabase.from('couple_journal').insert({
      household_id: profile.household_id,
      sender_id: user.id,
      message: text.trim(),
    })
  }, [user?.id, profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark messages as read ──
  const markAllRead = useCallback(async () => {
    if (!user?.id || !profile?.household_id) return
    const { error } = await supabase
      .from('couple_journal')
      .update({ is_read: true })
      .eq('household_id', profile.household_id)
      .neq('sender_id', user.id)
      .eq('is_read', false)
    if (!error) {
      setJournal(prev => prev.map(m => m.sender_id !== user.id ? { ...m, is_read: true } : m))
      setUnreadCount(0)
    }
  }, [user?.id, profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear popup + mark that message read ──
  const dismissPopup = useCallback(async () => {
    if (newMessage && user?.id) {
      await supabase
        .from('couple_journal')
        .update({ is_read: true })
        .eq('id', newMessage.id)
      setJournal(prev => prev.map(m => m.id === newMessage.id ? { ...m, is_read: true } : m))
      setUnreadCount(c => Math.max(0, c - 1))
    }
    setNewMessage(null)
  }, [newMessage, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    partner, loveMeter, anniversary, journal, unreadCount,
    newMessage, dismissPopup,
    sendMessage, markAllRead, loading,
    refetch: fetchAll,
  }
}
