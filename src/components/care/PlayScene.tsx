'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats, getCachedIsSleeping } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { cn } from '@/lib/utils'
import { playSound } from '@/lib/sounds'
import Leaderboard from '@/components/Leaderboard'
import BlinkingEren from '@/components/BlinkingEren'
import { useRoomEren } from '@/hooks/useRoomEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import StinkyFlies from '@/components/StinkyFlies'
import LightSwitch from '@/components/LightSwitch'
import { useIsDark } from '@/hooks/useIsDark'
import { useWish } from '@/contexts/WishContext'
import WishHintBanner from '@/components/wish/WishHintBanner'
import { wishHintRoom } from '@/lib/wishes'
import { useErenReaction } from '@/hooks/useErenReaction'
import { happyFinisherBeats, WORD_COLOR } from '@/lib/erenReactions'
import SoundWord from '@/components/SoundWord'
import { Hearts } from '@/components/care/ReactionFx'
import PetTarget, { PurrFx, PURR } from '@/components/care/PetTarget'
import DonePlayingButton from '@/components/playroom/DonePlayingButton'
import CareToast from '@/components/care/CareToast'
import RoomWeather from '@/components/weather/RoomWeather'
import { ROOM_HEADER_CLEARANCE } from '@/components/meadow/tokens'
import { M, MeadowIcon, Meter, Tag, TYPE } from '@/components/meadow'

const CAT_BOTTOM = 'calc(176px + env(safe-area-inset-bottom, 0px))'

interface Props { onClose: () => void }
interface BallPos { x: number; y: number }

// ErenBell.png pose: jingle-bell collar, blue irises, MIRRORED catchlights.
// Pixel-scan of the 1029×1532 sprite translated to the 200×200 BlinkingEren
// container (portrait, so height-fit → sprite scale 0.13055, sprite x offset
// ~32.8px on each side).
//   eye A (cat's RIGHT eye, viewer LEFT)  — catchlight in upper-RIGHT of iris
//   eye B (cat's LEFT  eye, viewer RIGHT) — catchlight in upper-LEFT  of iris
// catContentMidpointX = 58.9% (NOT 50%) — the bbox is pulled right by the bell
// ribbon hanging at the cat's chin, which is already accounted for in the
// per-eye image-% coords.
const BELL_EYES = {
  lidTop:     '32.93%',
  lidWidth:   '5.51%',
  lidLeftA:   '41.74%',
  lidLeftB:   '56.00%',
  maskTop:    '32.93%',
  maskLeftA:  '41.74%',
  maskLeftB:  '56.00%',
  maskW:      '5.51%',
  maskH:      '4.50%',
  glintLeftA: '60.24%',
  glintTopA:  '0%',
  glintLeftB: '19.52%',
  glintTopB:  '0%',
  glintW:     '20%',
}

// Play room idle look (ErenBell) — default when no Closet skin is set.
const PLAY_EREN_FALLBACK = {
  src: '/ErenBell_notail.png', tailSrc: '/ErenBell_tail.png', tailOrigin: '73.3% 76.7%', eyes: BELL_EYES,
}

/** A white control over the room art, the same as the garden's status pill. */
const ROOM_PILL: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, boxSizing: 'border-box',
  padding: '0 14px 0 10px', borderRadius: 999, border: 'none', background: '#FFFFFF',
  boxShadow: `0 3px 0 ${M.overArtLip}`, fontSize: 14, fontWeight: 800, color: M.text, cursor: 'pointer',
}

export default function PlayScene({ onClose }: Props) {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { stats, applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const wish = useWish()
  const wishMatchesThisRoom = wish?.wish ? wishHintRoom(wish.wish) === 'play' : false

  const [ballPos,      setBallPos]      = useState<BallPos>({ x: 50, y: 84 })
  const [throwCount,   setThrowCount]   = useState(0)
  const [done,         setDone]         = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState<string | null>(null)
  const [toastGood,    setToastGood]    = useState(true)
  const [lookDir,      setLookDir]      = useState<'left'|'right'>('right')
  const [ballMoving,   setBallMoving]   = useState(false)
  const [trailDots,    setTrailDots]    = useState<{id:number;x:number;y:number}[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  // The leaderboard fills the screen from inside the scene, under the
  // room-sized top bar (z-60), whose needs pill would sit on its week/all-time
  // toggle; the bar steps aside while it's open, as it does for the Attic's
  // transcript.
  const { setHideStats } = useCare()
  useEffect(() => {
    if (!showLeaderboard) return
    setHideStats(true)
    return () => setHideStats(false)
  }, [showLeaderboard, setHideStats])
  const isDark = useIsDark()
  const sceneRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const animRef  = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const trailId  = useRef(0)
  const saveLock = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const floorY = useCallback(() => {
    const room = sceneRef.current?.getBoundingClientRect()
    const footer = footerRef.current?.getBoundingClientRect()
    return room && room.height > 0 && footer ? Math.max(20, Math.min(88, (footer.top - room.top - 16) / room.height * 100)) : 88
  }, [])
  useEffect(() => {
    const fit = () => { const floor = floorY(); setBallPos(current => current.y > floor ? { ...current, y: floor } : current) }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [floorY])

  // Reaction runner — Eren pounces when the ball settles near him. The rAF
  // step reads the runner via a ref so the []-dep animateBall callback always
  // sees the latest play(), without re-creating the loop.
  const reaction = useErenReaction()
  const reactionRef = useRef(reaction); reactionRef.current = reaction
  const lastPounceRef = useRef(0)

  const animateBall = useCallback((sx: number, sy: number, vx: number, vy: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    let x = sx, y = sy, dvx = vx, dvy = vy
    const floor = floorY()
    const step = () => {
      x += dvx; dvy += 0.45; y += dvy
      if (x <= 3 || x >= 97) { dvx *= -0.75; x = x <= 3 ? 3 : 97 }
      if (y >= floor)         { dvy = Math.abs(dvy) < 1.5 ? 0 : -Math.abs(dvy) * 0.65; y = floor; dvx *= 0.88 }
      if (y <= 20)            { dvy = Math.abs(dvy) * 0.8; y = 20 }
      setBallPos({ x, y })
      setTrailDots(ts => [...ts.slice(-8), { id: trailId.current++, x, y }])
      if (y < floor - 0.01 || Math.sqrt(dvx * dvx + dvy * dvy) > 0.35) {
        animRef.current = requestAnimationFrame(step)
      } else {
        animRef.current = null
        setBallMoving(false)
        setTrailDots([])
        // Ball came to rest near Eren's paws → he pounces on it.
        const now = Date.now()
        if (Math.abs(x - 50) < 16 && y >= floor - 6 && now - lastPounceRef.current > 1500) {
          lastPounceRef.current = now
          playSound('care_jingle')
          reactionRef.current.play([{ name: 'pounce', ms: 520 }])
        }
      }
    }
    animRef.current = requestAnimationFrame(step)
  }, [floorY])

  // Stop the ball's rAF loop if the scene unmounts mid-flight (room swipe).
  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (toastTimer.current !== null) clearTimeout(toastTimer.current)
  }, [])

  // Cache fallback so Eren renders synchronously with the right state.
  const isSleeping = stats?.is_sleeping ?? getCachedIsSleeping() ?? true

  // Memoize the bare sprite so the 60fps ball-physics renders don't reconcile
  // the sprite stack every frame (same pattern as FeedScene). Cleanliness is
  // the only changing input — it drives StinkyFlies.
  const cleanliness = stats?.cleanliness ?? 100
  const playEren = useRoomEren('play', PLAY_EREN_FALLBACK)
  const erenSprite = useMemo(() => (
    <>
      <BlinkingEren size={200} {...playEren} />
      <StinkyFlies cleanliness={cleanliness} />
    </>
  ), [cleanliness, playEren])

  function handleThrow(e: React.MouseEvent<HTMLDivElement>) {
    if (done || isSleeping) return
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = ((e.clientX - rect.left) / rect.width)  * 100
    const cy = ((e.clientY - rect.top)  / rect.height) * 100
    const dx = cx - ballPos.x, dy = cy - ballPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.001) return
    const speed = Math.min(dist * 0.28, 9)
    setBallMoving(true)
    setLookDir(cx > 50 ? 'right' : 'left')
    animateBall(ballPos.x, ballPos.y, (dx / dist) * speed, (dy / dist) * speed)
    setThrowCount(c => c + 1)
  }

  async function handleDone() {
    if (!user?.id || saveLock.current || done || throwCount < 1 || isSleeping) return
    saveLock.current = true
    setSaving(true)
    try {
      const result = await applyAction(user.id, 'play')
      setToastGood(result.success)
      setToast(result.message)
      if (result.success) {
        setDone(true)
        completeTask('daily_play')
        reaction.play(happyFinisherBeats())
      }
    } catch {
      setToastGood(false)
      setToast('Could not save this play session. Please try again.')
    } finally {
      setSaving(false)
      saveLock.current = false
      if (toastTimer.current !== null) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 2500)
    }
  }

  const mood = done ? 'happy' : throwCount >= 3 ? 'playful' : 'idle'
  const energy = stats?.energy ?? 100
  const energyColor = energy > 50 ? M.leaf : energy > 25 ? M.energy : M.danger

  return (
    <div ref={sceneRef}
      className="fixed inset-0 z-40 overflow-hidden select-none"
      onClick={handleThrow}>

      {wish?.wish && (
        <WishHintBanner text={wish.text} status={wish.status} matchesThisRoom={wishMatchesThisRoom} />
      )}

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{ backgroundImage: `url(${isDark ? '/play.png' : '/playroom.png'})`, backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

      {/* Whatever sky the household hung outside this window. Layer 1: over
          the room art, under every prop, character and sheet in here. It has
          to live INSIDE the scene — the scene root is its own stacking
          context, so a sibling of it can only be over the whole room or under
          it, and "over" put the window on top of the fridge shop. */}
      <RoomWeather room="play" dark={isDark} />

      {/* ══ EREN ══ (hidden while sleeping in the bedroom).
          He tracks the ball by LEANING toward it, and the pounce hop jumps
          toward the side it went (--tx). He used to be mirrored to face it
          with a 500ms scaleX, which squashed him to a sliver halfway through
          every turn and showed him up as a flat picture. Idle pauses while a
          reaction plays. */}
      {!isSleeping && (
        <div className={cn('absolute z-10')}
          style={{ bottom: CAT_BOTTOM, left: '50%', transform: 'translateX(-50%)' }}>
          {/* Watch-the-ball lean — the whole cat tips toward the ball's side so
              he visibly tracks it as it flies. Derived from ballPos, which the
              rAF loop already re-renders every frame during flight, so it costs
              no extra render; a CSS transition eases it, low-passing the
              bouncing ball into a lazy gaze instead of a twitch. Seam-free: he
              pivots at his feet like the idle breathe — no head split, no neck
              seam. Held upright during the pounce/finish beats so the hop and
              the happy hop aren't tilted. */}
          <div style={{
            transformOrigin: 'bottom center',
            transition: 'transform 220ms ease-out',
            transform: `rotate(${
              reaction.phase === 'pounce' || reaction.phase === 'finish'
                ? 0 : Math.max(-5, Math.min(5, (ballPos.x - 50) * 0.12))
            }deg)`,
          }}>
            <div style={{
              animation: reaction.phase === 'pounce' ? 'erenPounce 520ms cubic-bezier(0.3,0.7,0.4,1)'
                : reaction.phase === 'finish' ? 'erenIdleHop 800ms ease-in-out'
                : undefined,
              transformOrigin: 'bottom center',
              ['--tx' as string]: lookDir === 'left' ? '-10px' : '10px',
            } as React.CSSProperties}>
              {/* Tapping him pets instead of throwing the ball at him —
                  PetTarget swallows the tap before the scene's onClick. */}
              <PetTarget reaction={reaction}>
                <ErenIdleLayer disabled={reaction.active}>
                  {erenSprite}
                </ErenIdleLayer>
              </PetTarget>
            </div>
          </div>
        </div>
      )}

      {/* Reaction words/hearts — a SEPARATE overlay at Eren's spot, so they
          don't lean or hop with him. */}
      {!isSleeping && (reaction.phase === 'pounce' || reaction.phase === 'finish' || reaction.phase === PURR) && (
        <div className="absolute z-20 pointer-events-none" style={{
          bottom: CAT_BOTTOM, left: '50%', transform: 'translateX(-50%)', width: 200, height: 200,
        }}>
          {reaction.phase === 'pounce' &&
            <SoundWord word="JINGLE!" color={WORD_COLOR.curious} left={50} top={4} />}
          {reaction.phase === 'finish' && <>
            <Hearts count={2} bottom="60%" />
            <SoundWord word="FUN!" color={WORD_COLOR.happy} left={50} top={6} />
          </>}
          {reaction.phase === PURR && <PurrFx bottom="60%" />}
        </div>
      )}

      {/* ══ BALL TRAIL ══ */}
      {!isSleeping && trailDots.map((dot, i) => (
        <div key={dot.id} className="absolute pointer-events-none rounded-full"
          style={{ left: `${dot.x}%`, top: `${dot.y}%`, width: 10, height: 10, transform: 'translate(-50%,-50%)', background: '#FF6B9D', opacity: (i + 1) / trailDots.length * 0.45 }} />
      ))}

      {/* ══ BALL ══ */}
      {!isSleeping && (
        <div className="absolute pointer-events-none z-20"
          style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%`, transform: 'translate(-50%,-50%)', width: 22, height: 22, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #FF9EC8, #FF3E80)', border: '2px solid #CC1A55', boxShadow: '2px 2px 0 rgba(0,0,0,0.25), inset 1px 1px 3px rgba(255,255,255,0.5)' }} />
      )}

      {/* ══ UI ══ */}
      {/* Scores and Arcade — white pills over the room, like the other
          rooms' controls. Top is calculated from the room-sized StatsHeader's
          bottom (ROOM_HEADER_CLEARANCE + safe-top) so they aren't buried
          behind it; the second sits 40px under the first. */}
      <button type="button" onClick={e => { e.stopPropagation(); playSound('ui_tap'); setShowLeaderboard(true) }}
        className="meadow-root absolute right-4 z-50 m-press m-focus"
        style={{ ...ROOM_PILL, top: `calc(var(--safe-top) + ${ROOM_HEADER_CLEARANCE + 8}px)` }}>
        <MeadowIcon name="trophy" size={18} />
        Scores
      </button>
      <button type="button" onClick={e => { e.stopPropagation(); playSound('ui_tap'); router.push('/games'); setTimeout(onClose, 400) }}
        className="meadow-root absolute right-4 z-50 m-press m-focus"
        style={{ ...ROOM_PILL, top: `calc(var(--safe-top) + ${ROOM_HEADER_CLEARANCE + 48}px)` }}>
        <MeadowIcon name="pad" size={18} />
        Arcade
      </button>

      {toast && <CareToast msg={toast} ok={toastGood} top={`calc(var(--safe-top) + ${ROOM_HEADER_CLEARANCE + 112}px)`} />}

      {throwCount === 0 && !done && (
        <div className="meadow-root absolute left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          style={{ ...ROOM_PILL, top: `calc(var(--safe-top) + ${ROOM_HEADER_CLEARANCE + 112}px)`, cursor: 'default' }}>
          <MeadowIcon name={isSleeping ? 'moon' : 'pad'} size={18} />
          {isSleeping ? 'Sleeping' : 'Playtime'}
        </div>
      )}

      {/* ══ BOTTOM UI ══ */}
      <div ref={footerRef} className="meadow-root absolute inset-x-0 flex flex-col items-center gap-2 px-6 z-20" style={{ bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }} onClick={e => e.stopPropagation()}>
        {/* Energy gauge */}
        <div className="w-full max-w-xs" style={{ background: '#FFFFFF', borderRadius: 16, boxShadow: `0 3px 0 ${M.overArtLip}`, padding: '10px 12px' }}>
          <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 6, fontSize: 13, fontWeight: 700, color: M.text2 }}>
            <span className="flex items-center" style={{ gap: 6 }}><MeadowIcon name="bolt" size={16} color={energyColor} />Energy</span>
            <span style={{ ...TYPE.number, color: M.text }}>{Math.round(energy)}%</span>
          </div>
          <Meter value={energy / 100} label="Playroom energy" color={energyColor} height={8} />
        </div>

        <div className="flex items-center gap-3">
          <Tag tone="soft" size="sm" style={{ background: '#FFFFFF' }}>{throwCount} {throwCount === 1 ? 'throw' : 'throws'}</Tag>
          {throwCount >= 1 && !done && (
            <Tag tone="leaf" size="sm" icon={<MeadowIcon name="check" size={14} />}>Ready</Tag>
          )}
        </div>

        <DonePlayingButton
          state={done ? 'done' : saving ? 'saving' : throwCount < 1 ? 'locked' : 'ready'}
          disabled={throwCount < 1 || done || saving || isSleeping}
          onClick={() => { playSound('ui_tap'); handleDone() }}
        />
      </div>

      {/* Leaderboard modal — opened via the HIGH SCORES button. Wrapped in
          a stop-propagation div so taps inside don't fire ball-throws. */}
      {showLeaderboard && (
        <div onClick={e => e.stopPropagation()}>
          <Leaderboard onClose={() => setShowLeaderboard(false)} />
        </div>
      )}

      {/* Switch on the left to clear the SCORES/leaderboard buttons stacked
          on the right side of the playroom. */}
      <LightSwitch side="left" targetBottom={CAT_BOTTOM} targetLeft="50%" persistKey="playroom" />
    </div>
  )
}
