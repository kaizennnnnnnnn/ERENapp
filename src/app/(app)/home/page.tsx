'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useCat } from '@/hooks/useCat'
import { useTimeTracking } from '@/hooks/useTimeTracking'
import MoodGate from '@/components/MoodGate'
import type { UserMood } from '@/types'
import { useCare } from '@/contexts/CareContext'
import { useTasks } from '@/contexts/TaskContext'
import { Sparkles } from 'lucide-react'
import { IconHeart, MeadowIcon } from '@/components/PixelIcons'
import { M, NAV_HEIGHT } from '@/components/meadow/tokens'
import { playSound } from '@/lib/sounds'
import TaskPanel from '@/components/TaskPanel'
import BlinkingEren from '@/components/BlinkingEren'
import { useRoomErenState } from '@/hooks/useRoomEren'
import StinkyFlies from '@/components/StinkyFlies'
import PageLoader from '@/components/PageLoader'
import ReminderSheet from '@/components/ReminderSheet'
import { registerSW, pingFireReminders } from '@/lib/reminders'
import { checkStatNotifications, requestNotificationPermission } from '@/lib/statNotifications'
import { subscribeToPush } from '@/lib/pushSubscription'
import { useCouple } from '@/hooks/useCouple'
import { useFortune } from '@/hooks/useFortune'
import { useInventory } from '@/hooks/useInventory'
import { useNewSkins } from '@/hooks/useNewSkins'
import HomeRoomFrame, { homeRoomArt } from '@/components/home/HomeRoomFrame'
import HomeHud from '@/components/home/HomeHud'
import RoomDots from '@/components/home/RoomDots'
import HomeDock, { DOCK_CLEARANCE } from '@/components/home/DockButtons'
import { useHideBottomNav } from '@/components/nav/NavVisibility'
import FortunePopup from '@/components/fortune/FortunePopup'
import ErenMessagePopup from '@/components/couple/ErenMessagePopup'
import GiftArrival from '@/components/couple/GiftArrival'
import ThoughtCloud from '@/components/couple/ThoughtCloud'
import JealousEren from '@/components/couple/JealousEren'
import DailyBattleHUD from '@/components/couple/DailyBattleHUD'
import DailyVerdictScreen from '@/components/couple/DailyVerdictScreen'
import { useDailyVerdict } from '@/hooks/useDailyVerdict'
import { useTrophyEffects } from '@/hooks/useTrophyEffects'
import { useTrophies } from '@/hooks/useTrophies'
import CoopGoalBar from '@/components/couple/CoopGoalBar'
import ComebackBadge from '@/components/couple/ComebackBadge'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import SendErenSheet from '@/components/couple/SendErenSheet'
import { MOOD_THEME, LOW_MOODS, moodDateKey } from '@/lib/moods'
import { useIsDark } from '@/hooks/useIsDark'
import LightSwitch from '@/components/LightSwitch'
import { useWish } from '@/contexts/WishContext'
import { useWishLinger } from '@/hooks/useWishLinger'
import { useErenReaction } from '@/hooks/useErenReaction'
import PetTarget, { PurrFx, PURR } from '@/components/care/PetTarget'
import WishCloud from '@/components/wish/WishCloud'
import ErenGrantBurst from '@/components/wish/ErenGrantBurst'
import ErenSpeechBubble from '@/components/wish/ErenSpeechBubble'
import { useFlavorBubble } from '@/hooks/useFlavorBubble'
import { useCatchupGate } from '@/hooks/useCatchupGate'
import CatchupCarousel from '@/components/memory/CatchupCarousel'
import TodaysMenu from '@/components/wish/TodaysMenu'
import { useFoodMenu } from '@/hooks/useFoodMenu'
import { usePageReady } from '@/hooks/usePageReady'
import RoomWeather from '@/components/weather/RoomWeather'

interface XpParticle {
  id: number; x: number; y: number; tx: number; ty: number
  text: string; delay: number; duration: number
  size: number; color: string; glow: string
}

// Home's default idle look — stable ref so useRoomEren's memo holds.
const HOME_EREN_FALLBACK = { src: '/erenGood_notail.png', tailSrc: '/erenGood_tail.png' }

// Which screen home is on. The early returns in HomePage follow this, and the
// bottom nav reads it to know when to step aside.
type HomeGate = 'loading' | 'no-household' | 'mood' | 'verdict' | 'room'

// Has the living room been on screen yet in this app session? Every tap of the
// Home tab remounts this page, and each remount shows the loader for a network
// round trip (useAuth re-checks the session). Hiding the nav for that would
// blink the bar off and on at every tap, so only the session's first load, the
// one the splash covers, keeps it hidden; later loaders sit under a steady bar.
let roomSeenThisSession = false

export default function HomePage() {
  const router   = useRouter()
  const supabase = createClient()
  const { user, profile, loading: authLoading } = useAuth()
  const { stats, loading } = useErenStats(profile?.household_id ?? null)
  const { setIsSick, openScene, setHideStats, activeScene } = useCare()
  const { xp } = useTasks()
  useTimeTracking(user?.id ?? null)
  const { canClaim: fortuneAvailable } = useFortune()
  const { newMessage, dismissPopup, partner, isSolo, sendNudge, partnerMood, lifetimeWLT, giftArrivals, markGiftsSeen } = useCouple()
  const { inventory, loaded: invLoaded } = useInventory()
  const newSkinCount = useNewSkins(inventory, invLoaded)
  const isDark = useIsDark()
  const wish = useWish()
  const cat = useCat()
  // Today's three foods. Owns its own payout — see useFoodMenu.
  const foodMenu = useFoodMenu(profile?.household_id)
  // Idle look for the living room: a Closet skin, else the household's own cat
  // (cat_look, recoloured), else the classic erenGood. `pending` is the first
  // decode of the household's cat this session; the room holds its loader
  // through it (see the preload below) so the cat never pops in late.
  const { sprite: homeEren, pending: homeErenPending } = useRoomErenState('home', HOME_EREN_FALLBACK)

  // Pet interaction — tap on Eren and he stays in place, just trembling a
  // gentle purr with hearts + a "PURRR". The behaviour lives in PetTarget so
  // the care rooms pet him identically; it also dispatches eren:pet for the
  // pet-flavoured wishes (mood-pet, mood-lap).
  const petReaction = useErenReaction()

  // The unread / reward dot that sat on this page's heart button now lives on
  // the bottom nav's Us tab (nav/useUsBadge), with the same conditions.

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

  // XP sparkles fly from Eren into the top bar's level ring
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
    // Into the middle of the top bar's level ring.
    const dstX = barRect.left  + barRect.width / 2
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
  const [showSendEren, setShowSendEren]   = useState(false)

  // The room is ready once the exact pictures it will paint (the painting for
  // the time of day and Eren's idle layers) have decoded; see the preload
  // below. Derived from WHICH set decoded rather than kept as a flag, so the
  // render where the sprite changes (stats arriving with a Closet skin, the
  // household's own cat finishing its first decode) is already not-ready. A
  // flag reset from an effect lets that one render show the room with a cat
  // that isn't painted yet, then drop back to the loader: the loader twice.
  // `homeErenPending` is the household's cat still being made; its layers
  // don't exist yet, so there is nothing to decode and nothing to show.
  const roomArt = homeRoomArt(isDark)
  const roomArtKey = [roomArt, homeEren.src, homeEren.tailSrc ?? ''].join('|')
  const [decodedArtKey, setDecodedArtKey] = useState<string | null>(null)
  const roomReady = !homeErenPending && decodedArtKey === roomArtKey

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

  // Browser timezone for day-boundary math — the daily quip must resolve the
  // same local day on both partners' phones (same household + same tz → same
  // quip). Falls back to UTC inside dateKey when null.
  const homeTz = useMemo<string | null>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null } catch { return null }
  }, [])

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

  // A line the partner bought in the Trophy Shop for Eren to say to me.
  const { erenSays } = useTrophyEffects()
  const { balance: trophyBalanceRaw, loaded: trophiesLoaded } = useTrophies()
  const trophyBalance = trophiesLoaded ? trophyBalanceRaw : 0

  const { line: flavorLine, dismiss: dismissFlavor } = useFlavorBubble({
    erenSays,
    enabled: !!stats && !stats.is_sleeping && roomReady && !authLoading,
    // Only mute flavor while the GRANT celebration owns the anchor (its 2-min
    // linger). While a wish is merely pending it can sit unanswered all day —
    // suppressing flavor then would silence Eren's whole inner monologue. So
    // during pending, flavor and the wish cloud take turns: a flavor line
    // borrows the anchor for ~5.5s (the WishCloud `!flavorLine` gate below
    // hides the wish meanwhile), then the wish returns.
    suppressed: wishBubbleVisible && wish?.status === 'granted',
    leaderName,
    viewerName: profile?.name ?? '',
    partnerName: partner?.name ?? null,
    quietEren: profile?.quiet_eren_optin === true,
    userId: user?.id ?? null,
    householdId: profile?.household_id ?? null,
    tz: homeTz,
  })

  // Phase 3 PR 8 — backdated catchup carousel. Fires once per profile after
  // auth + household resolve; the server endpoint backfills historical
  // memory_frames timestamps, the client carousel walks the user through the
  // result. memory_caught_up flips inside the carousel's dismiss handler.
  // Yesterday's result + the trophy it paid. Same readiness contract as the
  // catchup gate: the mood is in, the stats are loaded and the room art has
  // decoded, so the verdict never renders under the splash.
  const verdict = useDailyVerdict(!authLoading && !!todayMood && !!stats && roomReady)

  const { frames: catchupFrames, dismiss: dismissCatchup } = useCatchupGate({
    userId:      user?.id ?? null,
    householdId: profile?.household_id ?? null,
    ready:       !authLoading && !!todayMood && !!stats && roomReady,
  })

  // Gifts my partner left while I was away. Ranked under the catchup carousel
  // for the same reason the message popup is: two full-screen moments must
  // not stack, and this one keeps until it is shown -- the marker only moves
  // when the tray is actually dismissed.
  const showGiftTray = giftArrivals.length > 0 && !catchupFrames

  // Fast localStorage check
  useEffect(() => {
    if (!user?.id) return
    const todayStr = moodDateKey()
    // `pocket_eren_mood_*` is the old key name. Read it as a fallback so a mood
    // logged before the rename doesn't re-prompt the gate today; it ages out on
    // its own (the key is date-stamped) and this line can go after a day.
    const cached = localStorage.getItem(`eren_mood_${user.id}_${todayStr}`)
      ?? localStorage.getItem(`pocket_eren_mood_${user.id}_${todayStr}`)
    if (cached) { setTodayMood(cached as UserMood); setMoodChecked(true) }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading && !user) router.replace('/onboarding')
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
  useEffect(() => {
    // The household's own cat is still being painted: its layers don't exist
    // yet, so there is nothing to preload. Stay on the loader until they do;
    // revealing the room now would show it catless and then swap him in.
    if (homeErenPending) return
    // Preload the idle look the room will actually paint — a Closet skin (its
    // cache-busted ?v= URLs), the household's recoloured cat, or the classic
    // default — so BlinkingEren (which decode-gates itself) shows it the
    // instant the room reveals instead of popping it in a beat after.
    // Hardcoding erenGood here missed skins.
    const srcs = [roomArt, homeEren.src, homeEren.tailSrc].filter(Boolean) as string[]
    let cancelled = false
    Promise.all(srcs.map(src => {
      const img = new window.Image()
      img.src = src
      // A picture that can't decode (a missing file, a revoked object URL)
      // must not hold the whole room on the loader. It rejects only after the
      // load has already failed, so waiting on onload/onerror here would wait
      // forever; the room shows and BlinkingEren copes with its own image.
      return img.decode().catch(() => undefined)
    })).then(() => {
      if (!cancelled) setDecodedArtKey(roomArtKey)
    })
    return () => { cancelled = true }
  }, [roomArtKey, homeErenPending]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load today's mood
  useEffect(() => {
    if (!profile?.household_id || !user?.id) return
    let timedOut = false
    const timeout = setTimeout(() => { timedOut = true; setMoodChecked(true) }, 6000)
    async function load() {
      try {
        const todayStr = moodDateKey()
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

  // ── Which screen ──
  // In order, the same gates the returns below act on:
  //   loading       auth, today's mood check, stats or the room art in flight
  //                 (roomReady also covers the household's own cat while it
  //                 is first being painted, homeErenPending)
  //                 — and "signed in but never moved in", which the effect
  //                 above is redirecting to /onboarding
  //   no-household  no profile at all: the Supabase-outage state in useAuth
  //   mood          today's mood question
  //   verdict       yesterday's result — a hard gate rather than an overlay,
  //                 so it cannot mount underneath the catchup carousel or an
  //                 inbound message popup. Both of those are inside the room
  //                 tree and simply don't exist while this is up; they get
  //                 their turn on the render after it closes.
  const gate: HomeGate =
    authLoading || !moodChecked ? 'loading'
    : !profile?.household_id ? (profile ? 'loading' : 'no-household')
    : !todayMood && !moodReadFailed ? 'mood'
    : loading || !stats || !roomReady ? 'loading'
    : verdict.show && verdict.row ? 'verdict'
    : 'room'

  // The bottom nav belongs to the living room. It steps aside for the mood
  // question and the verdict (full-screen moments), and for the loader until
  // the room has shown once this session (see roomSeenThisSession).
  useHideBottomNav(gate !== 'room' && (gate === 'mood' || gate === 'verdict' || !roomSeenThisSession))
  useEffect(() => { if (gate === 'room') roomSeenThisSession = true }, [gate])

  // No name until the row is in, so a renamed cat never flashes up as EREN.
  const LoadingScreen = <PageLoader label={cat.known ? cat.t('LOADING {NAME}') : 'LOADING'} />

  if (gate === 'no-household') {
    return (
      <div className="page-scroll flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <img src="/erenGood.png" alt={cat.name} draggable={false} style={{ width: 100, height: 100, objectFit: 'contain' }} />
        <p className="font-bold text-gray-700">No household found</p>
      </div>
    )
  }

  if (gate === 'mood') {
    return (
      <MoodGate
        userId={user!.id}
        userName={profile?.name ?? 'friend'}
        householdId={profile?.household_id ?? null}
        onDone={mood => {
          const todayStr = moodDateKey()
          localStorage.setItem(`eren_mood_${user!.id}_${todayStr}`, mood)
          setTodayMood(mood)
          showToast('Mood saved')
        }}
      />
    )
  }

  if (gate === 'verdict' && verdict.row) {
    return (
      // The verdict is the morning report on a battle a solo player has
      // genuinely been fighting, so naming the other podium "Partner" makes
      // the headline read PARTNER TOOK IT about nobody. Resolved the same way
      // useDailyBattle.ts already resolves it for the live HUD.
      <DailyVerdictScreen
        row={verdict.row}
        awarded={verdict.awarded}
        streak={verdict.streak}
        yesterdayTwist={verdict.yesterdayTwist}
        todayTwist={verdict.todayTwist}
        myName={profile?.name?.split(' ')[0] ?? 'You'}
        partnerName={partner?.name?.split(' ')[0] ?? (isSolo ? cat.name : 'Partner')}
        myTitle={profile?.equipped_title}
        myFrame={profile?.equipped_frame}
        partnerTitle={partner?.equipped_title}
        partnerFrame={partner?.equipped_frame}
        onClose={verdict.dismiss}
      />
    )
  }

  // Every other gate is the loader. (`!stats` is already a 'loading' gate;
  // repeating it here is what tells TypeScript the room below has stats.)
  if (gate !== 'room' || !stats) return LoadingScreen

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
      {/* Above the nav and the dock on its floor: the top of the screen is
          the stats header's, which sits over anything here. */}
      {toast && (
        <div role="status" className="meadow-root fixed left-1/2 -translate-x-1/2 z-50 flex items-center whitespace-nowrap pointer-events-none"
          style={{
            bottom: `calc(${NAV_HEIGHT} + ${DOCK_CLEARANCE}px)`, gap: 8, padding: '10px 16px 10px 12px',
            background: '#FFFFFF', borderRadius: 999, boxShadow: `0 3px 0 ${M.overArtLip}`,
            fontSize: 15, fontWeight: 800, color: M.text,
          }}>
          <MeadowIcon name="check" size={20} color={M.leaf} />
          {toast}
        </div>
      )}

      {showReminders && <ReminderSheet onClose={() => setShowReminders(false)} />}
      {showFortune && <FortunePopup onClose={() => setShowFortune(false)} />}
      {/* Suppress partner-message popup while the catchup carousel is up so
          an inbound message doesn't mount hidden under z-80 and surprise the
          user when they dismiss. The realtime subscription buffers it; it'll
          show up as unread on the nav's Us tab. */}
      {newMessage && !catchupFrames && !showGiftTray && <ErenMessagePopup message={newMessage} onDismiss={dismissPopup} />}

      {/* Everything they were given while they were out, handed over at once
          rather than one popup per gift. */}
      {showGiftTray && (
        <GiftArrival
          gifts={giftArrivals}
          fromName={partner?.name?.split(' ')[0] ?? 'Your partner'}
          onClose={markGiftsSeen}
        />
      )}
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

      {/* ══ THE ROOM ══ the painting fills the screen; everything standing in
          it lives on a stage that ends at the bottom nav (see HomeRoomFrame). */}
      <HomeRoomFrame
        dark={isDark}
        onTouchStart={e => { swipeTouchX.current = e.touches[0].clientX }}
        onTouchMove={e => {
          const dx = Math.abs(e.touches[0].clientX - swipeTouchX.current)
          if (dx > 20 && !dotsVisible) flashDots()
        }}
        artLayers={<>
          {/* Whatever the household hung outside the living-room window. It
              reproduces the painting's own `cover`, so it lives with the art,
              over the wallpaper and under Eren. */}
          <RoomWeather room="home" dark={isDark} />

          {mood === 'happy' && (
            <>
              <Sparkles size={11} className="absolute text-yellow-400 animate-sparkle" style={{ top: '30%', left: '10%', zIndex: 2 }} />
              <Sparkles size={9}  className="absolute text-pink-400  animate-sparkle" style={{ top: '25%', right: '15%', zIndex: 2, animationDelay: '0.7s' }} />
            </>
          )}
        </>}
      >

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
              {/* Tappable wrapper — he stays put and just trembles a gentle
                  purr in place; no lean. */}
              <PetTarget reaction={petReaction}>
                <ErenIdleLayer disabled={petReaction.active}>
                  {/* Tail split into its own layer (erenGood_tail.png) over a
                      tail-erased body so only the tail sways. See BlinkingEren. */}
                  <BlinkingEren id="eren-img" size={200} {...homeEren} />
                  <StinkyFlies cleanliness={stats?.cleanliness ?? 100} />
                  {/* Eren used to wear emoji hats and the room used to have
                      emoji plants stuck to it, both from the gacha. Those items
                      are gone: his look comes from Closet skins now. */}
                </ErenIdleLayer>
              </PetTarget>

              {/* Purr hearts + word, anchored to this box (centered above). */}
              {petReaction.phase === PURR && <PurrFx />}
            </div>

            {/* Daily wish bubble — anchored above-left of Eren, opposite
                ThoughtCloud's above-right anchor. Pending state shows the
                wish all day; after the grant, useWishLinger keeps it mounted
                for two minutes per viewer (persisted across reopens) and
                then unmounts it for the rest of the day. While a flavor line
                is on screen it yields the anchor (`!flavorLine`) so Eren's
                ambient thoughts get a turn instead of being muted all day. */}
            {wishBubbleVisible && !flavorLine && wish?.wish && wish.status !== 'loading' && (
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

            {/* Food bowl on Eren's other side — tap for the three foods he
                wants today. Mirrors the send-heart's anchor so the two read as
                a matched pair of things sitting beside him, and keeps the menu
                out of the HUD, which was covering the room to say very little. */}
            <TodaysMenu
              menu={foodMenu.menu}
              progress={foodMenu.progress}
              complete={foodMenu.complete}
              reward={foodMenu.reward}
            />

            {/* Little heart by Eren's side — quick "Send Eren" to your
                partner. Only shown when paired. */}
            {partner && (
              <button
                onClick={() => { playSound('ui_modal_open'); setShowSendEren(true) }}
                aria-label={`Send ${cat.name} to ${partner.name}`}
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
            {/* Global on purpose: the pulse is named from the inline style
                above, and a scoped styled-jsx keyframe never resolves there. */}
            <style jsx global>{`
              @keyframes sendErenPulse {
                0%, 100% { transform: scale(1);    box-shadow: 0 0 12px rgba(255,107,157,0.4), 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1); }
                50%      { transform: scale(1.08); box-shadow: 0 0 18px rgba(255,107,157,0.65), 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1); }
              }
            `}</style>

          </>
        )}

        {/* ══ HUD (below the shared stats header) ══ quests, then the room's
            own shortcuts; Us, Me and Rooms are tabs of the bottom nav now. */}
        <HomeHud
          quests={<TaskPanel compact />}
          footer={<CoopGoalBar />}
          wish={wish?.wish && wish.status !== 'loading'
            ? { text: wish.text, granted: wish.status === 'granted', weekCount: wish.weekGrantedCount }
            : null}
          fortuneAvailable={fortuneAvailable}
          trophyBalance={trophyBalance}
          newSkinCount={newSkinCount}
          onOpenFortune={() => { playSound('ui_modal_open'); setShowFortune(true) }}
          onOpenReminders={() => { playSound('ui_modal_open'); setShowReminders(true) }}
        />

        {/* Where you are among the swipe rooms. Only while swiping or a room
            is opening; sits just above the dock. */}
        <RoomDots visible={dotsVisible} bottom={DOCK_CLEARANCE} onOpen={id => { playSound('ui_tap'); openScene(id) }} />

        {/* switchTop pushed below the home HUD row so it doesn't sit on top of
            the quest panel. */}
        <LightSwitch switchTop="30%" targetBottom="10%" targetLeft="50%" persistKey="home" />

        {/* ══ BOTTOM DOCK ══ gacha · cake · shawarma · jelly, on the floor of
            the room, just above the nav. */}
        <HomeDock />
      </HomeRoomFrame>
    </>
  )
}
