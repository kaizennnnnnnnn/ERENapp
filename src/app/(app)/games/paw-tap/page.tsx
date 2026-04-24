'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { RefreshCw, ChevronLeft } from 'lucide-react'

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
interface Splash { id: number; x: string; y: string; color: string }
interface Bubble { id: number; x: number; animDuration: number; delay: number; size: number }

// Good fish — 1 point each
const GOOD_FISH  = ['🐟', '🐠', '🦐']
// Bonus fish — rare, worth 3 points
const BONUS_FISH = ['⭐', '🦑']
// Dangerous fish — tap them and lose 2 points!
const DANGER_FISH = ['🪼', '🦈', '🐙']

export default function PawTapGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(false) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const [gameState, setGameState] = useState<'idle' | 'running' | 'finished'>('idle')
  const [score, setScore]         = useState(0)
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION)
  const [fish, setFish]           = useState<Fish[]>([])
  const [splashes, setSplashes]   = useState<Splash[]>([])
  const [pawFlash, setPawFlash]   = useState(false)
  const [comboText, setComboText] = useState<{ id: number; text: string; x: string; y: string } | null>(null)
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fishTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const comboRef = useRef(0)
  const splashIdRef = useRef(0)

  function spawnFish() {
    const pos = FISH_POSITIONS[Math.floor(Math.random() * FISH_POSITIONS.length)]

    // Decide kind: 70% good, 12% bonus, 18% danger
    const roll = Math.random()
    let kind: FishKind = 'good'
    let emoji = ''
    let points = 1
    let lifespan = 2000

    if (roll < 0.18) {
      kind = 'danger'
      emoji = DANGER_FISH[Math.floor(Math.random() * DANGER_FISH.length)]
      points = -2
      lifespan = 2400 // they linger a bit longer to tempt you
    } else if (roll < 0.30) {
      kind = 'bonus'
      emoji = BONUS_FISH[Math.floor(Math.random() * BONUS_FISH.length)]
      points = 3
      lifespan = 1600 // bonus fish are fast to catch
    } else {
      emoji = GOOD_FISH[Math.floor(Math.random() * GOOD_FISH.length)]
    }

    const newFish: Fish = { id: Date.now() + Math.random(), ...pos, visible: true, caught: false, emoji, kind, points }
    setFish(prev => [...prev.slice(-8), newFish])

    setTimeout(() => {
      setFish(prev => prev.map(f => f.id === newFish.id && !f.caught ? { ...f, visible: false } : f))
    }, lifespan)
  }

  function startGame() {
    scoreRef.current = 0
    comboRef.current = 0
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setFish([])
    setSplashes([])
    setGameState('running')

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { endGame(); return 0 }
        return t - 1
      })
    }, 1000)

    fishTimerRef.current = setInterval(spawnFish, 450)
    spawnFish()
    spawnFish()
  }

  function endGame() {
    clearInterval(timerRef.current!)
    clearInterval(fishTimerRef.current!)
    setGameState('finished')
    setFish([])

    if (user?.id && scoreRef.current > 0) {
      supabase.from('game_scores').insert({ user_id: user.id, game_type: 'paw_tap', score: scoreRef.current }).then(({ error }) => { if (error) console.error('score save error:', error) })
      addCoins(scoreRef.current)
      completeTask('daily_game')
      if (scoreRef.current >= 30) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }

  function catchFish(f: Fish) {
    setFish(prev => prev.map(fi => fi.id === f.id ? { ...fi, visible: false, caught: true } : fi))

    const isDanger = f.kind === 'danger'

    if (isDanger) {
      // Lose points, break combo
      scoreRef.current = Math.max(0, scoreRef.current + f.points)
      comboRef.current = 0
    } else {
      // Score + combo bonus every 5 catches
      const comboBonus = comboRef.current > 0 && comboRef.current % 5 === 4 ? 2 : 0
      scoreRef.current += f.points + comboBonus
      comboRef.current += 1
    }

    setScore(scoreRef.current)
    setPawFlash(true)
    setTimeout(() => setPawFlash(false), 150)

    // Splash effect — color varies by kind
    const sid = splashIdRef.current++
    const splashColor = isDanger ? '#FF4444' : f.kind === 'bonus' ? '#FFD700' : '#FFFFFF'
    setSplashes(prev => [...prev, { id: sid, x: f.x, y: f.y, color: splashColor }])
    setTimeout(() => setSplashes(prev => prev.filter(s => s.id !== sid)), 600)

    // Floating text
    let text = ''
    if (isDanger) {
      text = `${f.points}`
    } else if (f.kind === 'bonus') {
      text = `+${f.points} BONUS!`
    } else {
      const combo = comboRef.current
      text = combo >= 10 ? `🔥 ×${combo}` : combo >= 5 ? `⚡ ×${combo}` : `+${f.points}`
    }
    setComboText({ id: Date.now(), text, x: f.x, y: f.y })
    setTimeout(() => setComboText(null), 700)
  }

  useEffect(() => () => {
    clearInterval(timerRef.current!)
    clearInterval(fishTimerRef.current!)
  }, [])

  const timeWarning = timeLeft <= 5
  const fillWidth = (timeLeft / GAME_DURATION) * 100

  return (
    <div className="page-scroll">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
          <ChevronLeft size={16} className="text-purple-500" />
        </button>
        <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #6BAED6, #3A88B8)' }}>🐾 PAW TAP!</span>
      </div>

      {/* ── HUD ── */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 flex flex-col items-center py-2.5"
          style={{ background: 'linear-gradient(135deg, #F0F8FF, #E0EEFF)', borderRadius: 3, border: '2px solid #B8D8F0', boxShadow: '2px 2px 0 #90B8D8' }}>
          <span className="font-pixel text-sky-500" style={{ fontSize: 6 }}>FISH CAUGHT</span>
          <span className="font-pixel text-[#FF6B9D] mt-1" style={{ fontSize: 16 }}>{score}</span>
        </div>
        <div className={`flex-1 flex flex-col items-center py-2.5 ${timeWarning ? 'animate-heartbeat' : ''}`}
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
        style={{ height: 320, borderRadius: 4, border: '3px solid #88C4E8', boxShadow: '4px 4px 0 #60A8D0' }}>

        {/* ── Underwater background ── */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #A8E0F8 0%, #70C4F0 35%, #50A8E0 70%, #3888C8 100%)' }} />

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
              animation: `rise ${b.animDuration}s ease-in ${b.delay}s infinite`,
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
              animation: `sway ${2 + si * 0.3}s ease-in-out infinite`,
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
                  animation: 'dangerRing 0.55s ease-in-out infinite',
                }} />
                {/* Inner red glow fill */}
                <div className="absolute left-1/2 top-1/2 pointer-events-none" style={{
                  width: 48, height: 48,
                  marginLeft: -24, marginTop: -24,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,50,50,0.45) 0%, rgba(255,50,50,0.15) 55%, transparent 80%)',
                  animation: 'dangerGlow 0.8s ease-in-out infinite',
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
                  animation: 'dangerBadge 0.5s ease-in-out infinite',
                }}>!</div>
                <button
                  onClick={() => catchFish(f)}
                  className="relative active:scale-125 transition-transform duration-100"
                  style={{
                    fontSize: 30,
                    lineHeight: 1,
                    filter: 'drop-shadow(0 0 8px rgba(255,20,20,1)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                    animation: 'dangerPulse 0.45s ease-in-out infinite',
                    background: 'transparent',
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
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-100 active:scale-125"
              style={{
                left: f.x, top: f.y,
                fontSize: isBonus ? 34 : 28,
                lineHeight: 1,
                filter: isBonus
                  ? 'drop-shadow(0 0 8px rgba(255,215,0,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
                  : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                animation: isBonus
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
              color: comboText.text.startsWith('-') ? '#FF4444' : comboText.text.includes('BONUS') ? '#FFD700' : comboText.text.includes('×') ? '#FF9D00' : '#FFD700',
              fontSize: comboText.text.includes('BONUS') || comboText.text.includes('×') ? 9 : 8,
              textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
              animation: 'floatUp 0.7s ease-out forwards',
            }}>
            {comboText.text}
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
                <div className="text-5xl mb-3 animate-float">🐟</div>
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
                <button onClick={startGame}
                  className="px-8 py-3 text-white active:translate-y-[2px] transition-transform"
                  style={{ background: 'linear-gradient(135deg, #4EAADC, #2A88C0)', borderRadius: 3, border: '2px solid #1A70A8', boxShadow: '0 4px 0 #105888', fontFamily: '"Press Start 2P"', fontSize: 8 }}>
                  ▶ DIVE IN!
                </button>
              </>
            )}
            {gameState === 'finished' && (
              <>
                <div className="text-4xl mb-2">🎣</div>
                <p className="font-pixel text-[#FFD700] mb-1" style={{ fontSize: 11 }}>{score}</p>
                <p className="font-pixel text-sky-200 mb-3" style={{ fontSize: 7 }}>FISH CAUGHT!</p>
                <p className="font-pixel text-sky-300 mb-1" style={{ fontSize: 6 }}>
                  {score >= 60 ? '★ LEGENDARY ANGLER! ★' : score >= 40 ? '★ PAW MASTER! ★' : score >= 20 ? '★ NICE CATCH! ★' : 'KEEP PRACTICING!'}
                </p>
                {score > 5 && <p className="font-pixel text-[#FF6B9D] mb-4" style={{ fontSize: 6 }}>EREN IS THRILLED! ♥</p>}
                <div className="flex gap-3 mt-1">
                  <button onClick={startGame}
                    className="px-4 py-2 text-white active:translate-y-[1px] transition-transform flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #4EAADC, #2A88C0)', borderRadius: 3, border: '2px solid #1A70A8', boxShadow: '2px 2px 0 #105888', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                    <RefreshCw size={10} /> RETRY
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
      `}</style>
    </div>
  )
}
