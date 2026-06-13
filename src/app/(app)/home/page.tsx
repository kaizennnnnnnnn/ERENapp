'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useLayoutEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
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
import { IconGift, IconCapsule, IconHeart, IconBell, IconPerson, IconDoor, IconDrumstick, IconYarn, IconMoonZ, IconBath, IconPill, IconBook, IconCake, IconPhoto, IconShawarma, IconFlask } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { requestCloudNav } from '@/components/CloudTransition'
import TaskPanel from '@/components/TaskPanel'
import BlinkingEren from '@/components/BlinkingEren'
import StinkyFlies from '@/components/StinkyFlies'
import PageLoader from '@/components/PageLoader'
import ReminderSheet from '@/components/ReminderSheet'
import { registerSW, pingFireReminders } from '@/lib/reminders'
import { checkStatNotifications, requestNotificationPermission } from '@/lib/statNotifications'
import { subscribeToPush } from '@/lib/pushSubscription'
import { useCouple } from '@/hooks/useCouple'
import { useFortune } from '@/hooks/useFortune'
import { useInventory } from '@/hooks/useInventory'
import { GACHA_ITEMS } from '@/lib/gacha'
import FortunePopup from '@/components/fortune/FortunePopup'
import ErenMessagePopup from '@/components/couple/ErenMessagePopup'
import ThoughtCloud from '@/components/couple/ThoughtCloud'
import JealousEren from '@/components/couple/JealousEren'
import DailyBattleHUD from '@/components/couple/DailyBattleHUD'
import ComebackBadge from '@/components/couple/ComebackBadge'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import SendErenSheet from '@/components/couple/SendErenSheet'
import { MOOD_THEME, LOW_MOODS } from '@/lib/moods'
import { useIsDark } from '@/hooks/useIsDark'
import { cuteBtn, CuteIcon } from '@/components/obsidian'
import LightSwitch from '@/components/LightSwitch'
import { useWish } from '@/contexts/WishContext'
import { useWishLinger } from '@/hooks/useWishLinger'
import { useErenReaction } from '@/hooks/useErenReaction'
import { WORD_COLOR } from '@/lib/erenReactions'
import SoundWord from '@/components/SoundWord'
import { Hearts } from '@/components/care/ReactionFx'
import WishCloud from '@/components/wish/WishCloud'
import ErenGrantBurst from '@/components/wish/ErenGrantBurst'
import ErenSpeechBubble from '@/components/wish/ErenSpeechBubble'
import { useFlavorBubble } from '@/hooks/useFlavorBubble'
import { useCatchupGate } from '@/hooks/useCatchupGate'
import CatchupCarousel from '@/components/memory/CatchupCarousel'
import { usePageReady } from '@/hooks/usePageReady'

interface XpParticle {
  id: number; x: number; y: number; tx: number; ty: number
  text: string; delay: number; duration: number
  size: number; color: string; glow: string
}

// ─── BOTTOM DOCK BUTTON STYLES ───────────────────────────────────────────
// Shared chrome for the three full-width home dock buttons (gacha, cake,
// shawarma). Per-button gradient is layered on top; the rest is identical
// so the row reads as a single console-style dock. Slim height so the
// row tucks along the bottom edge of the room without colliding with
// Eren standing at his usual bottom-10% spot.
const dockBtnBase: React.CSSProperties = {
  flex: 1,
  height: 46,
  borderRadius: 15,
  border: '2px solid #160a26',
  // Straight-down chunky shadow (candy/game-button look) + a glossy inner top
  // highlight. The press state in globals.css drops it into the shadow.
  boxShadow:
    '0 4px 0 #160a26, inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.18)',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  position: 'relative',
  overflow: 'hidden',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
}

// Glossy top dome — the rounded shine that makes it read as a candy button.
const dockBtnGloss: React.CSSProperties = {
  position: 'absolute',
  top: 2, left: 4, right: 4,
  height: '44%',
  pointerEvents: 'none',
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.04) 100%)',
  borderRadius: 12,
}

// Cute rounded bubble the icon sits in, so it pops as a little badge.
const dockBtnIcon: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24, height: 24,
  borderRadius: 8,
  flexShrink: 0,
  background: 'rgba(255,255,255,0.25)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 0 rgba(0,0,0,0.12)',
  position: 'relative',
  zIndex: 1,
}

const dockBtnLabel: React.CSSProperties = {
  fontFamily: '"Press Start 2P"',
  fontSize: 7,
  letterSpacing: 0.5,
  color: '#FBF1D9',
  textShadow: '1px 1px 0 rgba(0,0,0,0.65)',
  position: 'relative',
  zIndex: 1,
}

export default function HomePage() {
  const router   = useRouter()
  const supabase = createClient()
  const { user, profile, loading: authLoading } = useAuth()
  const { stats, loading } = useErenStats(profile?.household_id ?? null)
  const { setIsSick, openScene, setHideStats, activeScene } = useCare()
  const { xp, level } = useTasks()
  useTimeTracking(user?.id ?? null)
  const { canClaim: fortuneAvailable } = useFortune()
  const { newMessage, dismissPopup, unreadCount, partner, sendNudge, partnerMood, lifetimeWLT } = useCouple()
  const { inventory } = useInventory()
  const isDark = useIsDark()
  const wish = useWish()

  // Pet interaction — tap on Eren and he stays in place, just trembling a
  // gentle purr with hearts + a "PURRR", and dispatches eren:pet so the wish
  // system can grant pet-flavoured wishes (mood-pet, mood-lap). 1.5s cooldown
  // prevents tap-spam from auto-granting.
  const petReaction = useErenReaction()
  const lastPetAtRef = useRef(0)
  const handlePetEren = useCallback(() => {
    const now = Date.now()
    if (now - lastPetAtRef.current < 1500) return
    lastPetAtRef.current = now
    petReaction.play([{ name: 'purr', ms: 1000, onEnter: () => playSound('pet_purr') }])
    try {
      window.dispatchEvent(new CustomEvent('eren:pet', { detail: { user_id: user?.id } }))
    } catch { /* SSR/no-window */ }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Get equipped items for display
  const equippedOutfits = inventory.filter(i => i.equipped).map(i => GACHA_ITEMS.find(g => g.id === i.item_id)).filter(Boolean)
  const equippedDecos = inventory.filter(i => i.equipped && GACHA_ITEMS.find(g => g.id === i.item_id)?.category === 'decoration').map(i => GACHA_ITEMS.find(g => g.id === i.item_id)!)
  const [showFortune, setShowFortune] = useState(false)
  const [dotsVisible, setDotsVisible] = useState(false)
  const dotsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const swipeTouchX = useRef(0)

  const flashDots = useCallback(() => {
    setDotsVisible(true)
    if (dotsTimer.current) clearTimeout(dotsTimer.current)
    dotsTimer.current = setTimeout(() => setDotsVisible(false), 2000)
  }, [])

  useEffect(() => { if (activeScene) flashDots() }, [activeScene, flashDots])

  // XP bar
  const xpIntoLevel = xp - totalXpForLevel(level)
  const xpNeeded    = xpForNextLevel(level)
  const xpPct       = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))
  const prevXpRef   = useRef(xp)
  const particleIdRef = useRef(0)
  const [xpParticles, setXpParticles] = useState<XpParticle[]>([])
  // Gate the XP-sparkle animation behind a short post-auth delay so the
  // initial 0 → loaded transition doesn't fire fake sparkles "topping
  // up" the bar on every app open. Real in-session gains (task done,
  // game finished) animate normally because they happen well after
  // this settles.
  const [xpAnimReady, setXpAnimReady] = useState(false)

  useEffect(() => {
    registerSW()
    // Onboarding owns the permission ASK now (styled slide with context) —
    // home only refreshes the push subscription for users who already said
    // yes. No more native-prompt ambush on first load.
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted'
        && user?.id && profile?.household_id) {
      subscribeToPush(user.id, profile.household_id)
    }
  }, [user?.id, profile?.household_id])

  // Safety-net ping for /api/fire-reminders. The Supabase pg_cron is
  // the primary scheduler, but pinging on mount + tab focus catches
  // any minute the cron skipped — and means a phone coming back
  // online still picks up its current-minute reminder.
  useEffect(() => {
    pingFireReminders()
    const onVis = () => { if (document.visibilityState === 'visible') pingFireReminders() }
    const onFocus = () => pingFireReminders()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Check stat notifications whenever stats change
  useEffect(() => {
    if (stats) checkStatNotifications(stats)
  }, [stats])

  // Cache partner name for notifications. The actual interactions
  // realtime listener that fires `notifyPartnerAction` now lives inside
  // useDailyBattleImpl — folded in there so we only open one channel on
  // `interactions` for the whole app (was 3: DailyBattleHUD + DailyBattlePop
  // + this home_notifs channel, all subscribed to the same INSERTs).
  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    supabase.from('profiles').select('name').eq('household_id', profile.household_id).neq('id', user.id).single()
      .then(({ data }) => { if (data?.name) localStorage.setItem(`eren_partner_name_${user.id}`, data.name) })
  }, [profile?.household_id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Once auth has finished and the profile has had a moment to load,
  // unlock the XP particle animation. Anything that happens before
  // this is treated as initial state hydration, not a real XP gain.
  useEffect(() => {
    if (authLoading) return
    const t = setTimeout(() => setXpAnimReady(true), 1000)
    return () => clearTimeout(t)
  }, [authLoading])

  // XP sparkle particles Eren → bar
  useEffect(() => {
    if (!xpAnimReady) {
      // Silently sync the ref so the first real gain animates from the
      // correct baseline rather than from 0.
      prevXpRef.current = xp
      return
    }
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
  }, [xp, xpAnimReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const [todayMood, setTodayMood]         = useState<UserMood | null>(null)
  const [moodChecked, setMoodChecked]     = useState(false)
  const [moodReadFailed, setMoodReadFailed] = useState(false)
  const [toast, setToast]                 = useState<string | null>(null)
  const [showReminders, setShowReminders] = useState(false)
  const [showRooms, setShowRooms]         = useState(false)
  const [showSendEren, setShowSendEren]   = useState(false)
  const [roomReady, setRoomReady]         = useState(false)

  // Show stats header only when room is fully loaded & mood selected
  // (or the mood read failed and the gate is suppressed — room still shows)
  const pageReady = !authLoading && (!!todayMood || moodReadFailed) && !loading && !!stats && roomReady
  useEffect(() => {
    setHideStats(!pageReady)
  }, [pageReady, setHideStats])
  // Signal to SplashScreen that home is showing something real (room, mood
  // gate, or the "no household" fallback). Any of those replaces the loader
  // and is safe to reveal.
  const splashCanHide = pageReady
    || (!authLoading && !profile?.household_id)
    || (!authLoading && moodChecked && !todayMood)
  usePageReady(splashCanHide)

  // ── Flavor bubble — ambient inner-monologue lines that pop above-left of
  // Eren. Suppressed whenever the wish bubble is visible (pending or in its
  // 2-min post-grant linger) so the two surfaces never overlap. Leader name
  // mirrors WishContext's W-L-T derivation; lines that need {leader} or
  // {other} substitute silently and drop themselves when those are null.
  const leaderName = useMemo<string | null>(() => {
    const myWins = lifetimeWLT?.myWins ?? 0
    const partnerWins = lifetimeWLT?.partnerWins ?? 0
    if (myWins > partnerWins) return profile?.name ?? null
    if (partnerWins > myWins) return partner?.name ?? null
    return null
  }, [lifetimeWLT, profile?.name, partner?.name])

  // Single source of truth for the wish bubble's on-screen window — gates
  // both the WishCloud mount below and the flavor-bubble suppression. The
  // per-viewer 2-min post-grant countdown persists in localStorage, so a
  // remount (route change, PWA relaunch) resumes it instead of restarting
  // it. The countdown arms only while the bubble is actually viewable —
  // home past its gates, no care scene covering the room, Eren awake —
  // otherwise the one-shot window would burn behind MoodGate or a room
  // overlay and the viewer would never see the granted state.
  // `!!wish?.wish` keeps an unresolvable wish row (definition missing, or
  // a 503 left the row unloaded) from suppressing the flavor bubble while
  // nothing is on screen.
  const wishBubbleEligible = pageReady && !activeScene && !stats?.is_sleeping
  const wishBubbleVisible = useWishLinger(
    wish?.status ?? 'loading', wish?.todayKey ?? null, wishBubbleEligible,
  ) && !!wish?.wish

  const { line: flavorLine, dismiss: dismissFlavor } = useFlavorBubble({
    enabled: !!stats && !stats.is_sleeping && roomReady && !authLoading,
    suppressed: wishBubbleVisible,
    leaderName,
    viewerName: profile?.name ?? '',
    partnerName: partner?.name ?? null,
    quietEren: profile?.quiet_eren_optin === true,
  })


  // Phase 3 PR 8 — backdated catchup carousel. Fires once per profile after
  // auth + household resolve; the server endpoint backfills historical
  // memory_frames timestamps, the client carousel walks the user through the
  // result. memory_caught_up flips inside the carousel's dismiss handler.
  const { frames: catchupFrames, dismiss: dismissCatchup } = useCatchupGate({
    userId:      user?.id ?? null,
    householdId: profile?.household_id ?? null,
    ready:       !authLoading && !!todayMood && !!stats && roomReady,
  })

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

  // Signed in but never moved in — resume onboarding at its household step.
  // Only when the profile actually LOADED without a household: profile null
  // is the Supabase-outage state in useAuth, and bouncing a healthy user
  // into onboarding during a 503 would be worse than the loader.
  useEffect(() => {
    if (!authLoading && user && profile && !profile.household_id) router.replace('/onboarding')
  }, [authLoading, user, profile, router])

  useEffect(() => {
    if (!authLoading && !profile?.household_id) setMoodChecked(true)
  }, [authLoading, profile?.household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stats) setIsSick(stats.is_sick ?? false)
  }, [stats?.is_sick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Preload background + Eren before showing the room. Uses img.decode() —
  // it resolves only when the image is fully decoded and ready to paint,
  // unlike onload which fires on network completion (and would let
  // roomReady flip true while the <img> and background-image CSS were
  // still mid-decode, producing a flash of empty room on first load).
  useLayoutEffect(() => { setRoomReady(false) }, [])
  useEffect(() => {
    const bg = isDark ? '/HomeNight.png' : '/HomeDay.png'
    const srcs = [bg, '/erenGood_notail.png', '/erenGood_tail.png']
    let cancelled = false
    setRoomReady(false)
    Promise.all(srcs.map(src => {
      const img = new window.Image()
      img.src = src
      // decode() is the strict guarantee; fall back to a manual onload
      // resolve so a failure (CORS / unsupported browser) doesn't strand
      // roomReady at false.
      return img.decode().catch(() => new Promise<void>(resolve => {
        img.onload = img.onerror = () => resolve()
      }))
    })).then(() => {
      if (!cancelled) setRoomReady(true)
    })
    return () => { cancelled = true }
  }, [isDark])

  // Load today's mood
  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    let timedOut = false
    const timeout = setTimeout(() => { timedOut = true; setMoodChecked(true) }, 6000)
    async function load() {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const { data, error } = await withRetry(() => supabase
          .from('daily_moods').select('mood').eq('user_id', user!.id).eq('date', todayStr).maybeSingle())
        if (data) setTodayMood(data.mood as UserMood)
        // A transient 503 resolves as { data: null, error } without
        // throwing — error means "couldn't check", NOT "no mood yet".
        // Suppress the gate: re-asking would upsert over today's row and
        // can re-fire the partner low-mood push, which is worse than one
        // missed prompt. But if the 6s fallback already fired, the MoodGate
        // is on screen — a late error must not yank it away mid-interaction
        // (that would hide the mood question for the whole session).
        else if (error && !timedOut) setMoodReadFailed(true)
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
  const LoadingScreen = <PageLoader label="LOADING EREN" />

  if (authLoading || !moodChecked) return LoadingScreen

  // Redirected to /onboarding by the effect above — show the loader while
  // the navigation lands.
  if (profile && !profile.household_id) return LoadingScreen
  if (!profile?.household_id) {
    return (
      <div className="page-scroll flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 100, height: 100, objectFit: 'contain', imageRendering: 'pixelated' }} />
        <p className="font-bold text-gray-700">No household found</p>
      </div>
    )
  }

  if (!todayMood && !moodReadFailed) {
    return (
      <MoodGate
        userId={user!.id}
        userName={profile?.name ?? 'friend'}
        householdId={profile?.household_id ?? null}
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
      {/* Suppress partner-message popup while the catchup carousel is up so
          an inbound message doesn't mount hidden under z-80 and surprise the
          user when they dismiss. The realtime subscription buffers it; it'll
          show up as unread on the couple chip. */}
      {newMessage && !catchupFrames && <ErenMessagePopup message={newMessage} onDismiss={dismissPopup} />}
      {showSendEren && partner && (
        <SendErenSheet
          partnerName={partner.name}
          onSend={sendNudge}
          onClose={() => setShowSendEren(false)}
        />
      )}

      {catchupFrames && (
        <CatchupCarousel
          frames={catchupFrames}
          onOpenHallway={() => router.push('/hallway')}
          onClose={dismissCatchup}
        />
      )}

      {/* ══ FULL SCREEN ROOM ══ */}
      <div className="fixed inset-0" style={{ zIndex: 0 }}
        onTouchStart={e => { swipeTouchX.current = e.touches[0].clientX }}
        onTouchMove={e => {
          const dx = Math.abs(e.touches[0].clientX - swipeTouchX.current)
          if (dx > 20 && !dotsVisible) flashDots()
        }}>

        {/* Background image */}
        <div className="absolute inset-0" style={{
          backgroundImage: `url(${isDark ? '/HomeNight.png' : '/HomeDay.png'})`,
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

        {/* === EREN === (hidden while sleeping in the bedroom) */}
        {!stats.is_sleeping && (
          <>
            {/* Floating thought cloud — Eren wants to deliver a message or gift
                to the partner. Tapping it expands into the message + gift
                composer. Hidden while asleep since the whole Eren is. */}
            <ThoughtCloud />

            {/* Eren's whisper — names today's care leader when one
                partner is clearly ahead, otherwise drops a neutral
                line. Self-gated to ~30% of eligible opens and a 2h
                cooldown so it stays a treat, not a nag. */}
            <JealousEren />

            {/* Persistent daily care-battle HUD above Eren. The HUD
                opens a detail sheet on tap with the prize info and
                time-to-reset. Lives inside the awake block since it
                anchors visually to Eren's head. */}
            <DailyBattleHUD />

            {/* Fires on the rare moment the user pulls ahead today after
                losing yesterday. Listens to the `eren:comeback` event;
                useDailyBattle CAS-guards the bonus. */}
            <ComebackBadge />

            <div className="absolute" style={{
              bottom: '10%', left: '50%', transform: 'translateX(-50%)', zIndex: 2,
              filter: mood === 'angry' ? 'hue-rotate(340deg) saturate(1.3)' : mood === 'sleepy' ? 'brightness(0.85)' : 'none',
            }}>
              {/* Tappable wrapper — pet/purr lives here. He stays put and
                  just trembles a gentle purr in place; no lean. */}
              <div
                role="button"
                aria-label="Pet Eren"
                onClick={handlePetEren}
                style={{
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  animation: petReaction.phase === 'purr'
                    ? 'erenPurrShiver 150ms ease-in-out 6' : undefined,
                  transformOrigin: 'bottom center',
                }}>
                  <ErenIdleLayer disabled={petReaction.active}>
                    {/* Tail split into its own layer (erenGood_tail.png) over a
                        tail-erased body so only the tail sways. See BlinkingEren. */}
                    <BlinkingEren id="eren-img" size={200}
                      src="/erenGood_notail.png"
                      tailSrc="/erenGood_tail.png" />
                    <StinkyFlies cleanliness={stats?.cleanliness ?? 100} />

                    {/* Outfit overlays — % positions are relative to the parent
                        absolute div, which is sized by BlinkingEren (200×200). */}
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
                  </ErenIdleLayer>
                </div>

                {/* Purr hearts + word, anchored to this box (centered above). */}
                {petReaction.phase === 'purr' && <>
                  <Hearts count={3} bottom="58%" />
                  <SoundWord word="PURRR" color={WORD_COLOR.purr} left={50} top={6} />
                </>}
              </div>
            </div>

            {/* Daily wish bubble — anchored above-left of Eren, opposite
                ThoughtCloud's above-right anchor. Pending state shows the
                wish all day; after the grant, useWishLinger keeps it mounted
                for two minutes per viewer (persisted across reopens) and
                then unmounts it for the rest of the day. */}
            {wishBubbleVisible && wish?.wish && wish.status !== 'loading' && (
              <WishCloud
                wish={wish.wish}
                text={wish.text}
                status={wish.status}
                grantedByMe={!!wish.grantedBy && wish.grantedBy === user?.id}
                grantedByName={wish.grantedBy === user?.id ? (profile?.name ?? null)
                  : wish.grantedBy === partner?.id ? (partner?.name ?? null)
                  : null}
                coinsPaid={wish.coinsPaid}
              />
            )}

            {/* Gold sparkle explosion centered on Eren himself on grant.
                Listens for `eren:wish-granted` and re-fires per grant. */}
            <ErenGrantBurst />

            {/* Ambient flavor bubble — Eren's inner monologue. Cycles every
                60–90s, plus contextual triggers (after_positive, gap_24h,
                duplicate_feed). Suppressed whenever the wish bubble is up so
                the two surfaces never collide in the same anchor. */}
            {flavorLine && (
              <ErenSpeechBubble bubble={flavorLine} onDismiss={dismissFlavor} />
            )}

            {/* Little heart by Eren's side — quick "Send Eren" to your
                partner. Only shown when paired. */}
            {partner && (
              <button
                onClick={() => { playSound('ui_modal_open'); setShowSendEren(true) }}
                aria-label={`Send Eren to ${partner.name}`}
                className="absolute active:scale-90 transition-transform"
                style={{ bottom: '22%', left: '23%', zIndex: 3 }}
              >
                <div className="relative flex items-center justify-center" style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 28%, #2a1620 0%, #0a0a0c 60%, #000 100%)',
                  border: '1.5px solid rgba(255,107,157,0.5)',
                  boxShadow: '0 0 12px rgba(255,107,157,0.4), 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
                  animation: 'sendErenPulse 2.2s ease-in-out infinite',
                }}>
                  <IconHeart size={18} />
                  {/* Mood hint — dot shows the partner's mood whenever they've
                      checked in today; low moods glow stronger to stand out. */}
                  {partnerMood && (
                    <div className="absolute" style={{
                      top: -2, right: -2,
                      width: 12, height: 12, borderRadius: '50%',
                      background: `linear-gradient(180deg, ${MOOD_THEME[partnerMood].main}, ${MOOD_THEME[partnerMood].dark})`,
                      border: '2px solid #050507',
                      boxShadow: LOW_MOODS.includes(partnerMood)
                        ? `0 0 8px ${MOOD_THEME[partnerMood].glow}, 0 0 14px ${MOOD_THEME[partnerMood].glow}`
                        : `0 0 5px ${MOOD_THEME[partnerMood].glow}`,
                    }} />
                  )}
                </div>
              </button>
            )}
            <style jsx global>{`
              @keyframes sendErenPulse {
                0%, 100% { transform: scale(1);    box-shadow: 0 0 12px rgba(255,107,157,0.4), 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1); }
                50%      { transform: scale(1.08); box-shadow: 0 0 18px rgba(255,107,157,0.65), 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1); }
              }
              @keyframes erenPetWiggle {
                0%   { transform: rotate(0deg)    scale(1); }
                15%  { transform: rotate(-3deg)   scale(1.05); }
                35%  { transform: rotate(2.5deg)  scale(1.03); }
                55%  { transform: rotate(-1.8deg) scale(1.04); }
                75%  { transform: rotate(1.2deg)  scale(1.02); }
                100% { transform: rotate(0deg)    scale(1); }
              }
            `}</style>

          </>
        )}


        {/* ══ HUD OVERLAY (below shared stats header) ══ */}
        <div className="absolute left-0 right-0 z-10 px-3" style={{ top: 'calc(var(--safe-top) + 124px)' }}>

          {/* Quest panel + nav buttons share a single row again. The
              buttons are 34 px wide with a 4-px gap (instead of 40 / 8)
              so the row holds the panel + 7 buttons (8 when fortune is
              available) without truncating. */}
          <div className="flex items-center gap-1">
            {/* Quests — flexes to take remaining space */}
            <div className="flex-1 min-w-0">
              <TaskPanel compact />
            </div>

            {/* Nav buttons — obsidian + gold-rivet to match the new HUD */}
            {fortuneAvailable && (
              <button onClick={() => { playSound('ui_modal_open'); setShowFortune(true) }}
                className="w-8 h-8 flex-shrink-0 relative flex items-center justify-center active:scale-90 transition-transform"
                style={{ ...cuteBtn('217,199,247'), animation: 'pulse 2s ease-in-out infinite' }}>
                <CuteIcon><IconGift size={18} /></CuteIcon>
              </button>
            )}
            <Link href="/hallway" onClick={() => playSound('ui_tap')}
              aria-label="The Hallway"
              className="w-8 h-8 flex-shrink-0 relative flex items-center justify-center active:scale-90 transition-transform"
              style={cuteBtn('191,224,255')}>
              <CuteIcon><IconPhoto size={18} /></CuteIcon>
            </Link>
            <Link href="/couple" onClick={() => playSound('ui_tap')} className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center active:scale-90 transition-transform"
              style={cuteBtn('255,198,216')}>
              <CuteIcon><IconHeart size={18} /></CuteIcon>
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 flex items-center justify-center"
                  style={{ width: 16, height: 16, background: '#FF1D5E', border: '2px solid #050507', boxShadow: '0 0 4px rgba(255,29,94,0.6)', borderRadius: 6 }}>
                  <span className="font-pixel text-white" style={{ fontSize: 5 }}>{unreadCount}</span>
                </div>
              )}
            </Link>
            <button onClick={() => { playSound('ui_modal_open'); setShowReminders(true) }}
              className="w-8 h-8 flex-shrink-0 relative flex items-center justify-center active:scale-90 transition-transform"
              style={cuteBtn('251,228,154')}>
              <CuteIcon><IconBell size={18} /></CuteIcon>
            </button>
            <Link href="/profile" onClick={() => playSound('ui_tap')}
              className="w-8 h-8 flex-shrink-0 relative flex items-center justify-center active:scale-90 transition-transform"
              style={cuteBtn('217,199,247')}>
              <CuteIcon><IconPerson size={18} /></CuteIcon>
            </Link>
            <div className="relative flex-shrink-0">
              <button onClick={() => { playSound(showRooms ? 'ui_modal_close' : 'ui_modal_open'); setShowRooms(r => !r) }}
                className="w-10 h-10 relative flex items-center justify-center active:scale-90 transition-transform"
                style={cuteBtn('226,196,154')}>
                <CuteIcon><IconDoor size={18} /></CuteIcon>
              </button>
              {showRooms && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowRooms(false)} />
                  <div className="absolute right-0 top-12 z-30 flex flex-col gap-1.5 p-2.5"
                    style={{
                      background: 'linear-gradient(180deg, rgba(16,10,36,0.96) 0%, rgba(8,5,22,0.98) 100%)',
                      backdropFilter: 'blur(16px)',
                      borderRadius: 6,
                      border: '2px solid rgba(167,139,250,0.35)',
                      minWidth: 172,
                      boxShadow: '4px 4px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
                    }}>
                    {/* Scanline overlay */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                      background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)',
                      borderRadius: 6,
                    }} />
                    {/* Corner ticks */}
                    <div style={{ position: 'absolute', top: 4, left: 4, width: 4, height: 4, background: '#A78BFA', opacity: 0.6 }} />
                    <div style={{ position: 'absolute', top: 4, right: 4, width: 4, height: 4, background: '#A78BFA', opacity: 0.6 }} />
                    <div style={{ position: 'absolute', bottom: 4, left: 4, width: 4, height: 4, background: '#A78BFA', opacity: 0.6 }} />
                    <div style={{ position: 'absolute', bottom: 4, right: 4, width: 4, height: 4, background: '#A78BFA', opacity: 0.6 }} />

                    {([
                      { id: 'feed',   label: 'Kitchen',       Icon: IconDrumstick, color: '#F5C842', rgb: '245,200,66' },
                      { id: 'play',   label: 'Playroom',      Icon: IconYarn,      color: '#FF6B9D', rgb: '255,107,157' },
                      { id: 'sleep',  label: 'Bedroom',       Icon: IconMoonZ,     color: '#818CF8', rgb: '129,140,248' },
                      { id: 'wash',   label: 'Bathroom',      Icon: IconBath,      color: '#38BDF8', rgb: '56,189,248' },
                      { id: 'chemistry', label: 'Chem Lab',   Icon: IconFlask,     color: '#84CC16', rgb: '132,204,22' },
                      { id: 'vet',    label: 'Vet Office',    Icon: IconPill,      color: '#34D399', rgb: '52,211,153' },
                      { id: 'school', label: 'Serbian Class', Icon: IconBook,      color: '#F59E0B', rgb: '245,158,11' },
                      // Bakery is a top-level route, not a care scene — `href`
                      // routes via router.push instead of openScene().
                      { id: 'bakery', label: 'Eren’s Bakery', Icon: IconCake, color: '#FBBF24', rgb: '251,191,36', href: '/bakery' },
                    ] as const).map(room => (
                      <button key={room.id} onClick={() => {
                        playSound('ui_tap')
                        setShowRooms(false)
                        if ('href' in room && room.href) {
                          requestCloudNav(room.href)
                        } else {
                          openScene(room.id as Exclude<typeof room.id, 'bakery'>)
                        }
                      }}
                        className="flex items-center gap-2.5 px-3 py-2 active:scale-95 transition-transform relative"
                        style={{
                          borderRadius: 4,
                          background: `linear-gradient(135deg, rgba(${room.rgb},0.12), rgba(${room.rgb},0.04))`,
                          border: `1px solid rgba(${room.rgb},0.25)`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)`,
                        }}>
                        <div className="flex items-center justify-center"
                          style={{
                            width: 26, height: 26,
                            background: `rgba(${room.rgb},0.15)`,
                            borderRadius: 3,
                            border: `1px solid rgba(${room.rgb},0.4)`,
                          }}>
                          <room.Icon size={18} />
                        </div>
                        <span className="font-pixel" style={{ fontSize: 7, color: room.color, letterSpacing: 0.5, textShadow: `0 0 4px rgba(${room.rgb},0.4)` }}>
                          {room.label.toUpperCase()}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dot indicators — only visible during swipe / scene transition */}
        <div className="absolute bottom-4 left-1/2 z-10 flex items-center gap-0.5 px-2 py-0.5"
          style={{
            transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.35)',
            borderRadius: 20, backdropFilter: 'blur(6px)',
            opacity: dotsVisible ? 1 : 0,
            transition: 'opacity 0.3s ease',
            pointerEvents: dotsVisible ? 'auto' : 'none',
          }}>
          {/* Home dot — active */}
          <div style={{ padding: '8px 4px', lineHeight: 0 }}>
            <div style={{ width: 18, height: 7, borderRadius: 4, background: '#FF6B9D', boxShadow: '0 0 6px 2px #FF6B9D88', transition: 'all 0.25s ease' }} />
          </div>
          {/* Care room dots — clickable */}
          {([
            { id: 'feed',   color: '#F5C842' },
            { id: 'play',   color: '#FF6B9D' },
            { id: 'sleep',  color: '#818CF8' },
            { id: 'wash',   color: '#38BDF8' },
            { id: 'chemistry', color: '#84CC16' },
            { id: 'vet',    color: '#34D399' },
            { id: 'school', color: '#F59E0B' },
          ] as const).map(r => (
            <button
              key={r.id}
              onClick={() => { playSound('ui_tap'); openScene(r.id) }}
              aria-label={`Open ${r.id}`}
              className="active:scale-90 transition-transform"
              style={{ padding: '8px 4px', lineHeight: 0, background: 'transparent' }}>
              <div style={{
                width: 7, height: 7, borderRadius: 4,
                background: 'rgba(255,255,255,0.4)',
                boxShadow: `0 0 4px ${r.color}44`,
                transition: 'all 0.15s ease',
              }} />
            </button>
          ))}
        </div>

        {/* switchTop pushed below the home HUD/nav row so it doesn't sit
            on top of the quest panel + nav buttons. */}
        <LightSwitch switchTop="30%" targetBottom="10%" targetLeft="50%" persistKey="home" />

        {/* ══ BOTTOM DOCK — gacha · cake · shawarma ══
            Three full-width neo-brutalism buttons filling the floor of the
            room. Vibrant per-button gradient, hard 2px ink border + 4px
            offset shadow, icon stacked over font-pixel label. Press state
            slides the button into the shadow for a tactile click. */}
        <div
          className="absolute left-0 right-0 z-20 flex gap-2 px-2"
          style={{ bottom: 'calc(var(--safe-bottom, 0px) + 10px)' }}
        >
          <Link
            href="/gacha"
            onClick={e => {
              // Rainbow variant of the cloud flight — gacha is the lucky room.
              e.preventDefault()
              playSound('ui_tap')
              requestCloudNav('/gacha', 'rainbow')
            }}
            className="home-dock-btn"
            style={{
              ...dockBtnBase,
              background: 'linear-gradient(180deg, #D4B4FC 0%, #A78BFA 45%, #7C3AED 100%)',
            }}
          >
            <div style={dockBtnGloss} />
            <div className="home-dock-shine" style={{ animationDelay: '0s' }} />
            <span style={dockBtnIcon}><IconCapsule size={17} /></span>
            <span style={dockBtnLabel}>GACHA</span>
          </Link>

          <Link
            href="/bakery"
            onClick={e => {
              // Magical entry: clouds converge, the route swaps underneath,
              // then they part on the shop. CloudTransition owns the push.
              e.preventDefault()
              playSound('ui_tap')
              requestCloudNav('/bakery')
            }}
            className="home-dock-btn"
            style={{
              ...dockBtnBase,
              background: 'linear-gradient(180deg, #FBCFE8 0%, #F472B6 45%, #DB2777 100%)',
            }}
          >
            <div style={dockBtnGloss} />
            <div className="home-dock-shine" style={{ animationDelay: '1.4s' }} />
            <span style={dockBtnIcon}><IconCake size={17} /></span>
            <span style={dockBtnLabel}>CAKE</span>
          </Link>

          <button
            onClick={() => { playSound('ui_tap'); showToast('SHAWARMA — coming soon') }}
            className="home-dock-btn"
            style={{
              ...dockBtnBase,
              background: 'linear-gradient(180deg, #FED7AA 0%, #FB923C 45%, #C2410C 100%)',
            }}
          >
            <div style={dockBtnGloss} />
            <div className="home-dock-shine" style={{ animationDelay: '2.8s' }} />
            <span style={dockBtnIcon}><IconShawarma size={17} /></span>
            <span style={dockBtnLabel}>SHAWARMA</span>
          </button>
        </div>

      </div>
    </>
  )
}
