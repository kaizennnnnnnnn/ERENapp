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
import { Sparkles } from 'lucide-react'
import { IconGift, IconCapsule, IconHeart, IconBell, IconPerson, IconDoor } from '@/components/PixelIcons'
import TaskPanel from '@/components/TaskPanel'
import ReminderSheet from '@/components/ReminderSheet'
import { registerSW } from '@/lib/reminders'
import { checkStatNotifications, requestNotificationPermission, notifyPartnerAction, notifyPartnerMessage } from '@/lib/statNotifications'
import { subscribeToPush } from '@/lib/pushSubscription'
import { useCouple } from '@/hooks/useCouple'
import { useFortune } from '@/hooks/useFortune'
import { useInventory } from '@/hooks/useInventory'
import { GACHA_ITEMS } from '@/lib/gacha'
import FortunePopup from '@/components/fortune/FortunePopup'
import ErenMessagePopup from '@/components/couple/ErenMessagePopup'

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


export default function HomePage() {
  const router   = useRouter()
  const supabase = createClient()
  const { user, profile, loading: authLoading } = useAuth()
  const { stats, loading } = useErenStats(profile?.household_id ?? null)
  const { setIsSick, openScene, setHideStats } = useCare()
  const { xp, level } = useTasks()
  useTimeTracking(user?.id ?? null)
  const { canClaim: fortuneAvailable } = useFortune()
  const { newMessage, dismissPopup, unreadCount } = useCouple()
  const { inventory } = useInventory()

  // Get equipped items for display
  const equippedOutfits = inventory.filter(i => i.equipped).map(i => GACHA_ITEMS.find(g => g.id === i.item_id)).filter(Boolean)
  const equippedDecos = inventory.filter(i => i.equipped && GACHA_ITEMS.find(g => g.id === i.item_id)?.category === 'decoration').map(i => GACHA_ITEMS.find(g => g.id === i.item_id)!)
  const [showFortune, setShowFortune] = useState(false)

  // XP bar
  const xpIntoLevel = xp - totalXpForLevel(level)
  const xpNeeded    = xpForNextLevel(level)
  const xpPct       = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
  const prevXpRef   = useRef(xp)
  const particleIdRef = useRef(0)
  const [xpParticles, setXpParticles] = useState<XpParticle[]>([])

  useEffect(() => {
    registerSW()
    requestNotificationPermission().then(granted => {
      if (granted && user?.id && profile?.household_id) {
        subscribeToPush(user.id, profile.household_id)
      }
    })
  }, [user?.id, profile?.household_id])

  // Check stat notifications whenever stats change
  useEffect(() => {
    if (stats) checkStatNotifications(stats)
  }, [stats])

  // Realtime: notify when partner does an action or sends a message
  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    const partnerName = (() => { try { return localStorage.getItem(`eren_partner_name_${user.id}`) ?? 'Your partner' } catch { return 'Your partner' } })()

    // Cache partner name for notifications
    supabase.from('profiles').select('name').eq('household_id', profile.household_id).neq('id', user.id).single()
      .then(({ data }) => { if (data?.name) localStorage.setItem(`eren_partner_name_${user.id}`, data.name) })

    const ch = supabase.channel(`home_notifs_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'interactions',
        filter: `household_id=eq.${profile.household_id}`,
      }, payload => {
        const row = payload.new as { user_id: string; action_type: string }
        if (row.user_id !== user.id) {
          const name = localStorage.getItem(`eren_partner_name_${user.id}`) ?? partnerName
          notifyPartnerAction(name, row.action_type)
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'couple_journal',
        filter: `household_id=eq.${profile.household_id}`,
      }, payload => {
        const row = payload.new as { sender_id: string }
        if (row.sender_id !== user.id) {
          const name = localStorage.getItem(`eren_partner_name_${user.id}`) ?? partnerName
          notifyPartnerMessage(name)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [profile?.household_id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // XP sparkle particles Eren → bar
  useEffect(() => {
    if (xp <= prevXpRef.current) { prevXpRef.current = xp; return }
    const gained = xp - prevXpRef.current
    prevXpRef.current = xp
    const erenEl = document.getElementById('eren-img')
    const barEl  = document.getElementById('stats-xp-bar')
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

  // Show stats header only when room is fully loaded & mood selected
  useEffect(() => {
    const ready = !authLoading && !!todayMood && !loading && !!stats && roomReady
    setHideStats(!ready)
  }, [authLoading, todayMood, loading, stats, roomReady, setHideStats])

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
            animation: `xpSparkle ${p.duration}s linear forwards`,
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
      {showFortune && <FortunePopup onClose={() => setShowFortune(false)} />}
      {newMessage && <ErenMessagePopup message={newMessage} onDismiss={dismissPopup} />}

      {/* ══ FULL SCREEN ROOM ══ */}
      <div className="fixed inset-0" style={{ zIndex: 0 }}>

        {/* Background image */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'url(/livingRoom.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          pointerEvents: 'none',
        }} />

        {mood === 'happy' && (
          <>
            <Sparkles size={11} className="absolute text-yellow-400 animate-sparkle" style={{ top: '30%', left: '10%', zIndex: 2 }} />
            <Sparkles size={9}  className="absolute text-pink-400  animate-sparkle" style={{ top: '25%', right: '15%', zIndex: 2, animationDelay: '0.7s' }} />
          </>
        )}

        {/* === ROOM DECORATIONS (from gacha) === */}
        {equippedDecos.map(deco => deco.roomPos && (
          <div key={deco.id} className="absolute pointer-events-none" style={{
            bottom: `${deco.roomPos.bottom}%`, left: `${deco.roomPos.left}%`,
            transform: 'translateX(-50%)',
            fontSize: deco.roomPos.size, lineHeight: 1, zIndex: 1,
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
          }}>
            {deco.icon}
          </div>
        ))}

        {/* === EREN === */}
        <div className="absolute" style={{
          bottom: '10%', left: '50%', transform: 'translateX(-50%)', zIndex: 2,
          filter: mood === 'angry' ? 'hue-rotate(340deg) saturate(1.3)' : mood === 'sleepy' ? 'brightness(0.85)' : 'none',
        }}>
          <div className="relative" style={{ width: 200, height: 200 }}>
            <img id="eren-img" src="/erenGood.png" alt="Eren" draggable={false}
              style={{ width: 200, height: 200, objectFit: 'contain', imageRendering: 'pixelated' }} />

            {/* Outfit overlays */}
            {equippedOutfits.map(item => item?.pos && item.slot && (
              <div key={item.id} className="absolute pointer-events-none" style={{
                top: `${item.pos.top}%`, left: `${item.pos.left}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: item.pos.size, lineHeight: 1,
                zIndex: item.slot === 'hat' ? 10 : item.slot === 'eyes' ? 9 : 8,
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
              }}>
                {item.icon}
              </div>
            ))}
          </div>
        </div>

        {/* Speech bubble */}
        <div className="absolute" style={{ bottom: '32%', left: '55%', zIndex: 3, background: 'white', borderRadius: 4, border: '2px solid #F0D8FF', boxShadow: '2px 2px 0 #E0CCFF', padding: '4px 10px', whiteSpace: 'nowrap' }}>
          <p className="text-xs text-gray-600 font-medium">{MOOD_GREETINGS[mood] ?? MOOD_GREETINGS.idle}</p>
          <div className="absolute" style={{ bottom: -6, left: 10, width: 8, height: 6, background: 'white', clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)' }} />
        </div>

        {/* ══ HUD OVERLAY (below shared stats header) ══ */}
        <div className="absolute left-0 right-0 z-10 px-3" style={{ top: 100 }}>

          {/* Quests (compact) + Nav buttons — single row */}
          <div className="flex items-center gap-2">
            {/* Quests — takes remaining space */}
            <div className="flex-1 min-w-0">
              <TaskPanel compact />
            </div>

            {/* Nav buttons — pixel game style */}
            {fortuneAvailable && (
              <button onClick={() => setShowFortune(true)}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center active:scale-90 transition-transform"
                style={{ background: 'rgba(8,5,20,0.8)', border: '2px solid rgba(245,158,11,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(251,191,36,0.2)', animation: 'pulse 2s ease-in-out infinite' }}>
                <IconGift size={22} />
              </button>
            )}
            <Link href="/gacha"
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'rgba(8,5,20,0.8)', border: '2px solid rgba(124,58,237,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(167,139,250,0.2)' }}>
              <IconCapsule size={22} />
            </Link>
            <Link href="/couple" className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'rgba(8,5,20,0.8)', border: '2px solid rgba(255,107,157,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,107,157,0.2)' }}>
              <IconHeart size={22} />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 flex items-center justify-center"
                  style={{ width: 16, height: 16, background: '#FF1D5E', border: '2px solid rgba(8,5,20,0.9)' }}>
                  <span className="font-pixel text-white" style={{ fontSize: 5 }}>{unreadCount}</span>
                </div>
              )}
            </Link>
            <button onClick={() => setShowReminders(true)}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'rgba(8,5,20,0.8)', border: '2px solid rgba(255,215,0,0.35)', boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,215,0,0.15)' }}>
              <IconBell size={22} />
            </button>
            <Link href="/profile"
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: 'rgba(8,5,20,0.8)', border: '2px solid rgba(167,139,250,0.4)', boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(167,139,250,0.2)' }}>
              <IconPerson size={22} />
            </Link>
            <div className="relative flex-shrink-0">
              <button onClick={() => setShowRooms(r => !r)}
                className="w-10 h-10 flex items-center justify-center active:scale-90 transition-transform"
                style={{ background: 'rgba(8,5,20,0.8)', border: '2px solid rgba(107,65,33,0.6)', boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(200,150,100,0.2)' }}>
                <IconDoor size={22} />
              </button>
              {showRooms && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowRooms(false)} />
                  <div className="absolute right-0 top-12 z-30 flex flex-col gap-1 p-2"
                    style={{ background: 'rgba(10,5,25,0.85)', backdropFilter: 'blur(16px)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', minWidth: 150, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
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
                        style={{ borderRadius: 8, background: 'rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 15 }}>{room.icon}</span>
                        <span className="font-pixel text-white" style={{ fontSize: 7 }}>{room.label.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
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
