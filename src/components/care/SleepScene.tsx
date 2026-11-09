'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats, getCachedIsSleeping } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'
import { playSound } from '@/lib/sounds'
import BlinkingEren from '@/components/BlinkingEren'
import { useRoomEren } from '@/hooks/useRoomEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import StinkyFlies from '@/components/StinkyFlies'
import LightSwitch from '@/components/LightSwitch'
import { useWish } from '@/contexts/WishContext'
import WishHintBanner from '@/components/wish/WishHintBanner'
import { wishHintRoom } from '@/lib/wishes'
import { useErenReaction } from '@/hooks/useErenReaction'
import { WORD_COLOR } from '@/lib/erenReactions'
import SoundWord from '@/components/SoundWord'
import PoseSprite from '@/components/care/PoseSprite'
import PetTarget, { PurrFx, PURR } from '@/components/care/PetTarget'
import PixelPoof from '@/components/PixelPoof'
import { preloadImages } from '@/lib/preloadImages'
import SleepButton from '@/components/bedroom/SleepButton'
import CareToast from '@/components/care/CareToast'
import RoomWeather from '@/components/weather/RoomWeather'
import { M, MeadowIcon, Meter, TYPE } from '@/components/meadow'
import type { SleepAction } from '@/lib/sleepSessionSaves'

interface Props { onClose: () => void }

// Bedroom awake idle look (erenSleep nightcap) — default when no Closet skin
// is set. The tucked-in curled pose is a separate PoseSprite and unaffected.
const SLEEP_EREN_FALLBACK = {
  src: '/erenSleep_notail.png', tailSrc: '/erenSleep_tail.png', tailOrigin: '69.4% 73.6%',
  eyes: {
    lidTop: '36%', lidLeftA: '41%', lidLeftB: '51%',
    maskTop: '36.3%', maskLeftA: '40.3%', maskLeftB: '52.8%', glintW: '28%',
  },
}

export default function SleepScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, finishSleepSession, sleepSaveBusy, sleepSavePending, sleepSaveError } = useErenStats(profile?.household_id ?? null)
  const sleepEren = useRoomEren('sleep', SLEEP_EREN_FALLBACK)
  const { completeTask } = useTasks()
  const wish = useWish()
  const wishMatchesThisRoom = wish?.wish ? wishHintRoom(wish.wish) === 'sleep' : false

  const [tucking, setTucking] = useState(false)
  // Separate from `tucking` on purpose. `tucking` tracks the WRITE (it gates
  // the button so a tuck-in and a wake-up can never be in flight together).
  // `holdPose` tracks the CHOREOGRAPHY, and only that. Splitting them is what
  // lets the write start at tap time while the sway→settle still plays out in
  // full — see handleTuckIn.
  const [holdPose, setHoldPose] = useState(false)
  const [waking,  setWaking]  = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [toast,   setToast]   = useState<string | null>(null)
  const [toastGood, setToastGood] = useState(true)
  const [sleepIdx, setSleepIdx] = useState(0)   // which curled pose (0–3)
  const [showPoof, setShowPoof] = useState(false)
  const reaction = useErenReaction()
  const actionLock = useRef<symbol | null>(null)
  const mounted = useRef(true)
  const saveEpoch = useRef(0)
  const saveScope = useRef({ userId: user?.id, householdId: profile?.household_id })
  if (saveScope.current.userId !== user?.id || saveScope.current.householdId !== profile?.household_id) saveScope.current = { userId: user?.id, householdId: profile?.household_id }
  const currentSaveScope = saveScope.current
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const releasePose = useRef<(() => void) | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mounted.current = true; actionLock.current = null
    setTucking(false); setWaking(false); setRecovering(false); setHoldPose(false); setToast(null)
    return () => {
      mounted.current = false; saveEpoch.current++
      if (poseTimer.current !== null) clearTimeout(poseTimer.current)
      releasePose.current?.()
      releasePose.current = null
      if (toastTimer.current !== null) clearTimeout(toastTimer.current)
    }
  }, [user?.id, profile?.household_id])

  function showResult(result: { success: boolean; message: string }) {
    const generation = saveEpoch.current
    const active = () => mounted.current && saveEpoch.current === generation && saveScope.current === currentSaveScope
    if (!active()) return
    setToastGood(result.success)
    setToast(result.message)
    if (toastTimer.current !== null) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => { if (active()) setToast(null) }, 3000)
  }

  // Fall back to the module-level cache so the button reads WAKE UP
  // immediately on swipe-in; otherwise it flashes TUCK IN for ~200 ms
  // while useErenStats refetches.
  const tuckedIn  = stats?.is_sleeping ?? getCachedIsSleeping() ?? false
  const sleepVal  = stats?.sleep_quality ?? 100
  const sleepColor = sleepVal > 50 ? M.leaf : sleepVal > 25 ? M.energy : M.danger
  const busy      = tucking || waking || recovering || sleepSaveBusy
  // Confirmed sleep state waits for the existing tuck choreography to finish.
  const showAsleep = (tuckedIn || waking) && !holdPose

  // Roll a curled-pose pick on mount (covers a reload / remote-partner tuck-in
  // where handleTuckIn never ran) and warm the four stickers so the poof
  // reveals a decoded bitmap, not a blank frame.
  useEffect(() => {
    setSleepIdx(Math.floor(Math.random() * 4))
    preloadImages(['/erenSleep1.png?v=2', '/erenSleep2.png?v=2', '/erenSleep3.png?v=2', '/erenSleep4.png?v=2'])
  }, [])
  // Poof-mask the asleep<->awake pose swap, but only on a real transition — not
  // on mount or a room-swipe (prevTucked starts equal to the first value).
  const prevTucked = useRef(showAsleep)
  useEffect(() => {
    if (prevTucked.current !== showAsleep) {
      prevTucked.current = showAsleep
      setShowPoof(true)
    }
  }, [showAsleep])

  async function handleSleepAction(action: SleepAction, recover = false) {
    const generation = saveEpoch.current, token = Symbol('bedroom-save')
    const active = () => mounted.current && saveEpoch.current === generation && saveScope.current === currentSaveScope
    if (!user?.id || !stats || stats.household_id !== profile?.household_id || actionLock.current || sleepSaveBusy || !active()) return
    if (!recover && (sleepSavePending || (action === 'tuck' ? tuckedIn : !tuckedIn))) return
    actionLock.current = token
    if (recover) setRecovering(true)
    else if (action === 'tuck') setTucking(true)
    else setWaking(true)
    const animateTuck = !recover && action === 'tuck'
    let poseFinished = Promise.resolve()
    if (animateTuck) {
      setHoldPose(true); setSleepIdx(Math.floor(Math.random() * 4))
      reaction.play([{ name: 'sway', ms: 500, onEnter: () => playSound('care_sleep') }, { name: 'settle', ms: 700 }])
      poseFinished = new Promise<void>(resolve => {
        releasePose.current = resolve
        poseTimer.current = setTimeout(() => { poseTimer.current = null; releasePose.current = null; resolve() }, 1150)
      })
    }
    // Networking starts under the choreography; recovery never waits for it again.
    const write = finishSleepSession(action, recover).catch(() => ({ success: false, changed: false, action, isSleeping: undefined, message: 'Could not confirm this bedroom save. Please try again.' }))
    try {
      await poseFinished
      if (active()) setHoldPose(false)
      const result = await write
      if (result.success && result.changed && result.action === 'tuck') void completeTask('daily_sleep')
      if (!active()) return
      if (!recover && action === 'wake' && result.success && result.changed && result.isSleeping === false) reaction.play([{ name: 'wake', ms: 1800, onEnter: () => playSound('care_sleep') }])
      showResult(result)
    } finally {
      if (actionLock.current === token) actionLock.current = null
      if (active()) { setTucking(false); setWaking(false); setRecovering(false); setHoldPose(false) }
    }
  }

  async function handleTuckIn() { await handleSleepAction('tuck') }
  async function handleWakeUp() {
    await handleSleepAction('wake')
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {wish?.wish && (
        <WishHintBanner text={wish.text} status={wish.status} matchesThisRoom={wishMatchesThisRoom} />
      )}

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{ backgroundImage: 'url(/bedroom.png)', backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

      {/* Whatever sky the household hung outside this window. Layer 1: over
          the room art, under every prop, character and sheet in here. It has
          to live INSIDE the scene — the scene root is its own stacking
          context, so a sibling of it can only be over the whole room or under
          it, and "over" put the window on top of the fridge shop. */}
      <RoomWeather room="sleep" dark={true} />

      {/* ══ STAR GLOWS ══ */}
      {[
        { x: '54%', y: '22%', d: '2.0s' },
        { x: '43%', y: '35%', d: '0s'   },
        { x: '38%', y: '36%', d: '1.1s' },
        { x: 'calc(67% - 2px)', y: '41%', d: '0.7s' },
        { x: '58%', y: '38%', d: '1.2s' },
        { x: '39%', y: '41%', d: '0.6s' },
        { x: '44%', y: '31%', d: '1.8s' },
        { x: '57%', y: '34%', d: '0.3s' },
        { x: '45%', y: '43%', d: '1.5s' },
        { x: '55%', y: '40%', d: '0.9s' },
      ].map((s, i) => (
        <div key={i} className="absolute pointer-events-none z-[1]" style={{
          left: s.x, top: s.y,
          width: 0, height: 0,
          boxShadow: '0 0 2px 1.5px rgba(210,230,255,1), 0 0 5px 2.5px rgba(190,215,255,0.8)',
          animation: `starTwinkle 3s ease-in-out ${s.d} infinite`,
        }} />
      ))}

      {/* ══ MOON GLOW ══ */}
      <div className="absolute pointer-events-none z-[1]" style={{
        left: '60%', top: '33%',
        width: 0, height: 0,
        boxShadow: '0 0 14px 8px rgba(255,250,200,0.9), 0 0 28px 14px rgba(255,240,160,0.55), 0 0 50px 22px rgba(240,225,130,0.28)',
        animation: 'moonGlow 5s ease-in-out infinite',
      }} />

      <style jsx>{`
        @keyframes moonGlow {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1;  }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 1;   }
          50%       { opacity: 0.1; }
        }
      `}</style>

      {/* ══ EREN ══ */}
      {/* Awake (14%) and asleep (17%) sit at different anchors because the two
          poses have different contact lines. SNAP between them (no transition):
          the swap is hidden by the 450ms poof, so he must already be at his
          resting spot when the cloud clears — a 700ms slide would creep up
          AFTER the poof and read as him drifting into place. */}
      <div className={cn('absolute z-10', showAsleep ? 'bottom-[17%]' : 'bottom-[14%]')}
        style={{ left: '50%', transform: 'translateX(-50%)' }}>
        {showAsleep ? (
          // Asleep: a curled-up pose sticker (eyes painted shut, no overlays).
          // The pick is re-rolled on each tuck-in; the swap is hidden by the
          // poof. Breath slowed so the sleeping body rises and falls gently.
          <PoseSprite src={`/erenSleep${sleepIdx + 1}.png?v=2`} width={125} breatheDur={6.5} />
        ) : (
          // Pettable only while he's up — the tucked-in pose above is asleep,
          // and a purr there would undo the whole point of the bedroom.
          <PetTarget reaction={reaction}>
            <ErenIdleLayer disabled={reaction.active}>
              {/* Awake in the bedroom: the nightcap pose. Sleepy sway → settle
                  squash as he's tucked in, waking stretch on wake. The bedroom
                  cap pushes the face down, so the blink/glint overlays are
                  re-aimed lower and closer together; lids shut during the settle. */}
              <div style={{
                animation: reaction.phase === 'sway'   ? 'erenSleepySway 500ms ease-in-out 2'
                  : reaction.phase === 'settle' ? 'erenSettle 700ms ease-out both'
                  : reaction.phase === 'wake'   ? 'erenIdleStretch 1800ms ease-in-out'
                  : undefined,
                transformOrigin: 'bottom center',
              }}>
                <BlinkingEren size={230} {...sleepEren}
                  lidsClosed={tucking || reaction.phase === 'settle'}
                  sleepyLids
                  breatheDur={4} />
              </div>
            </ErenIdleLayer>
          </PetTarget>
        )}
        <StinkyFlies cleanliness={stats?.cleanliness ?? 100} />

        {/* Poof that masks the asleep<->awake sticker swap (never on mount). */}
        {showPoof && <PixelPoof size={210} onDone={() => setShowPoof(false)} />}

        {/* Sleepy yawn / waking sound-words, anchored above his head. */}
        {reaction.phase === 'sway' && <SoundWord word="MRAAW" color={WORD_COLOR.sleep} left={50} top={4} />}
        {reaction.phase === 'wake' && <SoundWord word="MRRP!" color={WORD_COLOR.sleep} left={50} top={4} />}
        {/* Tap-to-pet purr. */}
        {reaction.phase === PURR && <PurrFx bottom="60%" />}
      </div>

      {/* ══ ZZZs ══ */}
      {showAsleep && (
        <div className="absolute pointer-events-none z-20" style={{ bottom: '40%', left: '58%' }}>
          {[{z:'z',s:10,d:0},{z:'z',s:14,d:0.5},{z:'Z',s:18,d:1.0}].map((zz, i) => (
            <span key={i} className="absolute font-bold select-none"
              style={{ fontSize: zz.s, left: i * 16, top: -i * 16, color: '#A5B4FC', opacity: 0.9, fontFamily: '"Press Start 2P"', animation: `float ${1.2 + i * 0.4}s ease-in-out ${zz.d}s infinite` }}>
              {zz.z}
            </span>
          ))}
        </div>
      )}

      {/* Dream cloud when deeply sleeping */}
      {showAsleep && (
        <div className="absolute pointer-events-none" style={{ bottom: '44%', left: '40%', animation: 'float 5s ease-in-out infinite' }}>
          <div style={{ width: 60, height: 28, borderRadius: 20, background: 'rgba(160,150,240,0.15)', border: '1px solid rgba(180,170,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {/* CSS fish */}
            <div style={{ position: 'relative', width: 12, height: 8, opacity: 0.65 }}>
              <div style={{ width: 9, height: 7, borderRadius: '50% 40% 40% 50%', background: '#6BAED6' }} />
              <div style={{ position: 'absolute', right: -3, top: 0, width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '5px solid #4A90BC' }} />
            </div>
            {/* CSS paw */}
            <div style={{ position: 'relative', width: 9, height: 9, opacity: 0.6 }}>
              <div style={{ width: 5, height: 4, borderRadius: '50%', background: '#C0A0E0', margin: '0 auto' }} />
              {[[-3,1],[3,1],[-1.5,4],[1.5,4]].map(([px,py], k) => (
                <div key={k} style={{ position: 'absolute', left: 4.5 + px, top: py, width: 2.5, height: 2, borderRadius: '50%', background: '#C0A0E0' }} />
              ))}
            </div>
            {/* CSS 4-star */}
            <div style={{ position: 'relative', width: 9, height: 9, opacity: 0.55 }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)', background: '#F5E060', borderRadius: 1 }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, transform: 'translateX(-50%)', background: '#F5E060', borderRadius: 1 }} />
            </div>
          </div>
        </div>
      )}

      {/* ══ UI ══ */}

      {!busy && (toast || sleepSavePending) && <CareToast msg={toast ?? sleepSaveError ?? 'Your last bedroom save needs confirmation.'} ok={toast ? toastGood : !sleepSaveError} />}

      {/* ══ BOTTOM UI ══ */}
      <div className="meadow-root absolute inset-x-0 flex flex-col items-center gap-3 px-6 z-20" style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        {/* Sleep quality gauge */}
        <div className="w-full max-w-xs" aria-busy={!stats} style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: `0 3px 0 ${M.overArtLip}`, padding: '10px 12px' }}>
          <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 6, fontSize: 13, fontWeight: 700, color: M.text2 }}>
            <span className="flex items-center" style={{ gap: 6 }}><MeadowIcon name="moon" size={16} color={sleepColor} />Sleep quality</span>
            <span style={{ ...TYPE.number, color: M.text }}>{stats ? `${Math.round(sleepVal)}%` : '...'}</span>
          </div>
          <Meter value={stats ? sleepVal / 100 : 0} label="Sleep quality" color={sleepColor} height={8} />
        </div>

        <SleepButton
          state={recovering || sleepSaveBusy && sleepSavePending ? 'recovering' : waking ? 'waking' : tucking || sleepSaveBusy ? 'tucking' : sleepSavePending ? 'recover' : showAsleep ? 'wake' : 'tuck'}
          disabled={busy || !stats || stats.household_id !== profile?.household_id}
          onClick={() => { playSound('ui_tap'); if (sleepSavePending) void handleSleepAction(sleepSavePending, true); else if (tuckedIn) void handleWakeUp(); else void handleTuckIn() }}
        />
      </div>

      <LightSwitch targetBottom="16%" targetLeft="50%" persistKey="bedroom" />
    </div>
  )
}
