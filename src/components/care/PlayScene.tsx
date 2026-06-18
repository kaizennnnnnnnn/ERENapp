'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats, getCachedIsSleeping } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'
import { IconController, IconStar, IconCrown } from '@/components/PixelIcons'
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
import DonePlayingButton from '@/components/playroom/DonePlayingButton'
import SegmentMeter, { type MeterPalette } from '@/components/care/SegmentMeter'

// ENERGY gauge palettes — the lit colour tracks energy level (violet when
// healthy, gold mid, red when low). The recessed channel is a deep plum so the
// glowing segments pop against the bright playroom; rivets are the app gold.
const ENERGY_TRACK = { track: '#2A2440', trackEdge: '#473A6E', groove: '#19142C', frame: '#120D24', rivet: '#FCD34D' }
const ENERGY_GOOD: MeterPalette = { fillHi: '#CFBFFF', fillBase: '#A78BFA', fillLo: '#8567E0', fillEdge: '#7C5FE0', glow: 'rgba(167,139,250,0.6)', ...ENERGY_TRACK }
const ENERGY_MID:  MeterPalette = { fillHi: '#FFE7A0', fillBase: '#F5C842', fillLo: '#D99A18', fillEdge: '#D99A10', glow: 'rgba(245,200,66,0.6)', ...ENERGY_TRACK }
const ENERGY_LOW:  MeterPalette = { fillHi: '#FFB3B3', fillBase: '#F87171', fillLo: '#E04A4A', fillEdge: '#DC3535', glow: 'rgba(248,113,113,0.65)', ...ENERGY_TRACK }

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
  const [lookDir,      setLookDir]      = useState<'left'|'right'>('right')
  const [ballMoving,   setBallMoving]   = useState(false)
  const [trailDots,    setTrailDots]    = useState<{id:number;x:number;y:number}[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const isDark = useIsDark()
  const sceneRef = useRef<HTMLDivElement>(null)
  const animRef  = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const trailId  = useRef(0)

  // Reaction runner — Eren pounces when the ball settles near him. The rAF
  // step reads the runner via a ref so the []-dep animateBall callback always
  // sees the latest play(), without re-creating the loop.
  const reaction = useErenReaction()
  const reactionRef = useRef(reaction); reactionRef.current = reaction
  const lastPounceRef = useRef(0)

  const animateBall = useCallback((sx: number, sy: number, vx: number, vy: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    let x = sx, y = sy, dvx = vx, dvy = vy
    const step = () => {
      x += dvx; y += dvy; dvy += 0.45
      if (x <= 3 || x >= 97) { dvx *= -0.75; x = x <= 3 ? 3 : 97 }
      if (y >= 88)            { dvy *= -0.65; y = 88; dvx *= 0.88 }
      if (y <= 20)            { dvy *= -0.8;  y = 20 }
      setBallPos({ x, y })
      setTrailDots(ts => [...ts.slice(-8), { id: trailId.current++, x, y }])
      if (Math.sqrt(dvx * dvx + dvy * dvy) > 0.35) {
        animRef.current = requestAnimationFrame(step)
      } else {
        setBallMoving(false)
        setTrailDots([])
        // Ball came to rest near Eren's paws → he pounces on it.
        const now = Date.now()
        if (Math.abs(x - 50) < 16 && y >= 82 && now - lastPounceRef.current > 1500) {
          lastPounceRef.current = now
          playSound('care_jingle')
          reactionRef.current.play([{ name: 'pounce', ms: 520 }])
        }
      }
    }
    animRef.current = requestAnimationFrame(step)
  }, [])

  // Stop the ball's rAF loop if the scene unmounts mid-flight (room swipe).
  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current) }, [])

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
    const speed = Math.min(dist * 0.28, 9)
    setBallMoving(true)
    setLookDir(cx > 50 ? 'right' : 'left')
    animateBall(ballPos.x, ballPos.y, (dx / dist) * speed, (dy / dist) * speed)
    setThrowCount(c => c + 1)
  }

  async function handleDone() {
    if (!user?.id || saving || throwCount < 1 || isSleeping) return
    setSaving(true)
    const result = await applyAction(user.id, 'play')
    setSaving(false)
    setDone(true)
    setToast(result.message)
    if (result.success) {
      completeTask('daily_play')
      reaction.play(happyFinisherBeats())
    }
    setTimeout(() => setToast(null), 2500)
  }

  const mood = done ? 'happy' : throwCount >= 3 ? 'playful' : 'idle'
  const energy = stats?.energy ?? 100
  const energyPalette = energy > 50 ? ENERGY_GOOD : energy > 25 ? ENERGY_MID : ENERGY_LOW

  return (
    <div ref={sceneRef}
      className="fixed inset-0 z-40 overflow-hidden select-none"
      onClick={handleThrow}>

      {wish?.wish && (
        <WishHintBanner text={wish.text} status={wish.status} matchesThisRoom={wishMatchesThisRoom} />
      )}

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{ backgroundImage: `url(${isDark ? '/play.png' : '/playroom.png'})`, backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

            {/* ══ EREN ══ (hidden while sleeping in the bedroom).
          The flip container faces him toward the ball; the pounce hop rides
          an inner wrapper so its forward --tx is mirrored toward the ball by
          the same flip. Idle pauses while a reaction plays. */}
      {!isSleeping && (
        <div className={cn('absolute z-10')}
          style={{ bottom: '10%', left: '50%', transform: 'translateX(-50%)' }}>
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
            {/* Flip faces him toward the ball. Kept on its own layer INSIDE the
                lean so the lean stays in screen space (no sign flip needed) and
                the 500ms transition still gives the smooth turn-around. */}
            <div style={{
              transform: `scaleX(${lookDir === 'left' ? -1 : 1})`,
              transition: 'transform 500ms',
            }}>
              <div style={{
                animation: reaction.phase === 'pounce' ? 'erenPounce 520ms cubic-bezier(0.3,0.7,0.4,1)'
                  : reaction.phase === 'finish' ? 'erenIdleHop 800ms ease-in-out'
                  : undefined,
                transformOrigin: 'bottom center',
                ['--tx' as string]: '10px',
              } as React.CSSProperties}>
                <ErenIdleLayer disabled={reaction.active}>
                  {erenSprite}
                </ErenIdleLayer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reaction words/hearts — a SEPARATE, non-flipped overlay at Eren's
          spot so the pixel text never renders mirrored by the flip. */}
      {!isSleeping && (reaction.phase === 'pounce' || reaction.phase === 'finish') && (
        <div className="absolute z-20 pointer-events-none" style={{
          bottom: '10%', left: '50%', transform: 'translateX(-50%)', width: 200, height: 200,
        }}>
          {reaction.phase === 'pounce' &&
            <SoundWord word="JINGLE!" color={WORD_COLOR.curious} left={50} top={4} />}
          {reaction.phase === 'finish' && <>
            <Hearts count={2} bottom="60%" />
            <SoundWord word="FUN!" color={WORD_COLOR.happy} left={50} top={6} />
          </>}
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
      {/* Leaderboard button — opens the household high-scores modal.
          Top is calculated from the StatsHeader bottom (120px + iOS
          safe-top) so it isn't buried behind the persistent stats. */}
      <button onClick={e => { e.stopPropagation(); playSound('ui_tap'); setShowLeaderboard(true) }}
        className="absolute right-4 z-50 active:translate-y-[2px] transition-transform"
        style={{ top: 'calc(var(--safe-top) + 128px)' }}>
        <div className="relative flex items-center gap-2 px-3 py-2 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #FBBF24 0%, #F59E0B 55%, #B45309 100%)',
            borderRadius: 4,
            border: '2px solid #78350F',
            boxShadow: '0 4px 0 #451A03, inset 0 1px 0 rgba(255,255,255,0.45), 0 0 12px rgba(251,191,36,0.55)',
          }}>
          {/* Corner rivets */}
          <div style={{ position: 'absolute', top: 2, left: 2, width: 3, height: 3, background: '#FFFFFF', boxShadow: '0 0 2px #FFFFFF' }} />
          <div style={{ position: 'absolute', top: 2, right: 2, width: 3, height: 3, background: '#FFFFFF', boxShadow: '0 0 2px #FFFFFF' }} />
          <div style={{ position: 'absolute', bottom: 2, left: 2, width: 3, height: 3, background: '#FFFFFF', boxShadow: '0 0 2px #FFFFFF' }} />
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 3, height: 3, background: '#FFFFFF', boxShadow: '0 0 2px #FFFFFF' }} />
          <div className="relative flex items-center justify-center"
            style={{
              width: 22, height: 22,
              background: 'linear-gradient(135deg, rgba(0,0,0,0.25), rgba(0,0,0,0.15))',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 3,
            }}>
            <IconCrown size={14} />
          </div>
          <span className="font-pixel text-white" style={{ fontSize: 8, letterSpacing: 1, textShadow: '1px 1px 0 #78350F' }}>
            HIGH SCORES
          </span>
        </div>
      </button>

      {/* Games link — premium pixel arcade button. Sits ~52 px below
          the leaderboard button so the two stack as a clear pair. */}
      <button onClick={e => { e.stopPropagation(); playSound('ui_tap'); router.push('/games'); setTimeout(onClose, 400) }}
        className="absolute right-4 z-50 active:translate-y-[2px] transition-transform group"
        style={{ top: 'calc(var(--safe-top) + 168px)' }}>
        <div className="relative flex items-center gap-2 px-3 py-2 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #A855F7 0%, #7C3AED 55%, #5B21B6 100%)',
            borderRadius: 4,
            border: '2px solid #4C1D95',
            boxShadow: '0 4px 0 #2E0F5C, inset 0 1px 0 rgba(255,255,255,0.45), 0 0 12px rgba(167,139,250,0.55)',
          }}>
          {/* Corner rivets */}
          <div style={{ position: 'absolute', top: 2, left: 2, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 2px #FFD700' }} />
          <div style={{ position: 'absolute', top: 2, right: 2, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 2px #FFD700' }} />
          <div style={{ position: 'absolute', bottom: 2, left: 2, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 2px #FFD700' }} />
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 2px #FFD700' }} />

          {/* Sweeping shine overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.38) 50%, transparent 62%)',
            animation: 'gamesShine 2.6s ease-in-out infinite',
          }} />

          {/* Icon tile */}
          <div className="relative flex items-center justify-center"
            style={{
              width: 22, height: 22,
              background: 'linear-gradient(135deg, rgba(0,0,0,0.25), rgba(0,0,0,0.15))',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 3,
            }}>
            <IconController size={16} />
          </div>

          <div className="relative flex items-center gap-1">
            <span className="font-pixel text-white" style={{ fontSize: 8, letterSpacing: 1, textShadow: '1px 1px 0 #2E0F5C' }}>GAMES</span>
            <div style={{ animation: 'gamesStar 1.4s ease-in-out infinite' }}>
              <IconStar size={10} />
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes gamesShine {
            0%, 30% { transform: translateX(-120%); }
            60%, 100% { transform: translateX(120%); }
          }
          @keyframes gamesStar {
            0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
            50%      { transform: scale(1.25) rotate(15deg); opacity: 0.75; }
          }
        `}</style>
      </button>

      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 animate-float whitespace-nowrap"
          style={{ top: 'calc(var(--safe-top) + 232px)', background: '#1F1F2E', borderRadius: 3, border: '2px solid #3A3A5E', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast}
        </div>
      )}

      {throwCount === 0 && !done && (
        <div className="absolute left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 pointer-events-none animate-pulse-soft"
          style={{ top: 'calc(var(--safe-top) + 280px)', background: 'rgba(255,255,255,0.85)', borderRadius: 3, border: '2px solid #C0A0E8', boxShadow: '2px 2px 0 rgba(150,100,220,0.2)', fontFamily: '"Press Start 2P"', fontSize: 7, color: '#7C3AED' }}>
          TAP TO THROW THE BALL!
        </div>
      )}

      {/* ══ BOTTOM UI ══ */}
      <div className="absolute bottom-5 inset-x-0 flex flex-col items-center gap-2 px-8 z-20" onClick={e => e.stopPropagation()}>
        {/* Energy gauge */}
        <div className="w-full max-w-xs">
          <SegmentMeter label="ENERGY" value={energy} palette={energyPalette} labelColor="#7C3AED" valueColor="#7C3AED" />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-pixel text-purple-600" style={{ fontSize: 7 }}>THROWS: {throwCount}</span>
          {throwCount >= 3 && !done && (
            <span className="font-pixel text-green-600 px-2 py-0.5" style={{ fontSize: 6, background: '#D1FAE5', borderRadius: 2, border: '1px solid #6EE7B7' }}>READY! ★</span>
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
      <LightSwitch side="left" targetBottom="10%" targetLeft="50%" persistKey="playroom" />
    </div>
  )
}
