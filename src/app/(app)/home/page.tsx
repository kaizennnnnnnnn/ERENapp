'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
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
import { Bell, Sparkles } from 'lucide-react'
import TaskPanel from '@/components/TaskPanel'
import ReminderSheet from '@/components/ReminderSheet'
import { registerSW } from '@/lib/reminders'

interface XpParticle { id: number; x: number; y: number; tx: number; ty: number; text: string; delay: number }

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
  const { setIsSick } = useCare()
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

  // XP particles Eren → bar
  useEffect(() => {
    if (xp <= prevXpRef.current) { prevXpRef.current = xp; return }
    const gained = xp - prevXpRef.current
    prevXpRef.current = xp
    const erenEl = document.getElementById('eren-img')
    const barEl  = xpBarRef.current
    if (!erenEl || !barEl) return
    const erenRect = erenEl.getBoundingClientRect()
    const barRect  = barEl.getBoundingClientRect()
    const srcX = erenRect.left + erenRect.width  / 2
    const srcY = erenRect.top  + erenRect.height * 0.25
    const dstX = barRect.left  + barRect.width   * (xpPct / 100)
    const dstY = barRect.top   + barRect.height  / 2
    const items = ['✦', '★', '✨', '⭐', '💫', '·', '•']
    function makeWave(count: number, baseDelay: number, labelCount: number): XpParticle[] {
      return Array.from({ length: count }, (_, i) => {
        const px = srcX + (Math.random() - 0.5) * 70
        const py = srcY + (Math.random() - 0.5) * 60
        return { id: particleIdRef.current++, x: px, y: py, tx: dstX - px, ty: dstY - py,
          text: i < labelCount ? `+${gained}XP` : items[Math.floor(Math.random() * items.length)], delay: baseDelay + i * 90 }
      })
    }
    setXpParticles(p => [...p, ...makeWave(16, 0, 3), ...makeWave(12, 600, 1), ...makeWave(8, 1300, 0)])
    setTimeout(() => setXpParticles([]), 4200)
  }, [xp]) // eslint-disable-line react-hooks/exhaustive-deps

  const [todayMood, setTodayMood]     = useState<UserMood | null>(null)
  const [moodChecked, setMoodChecked] = useState(false)
  const [toast, setToast]             = useState<string | null>(null)
  const [showReminders, setShowReminders] = useState(false)

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

  if (loading || !stats) return LoadingScreen

  const mood = (stats.mood ?? 'idle') as string

  return (
    <>
      {/* ── XP particles ── */}
      {xpParticles.map(p => (
        <div key={p.id} className="fixed pointer-events-none z-50 font-pixel"
          style={{ left: p.x, top: p.y, fontSize: p.text.length > 2 ? 7 : 13, color: '#A78BFA', whiteSpace: 'nowrap',
            animationDelay: `${p.delay}ms`, animation: 'flyToBar 1.8s ease-in forwards',
            ...({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` } as React.CSSProperties) }}>
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

        {/* === WALL (top 60%) === */}
        <div className="absolute inset-x-0 top-0" style={{ height: '60%', background: '#F0E6D0' }}>
          <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(210,180,140,0.2) 28px, rgba(210,180,140,0.2) 30px)' }} />
          {/* Crown molding */}
          <div className="absolute top-0 left-0 right-0 h-3" style={{ background: '#D4B896', borderBottom: '2px solid #B89060' }} />

          {/* Window center */}
          <div className="absolute" style={{ top: 90, left: '50%', transform: 'translateX(-50%)', width: 90, height: 72, border: '3px solid #7A5030' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #87CEEB, #B8E0FF)' }} />
            <div className="absolute" style={{ top: 0, bottom: 0, left: '50%', width: 3, background: '#7A5030', transform: 'translateX(-50%)', zIndex: 2 }} />
            <div className="absolute" style={{ left: 0, right: 0, top: '50%', height: 3, background: '#7A5030', transform: 'translateY(-50%)', zIndex: 2 }} />
            <div className="absolute" style={{ top: 8, left: 5, width: 20, height: 9, background: 'white', borderRadius: 4, opacity: 0.85, zIndex: 1 }} />
            <div className="absolute" style={{ top: 10, right: 7, width: 15, height: 8, background: 'white', borderRadius: 3, opacity: 0.8, zIndex: 1 }} />
          </div>
          {/* Window sill */}
          <div className="absolute" style={{ top: 162, left: '50%', transform: 'translateX(-50%)', width: 104, height: 6, background: '#7A5030' }} />

          {/* Shelf + books left */}
          <div className="absolute" style={{ top: 110, left: 12, width: 58, height: 5, background: '#A07850', border: '2px solid #7A5030' }} />
          <div className="absolute" style={{ top: 92, left: 14, width: 10, height: 20, background: '#E8705A', border: '2px solid #C05040' }} />
          <div className="absolute" style={{ top: 92, left: 26, width: 8, height: 20, background: '#70B870', border: '2px solid #508850' }} />
          <div className="absolute" style={{ top: 94, left: 36, width: 10, height: 18, background: '#F0C040', border: '2px solid #C09020' }} />

          {/* Plant right */}
          <div className="absolute" style={{ bottom: 0, right: 16 }}>
            <div style={{ width: 24, height: 20, background: '#C87840', border: '2px solid #A05830', borderRadius: '0 0 4px 4px', margin: '0 auto' }} />
            <div className="absolute" style={{ bottom: 18, left: '50%', transform: 'translateX(-50%)', width: 20, height: 24, background: '#50A850', border: '2px solid #308030', borderRadius: '10px 10px 2px 2px' }} />
            <div className="absolute" style={{ bottom: 24, left: 0, width: 15, height: 13, background: '#60B860', border: '2px solid #408040', borderRadius: '6px 2px 2px 6px', transform: 'rotate(-25deg)' }} />
            <div className="absolute" style={{ bottom: 24, right: 0, width: 15, height: 13, background: '#60B860', border: '2px solid #408040', borderRadius: '2px 6px 6px 2px', transform: 'rotate(25deg)' }} />
          </div>

          {mood === 'happy' && (
            <>
              <Sparkles size={11} className="absolute text-yellow-400 animate-sparkle" style={{ bottom: 20, left: 30 }} />
              <Sparkles size={9}  className="absolute text-pink-400  animate-sparkle" style={{ bottom: 40, right: 80, animationDelay: '0.7s' }} />
            </>
          )}
        </div>

        {/* === FLOOR (bottom 40%) === */}
        <div className="absolute inset-x-0 bottom-0" style={{
          height: '40%', background: '#C8A060',
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 32px, rgba(0,0,0,0.07) 32px, rgba(0,0,0,0.07) 34px)',
          borderTop: '3px solid #A07840',
        }} />

        {/* Rug */}
        <div className="absolute" style={{ bottom: 90, left: '50%', transform: 'translateX(-50%)', width: 180, height: 60, background: '#C03050', border: '3px solid #902040', borderRadius: 4, zIndex: 1 }}>
          <div className="absolute inset-2" style={{ border: '2px solid #E05070', borderRadius: 2 }} />
        </div>

        {/* === EREN === */}
        <div className="absolute" style={{
          bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
          filter: mood === 'angry' ? 'hue-rotate(340deg) saturate(1.3)' : mood === 'sleepy' ? 'brightness(0.85)' : 'none',
        }}>
          <img id="eren-img" src="/erenGood.png" alt="Eren" draggable={false}
            style={{ width: 170, height: 170, objectFit: 'contain', imageRendering: 'pixelated' }} />
        </div>

        {/* Speech bubble */}
        <div className="absolute" style={{ bottom: 250, left: '55%', zIndex: 3, background: 'white', borderRadius: 4, border: '2px solid #F0D8FF', boxShadow: '2px 2px 0 #E0CCFF', padding: '4px 10px', whiteSpace: 'nowrap' }}>
          <p className="text-xs text-gray-600 font-medium">{MOOD_GREETINGS[mood] ?? MOOD_GREETINGS.idle}</p>
          <div className="absolute" style={{ bottom: -6, left: 10, width: 8, height: 6, background: 'white', clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)' }} />
        </div>

        {/* ══ HUD OVERLAY (top of room) ══ */}
        <div className="absolute top-0 left-0 right-0 z-10 px-3 pt-3 flex flex-col gap-2">

          {/* Row 1: XP bar + Coins + Bell */}
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
          </div>

          {/* Row 2: Mini stat bars */}
          <div className="flex gap-1.5">
            {MINI_STATS.map(({ key, icon, color }) => {
              const raw = (stats as Record<string, unknown>)[key]
              const val = Math.round(Math.max(0, Math.min(100, (typeof raw === 'number' ? raw : 0))))
              const barColor = val >= 60 ? color : val >= 30 ? '#facc15' : '#f87171'
              return (
                <div key={key} className="flex-1 flex items-center gap-1 px-1.5 py-1"
                  style={{ background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(6px)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span style={{ fontSize: 10, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                  <div className="flex-1 overflow-hidden" style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.15)' }}>
                    <div style={{ width: `${val}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width 0.5s' }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Row 3: Quests */}
          <TaskPanel />
        </div>
      </div>
    </>
  )
}
