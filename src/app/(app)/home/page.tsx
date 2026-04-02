'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTimeTracking } from '@/hooks/useTimeTracking'
import PixelIcon from '@/components/PixelIcon'
import StatBar from '@/components/StatBar'
import MoodGate from '@/components/MoodGate'
import MoodCalendar from '@/components/MoodCalendar'
import { STAT_CONFIGS } from '@/types'
import type { DailyMood, Profile, UserMood } from '@/types'
import { MOOD_CONFIGS } from '@/types'
import { useCare } from '@/contexts/CareContext'
import { useTasks } from '@/contexts/TaskContext'
import { xpForNextLevel, totalXpForLevel } from '@/lib/tasks'
import { format } from 'date-fns'
import { Bell, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import TaskPanel from '@/components/TaskPanel'

interface XpParticle { id: number; x: number; y: number; tx: number; ty: number; text: string; delay: number }

const MOOD_GREETINGS: Record<string, string> = {
  happy:   "Eren is so happy to see you!",
  idle:    "Eren is chilling and waiting for attention",
  hungry:  "Eren is hungry! Feed me, hooman!",
  sleepy:  "Eren is sleepy… shhh",
  playful: "Eren wants to play! Let's go!",
  angry:   "Eren is not amused. Fix that!",
}

// Pixel icon per stat
const STAT_PIXEL_ICONS: Record<string, React.ComponentProps<typeof PixelIcon>['icon']> = {
  happiness:     'heart',
  hunger:        'food',
  energy:        'lightning',
  sleep_quality: 'zzz',
  cleanliness:   'droplet',
}

export default function HomePage() {
  const router   = useRouter()
  const supabase = createClient()
  const { user, profile, loading: authLoading } = useAuth()
  const { stats, loading } = useErenStats(profile?.household_id ?? null)
  const { setIsSick } = useCare()
  const { xp, level } = useTasks()
  useTimeTracking(user?.id ?? null)

  // XP bar
  const xpIntoLevel = xp - totalXpForLevel(level)
  const xpNeeded    = xpForNextLevel(level)
  const xpPct       = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
  const xpBarRef    = useRef<HTMLDivElement>(null)
  const prevXpRef   = useRef(xp)
  const particleIdRef = useRef(0)
  const [xpParticles, setXpParticles] = useState<XpParticle[]>([])

  // Spawn particles from Eren → XP bar on XP gain
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
    const srcY = erenRect.top  + erenRect.height * 0.25
    const dstX = barRect.left  + barRect.width  * (xpPct / 100)
    const dstY = barRect.top   + barRect.height / 2

    const items = ['✦', '★', '✨', '⭐', '💫', '·', '•']

    function makeWave(count: number, baseDelay: number, labelCount: number): XpParticle[] {
      return Array.from({ length: count }, (_, i) => {
        const px = srcX + (Math.random() - 0.5) * 70
        const py = srcY + (Math.random() - 0.5) * 60
        return {
          id:    particleIdRef.current++,
          x:     px,
          y:     py,
          tx:    dstX - px,
          ty:    dstY - py,
          text:  i < labelCount ? `+${gained}XP` : items[Math.floor(Math.random() * items.length)],
          delay: baseDelay + i * 90,
        }
      })
    }

    // Wave 1 immediately, wave 2 after 600ms, wave 3 after 1300ms
    const wave1 = makeWave(16, 0, 3)
    const wave2 = makeWave(12, 600, 1)
    const wave3 = makeWave(8,  1300, 0)
    setXpParticles(p => [...p, ...wave1, ...wave2, ...wave3])
    setTimeout(() => setXpParticles([]), 4200)
  }, [xp]) // eslint-disable-line react-hooks/exhaustive-deps

  const [moods, setMoods]               = useState<DailyMood[]>([])
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null)
  const [todayMood, setTodayMood]       = useState<UserMood | null>(null)
  const [moodChecked, setMoodChecked]   = useState(false) // have we checked DB yet?
  const [toast, setToast]               = useState<string | null>(null)

  // Fast localStorage check — skips gate immediately if already submitted today
  useEffect(() => {
    if (!user?.id) return
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const cached = localStorage.getItem(`pocket_eren_mood_${user.id}_${todayStr}`)
    if (cached) {
      setTodayMood(cached as UserMood)
      setMoodChecked(true)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login')
  }, [user, authLoading, router])

  // If auth done but no household — unblock moodChecked so loading screen clears
  useEffect(() => {
    if (!authLoading && !profile?.household_id) setMoodChecked(true)
  }, [authLoading, profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync is_sick into CareContext so BottomNav can show Hospital button
  useEffect(() => {
    if (stats) setIsSick(stats.is_sick ?? false)
  }, [stats?.is_sick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load moods + partner
  useEffect(() => {
    if (!profile?.household_id || !user?.id) return

    async function load() {
      const today   = new Date()
      const todayStr = format(today, 'yyyy-MM-dd')
      const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd')

      const { data: moodsData } = await supabase
        .from('daily_moods')
        .select('*, profile:profiles(name, avatar_url)')
        .gte('date', monthStart)
        .order('date', { ascending: false })

      if (moodsData) {
        setMoods(moodsData)
        const mine = moodsData.find(m => m.user_id === user!.id && m.date === todayStr)
        if (mine) setTodayMood(mine.mood as UserMood)
      }
      setMoodChecked(true)

      const { data: partner } = await supabase
        .from('profiles')
        .select('*')
        .eq('household_id', profile!.household_id!)
        .neq('id', user!.id)
        .limit(1)
        .single()

      if (partner) setPartnerProfile(partner)
    }

    load()
  }, [profile?.household_id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Loading screen (with pixel Eren) ──
  if (authLoading || !moodChecked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-pink-50 to-[#FDF6FF] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #C084FC 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="animate-float relative z-10">
          <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 150, height: 150, objectFit: 'contain', imageRendering: 'pixelated' }} />
        </div>
        <p className="font-pixel text-gray-400 animate-pulse-soft relative z-10" style={{ fontSize: 8 }}>
          LOADING EREN<span className="animate-cursor">_</span>
        </p>
      </div>
    )
  }

  // ── Household missing ──
  if (!profile?.household_id) {
    return (
      <div className="page-scroll flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 100, height: 100, objectFit: 'contain', imageRendering: 'pixelated' }} />
        <p className="font-bold text-gray-700">No household found</p>
        <div className="card w-full text-xs font-mono text-gray-600 break-all">
          update public.profiles set household_id = (select id from public.households limit 1) where id = &apos;{user?.id}&apos;;
        </div>
      </div>
    )
  }

  // ── Mood gate — only if not yet checked in today ──
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

  // ── Stats loading ──
  if (loading || !stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-pink-50 to-[#FDF6FF] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #C084FC 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="animate-float relative z-10">
          <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 150, height: 150, objectFit: 'contain', imageRendering: 'pixelated' }} />
        </div>
        <p className="font-pixel text-gray-400 animate-pulse-soft relative z-10" style={{ fontSize: 8 }}>
          LOADING EREN<span className="animate-cursor">_</span>
        </p>
      </div>
    )
  }

  const mood = (stats.mood ?? 'idle') as string
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const partnerTodayMood = moods.find(m => m.user_id === partnerProfile?.id && m.date === todayStr)


  return (
    <div className="page-scroll">
      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2.5 animate-float whitespace-nowrap"
          style={{ background: '#1F1F2E', borderRadius: 3, border: '2px solid #3A3A5E', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast}
        </div>
      )}

      {/* ── XP particles flying Eren → bar ── */}
      {xpParticles.map(p => (
        <div key={p.id}
          className="fixed pointer-events-none z-50 font-pixel"
          style={{
            left: p.x,
            top:  p.y,
            fontSize: p.text.length > 2 ? 7 : 13,
            color: '#A78BFA',
            whiteSpace: 'nowrap',
            animationDelay: `${p.delay}ms`,
            animation: 'flyToBar 1.8s ease-in forwards',
            ...({ '--tx': `${p.tx}px`, '--ty': `${p.ty}px` } as React.CSSProperties),
          }}>
          {p.text}
        </div>
      ))}

      {/* ── Header: XP bar + coins + bell ── */}
      <div className="flex items-center gap-2 mb-3">
        {/* Compact level + XP bar */}
        <div ref={xpBarRef} className="flex-1 flex items-center gap-1.5 px-2.5 h-9"
          style={{ background: 'linear-gradient(135deg, #F5F0FF, #EDE8FF)', borderRadius: 6, border: '2px solid #D8C8F8', boxShadow: '2px 2px 0 #C8B0F0' }}>
          <span className="font-pixel text-purple-600 flex-shrink-0" style={{ fontSize: 7 }}>Lv.{level}</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden relative" style={{ background: '#D8CEF0' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg, #A78BFA, #7C3AED)' }} />
            <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
          </div>
          <span className="font-pixel text-purple-400 flex-shrink-0" style={{ fontSize: 6 }}>{xpIntoLevel}/{xpNeeded}</span>
        </div>
        {/* Coins */}
        <div className="flex items-center gap-1 px-2.5 h-9"
          style={{ background: 'linear-gradient(135deg, #FFF3C0, #FFE680)', borderRadius: 6, border: '2px solid #F5C842', boxShadow: '2px 2px 0 #C8A020' }}>
          <span className="text-sm">🪙</span>
          <span className="font-pixel text-amber-700" style={{ fontSize: 9 }}>{stats.coins ?? 0}</span>
        </div>
        {/* Bell */}
        <button className="w-9 h-9 bg-white flex items-center justify-center"
          style={{ borderRadius: 6, border: '2px solid #E8D8F0', boxShadow: '2px 2px 0 #D8C8E8' }}>
          <Bell size={16} className="text-purple-300" />
        </button>
      </div>

      {/* ── Quests ── */}
      <TaskPanel />

      {/* ── Stats ── */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)' }}>STATS</span>
          <div className="flex-1 h-px" style={{ background: 'repeating-linear-gradient(90deg, #E0D0F8 0px, #E0D0F8 4px, transparent 4px, transparent 8px)' }} />
          <span className="text-xs text-gray-400">♥ Eren</span>
        </div>
        {STAT_CONFIGS.map(cfg => (
          <StatBar
            key={cfg.key}
            label={cfg.label}
            icon={cfg.icon}
            value={stats[cfg.key] ?? 0}
            color={cfg.color}
            bgColor={cfg.bgColor}
            pixelIcon={<PixelIcon icon={STAT_PIXEL_ICONS[cfg.key]} size={3} />}
          />
        ))}
      </div>

      {/* ── Eren's Room ── */}
      <div className="mb-4 relative overflow-hidden" style={{ borderRadius: 8, border: '3px solid #C8A878', boxShadow: '4px 4px 0 #A07850', height: 320 }}>

        {/* === WALL (top 60%) === */}
        <div className="absolute inset-x-0 top-0" style={{ height: '62%', background: '#F0E6D0' }}>
          <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(210,180,140,0.2) 28px, rgba(210,180,140,0.2) 30px)' }} />
          {/* Crown molding */}
          <div className="absolute top-0 left-0 right-0 h-3" style={{ background: '#D4B896', borderBottom: '2px solid #B89060' }} />

          {/* Window center */}
          <div className="absolute" style={{ top: 18, left: '50%', transform: 'translateX(-50%)', width: 86, height: 68, border: '3px solid #7A5030' }}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #87CEEB, #B8E0FF)' }} />
            <div className="absolute" style={{ top: 0, bottom: 0, left: '50%', width: 3, background: '#7A5030', transform: 'translateX(-50%)', zIndex: 2 }} />
            <div className="absolute" style={{ left: 0, right: 0, top: '50%', height: 3, background: '#7A5030', transform: 'translateY(-50%)', zIndex: 2 }} />
            <div className="absolute" style={{ top: 8, left: 5, width: 18, height: 8, background: 'white', borderRadius: 4, opacity: 0.85, zIndex: 1 }} />
            <div className="absolute" style={{ top: 10, right: 6, width: 14, height: 7, background: 'white', borderRadius: 3, opacity: 0.8, zIndex: 1 }} />
          </div>
          {/* Window sill */}
          <div className="absolute" style={{ top: 86, left: '50%', transform: 'translateX(-50%)', width: 98, height: 5, background: '#7A5030' }} />

          {/* Shelf + books left */}
          <div className="absolute" style={{ top: 28, left: 10, width: 54, height: 5, background: '#A07850', border: '2px solid #7A5030' }} />
          <div className="absolute" style={{ top: 12, left: 12, width: 10, height: 18, background: '#E8705A', border: '2px solid #C05040' }} />
          <div className="absolute" style={{ top: 12, left: 24, width: 8, height: 18, background: '#70B870', border: '2px solid #508850' }} />
          <div className="absolute" style={{ top: 14, left: 34, width: 10, height: 16, background: '#F0C040', border: '2px solid #C09020' }} />

          {/* Plant right */}
          <div className="absolute" style={{ bottom: 0, right: 14 }}>
            <div style={{ width: 22, height: 18, background: '#C87840', border: '2px solid #A05830', borderRadius: '0 0 4px 4px', margin: '0 auto' }} />
            <div className="absolute" style={{ bottom: 16, left: '50%', transform: 'translateX(-50%)', width: 18, height: 22, background: '#50A850', border: '2px solid #308030', borderRadius: '10px 10px 2px 2px' }} />
            <div className="absolute" style={{ bottom: 22, left: -2, width: 14, height: 12, background: '#60B860', border: '2px solid #408040', borderRadius: '6px 2px 2px 6px', transform: 'rotate(-25deg)' }} />
            <div className="absolute" style={{ bottom: 22, right: -2, width: 14, height: 12, background: '#60B860', border: '2px solid #408040', borderRadius: '2px 6px 6px 2px', transform: 'rotate(25deg)' }} />
          </div>

          {/* Name badge */}
          <div className="absolute" style={{ top: 10, right: 10 }}>
            <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)', fontSize: 6 }}>★ EREN ★</span>
          </div>

          {mood === 'happy' && (
            <>
              <Sparkles size={11} className="absolute text-yellow-400 animate-sparkle" style={{ top: 95, left: 28 }} />
              <Sparkles size={9}  className="absolute text-pink-400  animate-sparkle" style={{ top: 75, right: 60, animationDelay: '0.7s' }} />
            </>
          )}
        </div>

        {/* === FLOOR (bottom 38%) === */}
        <div className="absolute inset-x-0 bottom-0" style={{
          height: '38%',
          background: '#C8A060',
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 32px, rgba(0,0,0,0.07) 32px, rgba(0,0,0,0.07) 34px)',
          borderTop: '3px solid #A07840',
        }} />

        {/* Rug on floor */}
        <div className="absolute" style={{ bottom: 28, left: '50%', transform: 'translateX(-50%)', width: 150, height: 50, background: '#C03050', border: '3px solid #902040', borderRadius: 4, zIndex: 1 }}>
          <div className="absolute inset-2" style={{ border: '2px solid #E05070', borderRadius: 2 }} />
        </div>

        {/* === EREN centered, no animation === */}
        <div className="absolute" style={{
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2,
          filter: mood === 'angry' ? 'hue-rotate(340deg) saturate(1.3)' : mood === 'sleepy' ? 'brightness(0.85)' : 'none',
        }}>
          <img
            id="eren-img"
            src="/erenGood.png"
            alt="Eren"
            draggable={false}
            style={{ width: 170, height: 170, objectFit: 'contain', imageRendering: 'pixelated' }}
          />
        </div>

        {/* Speech bubble top-right */}
        <div className="absolute" style={{ bottom: 160, left: '55%', zIndex: 3, background: 'white', borderRadius: 4, border: '2px solid #F0D8FF', boxShadow: '2px 2px 0 #E0CCFF', padding: '4px 10px', whiteSpace: 'nowrap' }}>
          <p className="text-xs text-gray-600 font-medium">{MOOD_GREETINGS[mood as string] ?? MOOD_GREETINGS.idle}</p>
          <div className="absolute" style={{ bottom: -6, left: 10, width: 8, height: 6, background: 'white', clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)', borderBottom: 'none' }} />
        </div>
      </div>

      {/* ── Partner status ── */}
      {partnerProfile && (
        <div className="mb-4 flex items-center gap-3 p-3"
          style={{ background: 'linear-gradient(135deg, #F5F0FF, #EDE8FF)', borderRadius: 4, border: '2px solid #DDD0F8', boxShadow: '3px 3px 0 #CEC0F0' }}>
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-lg font-bold text-purple-600"
            style={{ background: 'linear-gradient(135deg, #E8D8FF, #D8C8F8)', borderRadius: 3, border: '2px solid #C8B0F0' }}>
            {partnerProfile.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-pixel text-gray-700 leading-tight" style={{ fontSize: 8 }}>{partnerProfile.name}</p>
            <p className="text-[10px] text-purple-400 mt-0.5">Also caring for Eren ♥</p>
          </div>
          <div className="flex-shrink-0 text-center">
            {partnerTodayMood
              ? <>
                  <p className="text-2xl">{MOOD_CONFIGS[partnerTodayMood.mood as UserMood].emoji}</p>
                  <p className="font-pixel text-gray-400" style={{ fontSize: 6 }}>{MOOD_CONFIGS[partnerTodayMood.mood as UserMood].label}</p>
                </>
              : <span className="font-pixel text-gray-300" style={{ fontSize: 6 }}>not in yet</span>
            }
          </div>
        </div>
      )}

      {/* ── Mood calendar ── */}
      {moods.length > 0 && user && (
        <div className="mb-4">
          <MoodCalendar
            moods={moods}
            userId={user.id}
            partnerName={partnerProfile?.name}
          />
        </div>
      )}

    </div>
  )
}
