'use client'

import { useEffect, useRef, useState } from 'react'
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
import { useIsDark } from '@/hooks/useIsDark'
import { useWish } from '@/contexts/WishContext'
import WishHintBanner from '@/components/wish/WishHintBanner'
import { wishHintRoom } from '@/lib/wishes'
import { IconStethoscope } from '@/components/PixelIcons'
import { useErenReaction } from '@/hooks/useErenReaction'
import { happyFinisherBeats, WORD_COLOR } from '@/lib/erenReactions'
import SoundWord from '@/components/SoundWord'
import { Sparkles, Hearts, Crumbs, Lolipop } from '@/components/care/ReactionFx'
import ChewingEren, { EAT_NOSE_X, EAT_WIDTH, pickEatPose, preloadEatPoses } from '@/components/care/ChewingEren'
import PixelPoof from '@/components/PixelPoof'
import PetTarget, { PurrFx, PURR } from '@/components/care/PetTarget'
import CheckupButton from '@/components/vet/CheckupButton'
import GiveMedicineButton, { MedicineResultBanner } from '@/components/vet/GiveMedicineButton'
import GiveLolipopButton, { LolipopBanner } from '@/components/vet/GiveLolipopButton'
import CareToast from '@/components/care/CareToast'

interface Props { onClose: () => void }

// One lolipop every 30 minutes. The treat lifts four bars at once and the
// button sits two taps from the room entrance, so ungated you could swipe in
// and out topping him up faster than anything decays. Stored as the timestamp
// of the last one rather than a "used" flag, so the wait survives a reload and
// the room can show how long is left.
//
// Per-device on purpose: it's a small, shared indulgence, so both of you
// getting one isn't a bug.
const LOLIPOP_AT_KEY = 'eren_lolipop_at'
const LOLIPOP_COOLDOWN_MS = 30 * 60 * 1000

/** When the next one is available, as an epoch ms. 0 = now. */
function lolipopReadyAt(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = Number(localStorage.getItem(LOLIPOP_AT_KEY))
    // A clock that moved backwards (timezone change, manual set) shouldn't
    // strand him behind a cooldown that never ends.
    if (!raw || raw > Date.now()) return 0
    return raw + LOLIPOP_COOLDOWN_MS
  } catch { return 0 }
}

function markLolipopNow(): void {
  try { localStorage.setItem(LOLIPOP_AT_KEY, String(Date.now())) } catch { /* private mode */ }
}

/** "29M" / "45S" — coarse while it's far off, precise once it's nearly there. */
function formatWait(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return s >= 60 ? `${Math.ceil(s / 60)}M` : `${s}S`
}

// How long "LOLIPOP GIVEN!" holds before the chip turns into the countdown.
// Measured from the stat write, which lands early — he's still licking for
// another ~3s after it — so this has to cover the animation plus a few seconds
// of the chip actually being on screen.
const CELEBRATE_MS = 7000

// The eating pose is bottom-anchored on its contact line, but BlinkingEren
// bottom-anchors a 200px BOX whose paws sit ROOM_FIT.vet.botGap (13.6%) above
// it. Lifting the crouch by that much lands him on the same floor he was
// standing on, instead of dropping 27px at the swap.
const EAT_LIFT = Math.round(200 * 0.136)

// ErenVet.png pose: vet doctor with stethoscope. MIRRORED catchlights.
// Pixel-scan of the 976×1535 sprite translated to the 200×200 BlinkingEren
// container (portrait, height-fit → sprite scale 0.13029, sprite x offset
// ~36.4px on each side).
//   eye A (cat's RIGHT eye, viewer LEFT)  — catchlight in upper-RIGHT of iris
//   eye B (cat's LEFT  eye, viewer RIGHT) — catchlight in upper-LEFT  of iris
// catContentMidpointX = 57.1% (NOT 50%) — bbox is pulled right by the
// stethoscope cord; already factored into the per-eye image-% coords.
const VET_EYES = {
  lidTop:     '31.11%',
  lidWidth:   '5.54%',
  lidLeftA:   '40.32%',
  lidLeftB:   '54.40%',
  maskTop:    '31.11%',
  maskLeftA:  '40.32%',
  maskLeftB:  '54.40%',
  maskW:      '5.54%',
  maskH:      '4.50%',
  glintLeftA: '58.82%',
  glintTopA:  '0%',
  glintLeftB: '19.41%',
  glintTopB:  '0%',
  glintW:     '20%',
  // The vet pose's painted eyes are bigger than the glint-tuned mask, so the
  // sleepy closed lids need extra coverage to fully hide them.
  sleepyLidW: 1.55,
  sleepyLidH: 1.5,
}

// Vet idle look (ErenVet) — default when no Closet skin is set.
const VET_EREN_FALLBACK = {
  src: '/ErenVet_notail.png', tailSrc: '/ErenVet_tail.png', tailOrigin: '71.6% 71.7%', eyes: VET_EYES,
}

export default function VetScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)
  const vetEren = useRoomEren('vet', VET_EREN_FALLBACK)
  const { completeTask } = useTasks()

  const [checkDone, setCheckDone] = useState(false)
  const [checking,  setChecking]  = useState(false)
  const [medGiven,  setMedGiven]  = useState(false)
  const [giving,    setGiving]    = useState(false)
  const [lolBusy,   setLolBusy]   = useState(false)
  // Drives the "LOLIPOP GIVEN!" chip for a beat before it hands over to the
  // countdown, so handing one over still gets a reaction.
  const [lolJustGiven, setLolJustGiven] = useState(false)
  const [readyAt,   setReadyAt]   = useState(lolipopReadyAt)
  const [now,       setNow]       = useState(() => Date.now())
  const [toast,     setToast]     = useState<string | null>(null)
  // Lolipop eating choreography: which head-down pose this treat uses, the
  // poof that masks the standing<->crouch sticker swap, and which of the two
  // flows is finishing (a lolipop lands on "YUM!", a dose on "ALL BETTER!").
  const [eatIdx,    setEatIdx]    = useState(0)
  const [showPoof,  setShowPoof]  = useState(false)
  const [treatFlow, setTreatFlow] = useState(false)

  // Warm the four eating stickers so the poof reveals a decoded bitmap.
  useEffect(() => { preloadEatPoses() }, [])

  const lolWait = Math.max(0, readyAt - now)
  const lolCounting = lolWait > 0

  // Tick only while something is actually counting down, so a healthy cat
  // sitting in the vet room isn't re-rendering once a second forever. Keyed on
  // the boolean, not the remaining ms — the latter changes every tick and would
  // tear down and rebuild the interval each second.
  useEffect(() => {
    if (!lolCounting) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [lolCounting])
  const reaction = useErenReaction()

  // He's head-down on the treat. Same two-beat shape as a meal in the kitchen,
  // so the crouch sticker, the chew bob and the poof all behave identically.
  const licking = reaction.phase === 'lick' || reaction.phase === 'lick2'
  // Everything from the tap to the last lick. `lolBusy` covers the frame
  // between the tap and the first beat, so the bottom UI never flickers back.
  const treating = lolBusy || reaction.phase === 'unwrap' || licking

  // Poof-mask the standing<->crouch sticker swap at each end of the treat.
  const prevLicking = useRef(false)
  useEffect(() => {
    if (prevLicking.current !== licking) { prevLicking.current = licking; setShowPoof(true) }
  }, [licking])

  const isDark = useIsDark()
  const wish = useWish()
  const wishMatchesThisRoom = wish?.wish ? wishHintRoom(wish.wish) === 'medicine' : false

  // Cache fallback so Eren renders synchronously with the right state.
  const isSleeping   = stats?.is_sleeping ?? getCachedIsSleeping() ?? true
  const isSick       = stats?.is_sick ?? false
  const cleanliness  = stats?.cleanliness ?? 100
  const sleepQuality = stats?.sleep_quality ?? 100
  const weight       = stats?.weight ?? 4
  const energy       = stats?.energy ?? 100

  // Health assessment
  const issues: string[] = []
  if (isSick) issues.push('Feeling sick')
  if (cleanliness < 30) issues.push('Needs a bath')
  if (sleepQuality < 30) issues.push('Sleep deprived')
  if (weight > 7) issues.push('Overweight')
  if (energy < 20) issues.push('Very tired')
  const healthy = issues.length === 0

  async function doCheckup() {
    if (checking || checkDone || isSleeping) return
    setChecking(true)
    await new Promise(r => setTimeout(r, 1200))
    setChecking(false)
    setCheckDone(true)
    // The visit itself grants "take me to the vet". A dose only follows when
    // the report says NEEDS CARE, so waiting for one left the wish stuck on
    // pending every day Eren was healthy.
    try { window.dispatchEvent(new Event('eren:vet-checkup')) } catch { /* SSR/no-window */ }
  }

  async function giveMedicine() {
    if (!user?.id || giving || medGiven || isSleeping) return
    setGiving(true)
    setTreatFlow(false)
    // Gulp + grimace → snap upright with green recovery sparks → happy hop.
    reaction.play([
      { name: 'grimace', ms: 600, onEnter: () => playSound('care_gulp') },
      { name: 'recover', ms: 600 },
      ...happyFinisherBeats(),
    ])
    await new Promise(r => setTimeout(r, 800))
    const result = await applyAction(user.id, 'medicine')
    setGiving(false)
    setMedGiven(true)
    setToast(result.message)
    if (result.success) completeTask('daily_wash')
    setTimeout(() => setToast(null), 3000)
  }

  // The reward for a clean bill of health: every bar but cleanliness goes up,
  // happiness twice as much. He actually EATS it — the kitchen's head-down
  // choreography, with a lolipop on the floor at his muzzle instead of a bowl,
  // and the lapping sample instead of the chewing one because it's a candy on
  // a stick. The bottom UI clears out for the duration: the crouch pose is low
  // enough that the report card lands across his face and the button covers
  // everything under it.
  async function giveLolipop() {
    if (!user?.id || lolBusy || lolWait > 0 || isSleeping) return
    setLolBusy(true)
    setTreatFlow(true)
    setEatIdx(pickEatPose())
    reaction.play([
      // Beat of nothing so the UI is already gone when the poof fires.
      { name: 'unwrap', ms: 150 },
      { name: 'lick',   ms: 1300, onEnter: () => playSound('care_drink') },
      // The second lap lands mid-treat rather than stacked on the first, and
      // uses the OTHER take so it isn't one clip played twice.
      { name: 'lick2',  ms: 1350, onEnter: () => playSound('care_drink2') },
      ...happyFinisherBeats(),
    ])
    await new Promise(r => setTimeout(r, 700))
    const result = await applyAction(user.id, 'lolipop')
    setLolBusy(false)
    if (!result.success) { setToast(result.message); setTimeout(() => setToast(null), 3000); return }
    // Only start the cooldown once the write actually landed — a 503 shouldn't
    // cost him half an hour.
    markLolipopNow()
    setNow(Date.now())
    setReadyAt(Date.now() + LOLIPOP_COOLDOWN_MS)
    setLolJustGiven(true)
    setTimeout(() => setLolJustGiven(false), CELEBRATE_MS)
    setToast(result.message)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden">

      {wish?.wish && (
        <WishHintBanner text={wish.text} status={wish.status} matchesThisRoom={wishMatchesThisRoom} />
      )}

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{ backgroundImage: `url(${isDark ? '/wetDark.png' : '/vetBACK.png'})`, backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

      {/* ══ EREN ══ (hidden while sleeping in the bedroom). Body wrapper:
          curious tilt during the checkup, grimace on medicine then a snap
          upright + happy hop. Idle pauses while examining / reacting. */}
      {!isSleeping && (
        <div className={cn('absolute z-10 transition-all duration-500', checkDone ? 'bottom-[6%]' : 'bottom-[4%]')}
          style={{ left: '50%', transform: 'translateX(-50%)' }}>
          {licking ? (
            // Head-down on the lolipop. Lifted onto the standing sprite's floor
            // line, and the swap at each end is hidden inside the poof.
            <div style={{ marginBottom: EAT_LIFT }}>
              <ChewingEren idx={eatIdx} />
            </div>
          ) : (
            <PetTarget reaction={reaction} disabled={checking}>
              <ErenIdleLayer disabled={checking || reaction.active}>
                <div style={{
                  animation: reaction.phase === 'grimace' ? 'erenGrimace 600ms ease-out both'
                    : reaction.phase === 'finish' ? 'erenIdleHop 800ms ease-in-out'
                    : checking ? 'erenHeadTilt 1200ms ease-in-out'
                    : undefined,
                  transformOrigin: 'bottom center',
                }}>
                  <BlinkingEren size={200} {...vetEren}
                    lidsClosed={reaction.phase === 'grimace'} sleepyLids />
                  <StinkyFlies cleanliness={stats?.cleanliness ?? 100} />
                </div>
              </ErenIdleLayer>
            </PetTarget>
          )}

          {/* The treat, lying on the floor at his muzzle — which is LEFT of the
              sprite centre in the crouch poses, hence EAT_NOSE_X. The -6px puts
              the candy itself (which sits right of the prop's centre, stick
              trailing left) on the nose; the offsets below the contact line
              sink it just far enough to read as in front of him. */}
          {licking && <>
            <Lolipop left={`${(EAT_NOSE_X[eatIdx] / 100) * EAT_WIDTH - 6}px`} bottom={`${EAT_LIFT - 15}px`} />
            <Crumbs color={WORD_COLOR.candy} left={`${EAT_NOSE_X[eatIdx]}%`} bottom={`${EAT_LIFT + 6}px`} />
            <SoundWord word="LICK LICK" color={WORD_COLOR.candy} left={EAT_NOSE_X[eatIdx] + 14} top={12} size={6} />
            <SoundWord word="LICK LICK" color={WORD_COLOR.candy} left={EAT_NOSE_X[eatIdx] + 12} top={6} size={6} delayMs={1400} />
          </>}

          {/* Reaction words / sparks, anchored to Eren's 200px box. */}
          {checking && <SoundWord word="?" color={WORD_COLOR.curious} left={62} top={2} size={10} />}
          {reaction.phase === 'grimace' && <SoundWord word="BLEH!" color={WORD_COLOR.medicine} left={50} top={4} />}
          {reaction.phase === 'recover' && <Sparkles tint="#86EFAC" />}
          {reaction.phase === 'finish' && <>
            <Hearts count={2} bottom="58%" />
            <SoundWord word={treatFlow ? 'YUM!' : 'ALL BETTER!'} color={WORD_COLOR.happy} left={50} top={4} size={6} />
          </>}
          {/* Tap-to-pet purr. */}
          {reaction.phase === PURR && <PurrFx />}

          {/* Poof that masks the standing<->crouch sticker swap. */}
          {showPoof && <PixelPoof size={200} onDone={() => setShowPoof(false)} />}
        </div>
      )}

      {/* ══ STETHOSCOPE ANIM when checking — pixel icon, no emoji ══ */}
      {checking && (
        <div className="absolute z-20 pointer-events-none" style={{ left: '55%', bottom: '35%', animation: 'pulse 0.6s ease-in-out infinite' }}>
          <IconStethoscope size={28} />
        </div>
      )}

      {/* ══ TOAST ══ */}
      {toast && <CareToast msg={toast} tone="#4ADE80" top={56} />}

      {/* ══ BOTTOM UI ══
          Cleared out entirely while he's eating the treat. The crouch pose is
          low and the report card sits higher than the button, so leaving
          either one up means watching him lick a lolipop from behind a slab. */}
      <div className={cn('absolute bottom-6 inset-x-0 flex-col items-center gap-3 px-6 z-20',
        treating ? 'hidden' : 'flex')}>

        {/* Health report card */}
        {checkDone && (
          <div className="w-full max-w-xs"
            style={{ background: '#1A2E1A', borderRadius: 4, border: '2px solid #2E5A2E', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', padding: '10px 12px' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-pixel text-green-300" style={{ fontSize: 7 }}>HEALTH REPORT</span>
              <span className="font-pixel" style={{ fontSize: 7, color: healthy ? '#4ADE80' : '#F87171' }}>
                {healthy ? 'HEALTHY' : 'NEEDS CARE'}
              </span>
            </div>
            {healthy ? (
              <p className="font-pixel text-green-400 text-center" style={{ fontSize: 6, lineHeight: 2 }}>
                EREN IS IN GREAT SHAPE!
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {issues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div style={{ width: 4, height: 4, borderRadius: 2, background: '#F87171' }} />
                    <span className="font-pixel text-red-300" style={{ fontSize: 6 }}>{issue.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Buttons. A clean bill of health used to end the visit with a chip
            and nothing to do; now it offers the lolipop instead. Curing him
            with medicine flips `healthy` true, so the treat follows the dose
            in the same visit. */}
        {!checkDone ? (
          <CheckupButton
            state={checking ? 'checking' : 'check'}
            disabled={checking || isSleeping}
            onClick={() => { playSound('ui_tap'); doCheckup() }}
          />
        ) : !healthy && !medGiven ? (
          <GiveMedicineButton
            state={giving ? 'giving' : 'give'}
            disabled={giving || isSleeping}
            onClick={() => { playSound('ui_tap'); giveMedicine() }}
          />
        ) : healthy && lolWait <= 0 ? (
          <GiveLolipopButton
            state={lolBusy ? 'giving' : 'give'}
            disabled={lolBusy || isSleeping}
            onClick={() => { playSound('ui_tap'); giveLolipop() }}
          />
        ) : healthy ? (
          // The chip celebrates for four seconds, then becomes the clock.
          <LolipopBanner waitLabel={lolJustGiven ? null : formatWait(lolWait)} />
        ) : (
          <MedicineResultBanner healthy={healthy} />
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1) rotate(-15deg); }
          50%       { transform: scale(1.15) rotate(5deg); }
        }
      `}</style>

      <LightSwitch targetBottom="6%" targetLeft="50%" persistKey="vet" />
    </div>
  )
}
