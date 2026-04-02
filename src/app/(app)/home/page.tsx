'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTimeTracking } from '@/hooks/useTimeTracking'
import PixelEren from '@/components/PixelEren'
import PixelErenLoading from '@/components/PixelErenLoading'
import PixelIcon from '@/components/PixelIcon'
import StatBar from '@/components/StatBar'
import MoodGate from '@/components/MoodGate'
import MoodCalendar from '@/components/MoodCalendar'
import { STAT_CONFIGS } from '@/types'
import type { DailyMood, Profile, UserMood } from '@/types'
import { MOOD_CONFIGS } from '@/types'
import { useCare } from '@/contexts/CareContext'
import { format } from 'date-fns'
import { Bell, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  useTimeTracking(user?.id ?? null)

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
          <PixelErenLoading size={9} />
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
        <PixelEren mood="idle" size={6} animate={false} />
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
          <PixelErenLoading size={9} />
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

      {/* ── Header ── */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {/* Pixel coin counter */}
        <div className="flex items-center gap-1.5 px-3 h-9"
          style={{ background: 'linear-gradient(135deg, #FFF3C0, #FFE680)', borderRadius: 3, border: '2px solid #F5C842', boxShadow: '2px 2px 0 #C8A020' }}>
          <span className="text-sm">🪙</span>
          <span className="font-pixel text-amber-700" style={{ fontSize: 9 }}>{stats.coins ?? 0}</span>
        </div>
        <button className="w-9 h-9 bg-white shadow-card flex items-center justify-center"
          style={{ borderRadius: 3, border: '2px solid #E8D8F0', boxShadow: '2px 2px 0 #D8C8E8' }}>
          <Bell size={18} className="text-purple-300" />
        </button>
      </div>

      {/* ── Pixel Eren stage ── */}
      <div className="card-pink mb-4 flex flex-col items-center py-6 relative overflow-hidden">
        {/* Pixel dot grid background */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{
          backgroundImage: 'radial-gradient(circle, #C084FC 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }} />

        {/* Corner pixel stars */}
        <span className="absolute top-3 left-4 text-yellow-300 text-lg pointer-events-none" style={{ fontFamily: 'monospace', animation: 'twinkle 2.2s ease-in-out infinite' }}>✦</span>
        <span className="absolute top-3 right-4 text-pink-300 text-sm pointer-events-none"  style={{ fontFamily: 'monospace', animation: 'twinkle 1.8s ease-in-out infinite 0.6s' }}>✦</span>
        <span className="absolute bottom-3 left-6 text-purple-300 text-xs pointer-events-none" style={{ fontFamily: 'monospace', animation: 'twinkle 2.5s ease-in-out infinite 1.1s' }}>✦</span>
        <span className="absolute bottom-3 right-6 text-yellow-200 text-base pointer-events-none" style={{ fontFamily: 'monospace', animation: 'twinkle 2s ease-in-out infinite 0.3s' }}>✦</span>

        {mood === 'happy' && (
          <>
            <Sparkles size={14} className="absolute top-5 left-10 text-yellow-400 animate-sparkle" />
            <Sparkles size={10} className="absolute top-9 right-10 text-pink-400 animate-sparkle" style={{ animationDelay: '0.7s' }} />
          </>
        )}

        {/* EREN pixel name badge */}
        <div className="relative mb-3 flex items-center gap-2">
          <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #FF6B9D, #C084FC)' }}>
            ★ EREN ★
          </span>
          <span className="font-pixel text-gray-400" style={{ fontSize: 7 }}>{stats.weight?.toFixed(1) ?? '—'} kg</span>
        </div>

        <div className={cn(
          'transition-transform duration-300',
          mood === 'happy'   && 'animate-float',
          mood === 'playful' && 'animate-bounce-soft',
          mood === 'idle'    && 'animate-breath',
          mood === 'sleepy'  && 'animate-sway',
        )}
          style={{ filter: mood === 'angry' ? 'hue-rotate(340deg) saturate(1.3)' : mood === 'sleepy' ? 'brightness(0.88)' : 'none' }}
        >
          <img
            src="/erenSticker.png"
            alt="Eren"
            draggable={false}
            style={{ width: 160, height: 160, objectFit: 'contain', imageRendering: 'pixelated' }}
          />
        </div>

        {/* Speech bubble */}
        <div className="relative mt-3 px-4 py-2 bg-white/90 shadow-sm max-w-xs text-center"
          style={{ borderRadius: 4, border: '2px solid #F0D8FF', boxShadow: '2px 2px 0 #E0CCFF' }}>
          {/* Bubble tail */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-2 bg-white/90"
            style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', filter: 'drop-shadow(0 -1px 0 #F0D8FF)' }} />
          <p className="text-xs text-gray-600 font-medium">
            {MOOD_GREETINGS[mood as string] ?? MOOD_GREETINGS.idle}
          </p>
        </div>
      </div>

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
