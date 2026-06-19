'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useGameTimers } from '@/hooks/useGameTimers'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import GameCoinReward from '@/components/games/GameCoinReward'
import { RefreshCw, ChevronLeft } from 'lucide-react'
import { playSound } from '@/lib/sounds'
import { fireMinigameDone } from '@/lib/minigames'

const GAME_DURATION  = 20
const FISH_POSITIONS = [
  { x: '14%', y: '22%' }, { x: '58%', y: '14%' },
  { x: '76%', y: '52%' }, { x: '18%', y: '62%' },
  { x: '44%', y: '38%' }, { x: '80%', y: '72%' },
  { x: '8%',  y: '76%' }, { x: '54%', y: '66%' },
  { x: '34%', y: '54%' }, { x: '66%', y: '30%' },
  { x: '24%', y: '42%' }, { x: '72%', y: '20%' },
  { x: '90%', y: '40%' }, { x: '50%', y: '80%' },
]

type FishKind = 'good' | 'bonus' | 'danger'
interface Fish { id: number; x: string; y: string; visible: boolean; caught: boolean; emoji: string; kind: FishKind; points: number }
interface Splash { id: number; x: string; y: string; color: string; ring: boolean }
interface Bubble { id: number; x: number; animDuration: number; delay: number; size: number }
interface StarParticle { id: number; angle: number; distance: number; delay: number }

// Good fish — 1 point each
const GOOD_FISH  = ['🐟', '🐠', '🦐']
// Bonus fish — rare, worth 3 points
const BONUS_FISH = ['⭐', '🦑']
// Dangerous fish — tap them and lose 2 points!
const DANGER_FISH = ['🪼', '🦈', '🐙']

export default function PawTapGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const timers = useGameTimers()
  const reduced = useReducedMotion()

  const [gameState, setGameState] = useState<'idle' | 'running' | 'finished'>('idle')
  const [reward, setReward]       = useState<GameRewardResult | null>(null)
  const [score, setScore]         = useState(0)
  const [displayScore, setDisplayScore] = useState(0)
  const [scorePulse, setScorePulse] = useState<'none' | 'good' | 'bonus'>('none')
  const [hudFlash, setHudFlash]   = useState<'none' | 'danger' | 'bonus'>('none')
  const [shake, setShake]         = useState(false)
  const [bonusZoom, setBonusZoom] = useState(false)
  const [comboLost, setComboLost] = useState<{ id: number; combo: number } | null>(null)
  const [stars, setStars]         = useState<StarParticle[]>([])
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION)
  const [fish, setFish]           = useState<Fish[]>([])
  const [splashes, setSplashes]   = useState<Splash[]>([])
  const [pawFlash, setPawFlash]   = useState(false)
  const [comboText, setComboText] = useState<{ id: number; text: string; x: string; y: string; tier: 'normal' | 'bonus' | 'combo' | 'fire' | 'damage' } | null>(null)
  const [bubbles]                 = useState<Bubble[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      animDuration: 3 + Math.random() * 4,
      delay: Math.random() * 5,
      size: 4 + Math.random() * 8,
    }))
  )

  const scoreRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const fishTimerRef = useRef<number | null>(null)
  const comboRef = useRef(0)
  const splashIdRef = useRef(0)
  const timeLeftRef = useRef(GAME_DURATION)
  const finishedRef = useRef(false)
  const starIdRef = useRef(0)

  function spawnFish() {
    const pos = FISH_POSITIONS[Math.floor(Math.random() * FISH_POSITIONS.length)]

    // Difficulty ramp: bonus probability rises in the final 5 seconds
    const lateGame = timeLeftRef.current <= 5
    const roll = Math.random()
    let kind: FishKind = 'good'
    let emoji = ''
    let points = 1
    let lifespan = 2000

    const dangerCutoff = 0.18
    const bonusCutoff  = lateGame ? 0.40 : 0.30 // more bonus fish late-game

    if (roll < dangerCutoff) {
      kind = 'danger'
      emoji = DANGER_FISH[Math.floor(Math.random() * DANGER_FISH.length)]
      points = -2
      lifespan = 2400 // they linger a bit longer to tempt you
    } else if (roll < bonusCutoff) {
      kind = 'bonus'
      emoji = BONUS_FISH[Math.floor(Math.random() * BONUS_FISH.length)]
      points = 3
      lifespan = lateGame ? 1300 : 1600
    } else {
      emoji = GOOD_FISH[Math.floor(Math.random() * GOOD_FISH.length)]
      lifespan = lateGame ? 1700 : 2000
    }

    const newFish: Fish = { id: Date.now() + Math.random(), ...pos, visible: true, caught: false, emoji, kind, points }
    setFish(prev => [...prev.slice(-8), newFish])

    timers.setTimeout(() => {
      setFish(prev => prev.map(f => {
        if (f.id === newFish.id && !f.caught && f.visible) {
          // Fish escaped — play a soft bubble plop only for non-danger fish
          if (f.kind !== 'danger') playSound('pt_fish_escape')
          return { ...f, visible: false }
        }
        return f
      }))
    }, lifespan)
  }

  function rescheduleFishTimer(intervalMs: number) {
    if (fishTimerRef.current !== null) timers.clearInterval(fishTimerRef.current)
    // Freeze spawning while the tab is backgrounded so a returning round
    // doesn't get flooded with a teleported backlog of fish.
    fishTimerRef.current = timers.setInterval(() => {
      if (document.hidden) return
      spawnFish()
    }, intervalMs)
  }

  function startGame() {
    timers.clearAll()
    scoreRef.current = 0
    comboRef.current = 0
    finishedRef.current = false
    timeLeftRef.current = GAME_DURATION
    setReward(null)
    setScore(0)
    setDisplayScore(0)
    setTimeLeft(GAME_DURATION)
    setFish([])
    setSplashes([])
    setStars([])
    setComboLost(null)
    setHudFlash('none')
    setScorePulse('none')
    setBonusZoom(false)
    setShake(false)
    setGameState('running')

    timerRef.current = timers.setInterval(() => {
      // Freeze the countdown while backgrounded so a 20s round can't drain unseen.
      if (document.hidden) return
      setTimeLeft(t => {
        const next = t - 1
        timeLeftRef.current = next
        // Ramp spawn rate when entering final 5 seconds
        if (next === 5) rescheduleFishTimer(300)
        if (next <= 0) { endGame(); return 0 }
        return next
      })
    }, 1000)

    rescheduleFishTimer(450)
    spawnFish()
    spawnFish()
  }

  function endGame() {
    if (finishedRef.current) return
    finishedRef.current = true
    setReward(reportGameResult({ gameType: 'paw_tap', score: scoreRef.current }))
    if (timerRef.current !== null) timers.clearInterval(timerRef.current)
    if (fishTimerRef.current !== null) timers.clearInterval(fishTimerRef.current)
    timerRef.current = null
    fishTimerRef.current = null
    setGameState('finished')
    setFish([])
    playSound('pt_game_over')

    // Count-up animation for the Game Over score
    const finalScore = scoreRef.current
    if (finalScore > 0) {
      setDisplayScore(0)
      const steps = 30
      const stepMs = 600 / steps
      let i = 0
      const countTimer = timers.setInterval(() => {
        i += 1
        const v = Math.round((finalScore * i) / steps)
        setDisplayScore(v)
        if (i >= steps) {
          timers.clearInterval(countTimer)
          setDisplayScore(finalScore)
        }
      }, stepMs)
    } else {
      setDisplayScore(0)
    }

    // Legendary tier — spawn 8 gold star pixels around the score (spectacle, off when reduced)
    if (finalScore >= 60 && !reduced) {
      const burst: StarParticle[] = Array.from({ length: 8 }, (_, idx) => ({
        id: starIdRef.current++,
        angle: (idx / 8) * 360,
        distance: 42 + Math.random() * 18,
        delay: idx * 60,
      }))
      setStars(burst)
    }

    if (user?.id && scoreRef.current > 0) {
      fireMinigameDone('paw_tap', scoreRef.current)
      completeTask('daily_game')
      if (scoreRef.current >= 30) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }

  function catchFish(f: Fish) {
    setFish(prev => prev.map(fi => fi.id === f.id ? { ...fi, visible: false, caught: true } : fi))

    const isDanger = f.kind === 'danger'
    const prevCombo = comboRef.current
    let comboMilestone = false

    if (isDanger) {
      // Lose points, break combo
      scoreRef.current = Math.max(0, scoreRef.current + f.points)
      comboRef.current = 0
      playSound('pt_danger_hit')
      // Screen shake + global red HUD flash + danger vignette — spectacle, off when reduced
      if (!reduced) {
        setShake(true)
        timers.setTimeout(() => setShake(false), 220)
        setHudFlash('danger')
        timers.setTimeout(() => setHudFlash('none'), 280)
      }
      // If they had a streak going, show a "COMBO LOST!" banner
      if (prevCombo >= 3) {
        const lostId = Date.now()
        setComboLost({ id: lostId, combo: prevCombo })
        timers.setTimeout(() => setComboLost(c => (c && c.id === lostId ? null : c)), 800)
      }
    } else {
      // Score + combo bonus every 5 catches
      comboMilestone = comboRef.current > 0 && comboRef.current % 5 === 4
      const comboBonus = comboMilestone ? 2 : 0
      scoreRef.current += f.points + comboBonus
      comboRef.current += 1
      if (f.kind === 'bonus') {
        playSound('pt_catch_bonus')
        // Subtle camera zoom-pulse + gold HUD flash — spectacle, off when reduced
        if (!reduced) {
          setBonusZoom(true)
          timers.setTimeout(() => setBonusZoom(false), 200)
          setHudFlash('bonus')
          timers.setTimeout(() => setHudFlash('none'), 220)
        }
      } else {
        playSound('pt_catch_good')
      }
      if (comboMilestone) playSound('pt_combo_milestone')
    }

    setScore(scoreRef.current)
    // HUD score number pulse — gold flash for bonus, regular pop otherwise
    if (!isDanger) {
      setScorePulse(f.kind === 'bonus' ? 'bonus' : 'good')
      timers.setTimeout(() => setScorePulse('none'), 180)
    }
    setPawFlash(true)
    timers.setTimeout(() => setPawFlash(false), 150)

    // Splash effect — catch feedback, color varies by kind, ring rendered on non-danger
    const sid = splashIdRef.current++
    const splashColor = isDanger ? '#FF4444' : f.kind === 'bonus' ? '#FFD700' : '#FFFFFF'
    setSplashes(prev => [...prev, { id: sid, x: f.x, y: f.y, color: splashColor, ring: !isDanger }])
    timers.setTimeout(() => setSplashes(prev => prev.filter(s => s.id !== sid)), 600)

    // Floating text
    let text = ''
    let tier: 'normal' | 'bonus' | 'combo' | 'fire' | 'damage' = 'normal'
    if (isDanger) {
      text = `${f.points}`
      tier = 'damage'
    } else if (f.kind === 'bonus') {
      text = `+${f.points} BONUS!`
      tier = 'bonus'
    } else {
      const combo = comboRef.current
      if (combo >= 10) { text = `🔥 ×${combo}`; tier = 'fire' }
      else if (combo >= 5) { text = `⚡ ×${combo}`; tier = 'combo' }
      else { text = `+${f.points}` }
    }
    setComboText({ id: Date.now(), text, x: f.x, y: f.y, tier })
    timers.setTimeout(() => setComboText(null), 700)
  }

  // Timers auto-flush on unmount via useGameTimers. The countdown and fish-spawn
  // intervals self-guard on `document.hidden` (they no-op while backgrounded),
  // so the round simply freezes and resumes — no wall-clock rebase needed.
  useVisibilityPause()

  const timeWarning = timeLeft <= 5
  const fillWidth = (timeLeft / GAME_DURATION) * 100

  return (
    <div className="page-scroll">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => { playSound('ui_back'); router.back() }} className="flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
          <ChevronLeft size={16} className="text-purple-500" />
        </button>
        <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #6BAED6, #3A88B8)' }}>🐾 PAW TAP!</span>
      </div>

      {/* ── HUD ── */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 flex flex-col items-center py-2.5"
          style={{
            background: hudFlash === 'danger'
              ? 'linear-gradient(135deg, #FFE0E0, #FFB0B0)'
              : hudFlash === 'bonus'
                ? 'linear-gradient(135deg, #FFF6CC, #FFE48A)'
                : 'linear-gradient(135deg, #F0F8FF, #E0EEFF)',
            borderRadius: 3,
            border: `2px solid ${hudFlash === 'danger' ? '#FF6060' : hudFlash === 'bonus' ? '#E0B020' : '#B8D8F0'}`,
            boxShadow: `2px 2px 0 ${hudFlash === 'danger' ? '#C03030' : hudFlash === 'bonus' ? '#A07810' : '#90B8D8'}`,
            transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
          }}>
          <span className="font-pixel text-sky-500" style={{ fontSize: 6 }}>FISH CAUGHT</span>
          <span
            className="font-pixel mt-1"
            style={{
              fontSize: 16,
              color: scorePulse === 'bonus' ? '#FFC000' : '#FF6B9D',
              display: 'inline-block',
              animation: scorePulse !== 'none' ? 'scoreBounce 0.18s steps(2, end)' : 'none',
              textShadow: scorePulse === 'bonus' ? '0 0 6px rgba(255,200,0,0.7)' : 'none',
            }}>
            {score}
          </span>
        </div>
        <div className={`flex-1 flex flex-col items-center py-2.5 ${timeWarning && !reduced ? 'animate-heartbeat' : ''}`}
          style={{ background: timeWarning ? 'linear-gradient(135deg, #FFF0F0, #FFE0E0)' : 'linear-gradient(135deg, #F0F8FF, #E0EEFF)', borderRadius: 3, border: `2px solid ${timeWarning ? '#FFB0B0' : '#B8D8F0'}`, boxShadow: `2px 2px 0 ${timeWarning ? '#FF9090' : '#90B8D8'}` }}>
          <span className="font-pixel text-sky-500" style={{ fontSize: 6 }}>TIME</span>
          <span className={`font-pixel mt-1 ${timeWarning ? 'text-red-500' : 'text-gray-700'}`} style={{ fontSize: 16 }}>{timeLeft}s</span>
        </div>
      </div>

      {/* ── Timer bar ── */}
      {gameState === 'running' && (
        <div className="mb-3 flex gap-0.5">
          {Array.from({ length: GAME_DURATION }).map((_, i) => {
            const lit = i < timeLeft
            return (
              <div key={i} style={{
                flex: 1, height: 8, borderRadius: 1,
                background: lit
                  ? (timeLeft <= 5 ? '#FF6060' : timeLeft <= 10 ? '#FFB840' : '#50C8E8')
                  : '#C0D8E8',
                border: lit ? '1px solid rgba(0,0,0,0.15)' : '1px solid #A8C8DC',
                boxShadow: lit ? 'inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
                transition: 'background 0.3s',
              }} />
            )
          })}
        </div>
      )}

      {/* ── Game area ── */}
      <div className="mb-4 relative overflow-hidden select-none"
        style={{
          height: 320,
          borderRadius: 4,
          border: '3px solid #88C4E8',
          boxShadow: '4px 4px 0 #60A8D0',
          animation: shake ? 'aquariumShake 0.22s steps(4, end)' : bonusZoom ? 'bonusZoom 0.2s ease-out' : 'none',
          touchAction: 'none',
          overscrollBehavior: 'contain',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}>

        {/* ── Underwater background ── */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #A8E0F8 0%, #70C4F0 35%, #50A8E0 70%, #3888C8 100%)' }} />

        {/* Danger vignette on bad hits */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(200,0,0,0.5) 100%)',
          opacity: hudFlash === 'danger' ? 1 : 0,
          transition: 'opacity 0.12s ease-out',
        }} />

        {/* Light rays from surface */}
        {[15, 35, 55, 75].map((rx, ri) => (
          <div key={ri} className="absolute top-0 pointer-events-none"
            style={{ left: `${rx}%`, width: 24, height: '100%', background: `linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 80%)`, transform: `rotate(${ri % 2 === 0 ? 5 : -5}deg)`, transformOrigin: 'top center' }} />
        ))}

        {/* Surface shimmer */}
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: 8, background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 100%)' }} />

        {/* Bubbles (always present) */}
        {bubbles.map(b => (
          <div key={b.id} className="absolute pointer-events-none"
            style={{
              left: `${b.x}%`, bottom: -b.size,
              width: b.size, height: b.size,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.35)',
              border: '1px solid rgba(255,255,255,0.5)',
              animation: reduced ? 'none' : `rise ${b.animDuration}s ease-in ${b.delay}s infinite`,
            }} />
        ))}

        {/* Seaweed at bottom */}
        {[8, 18, 30, 45, 60, 72, 85, 93].map((sx, si) => (
          <div key={si} className="absolute bottom-0 pointer-events-none"
            style={{
              left: `${sx}%`,
              width: 6, height: 28 + (si % 3) * 10,
              background: `linear-gradient(180deg, #40A840, #286028)`,
              borderRadius: '3px 3px 0 0',
              transformOrigin: 'bottom center',
              animation: reduced ? 'none' : `sway ${2 + si * 0.3}s ease-in-out infinite`,
            }} />
        ))}

        {/* Sandy floor */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ height: 16, background: 'linear-gradient(180deg, #D4B870 0%, #C0A050 100%)' }}>
          {/* Pebbles */}
          {[5,14,25,38,52,64,76,88].map((px, pi) => (
            <div key={pi} style={{ position: 'absolute', bottom: 3, left: `${px}%`, width: 5 + pi % 3 * 2, height: 5 + pi % 2 * 2, borderRadius: '50%', background: '#A88840' }} />
          ))}
        </div>

        {/* Fish targets */}
        {gameState === 'running' && fish.map(f => {
          if (!f.visible) return null
          const isDanger = f.kind === 'danger'
          const isBonus = f.kind === 'bonus'
          if (isDanger) {
            return (
              <div key={f.id} className="absolute" style={{ left: f.x, top: f.y, transform: 'translate(-50%, -50%)' }}>
                {/* Pulsing red warning ring */}
                <div className="absolute left-1/2 top-1/2 pointer-events-none" style={{
                  width: 58, height: 58,
                  marginLeft: -29, marginTop: -29,
                  borderRadius: '50%',
                  border: '3px solid #FF2020',
                  boxShadow: '0 0 14px rgba(255,32,32,0.85), inset 0 0 10px rgba(255,32,32,0.5)',
                  animation: reduced ? 'none' : 'dangerRing 0.55s ease-in-out infinite',
                }} />
                {/* Inner red glow fill */}
                <div className="absolute left-1/2 top-1/2 pointer-events-none" style={{
                  width: 48, height: 48,
                  marginLeft: -24, marginTop: -24,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,50,50,0.45) 0%, rgba(255,50,50,0.15) 55%, transparent 80%)',
                  animation: reduced ? 'none' : 'dangerGlow 0.8s ease-in-out infinite',
                }} />
                {/* Danger sign marker */}
                <div className="absolute pointer-events-none font-pixel" style={{
                  top: -26, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 12,
                  color: '#FFFFFF',
                  background: '#DC2626',
                  border: '2px solid #7F1D1D',
                  borderRadius: 3,
                  padding: '1px 5px',
                  boxShadow: '0 2px 0 #7F1D1D, 0 0 6px rgba(220,38,38,0.8)',
                  letterSpacing: 1,
                  animation: reduced ? 'none' : 'dangerBadge 0.5s ease-in-out infinite',
                }}>!</div>
                <button
                  onClick={() => catchFish(f)}
                  className="relative flex items-center justify-center active:scale-125 transition-transform duration-100"
                  style={{
                    // Glyph stays 30px; transparent box grows the tap target to >=44px.
                    minWidth: 44, minHeight: 44,
                    fontSize: 30,
                    lineHeight: 1,
                    filter: 'drop-shadow(0 0 8px rgba(255,20,20,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                    animation: reduced ? 'none' : 'dangerPulse 0.45s ease-in-out infinite',
                    background: 'transparent',
                    touchAction: 'none',
                  }}
                >
                  {f.emoji}
                </button>
              </div>
            )
          }
          return (
            <button
              key={f.id}
              onClick={() => catchFish(f)}
              className="absolute flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-100 active:scale-125"
              style={{
                left: f.x, top: f.y,
                // Glyph keeps its size; transparent box grows the tap target to >=44px.
                minWidth: 44, minHeight: 44,
                fontSize: isBonus ? 34 : 28,
                lineHeight: 1,
                background: 'transparent',
                touchAction: 'none',
                filter: isBonus
                  ? 'drop-shadow(0 0 8px rgba(255,215,0,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
                  : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                animation: reduced
                  ? 'none'
                  : isBonus
                    ? 'bonusShine 0.8s ease-in-out infinite'
                    : 'fishWobble 1.2s ease-in-out infinite',
              }}
            >
              {f.emoji}
            </button>
          )
        })}

        {/* Splash effects */}
        {splashes.map(s => (
          <div key={s.id}
            className="absolute pointer-events-none"
            style={{ left: s.x, top: s.y, transform: 'translate(-50%,-50%)', animation: 'splashOut 0.5s ease-out forwards' }}>
            {/* Expanding water-displacement rings (behind the dot burst) */}
            {s.ring && (
              <>
                <span style={{
                  position: 'absolute',
                  width: 22, height: 22,
                  marginLeft: -11, marginTop: -11,
                  borderRadius: '50%',
                  border: `2px solid ${s.color}`,
                  background: 'transparent',
                  animation: 'splashRing 0.35s ease-out forwards',
                }} />
                <span style={{
                  position: 'absolute',
                  width: 22, height: 22,
                  marginLeft: -11, marginTop: -11,
                  borderRadius: '50%',
                  border: `2px solid ${s.color}`,
                  background: 'transparent',
                  animation: 'splashRing 0.35s ease-out 0.08s forwards',
                  opacity: 0,
                }} />
              </>
            )}
            {[0, 1, 2, 3, 4, 5].map(ei => (
              <span key={ei} style={{
                position: 'absolute',
                width: 4, height: 4,
                borderRadius: '50%',
                background: s.color,
                boxShadow: `0 0 4px ${s.color}`,
                transform: `rotate(${ei * 60}deg) translateY(-22px)`,
                animation: 'splashFly 0.5s ease-out forwards',
                animationDelay: `${ei * 30}ms`,
              }} />
            ))}
          </div>
        ))}

        {/* Combo / damage text */}
        {comboText && (
          <div
            key={comboText.id}
            className="absolute pointer-events-none font-pixel"
            style={{
              left: comboText.x, top: comboText.y,
              transform: 'translate(-50%, -180%)',
              color: comboText.tier === 'damage'
                ? '#FF4444'
                : comboText.tier === 'bonus'
                  ? '#FFD700'
                  : comboText.tier === 'fire'
                    ? '#FF4500'
                    : comboText.tier === 'combo'
                      ? '#FF9D00'
                      : '#FFD700',
              fontSize: comboText.tier === 'fire' ? 11 : comboText.tier === 'combo' || comboText.tier === 'bonus' ? 9 : 8,
              textShadow: comboText.tier === 'fire'
                ? '1px 1px 0 #7A1A00, 0 0 6px rgba(255,80,0,0.7)'
                : '1px 1px 0 rgba(0,0,0,0.5)',
              animation: comboText.tier === 'fire'
                ? 'floatBurst 0.7s cubic-bezier(.2,.9,.3,1) forwards'
                : 'floatUp 0.7s ease-out forwards',
            }}>
            {/* Sparkle behind fire combos */}
            {comboText.tier === 'fire' && (
              <span aria-hidden style={{
                position: 'absolute', inset: -4,
                background: 'radial-gradient(circle, rgba(255,200,80,0.7) 0%, transparent 70%)',
                zIndex: -1,
                animation: 'sparklePulse 0.5s ease-out forwards',
              }} />
            )}
            {comboText.text}
          </div>
        )}

        {/* COMBO LOST! banner — only when streak >=3 was broken */}
        {comboLost && (
          <div
            key={comboLost.id}
            className="absolute pointer-events-none font-pixel"
            style={{
              left: '50%', top: '38%',
              transform: 'translate(-50%, -50%)',
              color: '#FF4444',
              fontSize: 10,
              letterSpacing: 1,
              textShadow: '1px 1px 0 #000, 0 0 6px rgba(255,40,40,0.6)',
              animation: 'comboLost 0.8s ease-out forwards',
            }}>
            COMBO LOST! ×{comboLost.combo}
          </div>
        )}

        {/* Paw indicator */}
        {gameState === 'running' && (
          <div className="absolute bottom-6 right-4 transition-transform duration-75 pointer-events-none"
            style={{ transform: pawFlash ? 'scale(1.5) rotate(-15deg)' : 'scale(1)', fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
            🐾
          </div>
        )}

        {/* Score bubble (underwater style) */}
        {gameState === 'running' && (
          <div className="absolute top-2 left-2 pointer-events-none flex items-center gap-1.5 px-2.5 py-1.5"
            style={{ background: 'rgba(20,60,100,0.65)', borderRadius: 3, border: '1px solid rgba(100,180,240,0.4)' }}>
            <span style={{ fontSize: 10 }}>🐟</span>
            <span className="font-pixel text-white" style={{ fontSize: 7 }}>{score}</span>
          </div>
        )}

        {/* Idle / Finished overlay */}
        {gameState !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm"
            style={{ background: 'rgba(20,80,140,0.78)' }}>
            {gameState === 'idle' && (
              <>
                <div className={`text-5xl mb-3 ${reduced ? '' : 'animate-float'}`}>🐟</div>
                <p className="font-pixel text-white mb-1" style={{ fontSize: 9 }}>PAW TAP!</p>
                <p className="text-xs text-sky-200 mb-2 text-center px-8 leading-relaxed">
                  Tap fish to catch them in {GAME_DURATION} seconds!
                </p>
                <div className="flex items-center gap-3 mb-5">
                  <div className="text-center">
                    <div style={{ fontSize: 20 }}>🐟</div>
                    <p className="font-pixel text-sky-200" style={{ fontSize: 5 }}>+1</p>
                  </div>
                  <div className="text-center">
                    <div style={{ fontSize: 20, filter: 'drop-shadow(0 0 4px #FFD700)' }}>⭐</div>
                    <p className="font-pixel text-yellow-300" style={{ fontSize: 5 }}>+3</p>
                  </div>
                  <div className="text-center">
                    <div style={{ fontSize: 20, filter: 'drop-shadow(0 0 4px #FF4444)' }}>🪼</div>
                    <p className="font-pixel text-red-400" style={{ fontSize: 5 }}>-2!</p>
                  </div>
                </div>
                <button onClick={() => { playSound('ui_tap'); startGame() }}
                  className="px-8 py-3 text-white active:translate-y-[2px] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #4EAADC, #2A88C0)', borderRadius: 3, border: '2px solid #1A70A8', boxShadow: '0 4px 0 #105888', fontFamily: '"Press Start 2P"', fontSize: 8 }}>
                  ▶ DIVE IN!
                </button>
              </>
            )}
            {gameState === 'finished' && (
              <>
                <div className="text-4xl mb-2" style={{ animation: reduced ? 'none' : 'rodWiggle 1.4s ease-in-out infinite' }}>🎣</div>
                <div className="relative">
                  {/* Star burst — only for LEGENDARY (60+) */}
                  {score >= 60 && stars.map(st => (
                    <span
                      key={st.id}
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: '50%', top: '50%',
                        width: 6, height: 6,
                        marginLeft: -3, marginTop: -3,
                        background: '#FFD700',
                        boxShadow: '0 0 4px #FFC000, 1px 1px 0 #A06000',
                        // 4-point pixel star via clip
                        clipPath: 'polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)',
                        animation: `starBurst 0.9s cubic-bezier(.2,.7,.4,1) ${st.delay}ms forwards`,
                        ['--sx' as string]: `${Math.cos((st.angle * Math.PI) / 180) * st.distance}px`,
                        ['--sy' as string]: `${Math.sin((st.angle * Math.PI) / 180) * st.distance}px`,
                        opacity: 0,
                      } as React.CSSProperties}
                    />
                  ))}
                  <p className="font-pixel text-[#FFD700] mb-1" style={{ fontSize: 11 }}>{displayScore}</p>
                </div>
                <p className="font-pixel text-sky-200 mb-3" style={{ fontSize: 7 }}>FISH CAUGHT!</p>
                <p className="font-pixel text-sky-300 mb-1" style={{ fontSize: 6 }}>
                  {score >= 60 ? '★ LEGENDARY ANGLER! ★' : score >= 40 ? '★ PAW MASTER! ★' : score >= 20 ? '★ NICE CATCH! ★' : 'KEEP PRACTICING!'}
                </p>
                {score > 5 && <p className="font-pixel text-[#FF6B9D] mb-4" style={{ fontSize: 6 }}>EREN IS THRILLED! ♥</p>}
                {reward && (<div className="mb-3"><GameCoinReward coins={reward.coins} blocked={reward.blocked} /></div>)}
                <div className="flex gap-3 mt-1">
                  <button onClick={() => { playSound('ui_tap'); startGame() }}
                    className="px-4 py-2 text-white active:translate-y-[1px] transition-transform flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #4EAADC, #2A88C0)', borderRadius: 3, border: '2px solid #1A70A8', boxShadow: '2px 2px 0 #105888', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                    <RefreshCw size={10} /> RETRY
                  </button>
                  <button onClick={() => { playSound('ui_back'); router.back() }}
                    className="px-4 py-2 text-white active:translate-y-[1px] transition-transform"
                    style={{ background: 'linear-gradient(135deg, #475569, #1F2937)', borderRadius: 3, border: '2px solid #0F172A', boxShadow: '2px 2px 0 #0F172A', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                    EXIT
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <p className="font-pixel text-gray-400 text-center" style={{ fontSize: 6 }}>
        TAP THE FISH BEFORE THEY SWIM AWAY!
      </p>

      <style jsx>{`
        @keyframes rise {
          0%   { transform: translateY(0); opacity: 0.8; }
          100% { transform: translateY(-340px); opacity: 0; }
        }
        @keyframes fishWobble {
          0%, 100% { transform: translate(-50%,-50%) rotate(-8deg); }
          50%       { transform: translate(-50%,-50%) rotate(8deg); }
        }
        @keyframes dangerPulse {
          0%, 100% { transform: scale(1) rotate(-4deg); }
          50%       { transform: scale(1.18) rotate(4deg); }
        }
        @keyframes dangerRing {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(1.12); }
        }
        @keyframes dangerGlow {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes dangerBadge {
          0%, 100% { transform: translateX(-50%) translateY(0) scale(1); }
          50%       { transform: translateX(-50%) translateY(-2px) scale(1.1); }
        }
        @keyframes bonusShine {
          0%, 100% { transform: translate(-50%,-50%) scale(1) rotate(-10deg); }
          50%       { transform: translate(-50%,-50%) scale(1.2) rotate(10deg); }
        }
        @keyframes floatUp {
          0%   { transform: translate(-50%,-180%); opacity: 1; }
          100% { transform: translate(-50%,-280%); opacity: 0; }
        }
        @keyframes splashOut {
          0%   { transform: translate(-50%,-50%) scale(0.5); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
        }
        @keyframes splashFly {
          0%   { transform: rotate(var(--r,0deg)) translateY(-10px); opacity: 1; }
          100% { transform: rotate(var(--r,0deg)) translateY(-32px); opacity: 0; }
        }
        @keyframes splashRing {
          0%   { transform: scale(0); opacity: 0.6; }
          100% { transform: scale(2);   opacity: 0; }
        }
        @keyframes aquariumShake {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(-4px, 2px); }
          50%  { transform: translate(3px, -3px); }
          75%  { transform: translate(-2px, 4px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes bonusZoom {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        @keyframes scoreBounce {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes floatBurst {
          0%   { transform: translate(-50%, -180%) scale(1.4); opacity: 1; }
          12%  { transform: translate(-50%, -190%) scale(1.0); opacity: 1; }
          100% { transform: translate(-50%, -290%) scale(1.0); opacity: 0; }
        }
        @keyframes sparklePulse {
          0%   { opacity: 1; transform: scale(0.6); }
          100% { opacity: 0; transform: scale(1.6); }
        }
        @keyframes comboLost {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          25%  { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          75%  { transform: translate(-50%, -65%) scale(1);    opacity: 1; }
          100% { transform: translate(-50%, -90%) scale(0.95); opacity: 0; }
        }
        @keyframes rodWiggle {
          0%, 100% { transform: rotate(-6deg); }
          50%       { transform: rotate(6deg); }
        }
        @keyframes starBurst {
          0%   { transform: translate(0,0) scale(0.4); opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translate(var(--sx,0), var(--sy,0)) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
