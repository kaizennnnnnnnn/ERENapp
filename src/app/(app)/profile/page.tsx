'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Profile, DailyMood } from '@/types'
import { formatDuration } from '@/lib/utils'
import { Copy, LogOut, Check, ChevronLeft } from 'lucide-react'
import MoodCalendar from '@/components/MoodCalendar'
import { format } from 'date-fns'
import { useCare } from '@/contexts/CareContext'
import {
  IconPerson, IconHouse, IconHeart, IconClock, IconCatFace, IconPencil,
  IconCrown, IconHeartDuo,
} from '@/components/PixelIcons'

export default function ProfilePage() {
  const router   = useRouter()
  const supabase = createClient()
  const { user, profile, loading, signOut } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(false) }, [setHideStats])

  const [partner, setPartner]         = useState<Profile | null>(null)
  const [inviteCode, setInviteCode]   = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)
  const [mySeconds, setMySeconds]     = useState(0)
  const [partnerSeconds, setPartnerSeconds] = useState(0)
  const [editName, setEditName]       = useState('')
  const [savingName, setSavingName]   = useState(false)
  const [nameEditing, setNameEditing] = useState(false)
  const [moods, setMoods]             = useState<DailyMood[]>([])

  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    supabase.from('households').select('invite_code').eq('id', profile.household_id).single()
      .then(({ data }) => { if (data) setInviteCode(data.invite_code) })
    supabase.from('profiles').select('*').eq('household_id', profile.household_id).neq('id', user.id).limit(1).single()
      .then(({ data }) => { if (data) setPartner(data) })
    supabase.from('time_spent').select('user_id, duration_seconds').in('user_id', [user.id])
      .then(({ data }) => {
        if (!data) return
        setMySeconds(data.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0))
      })
    const today = new Date()
    const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd')
    supabase.from('daily_moods').select('*, profile:profiles(name, avatar_url)').gte('date', monthStart).order('date', { ascending: false })
      .then(({ data }) => { if (data) setMoods(data) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.household_id, user?.id])

  useEffect(() => {
    if (!partner?.id) return
    supabase.from('time_spent').select('duration_seconds').eq('user_id', partner.id)
      .then(({ data }) => {
        if (!data) return
        setPartnerSeconds(data.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.id])

  function copyInviteCode() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveName() {
    if (!user?.id || !editName.trim()) return
    setSavingName(true)
    await supabase.from('profiles').update({ name: editName.trim() }).eq('id', user.id)
    setSavingName(false)
    setNameEditing(false)
    window.location.reload()
  }

  async function handleSignOut() {
    await signOut()
    router.push('/auth/login')
  }

  if (loading || !profile) {
    return (
      <div className="page-scroll flex items-center justify-center min-h-[60vh]">
        <span className="font-pixel text-pink-300 animate-pulse-soft" style={{ fontSize: 8 }}>LOADING<span className="animate-cursor">_</span></span>
      </div>
    )
  }

  const initials = profile.name.charAt(0).toUpperCase()
  const totalSeconds = mySeconds + partnerSeconds

  return (
    <div className="page-scroll">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => router.push('/home')} className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
          <ChevronLeft size={16} className="text-purple-500" />
        </button>
        <span className="pixel-chip inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)', paddingLeft: 6 }}>
          <IconPerson size={14} />
          <span>PROFILE</span>
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-5 flex items-center gap-1.5">
        You &amp; your household
        <IconHouse size={14} />
      </p>

      {/* ── My profile ── */}
      <div className="mb-4 p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #FFF0F7, #F8F0FF)', borderRadius: 4, border: '3px solid #F0D0FF', boxShadow: '4px 4px 0 #E0B8FF' }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #A78BFA 1.2px, transparent 1.2px)', backgroundSize: '14px 14px' }} />

        <div className="relative flex items-center gap-4">
          {/* Pixel avatar */}
          <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center text-2xl font-bold text-white relative"
            style={{ background: 'linear-gradient(135deg, #FF6B9D, #A78BFA)', borderRadius: 4, border: '3px solid #CC3366', boxShadow: '3px 3px 0 #A020A0' }}>
            <div style={{ position: 'absolute', inset: 2, border: '1px dashed rgba(255,255,255,0.35)', borderRadius: 2 }} />
            <span className="relative">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            {nameEditing ? (
              <div className="flex gap-2">
                <input
                  className="input py-1.5 text-sm"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  autoFocus
                />
                <button onClick={saveName} disabled={savingName} className="btn-primary px-3 py-1.5 text-sm">
                  {savingName ? '…' : 'Save'}
                </button>
              </div>
            ) : (
              <button onClick={() => { setEditName(profile.name); setNameEditing(true) }} className="text-left">
                <p className="font-pixel text-gray-800 leading-tight mb-1" style={{ fontSize: 11 }}>{profile.name}</p>
                <p className="text-[10px] text-purple-400 flex items-center gap-1">
                  tap to edit name
                  <IconPencil size={10} />
                </p>
              </button>
            )}
            <p className="text-xs text-gray-400 mt-1 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* ── Partner card ── */}
      {partner && (
        <div className="mb-4 p-4"
          style={{ background: 'linear-gradient(135deg, #F0F0FF, #E8E0FF)', borderRadius: 4, border: '3px solid #D8D0F8', boxShadow: '4px 4px 0 #C0B0F0' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="pixel-chip inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #C084FC, #A060E0)', paddingLeft: 6 }}>
              <IconHeart size={12} />
              <span>PARTNER</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-lg font-bold text-purple-600 relative"
              style={{ background: 'linear-gradient(135deg, #E8D8FF, #D8C8F8)', borderRadius: 3, border: '2px solid #C0A8F0', boxShadow: '2px 2px 0 #B090E0' }}>
              <div style={{ position: 'absolute', inset: 2, border: '1px dashed rgba(124,58,237,0.18)', borderRadius: 2 }} />
              <span className="relative">{partner.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="font-pixel text-gray-700 leading-tight" style={{ fontSize: 10 }}>{partner.name}</p>
              <p className="text-xs text-purple-400 mt-0.5 flex items-center gap-1">
                Eren&apos;s other human
                <IconHeartDuo size={12} />
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Time with Eren ── */}
      <div className="mb-4 p-4"
        style={{ background: 'white', borderRadius: 4, border: '3px solid #F0D8FF', boxShadow: '4px 4px 0 #E0C8F0' }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="pixel-chip inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #F5C842, #E8A020)', paddingLeft: 6 }}>
            <IconClock size={12} />
            <span>TIME</span>
          </span>
          <span className="text-xs text-gray-400">with Eren</span>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="flex items-center gap-1.5">
                <IconCatFace size={16} />
                <span className="font-medium text-gray-700 text-xs">{profile.name}</span>
              </span>
              <span className="font-pixel text-[#FF6B9D]" style={{ fontSize: 8 }}>{formatDuration(mySeconds)}</span>
            </div>
            <div className="flex gap-[3px]">
              {Array.from({ length: 12 }).map((_, i) => {
                const pct = totalSeconds > 0 ? (mySeconds / totalSeconds) : 0
                const lit = i < Math.round(pct * 12)
                return <div key={i} className="flex-1" style={{ height: 10, borderRadius: 2, background: lit ? '#FF6B9D' : '#FFE0EE', boxShadow: lit ? '0 1px 0 rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35)' : 'inset 0 1px 0 rgba(0,0,0,0.05)' }} />
              })}
            </div>
          </div>

          {partner && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="flex items-center gap-1.5">
                  <IconCatFace size={16} />
                  <span className="font-medium text-gray-700 text-xs">{partner.name}</span>
                </span>
                <span className="font-pixel text-[#A78BFA]" style={{ fontSize: 8 }}>{formatDuration(partnerSeconds)}</span>
              </div>
              <div className="flex gap-[3px]">
                {Array.from({ length: 12 }).map((_, i) => {
                  const pct = totalSeconds > 0 ? (partnerSeconds / totalSeconds) : 0
                  const lit = i < Math.round(pct * 12)
                  return <div key={i} className="flex-1" style={{ height: 10, borderRadius: 2, background: lit ? '#A78BFA' : '#EDE8FF', boxShadow: lit ? '0 1px 0 rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35)' : 'inset 0 1px 0 rgba(0,0,0,0.05)' }} />
                })}
              </div>
            </div>
          )}
        </div>

        {mySeconds > partnerSeconds ? (
          <div className="mt-3 flex items-center gap-1.5">
            <IconCrown size={14} />
            <span className="font-pixel text-yellow-600" style={{ fontSize: 7 }}>YOU SPEND THE MOST TIME!</span>
          </div>
        ) : partnerSeconds > mySeconds && partner ? (
          <div className="mt-3 flex items-center gap-1.5">
            <IconCrown size={14} />
            <span className="font-pixel text-purple-500" style={{ fontSize: 7 }}>
              {partner.name.toUpperCase()} IS AHEAD — CATCH UP!
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Invite code ── */}
      {inviteCode && (
        <div className="mb-4 p-4"
          style={{ background: 'white', borderRadius: 4, border: '3px solid #F0D8FF', boxShadow: '4px 4px 0 #E0C8F0' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="pixel-chip inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #6BAED6, #4A90C0)', paddingLeft: 6 }}>
              <IconHouse size={12} />
              <span>INVITE</span>
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-3">Share with your partner to join</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-center py-3"
              style={{ background: '#F8F4FF', borderRadius: 3, border: '2px dashed #D8C8F0' }}>
              <p className="font-pixel text-[#1F1F2E] tracking-[0.25em]" style={{ fontSize: 13 }}>
                {inviteCode}
              </p>
            </div>
            <button
              onClick={copyInviteCode}
              className="w-12 h-12 flex items-center justify-center transition-all active:translate-y-[2px]"
              style={copied
                ? { background: '#4ade80', borderRadius: 3, border: '2px solid #16a34a', boxShadow: '0 2px 0 #15803d' }
                : { background: '#FF6B9D', borderRadius: 3, border: '2px solid #CC3366', boxShadow: '0 2px 0 #991A4A' }
              }
            >
              {copied ? <Check size={20} className="text-white" /> : <Copy size={20} className="text-white" />}
            </button>
          </div>
        </div>
      )}

      {/* ── Mood calendar ── */}
      {moods.length > 0 && user && (
        <div className="mb-4">
          <MoodCalendar moods={moods} userId={user.id} partnerName={partner?.name} />
        </div>
      )}

      {/* ── Sign out ── */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-3 transition-all active:translate-y-[2px]"
        style={{ background: '#FFF0F0', borderRadius: 3, border: '2px solid #FFCCCC', boxShadow: '2px 2px 0 #FFB0B0', color: '#CC4444' }}>
        <LogOut size={16} />
        <span className="font-pixel" style={{ fontSize: 8 }}>SIGN OUT</span>
      </button>

      <div className="flex items-center justify-center gap-2 mt-6 pb-2">
        <div className="h-px w-8" style={{ background: 'repeating-linear-gradient(90deg, #DDD0F8 0px, #DDD0F8 3px, transparent 3px, transparent 6px)' }} />
        <p className="font-pixel text-gray-300 text-center flex items-center gap-1" style={{ fontSize: 6 }}>
          EREN v1.0 · MADE WITH <IconHeart size={8} />
        </p>
        <div className="h-px w-8" style={{ background: 'repeating-linear-gradient(90deg, #DDD0F8 0px, #DDD0F8 3px, transparent 3px, transparent 6px)' }} />
      </div>
    </div>
  )
}
