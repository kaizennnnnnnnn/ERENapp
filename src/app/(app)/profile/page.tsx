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
  IconCrown, IconHeartDuo, IconStar,
} from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import {
  PINK, PINK_HI, PINK_LO,
  OBSIDIAN_FACE, OBSIDIAN_BTN, OBSIDIAN_ORB,
  Rivets, ObsidianChip, pinkText, accentA, accentLoA,
} from '@/components/obsidian'
import { useTheme, THEMES } from '@/contexts/ThemeContext'
import PageLoader from '@/components/PageLoader'

export default function ProfilePage() {
  const router   = useRouter()
  const supabase = createClient()
  const { user, profile, loading, signOut } = useAuth()
  const { setHideStats } = useCare()
  // Hide the persistent StatsHeader on this subpage; restore on unmount.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

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

  // Dark page surface — overrides the page-scroll's 120 px top padding
  // since the StatsHeader is hidden here.
  const pageStyle: React.CSSProperties = {
    background: 'radial-gradient(ellipse at top, #1f0f18 0%, #0a0a0c 60%, #050507 100%)',
    minHeight: '100vh',
    color: '#F0E0E8',
    paddingTop: 'calc(var(--safe-top) + 16px)',
  }

  if (loading || !profile) return <PageLoader label="LOADING PROFILE" />

  const initials = profile.name.charAt(0).toUpperCase()
  const totalSeconds = mySeconds + partnerSeconds
  const { theme, setTheme } = useTheme()

  return (
    <div className="page-scroll" style={pageStyle}>
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => { playSound('ui_back'); router.push('/home') }}
          className="flex items-center justify-center active:translate-y-[1px] transition-transform relative"
          style={{ width: 32, height: 32, ...OBSIDIAN_BTN }}>
          <Rivets inset={2} size={2} />
          <ChevronLeft size={16} style={{ color: PINK_HI }} />
        </button>
        <ObsidianChip accentRgb="236,72,153">
          <IconPerson size={14} />
          <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>PROFILE</span>
        </ObsidianChip>
      </div>
      <p className="text-sm mb-5 flex items-center gap-1.5" style={{ color: '#9A8090' }}>
        You &amp; your household
        <IconHouse size={14} />
      </p>

      {/* ── My profile ── */}
      <div className="mb-4 p-4 relative overflow-hidden" style={OBSIDIAN_FACE}>
        <Rivets inset={4} size={3} />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: `radial-gradient(circle, ${PINK} 1.2px, transparent 1.2px)`, backgroundSize: '14px 14px' }} />

        <div className="relative flex items-center gap-4">
          {/* Avatar — obsidian orb with pink ring */}
          <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center relative" style={OBSIDIAN_ORB}>
            <span className="font-pixel" style={{ fontSize: 22, ...pinkText }}>{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            {nameEditing ? (
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-1.5 text-sm bg-transparent outline-none relative"
                  style={{
                    ...OBSIDIAN_BTN,
                    color: '#F0E0E8',
                  }}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                  autoFocus
                />
                <button onClick={() => { playSound('ui_tap'); saveName() }} disabled={savingName}
                  className="px-3 py-1.5 text-sm relative"
                  style={OBSIDIAN_BTN}>
                  <Rivets inset={2} size={2} />
                  <span className="font-pixel" style={{ fontSize: 7, ...pinkText }}>{savingName ? '...' : 'SAVE'}</span>
                </button>
              </div>
            ) : (
              <button onClick={() => { playSound('ui_tap'); setEditName(profile.name); setNameEditing(true) }} className="text-left">
                <p className="font-pixel leading-tight mb-1" style={{ fontSize: 11, ...pinkText }}>{profile.name}</p>
                <p className="text-[10px] flex items-center gap-1" style={{ color: PINK_HI, opacity: 0.7 }}>
                  tap to edit name
                  <IconPencil size={10} />
                </p>
              </button>
            )}
            <p className="text-xs mt-1 truncate" style={{ color: '#7A6A75' }}>{user?.email}</p>
          </div>
        </div>
      </div>

      {/* ── Partner card ── */}
      {partner && (
        <div className="mb-4 p-4 relative" style={OBSIDIAN_FACE}>
          <Rivets inset={4} size={3} />
          <div className="flex items-center gap-2 mb-3">
            <ObsidianChip accentRgb="167,139,250">
              <IconHeart size={12} />
              <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>PARTNER</span>
            </ObsidianChip>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center relative" style={OBSIDIAN_ORB}>
              <span className="font-pixel" style={{ fontSize: 16, ...pinkText }}>{partner.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="font-pixel leading-tight" style={{ fontSize: 10, color: PINK_HI }}>{partner.name}</p>
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#9A8090' }}>
                Eren&apos;s other human
                <IconHeartDuo size={12} />
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Time with Eren ── */}
      <div className="mb-4 p-4 relative" style={OBSIDIAN_FACE}>
        <Rivets inset={4} size={3} />
        <div className="flex items-center gap-2 mb-4">
          <ObsidianChip accentRgb="245,200,66">
            <IconClock size={12} />
            <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>TIME</span>
          </ObsidianChip>
          <span className="text-xs" style={{ color: '#7A6A75' }}>with Eren</span>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="flex items-center gap-1.5">
                <IconCatFace size={16} />
                <span className="font-medium text-xs" style={{ color: PINK_HI }}>{profile.name}</span>
              </span>
              <span className="font-pixel" style={{ fontSize: 8, color: PINK_HI, textShadow: `0 0 3px ${accentA(0.4)}` }}>{formatDuration(mySeconds)}</span>
            </div>
            <div className="flex gap-[3px]">
              {Array.from({ length: 12 }).map((_, i) => {
                const pct = totalSeconds > 0 ? (mySeconds / totalSeconds) : 0
                const lit = i < Math.round(pct * 12)
                return <div key={i} className="flex-1" style={{
                  height: 10,
                  background: lit
                    ? `linear-gradient(180deg, ${PINK_HI}, ${PINK} 60%, ${PINK_LO})`
                    : '#0a0a0c',
                  border: `1px solid ${lit ? `${accentLoA(0.53)}` : `${accentA(0.13)}`}`,
                  boxShadow: lit ? 'inset 0 1px 0 rgba(255,255,255,0.3)' : 'inset 0 1px 2px rgba(0,0,0,0.6)',
                }} />
              })}
            </div>
          </div>

          {partner && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="flex items-center gap-1.5">
                  <IconCatFace size={16} />
                  <span className="font-medium text-xs" style={{ color: '#C4B5FD' }}>{partner.name}</span>
                </span>
                <span className="font-pixel" style={{ fontSize: 8, color: '#C4B5FD', textShadow: '0 0 3px rgba(167,139,250,0.5)' }}>{formatDuration(partnerSeconds)}</span>
              </div>
              <div className="flex gap-[3px]">
                {Array.from({ length: 12 }).map((_, i) => {
                  const pct = totalSeconds > 0 ? (partnerSeconds / totalSeconds) : 0
                  const lit = i < Math.round(pct * 12)
                  return <div key={i} className="flex-1" style={{
                    height: 10,
                    background: lit
                      ? 'linear-gradient(180deg, #E9D5FF, #A78BFA 60%, #5B21B6)'
                      : '#0a0a0c',
                    border: `1px solid ${lit ? '#5B21B688' : 'rgba(167,139,250,0.13)'}`,
                    boxShadow: lit ? 'inset 0 1px 0 rgba(255,255,255,0.3)' : 'inset 0 1px 2px rgba(0,0,0,0.6)',
                  }} />
                })}
              </div>
            </div>
          )}
        </div>

        {mySeconds > partnerSeconds ? (
          <div className="mt-3 flex items-center gap-1.5">
            <IconCrown size={14} />
            <span className="font-pixel" style={{ fontSize: 7, color: '#F5C842', textShadow: '0 0 3px rgba(245,200,66,0.5)' }}>YOU SPEND THE MOST TIME!</span>
          </div>
        ) : partnerSeconds > mySeconds && partner ? (
          <div className="mt-3 flex items-center gap-1.5">
            <IconCrown size={14} />
            <span className="font-pixel" style={{ fontSize: 7, color: '#C4B5FD' }}>
              {partner.name.toUpperCase()} IS AHEAD — CATCH UP!
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Invite code ── */}
      {inviteCode && (
        <div className="mb-4 p-4 relative" style={OBSIDIAN_FACE}>
          <Rivets inset={4} size={3} />
          <div className="flex items-center gap-2 mb-1">
            <ObsidianChip accentRgb="107,174,214">
              <IconHouse size={12} />
              <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>INVITE</span>
            </ObsidianChip>
          </div>
          <p className="text-xs mb-3" style={{ color: '#7A6A75' }}>Share with your partner to join</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-center py-3 relative"
              style={{
                ...OBSIDIAN_BTN,
                border: `1px dashed ${accentA(0.53)}`,
              }}>
              <p className="font-pixel tracking-[0.25em]" style={{ fontSize: 13, ...pinkText }}>
                {inviteCode}
              </p>
            </div>
            <button
              onClick={() => { playSound('ui_tap'); copyInviteCode() }}
              className="w-12 h-12 flex items-center justify-center transition-all active:translate-y-[1px] relative"
              style={copied
                ? { ...OBSIDIAN_BTN, border: '1px solid #4ade8088' }
                : OBSIDIAN_BTN
              }
            >
              <Rivets inset={2} size={2} />
              {copied
                ? <Check size={20} style={{ color: '#4ade80' }} />
                : <Copy size={20} style={{ color: PINK_HI }} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Mood calendar (component leaves its own styling) ── */}
      {moods.length > 0 && user && (
        <div className="mb-4">
          <MoodCalendar moods={moods} userId={user.id} partnerName={partner?.name} />
        </div>
      )}

      {/* ── Theme switcher ── */}
      <div className="mb-4 p-4 relative" style={OBSIDIAN_FACE}>
        <Rivets inset={4} size={3} />
        <div className="flex items-center gap-2 mb-3">
          <ObsidianChip accentRgb="245,200,66">
            <IconStar size={12} />
            <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>THEME</span>
          </ObsidianChip>
        </div>
        <p className="text-xs mb-3" style={{ color: '#7A6A75' }}>Pick the accent for the whole app</p>
        <div className="flex gap-2">
          {THEMES.map(t => {
            const active = theme === t.key
            return (
              <button
                key={t.key}
                onClick={() => { playSound('ui_tap'); setTheme(t.key) }}
                className="flex-1 flex flex-col items-center gap-2 p-3 active:translate-y-[1px] transition-transform relative"
                style={{
                  ...OBSIDIAN_BTN,
                  border: `1px solid ${active ? t.swatch : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: active
                    ? `0 0 0 1px ${t.swatch}55, 0 0 12px ${t.swatch}55, inset 0 1px 0 rgba(255,255,255,0.07)`
                    : OBSIDIAN_BTN.boxShadow as string,
                }}
              >
                {active && <Rivets inset={2} size={2} />}
                {/* Swatch — small obsidian orb tinted with the theme color */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 28%, ${t.swatchHi}, ${t.swatch} 60%, ${t.swatchLo})`,
                  boxShadow: `0 0 0 1.5px ${t.swatch}, 0 0 0 3px #000, 0 0 0 4px ${t.swatch}55, 0 2px 6px ${t.swatch}88`,
                }} />
                <span className="font-pixel" style={{
                  fontSize: 7, letterSpacing: 1,
                  color: active ? t.swatchHi : '#7A6A75',
                  textShadow: active ? `0 0 3px ${t.swatch}66` : 'none',
                }}>{t.label.toUpperCase()}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Sign out ── */}
      <button
        onClick={() => { playSound('ui_tap'); handleSignOut() }}
        className="w-full flex items-center justify-center gap-2 py-3 transition-all active:translate-y-[1px] relative"
        style={{
          ...OBSIDIAN_BTN,
          border: '1px solid rgba(248,113,113,0.5)',
        }}>
        <Rivets inset={3} size={3} />
        <LogOut size={16} style={{ color: '#fca5a5' }} />
        <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, color: '#fca5a5', textShadow: '0 0 3px rgba(248,113,113,0.4)' }}>SIGN OUT</span>
      </button>

      <div className="flex items-center justify-center gap-2 mt-6 pb-2">
        <div className="h-px w-8" style={{ background: `repeating-linear-gradient(90deg, ${accentA(0.2)} 0px, ${accentA(0.2)} 3px, transparent 3px, transparent 6px)` }} />
        <p className="font-pixel text-center flex items-center gap-1" style={{ fontSize: 6, color: '#5A4A55' }}>
          EREN v1.0 · MADE WITH <IconHeart size={8} />
        </p>
        <div className="h-px w-8" style={{ background: `repeating-linear-gradient(90deg, ${accentA(0.2)} 0px, ${accentA(0.2)} 3px, transparent 3px, transparent 6px)` }} />
      </div>
    </div>
  )
}
