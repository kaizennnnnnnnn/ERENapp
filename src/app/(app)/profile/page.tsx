'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { blockUser } from '@/lib/reporting'
import ReportSheet from '@/components/safety/ReportSheet'
import { withRetry } from '@/lib/supabaseRetry'
import { useAuth } from '@/hooks/useAuth'
import type { Profile, DailyMood } from '@/types'
import { formatDuration } from '@/lib/utils'
import { Copy, LogOut, Check, ChevronLeft } from 'lucide-react'
import MoodCalendar from '@/components/MoodCalendar'
import { format } from 'date-fns'
import { useCare } from '@/contexts/CareContext'
import {
  IconPerson, IconHouse, IconHeart, IconClock, IconCatFace, IconPencil,
  IconCrown, IconHeartDuo, IconStar, IconTrophy, IconFire, IconLock,
  IconPaw, IconController, IconSwords, IconMoon, IconCoin,
} from '@/components/PixelIcons'
import { useTasks } from '@/contexts/TaskContext'
import { ACHIEVEMENT_DEFS, RARITY_COLORS, type AchievementDef } from '@/lib/achievements'
import { playSound } from '@/lib/sounds'
import {
  PINK, PINK_HI, PINK_LO,
  OBSIDIAN_FACE, OBSIDIAN_BTN, OBSIDIAN_ORB,
  Rivets, ObsidianChip, pinkText, accentA, accentLoA,
} from '@/components/obsidian'
import { useTheme, THEMES } from '@/contexts/ThemeContext'
import PageLoader from '@/components/PageLoader'
import { usePageReady } from '@/hooks/usePageReady'

function AchievementIcon({ iconName, size }: { iconName: AchievementDef['icon']; size: number }) {
  switch (iconName) {
    case 'trophy':     return <IconTrophy size={size} />
    case 'fire':       return <IconFire size={size} />
    case 'star':       return <IconStar size={size} />
    case 'crown':      return <IconCrown size={size} />
    case 'heart':      return <IconHeart size={size} />
    case 'paw':        return <IconPaw size={size} />
    case 'controller': return <IconController size={size} />
    case 'swords':     return <IconSwords size={size} />
    case 'moon':       return <IconMoon size={size} />
    default:           return <IconLock size={size} />
  }
}

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

  const [deleteOpen, setDeleteOpen]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [deleteErr, setDeleteErr]     = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen]     = useState(false)
  const [leaving, setLeaving]         = useState(false)
  const [leaveErr, setLeaveErr]       = useState<string | null>(null)
  // Rotating the invite code is one tap that invalidates a code the partner
  // may be mid-way through typing, so the button arms before it fires. One
  // state rather than four booleans — every label the button shows is a
  // position in this machine.
  const [rotateState, setRotateState] = useState<'idle' | 'armed' | 'busy' | 'failed'>('idle')
  const [reportOpen, setReportOpen] = useState(false)
  const [blockOpen, setBlockOpen]   = useState(false)
  const [blocking, setBlocking]     = useState(false)
  const [blockErr, setBlockErr]     = useState<string | null>(null)
  const [partner, setPartner]         = useState<Profile | null>(null)
  const [inviteCode, setInviteCode]   = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)
  const [mySeconds, setMySeconds]     = useState(0)
  const [partnerSeconds, setPartnerSeconds] = useState(0)
  const [editName, setEditName]       = useState('')
  const [savingName, setSavingName]   = useState(false)
  const [nameEditing, setNameEditing] = useState(false)
  const [moods, setMoods]             = useState<DailyMood[]>([])
  const [moodAlerts, setMoodAlerts]   = useState(true)
  // Phase 3 PR 9/10 — per-channel push opt-ins + quiet Eren mode.
  const [wishPush, setWishPush]       = useState(true)
  const [memoryPush, setMemoryPush]   = useState(true)
  const [quietEren, setQuietEren]     = useState(false)
  // Phase 3 PR 9 — 4-countdown strip. Two profile birthdays + two household
  // dates (eren_birthday, couple_anniversary).
  const [myBirthday, setMyBirthday]               = useState<string>('')
  const [erenBirthday, setErenBirthday]           = useState<string>('')
  const [coupleAnniversary, setCoupleAnniversary] = useState<string>('')

  useEffect(() => {
    if (profile) setMoodAlerts(profile.mood_alert_optin ?? true)
  }, [profile?.mood_alert_optin]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!profile) return
    setWishPush(profile.wish_push_optin ?? true)
    setMemoryPush(profile.memory_push_optin ?? true)
    setQuietEren(profile.quiet_eren_optin ?? false)
    setMyBirthday(profile.birthday ?? '')
  }, [profile?.wish_push_optin, profile?.memory_push_optin, profile?.quiet_eren_optin, profile?.birthday]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!profile?.household_id) return
    void supabase.from('households').select('eren_birthday, couple_anniversary').eq('id', profile.household_id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setErenBirthday((data.eren_birthday as string | null) ?? '')
        setCoupleAnniversary((data.couple_anniversary as string | null) ?? '')
      })
  }, [profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleMoodAlerts() {
    if (!user?.id) return
    const next = !moodAlerts
    setMoodAlerts(next)
    await supabase.from('profiles').update({ mood_alert_optin: next }).eq('id', user.id)
  }
  async function toggleWishPush() {
    if (!user?.id) return
    const next = !wishPush
    setWishPush(next)
    await supabase.from('profiles').update({ wish_push_optin: next }).eq('id', user.id)
  }
  async function toggleMemoryPush() {
    if (!user?.id) return
    const next = !memoryPush
    setMemoryPush(next)
    await supabase.from('profiles').update({ memory_push_optin: next }).eq('id', user.id)
  }
  async function toggleQuietEren() {
    if (!user?.id) return
    const next = !quietEren
    setQuietEren(next)
    await supabase.from('profiles').update({ quiet_eren_optin: next }).eq('id', user.id)
  }
  async function saveMyBirthday(value: string) {
    if (!user?.id) return
    setMyBirthday(value)
    await supabase.from('profiles').update({ birthday: value || null }).eq('id', user.id)
  }
  async function saveErenBirthday(value: string) {
    if (!profile?.household_id) return
    setErenBirthday(value)
    await supabase.from('households').update({ eren_birthday: value || null }).eq('id', profile.household_id)
  }
  async function saveCoupleAnniversary(value: string) {
    if (!profile?.household_id) return
    setCoupleAnniversary(value)
    await supabase.from('households').update({ couple_anniversary: value || null }).eq('id', profile.household_id)
  }

  // Days-until helper for the 4-countdown strip.
  function daysUntil(mmdd: string | null): number | null {
    if (!mmdd || mmdd.length < 10) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tgt = new Date(today.getFullYear(), Number(mmdd.slice(5, 7)) - 1, Number(mmdd.slice(8, 10)))
    if (tgt < today) tgt.setFullYear(tgt.getFullYear() + 1)
    return Math.round((tgt.getTime() - today.getTime()) / 86400000)
  }

  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    // withRetry: a transient Supabase 503 resolves as { data: null } and must
    // not read as "no rows" — it used to hide the invite, partner and mood
    // calendar cards until a manual reload.
    withRetry(() => supabase.from('households').select('invite_code').eq('id', profile.household_id).single())
      .then(({ data }) => { if (data) setInviteCode(data.invite_code) })
    // maybeSingle: a partner-less household is a normal state, not an error to retry.
    withRetry(() => supabase.from('profiles').select('*').eq('household_id', profile.household_id).neq('id', user.id).limit(1).maybeSingle())
      .then(({ data }) => { if (data) setPartner(data) })
    supabase.from('time_spent').select('user_id, duration_seconds').in('user_id', [user.id])
      .then(({ data }) => {
        if (!data) return
        setMySeconds(data.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0))
      })
    const today = new Date()
    const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd')
    withRetry(() => supabase.from('daily_moods').select('*, profile:profiles(name, avatar_url)').gte('date', monthStart).order('date', { ascending: false }))
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

  // Armed and failed are both transient — fall back to idle so a stray tap
  // doesn't leave a primed button sitting there minutes later.
  useEffect(() => {
    if (rotateState !== 'armed' && rotateState !== 'failed') return
    const t = setTimeout(() => setRotateState('idle'), 4000)
    return () => clearTimeout(t)
  }, [rotateState])

  // rotate_invite_code() replaces the code and returns the new one. This is
  // the remedy for a code that got out — an old screenshot, a shared phone,
  // an ex who still remembers it. Without it a code, once seen, was a
  // permanent key to the household.
  async function handleRotateCode() {
    if (rotateState === 'busy') return
    if (rotateState !== 'armed') { setRotateState('armed'); return }

    setRotateState('busy')
    const { data, error } = await supabase.rpc('rotate_invite_code')
    if (error || !data) { setRotateState('failed'); return }

    setInviteCode(data as string)
    setCopied(false)   // the clipboard now holds the dead code
    setRotateState('idle')
  }

  // block_user() records the block and detaches this account in one
  // transaction, and join_household() then refuses to put these two accounts
  // together again in either direction. The hard navigation is for the same
  // reason as leaving: every context downstream is built on a profile that
  // still says we are in a household.
  async function handleBlock() {
    if (blocking || !partner?.id) return
    setBlocking(true)
    setBlockErr(null)
    const res = await blockUser(partner.id)
    if (!res.ok) {
      setBlocking(false)
      setBlockErr(res.message)
      return
    }
    window.location.href = '/onboarding'
  }

  // leave_household() detaches this account and rotates the code behind it.
  // Shared history stays with the household by design — this is "move out",
  // not "delete our life together".
  //
  // A hard navigation, not router.replace: useAuth still holds a profile
  // saying we are in a household, and every context downstream is built on
  // it. Reloading is the honest way to drop all of it at once.
  async function handleLeaveHousehold() {
    if (leaving) return
    setLeaving(true)
    setLeaveErr(null)
    const { error } = await supabase.rpc('leave_household')
    if (error) {
      setLeaving(false)
      setLeaveErr("Couldn't leave just now. Try again in a moment.")
      return
    }
    window.location.href = '/onboarding'
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

  // delete_my_account() erases personal data, severs co-authored content from
  // this user, and drops the auth row last. The session is dead once it
  // returns, so sign out locally rather than leaving a token for a user that
  // no longer exists.
  async function handleDeleteAccount() {
    if (deleting) return
    setDeleting(true)
    setDeleteErr(null)
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      setDeleting(false)
      setDeleteErr("Couldn't delete the account just now. Try again in a moment.")
      return
    }
    await signOut()
    router.replace('/auth/login')
  }

  // Dark page surface — overrides the page-scroll's 120 px top padding
  // since the StatsHeader is hidden here.
  const pageStyle: React.CSSProperties = {
    background: 'radial-gradient(ellipse at top, #1f0f18 0%, #0a0a0c 60%, #050507 100%)',
    minHeight: '100vh',
    color: '#F0E0E8',
    paddingTop: 'calc(var(--safe-top) + 16px)',
  }

  const { achievements, streak, streakRepairAvailable, streakRepairCost, repairStreak, coins } = useTasks()

  usePageReady(!loading && !!profile)

  if (loading || !profile) return <PageLoader label="LOADING PROFILE" />

  const initials = profile.name.charAt(0).toUpperCase()
  const totalSeconds = mySeconds + partnerSeconds
  const { theme, setTheme } = useTheme()
  const unlockedCount = Object.keys(achievements).length

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

      {/* ── Achievements ── */}
      <div className="mb-4 p-4 relative" style={OBSIDIAN_FACE}>
        <Rivets inset={4} size={3} />
        <div className="flex items-center gap-2 mb-1">
          <ObsidianChip accentRgb="251,191,36">
            <IconTrophy size={12} />
            <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>ACHIEVEMENTS</span>
          </ObsidianChip>
          <span className="font-pixel" style={{ fontSize: 7, color: '#7A6A75' }}>
            {unlockedCount}<span style={{ opacity: 0.5 }}>/</span>{ACHIEVEMENT_DEFS.length}
          </span>
        </div>

        {/* Progress bar showing overall unlock progress */}
        <div className="mb-3 mt-2" style={{
          height: 6, background: '#0a0a0c', overflow: 'hidden',
          boxShadow: `inset 0 1px 2px rgba(0,0,0,0.8), inset 0 0 0 1px ${accentA(0.13)}`,
        }}>
          <div style={{
            width: `${Math.round((unlockedCount / ACHIEVEMENT_DEFS.length) * 100)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #FBBF24, #F59E0B 60%, #D97706)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
            transition: 'width 700ms ease-out',
          }} />
        </div>

        {streak.best > 0 && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 relative" style={{
            ...OBSIDIAN_BTN,
            border: '1px solid rgba(255,107,0,0.3)',
          }}>
            <IconFire size={14} />
            <span className="font-pixel" style={{ fontSize: 6, color: '#FF6B00', letterSpacing: 1 }}>
              BEST: {streak.best}
            </span>
            {streak.current > 0 && (
              <span className="font-pixel" style={{ fontSize: 6, color: '#FFD700', letterSpacing: 1 }}>
                NOW: {streak.current}
              </span>
            )}
            {(streak.freezeTokens ?? 0) > 0 && (
              <span className="font-pixel ml-auto flex items-center gap-1" style={{ fontSize: 6, color: '#93C5FD', letterSpacing: 1 }}>
                <span style={{ fontSize: 10, lineHeight: 1 }}>❄</span>
                ×{streak.freezeTokens}
              </span>
            )}
          </div>
        )}

        {streak.brokenAt && streak.priorCurrent && streak.priorCurrent > 0 && (
          <div className="mb-3 px-2 py-2 relative" style={{
            ...OBSIDIAN_BTN,
            border: '1px solid rgba(255,107,157,0.35)',
          }}>
            <div className="flex items-center gap-2 mb-1.5">
              <IconFire size={12} />
              <span className="font-pixel" style={{ fontSize: 6, color: '#FF6B9D', letterSpacing: 1 }}>
                STREAK BROKE — DAY {streak.priorCurrent}
              </span>
            </div>
            <button
              disabled={!streakRepairAvailable}
              onClick={async () => {
                if (!streakRepairAvailable) return
                playSound('ui_modal_open')
                const ok = await repairStreak()
                if (ok) playSound('ui_modal_close')
              }}
              className="w-full px-2 py-1.5 flex items-center justify-center gap-1.5"
              style={{
                ...OBSIDIAN_BTN,
                opacity: streakRepairAvailable ? 1 : 0.5,
                cursor: streakRepairAvailable ? 'pointer' : 'not-allowed',
                border: '1px solid rgba(251,191,36,0.4)',
              }}
            >
              <IconCoin size={10} />
              <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>
                REPAIR · {streakRepairCost}
              </span>
              {coins < streakRepairCost && (
                <span className="font-pixel" style={{ fontSize: 5, color: '#7A6A75', letterSpacing: 0.5 }}>
                  (NEED {streakRepairCost - coins})
                </span>
              )}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {ACHIEVEMENT_DEFS.map(def => {
            const unlocked = !!achievements[def.id]
            const rc = RARITY_COLORS[def.rarity]
            return (
              <div
                key={def.id}
                className="flex items-center gap-3 px-3 py-2.5 relative"
                style={{
                  ...OBSIDIAN_BTN,
                  border: unlocked ? `1.5px solid ${rc.border}` : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: unlocked
                    ? `0 0 10px ${rc.glow}, ${OBSIDIAN_BTN.boxShadow}`
                    : OBSIDIAN_BTN.boxShadow as string,
                  background: unlocked
                    ? `linear-gradient(135deg, ${rc.bg} 0%, #050507 100%)`
                    : OBSIDIAN_BTN.background as string,
                }}
              >
                {unlocked && <Rivets inset={2} size={2} />}

                {/* Icon */}
                <div className="flex-shrink-0" style={{
                  width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  filter: unlocked
                    ? `drop-shadow(0 0 5px ${rc.glow})`
                    : 'grayscale(1) brightness(0.3)',
                }}>
                  {unlocked
                    ? <AchievementIcon iconName={def.icon} size={24} />
                    : <IconLock size={20} />}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-pixel" style={{
                      fontSize: 7, letterSpacing: 1, lineHeight: 1.2,
                      color: unlocked ? rc.text : '#5A4A55',
                    }}>
                      {unlocked ? def.title.toUpperCase() : def.description.toUpperCase()}
                    </span>
                  </div>
                  {unlocked && (
                    <span className="font-pixel" style={{
                      fontSize: 5, color: '#7A6A75', letterSpacing: 0.5,
                    }}>
                      {def.description}
                    </span>
                  )}
                </div>

                {/* Reward / rarity badge */}
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="font-pixel" style={{
                    fontSize: 5, letterSpacing: 1,
                    color: unlocked ? rc.text : '#3A3040',
                    textTransform: 'uppercase',
                  }}>
                    {def.rarity}
                  </span>
                  <div className="flex items-center gap-1">
                    <IconCoin size={8} />
                    <span className="font-pixel" style={{
                      fontSize: 6,
                      color: unlocked ? '#FFD700' : '#3A3040',
                    }}>
                      {unlocked ? `+${def.coins}` : def.coins}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
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

          {/* Rotate. Two taps, because the first one would otherwise kill a
              code the partner is halfway through typing. */}
          <button
            onClick={() => { playSound('ui_tap'); handleRotateCode() }}
            disabled={rotateState === 'busy'}
            className="w-full mt-2 py-2 transition-all active:translate-y-[1px]"
            style={{
              background: 'transparent',
              border: `1px solid ${rotateState === 'armed' ? 'rgba(251,191,36,0.5)' : 'rgba(120,113,108,0.3)'}`,
            }}>
            <span className="font-pixel" style={{
              fontSize: 7,
              letterSpacing: 1.5,
              color: rotateState === 'armed' ? '#fbbf24' : rotateState === 'failed' ? '#fca5a5' : '#8A7A85',
            }}>
              {rotateState === 'armed'  ? 'TAP AGAIN TO REPLACE'
             : rotateState === 'busy'   ? 'REPLACING…'
             : rotateState === 'failed' ? "COULDN'T REPLACE — RETRY"
             : 'NEW CODE'}
            </span>
          </button>
          <p className="mt-1.5" style={{ fontSize: 10, lineHeight: 1.5, color: '#6A5A65' }}>
            Replaces the code above. Anyone still holding the old one can no
            longer join.
          </p>
        </div>
      )}

      {/* ── Mood calendar (component leaves its own styling) ── */}
      {moods.length > 0 && user && (
        <div className="mb-4">
          <MoodCalendar moods={moods} userId={user.id} partnerName={partner?.name} />
        </div>
      )}

      {/* ── Mood alerts ── */}
      {partner && (
        <div className="mb-4 p-4 relative" style={OBSIDIAN_FACE}>
          <Rivets inset={4} size={3} />
          <div className="flex items-center gap-2 mb-3">
            <ObsidianChip accentRgb="255,107,157">
              <IconHeart size={12} />
              <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>MOOD ALERTS</span>
            </ObsidianChip>
          </div>
          <div className="flex items-center gap-3">
            <p className="flex-1 text-xs" style={{ color: '#9A8090', lineHeight: 1.5 }}>
              Notify me when {partner.name.split(' ')[0]} is having a tough day
            </p>
            <button
              onClick={() => { playSound('ui_toggle'); toggleMoodAlerts() }}
              role="switch"
              aria-checked={moodAlerts}
              className="flex-shrink-0 relative active:translate-y-[1px] transition-transform"
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: moodAlerts
                  ? `linear-gradient(180deg, ${PINK_HI}, ${PINK} 60%, ${PINK_LO})`
                  : 'linear-gradient(180deg, #2a2a32, #14141a)',
                border: `1px solid ${moodAlerts ? accentA(0.6) : 'rgba(255,255,255,0.1)'}`,
                boxShadow: moodAlerts ? `0 0 8px ${accentA(0.45)}, inset 0 1px 0 rgba(255,255,255,0.25)` : 'inset 0 1px 2px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: moodAlerts ? 22 : 2,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                transition: 'left 160ms ease-out',
              }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 3 — 4-countdown strip + dates ── */}
      <div className="mb-4 p-4 relative" style={OBSIDIAN_FACE}>
        <Rivets inset={4} size={3} />
        <div className="flex items-center gap-2 mb-3">
          <ObsidianChip accentRgb="245,200,66">
            <IconClock size={12} />
            <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>SPECIAL DAYS</span>
          </ObsidianChip>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {([
            { label: 'YOU',  date: myBirthday,        emoji: '🤎' },
            { label: 'HER',  date: partner?.birthday ?? '', emoji: '🩷' },
            { label: 'EREN', date: erenBirthday,      emoji: '🐾' },
            { label: 'US',   date: coupleAnniversary, emoji: '💍' },
          ] as const).map(c => {
            const days = daysUntil(c.date)
            return (
              <div key={c.label} className="flex flex-col items-center gap-1 p-2 relative"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(245,200,66,0.18)',
                  borderRadius: 4,
                }}>
                <span style={{ fontSize: 14 }}>{c.emoji}</span>
                <span className="font-pixel" style={{ fontSize: 5, color: '#A78BFA', letterSpacing: 1 }}>{c.label}</span>
                <span className="font-pixel" style={{
                  fontSize: 7, color: days !== null ? '#F5C842' : '#5A4A55',
                  textShadow: days !== null ? '0 0 4px rgba(245,200,66,0.4)' : 'none',
                }}>
                  {days === null ? '— —' : days === 0 ? 'TODAY!' : `${days}D`}
                </span>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs">
          <label className="flex items-center justify-between gap-3" style={{ color: '#9A8090' }}>
            <span>Your birthday</span>
            <input type="date" value={myBirthday} onChange={e => saveMyBirthday(e.target.value)}
              style={{ background: '#1A1018', color: '#F0E0E8', border: '1px solid rgba(245,200,66,0.3)', padding: '4px 6px', borderRadius: 3, fontSize: 11 }} />
          </label>
          <label className="flex items-center justify-between gap-3" style={{ color: '#9A8090' }}>
            <span>Eren&apos;s birthday</span>
            <input type="date" value={erenBirthday} onChange={e => saveErenBirthday(e.target.value)}
              style={{ background: '#1A1018', color: '#F0E0E8', border: '1px solid rgba(245,200,66,0.3)', padding: '4px 6px', borderRadius: 3, fontSize: 11 }} />
          </label>
          <label className="flex items-center justify-between gap-3" style={{ color: '#9A8090' }}>
            <span>Your anniversary</span>
            <input type="date" value={coupleAnniversary} onChange={e => saveCoupleAnniversary(e.target.value)}
              style={{ background: '#1A1018', color: '#F0E0E8', border: '1px solid rgba(245,200,66,0.3)', padding: '4px 6px', borderRadius: 3, fontSize: 11 }} />
          </label>
        </div>
      </div>

      {/* ── Phase 3 — Notification opt-ins ── */}
      <div className="mb-4 p-4 relative" style={OBSIDIAN_FACE}>
        <Rivets inset={4} size={3} />
        <div className="flex items-center gap-2 mb-3">
          <ObsidianChip accentRgb="167,139,250">
            <IconHeart size={12} />
            <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>NOTIFICATIONS</span>
          </ObsidianChip>
        </div>
        {([
          { label: "When the partner grants Eren's wish", value: wishPush,   on: toggleWishPush },
          { label: 'When new memories land on the wall',  value: memoryPush, on: toggleMemoryPush },
          { label: 'Quieter Eren — half the chatter, no memory pushes', value: quietEren, on: toggleQuietEren },
        ] as const).map(row => (
          <div key={row.label} className="flex items-center gap-3 mb-2">
            <p className="flex-1 text-xs" style={{ color: '#9A8090', lineHeight: 1.5 }}>{row.label}</p>
            <button
              onClick={() => { playSound('ui_toggle'); row.on() }}
              role="switch"
              aria-checked={row.value}
              className="flex-shrink-0 relative active:translate-y-[1px] transition-transform"
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: row.value
                  ? `linear-gradient(180deg, ${PINK_HI}, ${PINK} 60%, ${PINK_LO})`
                  : 'linear-gradient(180deg, #2a2a32, #14141a)',
                border: `1px solid ${row.value ? accentA(0.6) : 'rgba(255,255,255,0.1)'}`,
                boxShadow: row.value ? `0 0 8px ${accentA(0.45)}, inset 0 1px 0 rgba(255,255,255,0.25)` : 'inset 0 1px 2px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: row.value ? 22 : 2,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                transition: 'left 160ms ease-out',
              }} />
            </button>
          </div>
        ))}
      </div>

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
                onClick={() => { playSound('ui_toggle'); setTheme(t.key) }}
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

      {/* ── Report and block ──
          Play's UGC policy wants both, reachable in-app. They are separate
          buttons on purpose: reporting is for us to act on and changes nothing
          for the reporter, while blocking ends the shared home immediately.
          Someone frightened should be able to do the second without the
          first, and someone who just wants it looked at should not have to
          blow up their household to say so. */}
      {partner && (
        <>
          <button
            onClick={() => { playSound('ui_tap'); setReportOpen(true) }}
            className="w-full flex items-center justify-center gap-2 py-3 mt-3 transition-all active:translate-y-[1px]"
            style={{ background: 'transparent', border: '1px solid rgba(120,113,108,0.35)' }}>
            <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1.5, color: '#8A7A85' }}>
              REPORT {partner.name.split(' ')[0].toUpperCase()}
            </span>
          </button>

          <button
            onClick={() => { playSound('ui_tap'); setBlockOpen(true) }}
            className="w-full flex items-center justify-center gap-2 py-3 mt-3 transition-all active:translate-y-[1px]"
            style={{ background: 'transparent', border: '1px solid rgba(248,113,113,0.35)' }}>
            <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1.5, color: '#fca5a5' }}>
              BLOCK {partner.name.split(' ')[0].toUpperCase()}
            </span>
          </button>
        </>
      )}

      {reportOpen && partner && (
        <ReportSheet
          target="profile"
          targetId={partner.id}
          what={partner.name.split(' ')[0]}
          onClose={() => setReportOpen(false)}
        />
      )}

      {blockOpen && partner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
             style={{ background: 'rgba(5,5,7,0.82)' }}
             role="dialog" aria-modal="true" aria-labelledby="block-title">
          <div style={{ ...OBSIDIAN_BTN, maxWidth: 340, padding: 20, border: '2px solid rgba(248,113,113,0.5)' }}>
            <Rivets inset={4} size={3} />
            <p id="block-title" className="font-pixel mb-3"
               style={{ fontSize: 9, letterSpacing: 1, color: '#fca5a5' }}>
              BLOCK {partner.name.split(' ')[0].toUpperCase()}
            </p>
            <p className="mb-3" style={{ fontSize: 12, lineHeight: 1.55, color: '#C9BFC5' }}>
              You leave this home right now, and {partner.name.split(' ')[0]} can
              never share a home with you again — not even with a new invite code.
            </p>
            <p className="mb-3" style={{ fontSize: 12, lineHeight: 1.55, color: '#C9BFC5' }}>
              Eren and everything you wrote together stay with them. Your account
              is untouched, and you can start a new home straight after.
            </p>
            {/* Reporting reads the content out of the household you share, so
                once you have left there is nothing left for a report to point
                at. Nobody should discover that ordering afterwards. */}
            <button
              onClick={() => { playSound('ui_tap'); setBlockOpen(false); setReportOpen(true) }}
              disabled={blocking}
              className="w-full py-2 mb-4"
              style={{ background: 'transparent', border: '1px solid rgba(251,191,36,0.45)', opacity: blocking ? 0.5 : 1 }}>
              <span style={{ fontSize: 12, color: '#fbbf24' }}>
                Want us to look at what they did? Report first —
                you cannot report once you have left.
              </span>
            </button>
            {blockErr && (
              <p className="mb-3" style={{ fontSize: 11, color: '#fca5a5' }}>{blockErr}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { playSound('ui_tap'); setBlockOpen(false); setBlockErr(null) }}
                disabled={blocking}
                className="flex-1 py-2"
                style={{ ...OBSIDIAN_BTN, opacity: blocking ? 0.5 : 1 }}>
                <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: '#C9BFC5' }}>CANCEL</span>
              </button>
              <button
                onClick={handleBlock}
                disabled={blocking}
                className="flex-1 py-2"
                style={{ ...OBSIDIAN_BTN, border: '1px solid rgba(248,113,113,0.6)', opacity: blocking ? 0.5 : 1 }}>
                <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: '#fca5a5' }}>
                  {blocking ? 'BLOCKING…' : 'BLOCK'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Leave household ──
          The exit from a home you joined by mistake, or one you no longer
          want to be in. Without it, typing someone's invite code once put
          you inside their journal, notes, moods and memory wall permanently
          — the only way out was deleting your whole account. */}
      {profile?.household_id && (
        <button
          onClick={() => { playSound('ui_tap'); setLeaveOpen(true) }}
          className="w-full flex items-center justify-center gap-2 py-3 mt-3 transition-all active:translate-y-[1px]"
          style={{ background: 'transparent', border: '1px solid rgba(251,191,36,0.35)' }}>
          <IconHouse size={12} />
          <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1.5, color: '#c9a227' }}>LEAVE THIS HOME</span>
        </button>
      )}

      {leaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
             style={{ background: 'rgba(5,5,7,0.82)' }}
             role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div style={{ ...OBSIDIAN_BTN, maxWidth: 340, padding: 20, border: '2px solid rgba(251,191,36,0.5)' }}>
            <Rivets inset={4} size={3} />
            <p id="leave-title" className="font-pixel mb-3"
               style={{ fontSize: 9, letterSpacing: 1, color: '#fbbf24' }}>LEAVE THIS HOME</p>
            <p className="mb-3" style={{ fontSize: 12, lineHeight: 1.55, color: '#C9BFC5' }}>
              {partner
                ? `Eren and everything you two wrote together stay with ${partner.name.split(' ')[0]}. You keep your account, but you lose access to this home.`
                : 'You are the only one here, so this home, Eren, and every note, memory and photo in it are deleted with you. Your account stays.'}
            </p>
            <p className="mb-4" style={{ fontSize: 12, lineHeight: 1.55, color: '#C9BFC5' }}>
              {partner
                ? 'The invite code is replaced on your way out, so coming back needs a new one.'
                : 'You can start a new home or join one straight after.'}
            </p>
            {leaveErr && (
              <p className="mb-3" style={{ fontSize: 11, color: '#fca5a5' }}>{leaveErr}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { playSound('ui_tap'); setLeaveOpen(false); setLeaveErr(null) }}
                disabled={leaving}
                className="flex-1 py-2"
                style={{ ...OBSIDIAN_BTN, opacity: leaving ? 0.5 : 1 }}>
                <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: '#C9BFC5' }}>STAY</span>
              </button>
              <button
                onClick={handleLeaveHousehold}
                disabled={leaving}
                className="flex-1 py-2"
                style={{ ...OBSIDIAN_BTN, border: '1px solid rgba(251,191,36,0.6)', opacity: leaving ? 0.5 : 1 }}>
                <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: '#fbbf24' }}>
                  {leaving ? 'LEAVING…' : 'LEAVE'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete account ──
          Google Play requires in-app account deletion for any app with
          account creation. The two-step confirm is not friction for its own
          sake: deletion is irreversible, and the second step is where we
          disclose that co-authored content stays with the partner without a
          name on it. Anonymising silently would not be informed consent. */}
      <button
        onClick={() => { playSound('ui_tap'); setDeleteOpen(true) }}
        className="w-full flex items-center justify-center gap-2 py-3 mt-3 transition-all active:translate-y-[1px]"
        style={{ background: 'transparent', border: '1px solid rgba(120,113,108,0.35)' }}>
        <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1.5, color: '#8A7A85' }}>DELETE ACCOUNT</span>
      </button>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
             style={{ background: 'rgba(5,5,7,0.82)' }}
             role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div style={{ ...OBSIDIAN_BTN, maxWidth: 340, padding: 20, border: '2px solid rgba(248,113,113,0.5)' }}>
            <Rivets inset={4} size={3} />
            <p id="del-title" className="font-pixel mb-3"
               style={{ fontSize: 9, letterSpacing: 1, color: '#fca5a5' }}>DELETE ACCOUNT</p>
            <p className="mb-3" style={{ fontSize: 12, lineHeight: 1.55, color: '#C9BFC5' }}>
              This erases your login, your chats with Eren, your items, scores and
              moods. It cannot be undone.
            </p>
            <p className="mb-4" style={{ fontSize: 12, lineHeight: 1.55, color: '#C9BFC5' }}>
              {partner
                ? 'Notes and memories you added stay in your shared home so your partner keeps their history — but your name comes off them.'
                : 'You are the only one here, so the home, Eren, and every photo you added are deleted too.'}
            </p>
            {deleteErr && (
              <p className="mb-3" style={{ fontSize: 11, color: '#fca5a5' }}>{deleteErr}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { playSound('ui_tap'); setDeleteOpen(false); setDeleteErr(null) }}
                disabled={deleting}
                className="flex-1 py-2"
                style={{ ...OBSIDIAN_BTN, opacity: deleting ? 0.5 : 1 }}>
                <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: '#C9BFC5' }}>KEEP IT</span>
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-2"
                style={{ ...OBSIDIAN_BTN, border: '1px solid rgba(248,113,113,0.6)', opacity: deleting ? 0.5 : 1 }}>
                <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: '#fca5a5' }}>
                  {deleting ? 'DELETING…' : 'DELETE'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

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
