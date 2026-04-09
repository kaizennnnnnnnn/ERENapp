'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTimeTracking } from '@/hooks/useTimeTracking'
import MoodGate from '@/components/MoodGate'
import type { UserMood } from '@/types'
import { MOOD_CONFIGS } from '@/types'
import { useCare } from '@/contexts/CareContext'
import { useTasks } from '@/contexts/TaskContext'
import { xpForNextLevel, totalXpForLevel } from '@/lib/tasks'
import { format } from 'date-fns'
import Link from 'next/link'
import { Bell, Sparkles, Image, User, DoorOpen } from 'lucide-react'
import TaskPanel from '@/components/TaskPanel'
import ReminderSheet from '@/components/ReminderSheet'
import { registerSW } from '@/lib/reminders'

interface XpParticle {
  id: number; x: number; y: number; tx: number; ty: number
  text: string; delay: number; duration: number
  size: number; color: string; glow: string
}

const MOOD_GREETINGS: Record<string, string> = {
  happy:   'Eren is so happy today!',
  idle:    'Eren is chilling...',
  hungry:  'Feed me, hooman!',
  sleepy:  'Eren is sleepy... shhh',
  playful: 'Wanna play? Let\'s go!',
  angry:   'Eren is not amused.',
}

const MINI_STATS = [
  { key: 'happiness',     icon: '💕', color: '#f472b6' },
  { key: 'hunger',        icon: '🍗', color: '#fbbf24' },
  { key: 'energy',        icon: '⚡', color: '#34d399' },
  { key: 'sleep_quality', icon: '💤', color: '#818cf8' },
  { key: 'cleanliness',   icon: '🛁', color: '#38bdf8' },
] as const

export default function HomePage() {
  const router   = useRouter()
  const supabase = createClient()
  const { user, profile, loading: authLoading } = useAuth()
  const { stats, loading } = useErenStats(profile?.household_id ?? null)
  const { setIsSick, openScene } = useCare()
  const { xp, level, coins: userCoins } = useTasks()
  useTimeTracking(user?.id ?? null)

  // XP bar
  const xpIntoLevel = xp - totalXpForLevel(level)
  const xpNeeded    = xpForNextLevel(level)
  const xpPct       = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
  const xpBarRef    = useRef<HTMLDivElement>(null)
  const prevXpRef   = useRef(xp)
  const particleIdRef = useRef(0)
  const [xpParticles, setXpParticles] = useState<XpParticle[]>([])

  useEffect(() => { registerSW() }, [])

  // XP sparkle particles Eren → bar
  useEffect(() => {
    if (xp <= prevXpRef.current) { prevXpRef.current = xp; return }
    const gained = xp - prevXpRef.current
    prevXpRef.current = xp
    const erenEl = document.getElementById('eren-img')
    const barEl  = xpBarRef.current
    if (!erenEl || !barEl) return
    const erenRect = erenEl.getBoundingClientRect()
    const barRect  = barEl.getBoundingClientRect()
    const srcX = erenRect.left + erenRect.width / 2
    const srcY = erenRect.top  + erenRect.height * 0.2
    const dstX = barRect.left  + barRect.width * (xpPct / 100)
    const dstY = barRect.top   + barRect.height / 2

    // Scale particle count and duration based on XP gained
    const intensity = Math.min(1, gained / 50) // 0-1 based on XP (50+ = max)
    const waveCount = Math.max(2, Math.round(2 + intensity * 5)) // 2-7 waves
    const particlesPerWave = Math.max(4, Math.round(4 + intensity * 8)) // 4-12 per wave
    const totalDuration = Math.round(1500 + intensity * 3000) // 1.5s - 4.5s
    const waveInterval = Math.round(totalDuration / (waveCount + 1))

    const sparkleEmojis = ['✦', '✧', '⬥', '◆']
    const colors = ['#C084FC', '#A78BFA', '#7C3AED', '#E9D5FF', '#F0ABFC', '#FBBF24', '#FDE68A']
    const glows  = ['rgba(192,132,252,0.8)', 'rgba(167,139,250,0.7)', 'rgba(124,58,237,0.6)', 'rgba(251,191,36,0.7)']

    const allParticles: XpParticle[] = []

    for (let w = 0; w < waveCount; w++) {
      const baseDelay = w * waveInterval
      const count = w === 0 ? particlesPerWave + 2 : particlesPerWave

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8
        const spread = 30 + Math.random() * 50
        const px = srcX + Math.cos(angle) * spread
        const py = srcY + Math.sin(angle) * spread * 0.6 - Math.random() * 30

        const isLabel = w === 0 && i < 1
        const color = colors[Math.floor(Math.random() * colors.length)]
        const glow = glows[Math.floor(Math.random() * glows.length)]
        const dur = 1.2 + Math.random() * 0.8 // 1.2-2s flight time

        allParticles.push({
          id: particleIdRef.current++,
          x: px, y: py,
          tx: dstX - px + (Math.random() - 0.5) * 20,
          ty: dstY - py,
          text: isLabel ? `+${gained}` : sparkleEmojis[Math.floor(Math.random() * sparkleEmojis.length)],
          delay: baseDelay + i * (40 + Math.random() * 30),
          duration: dur,
          size: isLabel ? 9 : 6 + Math.random() * 8,
          color: isLabel ? '#FBBF24' : color,
          glow,
        })
      }
    }

    setXpParticles(p => [...p, ...allParticles])
    setTimeout(() => setXpParticles([]), totalDuration + 2500)
  }, [xp]) // eslint-disable-line react-hooks/exhaustive-deps

  const [todayMood, setTodayMood]         = useState<UserMood | null>(null)
  const [moodChecked, setMoodChecked]     = useState(false)
  const [toast, setToast]                 = useState<string | null>(null)
  const [showReminders, setShowReminders] = useState(false)
  const [showRooms, setShowRooms]         = useState(false)
  const [roomReady, setRoomReady]         = useState(false)

  // Fast localStorage check
  useEffect(() => {
    if (!user?.id) return
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const cached = localStorage.getItem(`pocket_eren_mood_${user.id}_${todayStr}`)
    if (cached) { setTodayMood(cached as UserMood); setMoodChecked(true) }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!authLoading && !profile?.household_id) setMoodChecked(true)
  }, [authLoading, profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stats) setIsSick(stats.is_sick ?? false)
  }, [stats?.is_sick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Preload background + Eren before showing the room
  useLayoutEffect(() => { setRoomReady(false) }, [])
  useEffect(() => {
    const srcs = ['/livingRoom.png', '/erenGood.png']
    let loaded = 0
    srcs.forEach(src => {
      const img = new window.Image()
      img.onload = img.onerror = () => { loaded++; if (loaded >= srcs.length) setRoomReady(true) }
      img.src = src
    })
  }, [])

  // Load today's mood
  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    const timeout = setTimeout(() => setMoodChecked(true), 6000)
    async function load() {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const { data } = await supabase
          .from('daily_moods').select('mood').eq('user_id', user!.id).eq('date', todayStr).maybeSingle()
        if (data) setTodayMood(data.mood as UserMood)
      } catch { /* ignore */ } finally {
        clearTimeout(timeout)
        setMoodChecked(true)
      }
    }
    load()
    return () => clearTimeout(timeout)
  }, [profile?.household_id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Loading ──
  const LoadingScreen = (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-pink-50 to-[#FDF6FF]">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #C084FC 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="animate-float relative z-10">
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 150, height: 150, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>
      <p className="font-pixel text-gray-400 animate-pulse-soft relative z-10" style={{ fontSize: 8 }}>
        LOADING EREN<span className="animate-cursor">_</span>
      </p>
    </div>
  )

  if (authLoading || !moodChecked) return LoadingScreen

  if (!profile?.household_id) {
    return (
      <div className="page-scroll flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 100, height: 100, objectFit: 'contain', imageRendering: 'pixelated' }} />
        <p className="font-bold text-gray-700">No household found</p>
      </div>
    )
  }

  if (!todayMood) {
    return (
      <MoodGate
        userId={user!.id}
        userName={profile?.name ?? 'friend'}
        onDone={mood => {
          const todayStr = format(new Date(), 'yyyy-MM-dd')
          localStorage.setItem(`pocket_eren_mood_${user!.id}_${todayStr}`, mood)
          setTodayMood(mood)
          showToast(`${MOOD_CONFIGS[mood].emoji} Mood saved!`)
        }}
      />
    )
  }

  if (loading || !stats || !roomReady) return LoadingScreen

  const mood = (stats.mood ?? 'idle') as string

  return (
    <>
      {/* ── XP sparkle particles ── */}
      {xpParticles.map(p => (
        <div key={p.id} className="fixed pointer-events-none z-50 font-pixel"
          style={{
            left: p.x, top: p.y,
            fontSize: p.size,
            color: p.color,
            whiteSpace: 'nowrap',
            textShadow: `0 0 6px ${p.glow}, 0 0 12px ${p.glow}`,
            animationDelay: `${p.delay}ms`,
            animation: `xpSparkle ${p.duration}s cubic-bezier(0.22, 0.61, 0.36, 1) forwards`,
            ...({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` } as React.CSSProperties),
          }}>
          {p.text}
        </div>
      ))}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2.5 whitespace-nowrap"
          style={{ background: '#1F1F2E', borderRadius: 3, border: '2px solid #3A3A5E', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast}
        </div>
      )}

      {showReminders && <ReminderSheet onClose={() => setShowReminders(false)} />}

      {/* ══ FULL SCREEN ROOM ══ */}
      <div className="fixed inset-0" style={{ zIndex: 0 }}>

        {/* Background image */}
        <img src="/livingRoom.png" alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center' }} draggable={false} />

        {mood === 'happy' && (
          <>
            <Sparkles size={11} className="absolute text-yellow-400 animate-sparkle" style={{ top: '30%', left: '10%', zIndex: 2 }} />
            <Sparkles size={9}  className="absolute text-pink-400  animate-sparkle" style={{ top: '25%', right: '15%', zIndex: 2, animationDelay: '0.7s' }} />
          </>
        )}

        {/* === EREN === */}
        <div className="absolute" style={{
          bottom: '10%', left: '50%', transform: 'translateX(-50%)', zIndex: 2,
          filter: mood === 'angry' ? 'hue-rotate(340deg) saturate(1.3)' : mood === 'sleepy' ? 'brightness(0.85)' : 'none',
        }}>
          <img id="eren-img" src="/erenGood.png" alt="Eren" draggable={false}
            style={{ width: 200, height: 200, objectFit: 'contain', imageRendering: 'pixelated' }} />
        </div>

        {/* Speech bubble */}
        <div className="absolute" style={{ bottom: '32%', left: '55%', zIndex: 3, background: 'white', borderRadius: 4, border: '2px solid #F0D8FF', boxShadow: '2px 2px 0 #E0CCFF', padding: '4px 10px', whiteSpace: 'nowrap' }}>
          <p className="text-xs text-gray-600 font-medium">{MOOD_GREETINGS[mood] ?? MOOD_GREETINGS.idle}</p>
          <div className="absolute" style={{ bottom: -6, left: 10, width: 8, height: 6, background: 'white', clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)' }} />
        </div>

        {/* ══ HUD OVERLAY (top of room) ══ */}
        <div className="absolute top-0 left-0 right-0 z-10 px-3 pt-3 flex flex-col gap-2">

          {/* Row 1: XP bar + Coins + Bell + Pics + Profile */}
          <div className="flex items-center gap-2">
            <div ref={xpBarRef} className="flex-1 flex items-center gap-1.5 px-2.5 h-9"
              style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)', borderRadius: 8, border: '1px solid rgba(167,139,250,0.35)' }}>
              <span className="font-pixel text-purple-300 flex-shrink-0" style={{ fontSize: 7 }}>Lv.{level}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg, #A78BFA, #7C3AED)' }} />
                <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 60%)' }} />
              </div>
              <span className="font-pixel text-purple-300 flex-shrink-0" style={{ fontSize: 6 }}>{xpIntoLevel}/{xpNeeded}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 h-9"
              style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)', borderRadius: 8, border: '1px solid rgba(245,200,66,0.4)' }}>
              <span style={{ fontSize: 14 }}>🪙</span>
              <span className="font-pixel text-yellow-300" style={{ fontSize: 9 }}>{userCoins}</span>
            </div>
            <button onClick={() => setShowReminders(true)}
              className="w-9 h-9 flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}>
              <Bell size={16} className="text-white/80" />
            </button>
            <Link href="/memories"
              className="w-9 h-9 flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)', borderRadius: 8, border: '1px solid rgba(255,150,200,0.3)' }}>
              <Image size={16} style={{ color: '#FF9DC0' }} />
            </Link>
            <Link href="/profile"
              className="w-9 h-9 flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)', borderRadius: 8, border: '1px solid rgba(167,139,250,0.3)' }}>
              <User size={16} style={{ color: '#A78BFA' }} />
            </Link>
            <div className="relative">
              <button onClick={() => setShowRooms(r => !r)}
                className="w-9 h-9 flex items-center justify-center active:scale-90 transition-transform"
                style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(8px)', borderRadius: 8, border: '1px solid rgba(52,211,153,0.4)' }}>
                <DoorOpen size={16} style={{ color: '#34D399' }} />
              </button>
              {showRooms && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowRooms(false)} />
                  <div className="absolute right-0 top-11 z-30 flex flex-col gap-1 p-2"
                    style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', minWidth: 140 }}>
                    {([
                      { id: 'feed',   label: 'Kitchen',   icon: '🍗', color: '#F5C842' },
                      { id: 'play',   label: 'Playroom',  icon: '🧶', color: '#FF6B9D' },
                      { id: 'sleep',  label: 'Bedroom',   icon: '💤', color: '#818CF8' },
                      { id: 'wash',   label: 'Bathroom',  icon: '🛁', color: '#38BDF8' },
                      { id: 'vet',    label: 'Vet Office', icon: '💊', color: '#34D399' },
                      { id: 'school', label: 'Serbian Class', icon: '📖', color: '#F59E0B' },
                    ] as const).map(room => (
                      <button key={room.id} onClick={() => { setShowRooms(false); openScene(room.id) }}
                        className="flex items-center gap-2 px-3 py-2 active:scale-95 transition-transform"
                        style={{ borderRadius: 6, background: 'rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 14 }}>{room.icon}</span>
                        <span className="font-pixel text-white" style={{ fontSize: 7 }}>{room.label.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Mini stat bars */}
          <div className="flex gap-1.5">
            {MINI_STATS.map(({ key, icon, color }) => {
              const raw = (stats as unknown as Record<string, unknown>)[key]
              const val = Math.round(Math.max(0, Math.min(100, (typeof raw === 'number' ? raw : 0))))
              const barColor = val >= 60 ? color : val >= 30 ? '#facc15' : '#f87171'
              return (
                <div key={key} className="flex-1 flex items-center gap-1 px-2 py-1.5"
                  style={{ background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(6px)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                  <div className="flex-1 overflow-hidden" style={{ height: 7, borderRadius: 3, background: 'rgba(255,255,255,0.15)' }}>
                    <div style={{ width: `${val}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width 0.5s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Row 3: Quests */}
          <TaskPanel />
        </div>

        {/* Dot indicators — home active + 4 care room dots */}
        <div className="absolute bottom-4 left-1/2 z-10 flex items-center gap-2 px-3 py-1.5"
          style={{ transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.35)', borderRadius: 20, backdropFilter: 'blur(6px)', pointerEvents: 'none' }}>
          {/* Home dot — active */}
          <div style={{ width: 18, height: 7, borderRadius: 4, background: '#FF6B9D', boxShadow: '0 0 6px 2px #FF6B9D88', transition: 'all 0.25s ease' }} />
          {/* Care room dots */}
          {['feed','play','sleep','wash','vet','school'].map(s => (
            <div key={s} style={{ width: 7, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.4)', transition: 'all 0.25s ease' }} />
          ))}
        </div>

      </div>
    </>
  )
}
