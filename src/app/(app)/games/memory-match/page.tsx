'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import {
  IconYarn, IconFish, IconPaw, IconMouse, IconHeart, IconStar,
  IconCrown, IconCoin,
} from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

// ── Game config ──────────────────────────────────────────────────────────────
const GAME_DURATION = 60 // seconds
const GRID_COLS = 3
const GRID_ROWS = 4        // 12 cards = 6 pairs
const MISMATCH_FLIP_BACK_MS = 720
const COMBO_WINDOW_MS = 3500

type CardKind = 'yarn' | 'fish' | 'paw' | 'mouse' | 'heart' | 'star'
const KINDS: CardKind[] = ['yarn', 'fish', 'paw', 'mouse', 'heart', 'star']

const KIND_META: Record<CardKind, {
  Icon: React.FC<{ size?: number }>
  tint: string   // background gradient face color
  glow: string   // match-glow color
}> = {
  yarn:  { Icon: IconYarn,  tint: '#FF6B9D', glow: 'rgba(255,107,157,0.55)' },
  fish:  { Icon: IconFish,  tint: '#6BAED6', glow: 'rgba(107,174,214,0.55)' },
  paw:   { Icon: IconPaw,   tint: '#F5C842', glow: 'rgba(245,200,66,0.55)' },
  mouse: { Icon: IconMouse, tint: '#B0B0B0', glow: 'rgba(180,180,180,0.55)' },
  heart: { Icon: IconHeart, tint: '#F472B6', glow: 'rgba(244,114,182,0.55)' },
  star:  { Icon: IconStar,  tint: '#FFD700', glow: 'rgba(255,215,0,0.6)'   },
}

type Card = {
  id: number
  kind: CardKind
  faceUp: boolean
  matched: boolean
  wobble: 'none' | 'match' | 'miss'
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function newDeck(): Card[] {
  const pairs = KINDS.flatMap(k => [k, k])
  return shuffle(pairs).map((kind, i) => ({
    id: i,
    kind,
    faceUp: false,
    matched: false,
    wobble: 'none',
  }))
}

// ── XP/score constants ───────────────────────────────────────────────────────
const MATCH_BASE_POINTS = 12
const TIME_BONUS_PER_SEC = 2
const COMBO_BONUS_PER = 6

export default function MemoryMatchGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const [deck, setDeck] = useState<Card[]>(() => newDeck())
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0) // consecutive matches
  const [flips, setFlips] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [gameState, setGameState] = useState<'idle' | 'running' | 'finished'>('idle')
  const [showFlash, setShowFlash] = useState<{ id: number; type: 'match' | 'miss'; color: string } | null>(null)
  const [savedOnce, setSavedOnce] = useState(false)
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; color: string; dx: number; dy: number; rot: number }>>([])

  const selected = useRef<number[]>([])
  const locked   = useRef(false)
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Game timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'running') return
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval)
          setGameState('finished')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [gameState])

  // ── Check for all-matched ──────────────────────────────────────────────────
  const matchedCount = deck.filter(c => c.matched).length
  useEffect(() => {
    if (gameState === 'running' && matchedCount === deck.length) {
      // All pairs matched — finish
      setGameState('finished')
      // Small confetti burst
      const burst: typeof confetti = []
      const colors = ['#FF6B9D', '#A78BFA', '#F5C842', '#6BAED6', '#4ADE80', '#FFD700']
      for (let i = 0; i < 36; i++) {
        burst.push({
          id: i,
          x: 50, y: 40,
          color: colors[i % colors.length],
          dx: (Math.random() - 0.5) * 180,
          dy: -Math.random() * 260 - 20,
          rot: (Math.random() - 0.5) * 540,
        })
      }
      setConfetti(burst)
      setTimeout(() => setConfetti([]), 2800)
    }
  }, [matchedCount, deck.length, gameState])

  // ── Compute final score ────────────────────────────────────────────────────
  const finalScore = useMemo(() => {
    if (gameState !== 'finished') return score
    return score + (matchedCount === deck.length ? timeLeft * TIME_BONUS_PER_SEC : 0)
  }, [gameState, score, timeLeft, matchedCount, deck.length])

  // ── Save finished score ────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'finished' || savedOnce || !user?.id) return
    setSavedOnce(true)
    ;(async () => {
      await supabase.from('game_scores').insert({
        user_id: user.id,
        game_type: 'memory_match',
        score: finalScore,
      })
      await applyAction(user.id, 'play')
      await addCoins(Math.min(30, Math.floor(finalScore / 8)))
      completeTask('daily_game')
      if (finalScore >= 30) completeTask('weekly_high_score')
    })()
  }, [gameState, savedOnce, user?.id, finalScore]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start a round ──────────────────────────────────────────────────────────
  function start() {
    setDeck(newDeck())
    setScore(0)
    setCombo(0)
    setFlips(0)
    setTimeLeft(GAME_DURATION)
    setGameState('running')
    setSavedOnce(false)
    setShowFlash(null)
    setConfetti([])
    selected.current = []
    locked.current = false
  }

  // ── Handle card tap ────────────────────────────────────────────────────────
  function tapCard(idx: number) {
    if (gameState !== 'running') return
    if (locked.current) return
    const card = deck[idx]
    if (card.faceUp || card.matched) return

    // Flip up
    setDeck(prev => prev.map((c, i) => i === idx ? { ...c, faceUp: true } : c))
    setFlips(f => f + 1)
    selected.current = [...selected.current, idx]

    if (selected.current.length === 2) {
      const [a, b] = selected.current
      const ka = deck[a].kind
      const kb = deck[b].kind
      if (ka === kb || (idx === b && deck[a].kind === deck[b].kind)) {
        // MATCH
        const kind = deck[a].kind
        locked.current = true
        setTimeout(() => {
          setDeck(prev => prev.map((c, i) =>
            i === a || i === b ? { ...c, matched: true, wobble: 'match' } : c
          ))
          // combo
          setCombo(prevCombo => {
            const next = prevCombo + 1
            // score = base + combo bonus
            setScore(s => s + MATCH_BASE_POINTS + (next - 1) * COMBO_BONUS_PER)
            // reset combo after window
            if (comboTimer.current) clearTimeout(comboTimer.current)
            comboTimer.current = setTimeout(() => setCombo(0), COMBO_WINDOW_MS)
            return next
          })
          setShowFlash({ id: Date.now(), type: 'match', color: KIND_META[kind].tint })
          setTimeout(() => setShowFlash(null), 700)
          // clear wobble
          setTimeout(() => {
            setDeck(prev => prev.map(c => c.wobble === 'match' ? { ...c, wobble: 'none' } : c))
          }, 600)
          selected.current = []
          locked.current = false
        }, 260)
      } else {
        // MISS
        locked.current = true
        setShowFlash({ id: Date.now(), type: 'miss', color: '#F87171' })
        setTimeout(() => setShowFlash(null), 500)
        setCombo(0)
        setTimeout(() => {
          setDeck(prev => prev.map((c, i) =>
            i === a || i === b
              ? { ...c, faceUp: false, wobble: 'miss' }
              : c
          ))
          setTimeout(() => {
            setDeck(prev => prev.map(c => c.wobble === 'miss' ? { ...c, wobble: 'none' } : c))
          }, 320)
          selected.current = []
          locked.current = false
        }, MISMATCH_FLIP_BACK_MS)
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none"
      style={{
        background: 'linear-gradient(180deg, #1A0A33 0%, #2D1659 45%, #4C1D95 100%)',
        touchAction: 'none',
      }}>

      {/* Star-field background */}
      <div className="absolute inset-0 pointer-events-none opacity-50" style={{
        backgroundImage: 'radial-gradient(circle, #FFD700 1px, transparent 1px), radial-gradient(circle, #A78BFA 1px, transparent 1px)',
        backgroundSize: '30px 30px, 45px 45px',
        backgroundPosition: '0 0, 15px 22px',
        animation: 'starDrift 24s linear infinite',
      }} />

      {/* Header */}
      <div className="absolute top-0 inset-x-0 pt-3 px-3 z-30 flex items-center gap-2">
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.1)', borderRadius: 6, border: '2px solid rgba(167,139,250,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={18} className="text-purple-200" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="font-pixel text-white px-3 py-1.5"
            style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(167,139,250,0.6)', borderRadius: 4, fontSize: 7, letterSpacing: 1.5, textShadow: '1px 1px 0 rgba(0,0,0,0.5)' }}>
            PURR-FECT MEMORY
          </span>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* Score & timer bar */}
      <div className="absolute top-14 inset-x-0 px-3 z-20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 px-2 py-1"
          style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(167,139,250,0.5)', borderRadius: 4, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <IconStar size={12} />
          <span className="font-pixel text-amber-200" style={{ fontSize: 9, textShadow: '1px 1px 0 rgba(0,0,0,0.6)', letterSpacing: 1 }}>{score}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1"
          style={{ background: timeLeft <= 10 ? 'rgba(127,0,0,0.5)' : 'rgba(0,0,0,0.5)',
            border: timeLeft <= 10 ? '2px solid rgba(248,113,113,0.6)' : '2px solid rgba(167,139,250,0.5)',
            borderRadius: 4, boxShadow: '0 2px 0 rgba(0,0,0,0.3)',
            animation: timeLeft <= 10 && gameState === 'running' ? 'timerPulse 0.6s ease-in-out infinite' : 'none' }}>
          <span className="font-pixel" style={{ fontSize: 9, color: timeLeft <= 10 ? '#FFA0A0' : '#C4B5FD', letterSpacing: 1 }}>
            {String(Math.floor(timeLeft / 60)).padStart(1, '0')}:{String(timeLeft % 60).padStart(2, '0')}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1"
          style={{
            background: combo >= 2 ? 'linear-gradient(135deg, rgba(255,100,150,0.45), rgba(255,200,40,0.45))' : 'rgba(0,0,0,0.5)',
            border: combo >= 2 ? '2px solid #FFD700' : '2px solid rgba(167,139,250,0.5)',
            borderRadius: 4,
            boxShadow: combo >= 2 ? '0 2px 0 rgba(0,0,0,0.3), 0 0 8px rgba(255,215,0,0.5)' : '0 2px 0 rgba(0,0,0,0.3)',
            transition: 'all 0.2s ease',
          }}>
          <span className="font-pixel" style={{ fontSize: 8, color: combo >= 2 ? '#FFF8C8' : '#A0A0C8', letterSpacing: 1 }}>
            COMBO x{combo}
          </span>
        </div>
      </div>

      {/* ── Idle intro screen ──────────────────────────────────────────────── */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-30">
          <div className="px-6 py-6 max-w-[320px] text-center relative"
            style={{ background: 'linear-gradient(135deg, rgba(60,20,110,0.92), rgba(30,10,70,0.92))', border: '3px solid #A78BFA', borderRadius: 6, boxShadow: '0 6px 0 #4C1D95, 0 0 18px rgba(167,139,250,0.4)' }}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <IconStar size={16} />
              <p className="font-pixel text-white" style={{ fontSize: 10, letterSpacing: 2 }}>PURR-FECT</p>
              <IconStar size={16} />
            </div>
            <p className="font-pixel text-amber-200 mb-4" style={{ fontSize: 14, letterSpacing: 1 }}>MEMORY</p>

            <div className="flex gap-2 justify-center mb-4 flex-wrap">
              {KINDS.slice(0, 6).map(k => {
                const Icon = KIND_META[k].Icon
                return (
                  <div key={k} style={{
                    width: 28, height: 28,
                    background: 'rgba(255,255,255,0.08)',
                    border: `2px solid ${KIND_META[k].tint}aa`,
                    borderRadius: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} />
                  </div>
                )
              })}
            </div>

            <p className="text-purple-200 text-xs leading-relaxed mb-1">
              Flip two cards at a time. Match all six pairs
              before time runs out. <br />
              <span className="text-amber-300">Consecutive matches chain into combos</span> for bonus points.
            </p>
          </div>

          <button onClick={() => { playSound('ui_tap'); start() }}
            className="px-8 py-3 text-white active:translate-y-[2px] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #EC4899 0%, #C026D3 50%, #9333EA 100%)',
              border: '3px solid #6B21A8',
              borderRadius: 4,
              boxShadow: '0 5px 0 #4C1D95, inset 0 1px 0 rgba(255,255,255,0.35), 0 0 14px rgba(192,38,211,0.6)',
              fontFamily: '"Press Start 2P"', fontSize: 10, letterSpacing: 2,
            }}>
            ▶ START
          </button>
        </div>
      )}

      {/* ── Board ──────────────────────────────────────────────────────────── */}
      {gameState !== 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center pt-24 pb-24 px-4 z-10">
          <div className="grid gap-2.5" style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
            width: '100%', maxWidth: 340, aspectRatio: `${GRID_COLS}/${GRID_ROWS * 1.2}`,
          }}>
            {deck.map((card, i) => {
              const meta = KIND_META[card.kind]
              const showFace = card.faceUp || card.matched
              return (
                <button
                  key={card.id}
                  onClick={() => tapCard(i)}
                  disabled={gameState !== 'running' || card.matched}
                  style={{
                    perspective: 1000,
                    background: 'transparent',
                    position: 'relative',
                    animation: card.wobble === 'miss' ? 'cardShake 0.32s linear' :
                               card.wobble === 'match' ? 'cardPop 0.56s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
                    opacity: card.matched ? 0.88 : 1,
                    transform: card.matched ? 'scale(0.96)' : 'scale(1)',
                    transition: 'opacity 0.2s, transform 0.2s',
                  }}>
                  <div style={{
                    position: 'relative',
                    width: '100%', height: '100%',
                    transformStyle: 'preserve-3d',
                    transform: showFace ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transition: 'transform 0.45s cubic-bezier(0.5, 0, 0.3, 1.4)',
                  }}>
                    {/* Back */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(135deg, #5B21B6 0%, #2E0F5C 100%)',
                      border: '2px solid #9333EA',
                      borderRadius: 6,
                      boxShadow: '0 3px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
                      backfaceVisibility: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {/* Pixel pattern */}
                      <div style={{
                        position: 'absolute', inset: 6,
                        border: '1px dashed rgba(255,255,255,0.22)',
                        borderRadius: 3,
                      }} />
                      <div style={{
                        position: 'absolute', top: 3, left: 3, width: 4, height: 4, background: '#FFD700',
                      }} />
                      <div style={{
                        position: 'absolute', top: 3, right: 3, width: 4, height: 4, background: '#FFD700',
                      }} />
                      <div style={{
                        position: 'absolute', bottom: 3, left: 3, width: 4, height: 4, background: '#FFD700',
                      }} />
                      <div style={{
                        position: 'absolute', bottom: 3, right: 3, width: 4, height: 4, background: '#FFD700',
                      }} />
                      <span className="font-pixel text-white" style={{ fontSize: 16, textShadow: '2px 2px 0 rgba(0,0,0,0.4)' }}>?</span>
                    </div>
                    {/* Front */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `linear-gradient(135deg, ${meta.tint}22 0%, ${meta.tint}44 100%)`,
                      border: `2px solid ${meta.tint}`,
                      borderRadius: 6,
                      boxShadow: card.matched
                        ? `0 3px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.35), 0 0 14px ${meta.glow}`
                        : '0 3px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <meta.Icon size={Math.min(46, 38)} />
                      {card.matched && (
                        <div style={{
                          position: 'absolute', top: 3, right: 3,
                          width: 10, height: 10,
                          background: '#4ADE80', border: '1px solid #15803D',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 2,
                        }}>
                          <span className="font-pixel text-white" style={{ fontSize: 6 }}>✓</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Flash overlay (match / miss) */}
      {showFlash && (
        <div className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: `radial-gradient(ellipse at center, ${showFlash.color}44 0%, transparent 55%)`,
            animation: 'flashFade 0.55s ease-out forwards',
          }} />
      )}

      {/* Footer — flips counter */}
      {gameState === 'running' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1"
          style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(167,139,250,0.4)', borderRadius: 4 }}>
          <span className="font-pixel text-purple-200" style={{ fontSize: 7, letterSpacing: 1 }}>
            FLIPS: {flips} · MATCHES: {matchedCount / 2}/6
          </span>
        </div>
      )}

      {/* Confetti */}
      {confetti.map(p => (
        <div key={p.id} className="absolute z-40 pointer-events-none" style={{
          left: `${p.x}%`, top: `${p.y}%`, width: 6, height: 6,
          background: p.color, borderRadius: 1,
          animation: `confettiFall 2.4s ease-out forwards`,
          ['--dx' as string]: `${p.dx}px`,
          ['--dy' as string]: `${p.dy}px`,
          ['--rot' as string]: `${p.rot}deg`,
        } as React.CSSProperties} />
      ))}

      {/* ── Finish screen ───────────────────────────────────────────────────── */}
      {gameState === 'finished' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 p-6"
          style={{ background: 'rgba(15,5,35,0.82)', backdropFilter: 'blur(4px)' }}>
          <div className="px-6 py-6 max-w-[340px] w-full text-center relative"
            style={{ background: 'linear-gradient(180deg, #2D1659 0%, #180736 100%)', border: '3px solid #A78BFA', borderRadius: 6, boxShadow: '0 6px 0 #4C1D95, 0 0 24px rgba(167,139,250,0.5)' }}>
            <div className="flex justify-center mb-3">
              <IconCrown size={28} />
            </div>
            <p className="font-pixel text-amber-300 mb-1" style={{ fontSize: 9, letterSpacing: 2 }}>
              {matchedCount === deck.length ? 'PURR-FECT!' : 'TIME UP'}
            </p>
            <p className="font-pixel text-white mb-4" style={{ fontSize: 28, textShadow: '2px 2px 0 #4C1D95' }}>
              {finalScore}
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs mb-4">
              <div className="px-2 py-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 3 }}>
                <p className="font-pixel text-purple-300" style={{ fontSize: 5, letterSpacing: 1 }}>MATCHES</p>
                <p className="font-pixel text-white mt-1" style={{ fontSize: 10 }}>{matchedCount / 2}/6</p>
              </div>
              <div className="px-2 py-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 3 }}>
                <p className="font-pixel text-purple-300" style={{ fontSize: 5, letterSpacing: 1 }}>FLIPS</p>
                <p className="font-pixel text-white mt-1" style={{ fontSize: 10 }}>{flips}</p>
              </div>
              <div className="px-2 py-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 3 }}>
                <p className="font-pixel text-purple-300" style={{ fontSize: 5, letterSpacing: 1 }}>TIME</p>
                <p className="font-pixel text-white mt-1" style={{ fontSize: 10 }}>{GAME_DURATION - timeLeft}s</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 mb-4" style={{ color: '#FFD760' }}>
              <IconCoin size={14} />
              <span className="font-pixel" style={{ fontSize: 8, textShadow: '1px 1px 0 rgba(0,0,0,0.5)' }}>+{Math.min(30, Math.floor(finalScore / 8))} coins</span>
            </div>

            <div className="flex gap-2 justify-center">
              <button onClick={() => { playSound('ui_tap'); start() }}
                className="flex items-center gap-1.5 px-4 py-2 text-white active:translate-y-[2px] transition-transform"
                style={{ background: 'linear-gradient(135deg, #A78BFA, #7C3AED)', border: '2px solid #5B21B6', borderRadius: 3, boxShadow: '0 3px 0 #4C1D95', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                <RefreshCw size={12} />
                AGAIN
              </button>
              <button onClick={() => { playSound('ui_back'); router.push('/games') }}
                className="px-4 py-2 text-white active:translate-y-[2px] transition-transform"
                style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(167,139,250,0.5)', borderRadius: 3, boxShadow: '0 3px 0 rgba(0,0,0,0.3)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                BACK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style jsx>{`
        @keyframes starDrift {
          from { background-position: 0 0, 15px 22px; }
          to   { background-position: 120px 0, 135px 22px; }
        }
        @keyframes cardShake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-4px); }
          50%      { transform: translateX(4px); }
          75%      { transform: translateX(-3px); }
        }
        @keyframes cardPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes flashFade {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes timerPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.05); }
        }
        @keyframes confettiFall {
          0%   { transform: translate(-50%, -50%) rotate(0deg); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + 320px)) rotate(var(--rot)); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
