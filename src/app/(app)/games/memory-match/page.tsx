'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useGameTimers } from '@/hooks/useGameTimers'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import GameCoinReward from '@/components/games/GameCoinReward'
import {
  IconYarn, IconFish, IconPaw, IconMouse, IconHeart, IconStar,
} from '@/components/PixelIcons'
import {
  GameTopBar, GameStatRow, GameStat, GAME_STAT_URGENT, GameFootnote, GameStartCard, GameArtTile, GameResultCard,
} from '@/components/games/GameChrome'
import { MeadowIcon } from '@/components/meadow'
import { fireMinigameDone } from '@/lib/minigames'
import { playSound } from '@/lib/sounds'

// ── Game config ──────────────────────────────────────────────────────────────
const GAME_DURATION = 60 // seconds
const GRID_COLS = 3
const GRID_ROWS = 4        // 12 cards = 6 pairs
const MISMATCH_FLIP_BACK_MS = 1000  // hold the reveal ~1s so a mismatch registers
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
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const timers = useGameTimers()
  const reduced = useReducedMotion()

  const [deck, setDeck] = useState<Card[]>(() => newDeck())
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0) // consecutive matches
  const [flips, setFlips] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [gameState, setGameState] = useState<'idle' | 'running' | 'finished'>('idle')
  const [showFlash, setShowFlash] = useState<{ id: number; type: 'match' | 'miss'; color: string } | null>(null)
  const [savedOnce, setSavedOnce] = useState(false)
  const [reward, setReward] = useState<GameRewardResult | null>(null)
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; y: number; color: string; dx: number; dy: number; rot: number }>>([])
  // Floating score popups anchored to the matched card midpoint (board %)
  const [scorePops, setScorePops] = useState<Array<{ id: number; x: number; y: number; color: string; text: string }>>([])
  // Per-match small particle bursts (sparkles in matched-kind tint)
  const [miniBursts, setMiniBursts] = useState<Array<{ id: number; x: number; y: number; color: string; dx: number; dy: number }>>([])
  // Score pulse trigger — increments to retrigger the keyframe animation
  const [scorePulseKey, setScorePulseKey] = useState(0)
  // Combo HUD pulse trigger
  const [comboPulseKey, setComboPulseKey] = useState(0)
  // Board shake on miss
  const [boardShakeKey, setBoardShakeKey] = useState(0)
  // Red vignette flash on miss
  const [vignetteKey, setVignetteKey] = useState(0)
  // One-shot timer warning trigger
  const [warnedTimer, setWarnedTimer] = useState(false)

  const selected = useRef<number[]>([])
  const locked   = useRef(false)
  const comboTimer = useRef<number | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const popIdRef = useRef(0)
  const burstIdRef = useRef(0)

  // ── Game timer ─────────────────────────────────────────────────────────────
  // The clock freezes while the tab is backgrounded (notification / app-switch)
  // so a 60s round can't drain — or hit 0 — unseen. setInterval is suspended
  // on mobile background anyway; the document.hidden guard covers desktop tabs.
  useEffect(() => {
    if (gameState !== 'running') return
    const interval = setInterval(() => {
      if (document.hidden) return
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

  // ── Timer warning one-shot at 10s ──────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'running' && timeLeft === 10 && !warnedTimer) {
      setWarnedTimer(true)
      playSound('mm_timer_warn')
    }
  }, [timeLeft, gameState, warnedTimer])

  // ── Check for all-matched ──────────────────────────────────────────────────
  const matchedCount = deck.filter(c => c.matched).length
  useEffect(() => {
    if (gameState === 'running' && matchedCount === deck.length) {
      // All pairs matched — finish
      setGameState('finished')
      playSound('mm_purrfect')
      // Small confetti burst — pure spectacle, skipped under reduced motion
      if (!reduced) {
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
        timers.setTimeout(() => setConfetti([]), 2800)
      }
    }
  }, [matchedCount, deck.length, gameState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Compute final score ────────────────────────────────────────────────────
  const finalScore = useMemo(() => {
    if (gameState !== 'finished') return score
    return score + (matchedCount === deck.length ? timeLeft * TIME_BONUS_PER_SEC : 0)
  }, [gameState, score, timeLeft, matchedCount, deck.length])

  // ── Save finished score ────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'finished' || savedOnce || !user?.id) return
    setSavedOnce(true)
    setReward(reportGameResult({ gameType: 'memory_match', score: finalScore }))
    ;(async () => {
      fireMinigameDone('memory_match', finalScore)
      await applyAction(user.id, 'play')
      completeTask('daily_game')
      if (finalScore >= 30) completeTask('weekly_high_score')
    })()
  }, [gameState, savedOnce, user?.id, finalScore]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start a round ──────────────────────────────────────────────────────────
  function start() {
    // Flush any timers still pending from the previous round so a stale
    // match-resolve / flip-back / combo-reset can't fire into the fresh deck.
    timers.clearAll()
    comboTimer.current = null
    setDeck(newDeck())
    setScore(0)
    setCombo(0)
    setFlips(0)
    setTimeLeft(GAME_DURATION)
    setGameState('running')
    setSavedOnce(false)
    setReward(null)
    setShowFlash(null)
    setConfetti([])
    setScorePops([])
    setMiniBursts([])
    setWarnedTimer(false)
    selected.current = []
    locked.current = false
  }

  // ── Compute the matched-card midpoint relative to the board container ─────
  function cardMidpoint(idxA: number, idxB: number): { x: number; y: number } {
    const board = boardRef.current
    const a = cardRefs.current[idxA]
    const b = cardRefs.current[idxB]
    if (!board || !a || !b) return { x: 50, y: 50 }
    const br = board.getBoundingClientRect()
    const ar = a.getBoundingClientRect()
    const bbr = b.getBoundingClientRect()
    const mx = (ar.left + ar.width / 2 + bbr.left + bbr.width / 2) / 2
    const my = (ar.top + ar.height / 2 + bbr.top + bbr.height / 2) / 2
    return {
      x: ((mx - br.left) / br.width) * 100,
      y: ((my - br.top) / br.height) * 100,
    }
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
    playSound('mm_card_flip')
    selected.current = [...selected.current, idx]

    if (selected.current.length === 2) {
      const [a, b] = selected.current
      const ka = deck[a].kind
      const kb = deck[b].kind
      if (ka === kb) {
        // MATCH
        const kind = deck[a].kind
        const tint = KIND_META[kind].tint
        locked.current = true
        timers.setTimeout(() => {
          setDeck(prev => prev.map((c, i) =>
            i === a || i === b ? { ...c, matched: true, wobble: 'match' } : c
          ))
          // combo
          setCombo(prevCombo => {
            const next = prevCombo + 1
            const gained = MATCH_BASE_POINTS + (next - 1) * COMBO_BONUS_PER
            // score = base + combo bonus
            setScore(s => s + gained)
            setScorePulseKey(k => k + 1)
            // Sound: combo vs first match
            if (next >= 2) {
              playSound('mm_combo')
              setComboPulseKey(k => k + 1)
            } else {
              playSound('mm_match')
            }
            // Floating score popup at matched-card midpoint
            const mid = cardMidpoint(a, b)
            const popId = ++popIdRef.current
            const text = next >= 2 ? `+${gained} x${next}!` : `+${gained}`
            setScorePops(prev => [...prev, { id: popId, x: mid.x, y: mid.y, color: tint, text }])
            timers.setTimeout(() => setScorePops(prev => prev.filter(p => p.id !== popId)), 700)
            // Per-match mini sparkle burst (6 pixels in tint) — spectacle, skipped under reduced motion
            if (!reduced) {
              const newBursts: Array<{ id: number; x: number; y: number; color: string; dx: number; dy: number }> = []
              for (let s = 0; s < 6; s++) {
                const angle = (Math.PI * 2 * s) / 6 + Math.random() * 0.5
                const r = 30 + Math.random() * 18
                newBursts.push({
                  id: ++burstIdRef.current,
                  x: mid.x, y: mid.y,
                  color: tint,
                  dx: Math.cos(angle) * r,
                  dy: Math.sin(angle) * r,
                })
              }
              setMiniBursts(prev => [...prev, ...newBursts])
              const burstIds = newBursts.map(p => p.id)
              timers.setTimeout(() => setMiniBursts(prev => prev.filter(p => !burstIds.includes(p.id))), 750)
            }
            // reset combo after window
            if (comboTimer.current != null) timers.clearTimeout(comboTimer.current)
            comboTimer.current = timers.setTimeout(() => setCombo(0), COMBO_WINDOW_MS)
            return next
          })
          setShowFlash({ id: Date.now(), type: 'match', color: tint })
          timers.setTimeout(() => setShowFlash(null), 700)
          // clear wobble
          timers.setTimeout(() => {
            setDeck(prev => prev.map(c => c.wobble === 'match' ? { ...c, wobble: 'none' } : c))
          }, 600)
          selected.current = []
          locked.current = false
        }, 260)
      } else {
        // MISS
        locked.current = true
        setShowFlash({ id: Date.now(), type: 'miss', color: '#F87171' })
        timers.setTimeout(() => setShowFlash(null), 500)
        setCombo(0)
        playSound('mm_miss')
        // Board shake + red vignette flash are pure feedback spectacle — skip under reduced motion
        if (!reduced) {
          setBoardShakeKey(k => k + 1)
          setVignetteKey(k => k + 1)
        }
        timers.setTimeout(() => {
          setDeck(prev => prev.map((c, i) =>
            i === a || i === b
              ? { ...c, faceUp: false, wobble: 'miss' }
              : c
          ))
          timers.setTimeout(() => {
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
    <div className="fixed inset-0 z-40 overflow-hidden select-none game-shell"
      style={{
        background: 'linear-gradient(180deg, #1A0A33 0%, #2D1659 45%, #4C1D95 100%)',
        touchAction: 'none',
      }}>

      {/* Star-field background — speeds up + brightens at combo>=3 (you're on fire) */}
      <div className="absolute inset-y-0 right-0 pointer-events-none" style={{
        left: -180,
        backgroundImage: 'radial-gradient(circle, #FFD700 1px, transparent 1px), radial-gradient(circle, #A78BFA 1px, transparent 1px)',
        backgroundSize: '30px 30px, 45px 45px',
        backgroundPosition: '0 0, 15px 22px',
        animation: reduced ? 'none' : `starDrift ${combo >= 3 ? '10s' : '24s'} linear infinite`,
        opacity: combo >= 3 ? 0.85 : 0.5,
        transition: 'opacity 0.4s ease',
      }} />

      {/* Header + stats — the shared Meadow game chrome. */}
      <GameTopBar title="Purr-fect Memory" onBack={() => { playSound('ui_back'); router.back() }} />

      <GameStatRow>
        <GameStat icon={<IconStar size={16} />} value={score} pulse={scorePulseKey} ariaLabel={`Score ${score}`} />
        <GameStat
          icon={<MeadowIcon name="clock" size={18} />}
          value={`${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
          tone={timeLeft <= 10 ? 'warn' : 'plain'}
          style={!reduced && timeLeft <= 10 && gameState === 'running' ? GAME_STAT_URGENT : undefined}
        />
        <GameStat label="Combo" value={`×${combo}`} tone={combo >= 2 ? 'hot' : 'plain'} pulse={comboPulseKey} />
      </GameStatRow>

      {/* ── Idle intro screen ──────────────────────────────────────────────── */}
      {gameState === 'idle' && (
        <GameStartCard
          title="Purr-fect Memory"
          art={KINDS.slice(0, 6).map(k => {
            const Icon = KIND_META[k].Icon
            return <GameArtTile key={k} size={38} tint={`${KIND_META[k].tint}26`}><Icon size={22} /></GameArtTile>
          })}
          onStart={() => { playSound('ui_tap'); start() }}
        >
          Flip two cards at a time and match all six pairs before time runs out.
          Matches in a row chain into combos for bonus points.
        </GameStartCard>
      )}

      {/* ── Board ──────────────────────────────────────────────────────────── */}
      {gameState !== 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center pt-24 pb-24 px-4 z-10">
          <div
            ref={boardRef}
            key={`board-${boardShakeKey}`}
            className="grid gap-2.5 relative"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
              width: '100%', maxWidth: 340, aspectRatio: `${GRID_COLS}/${GRID_ROWS * 1.2}`,
              animation: boardShakeKey > 0 ? 'boardJitter 0.22s linear' : 'none',
          }}>
            {deck.map((card, i) => {
              const meta = KIND_META[card.kind]
              const showFace = card.faceUp || card.matched
              return (
                <button
                  key={card.id}
                  ref={el => { cardRefs.current[i] = el }}
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
                      overflow: 'hidden',
                    }}>
                      {/* Diagonal gloss that sweeps once across the card on the
                          flip reveal, then is gone. `forwards` holds the final
                          (opacity 0, off-screen) keyframe so it can never linger
                          as a static white streak the way the old 3px line did. */}
                      {showFace && !card.matched && (
                        <span aria-hidden className="card-shine" style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%)',
                          transform: 'translateX(-100%)',
                          animation: 'cardShine 0.5s ease-out forwards',
                          pointerEvents: 'none',
                        }} />
                      )}
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

            {/* Floating "+N" / "+N xK!" score popups anchored to matched cards */}
            {scorePops.map(p => (
              <div key={p.id} className="absolute pointer-events-none font-pixel" style={{
                left: `${p.x}%`, top: `${p.y}%`,
                transform: 'translate(-50%, -50%)',
                color: p.color,
                fontSize: 10,
                letterSpacing: 1,
                textShadow: '1px 1px 0 rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.5)',
                animation: 'scorePopRise 0.6s ease-out forwards',
                zIndex: 25,
              }}>
                {p.text}
              </div>
            ))}

            {/* Per-match sparkle bursts in the matched-kind tint */}
            {miniBursts.map(p => (
              <div key={p.id} className="absolute pointer-events-none" style={{
                left: `${p.x}%`, top: `${p.y}%`,
                width: 4, height: 4,
                background: p.color,
                imageRendering: 'pixelated',
                boxShadow: `0 0 0 1px rgba(0,0,0,0.4)`,
                animation: 'miniBurst 0.7s cubic-bezier(0.2,0.7,0.4,1) forwards',
                ['--bx' as string]: `${p.dx}px`,
                ['--by' as string]: `${p.dy}px`,
                zIndex: 24,
              } as React.CSSProperties} />
            ))}
          </div>
        </div>
      )}

      {/* Red vignette flash on miss — outer-edge only */}
      {vignetteKey > 0 && (
        <div key={`vig-${vignetteKey}`} className="absolute inset-0 pointer-events-none z-20" style={{
          boxShadow: 'inset 0 0 60px 12px rgba(220,38,38,0.55)',
          animation: 'vignetteFlash 0.32s ease-out forwards',
        }} />
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
        <GameFootnote>Flips {flips} · Pairs {matchedCount / 2}/6</GameFootnote>
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
        <GameResultCard
          headline={matchedCount === deck.length ? 'Purr-fect!' : "Time's up"}
          score={finalScore}
          stats={[
            { label: 'Pairs', value: `${matchedCount / 2}/6` },
            { label: 'Flips', value: flips },
            { label: 'Time', value: `${GAME_DURATION - timeLeft}s` },
          ]}
          reward={reward && <GameCoinReward coins={reward.coins} blocked={reward.blocked} />}
          onAgain={() => { playSound('ui_tap'); start() }}
          onBack={() => { playSound('ui_back'); router.back() }}
        />
      )}

      {/* Styles */}
      <style jsx>{`
        @keyframes starDrift {
          from { transform: translateX(0); }
          to   { transform: translateX(120px); }
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
        @keyframes confettiFall {
          0%   { transform: translate(-50%, -50%) rotate(0deg); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + 320px)) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes boardJitter {
          0%, 100% { transform: translate(0, 0); }
          20%      { transform: translate(-2px, 1px); }
          40%      { transform: translate(2px, -1px); }
          60%      { transform: translate(-2px, -1px); }
          80%      { transform: translate(2px, 1px); }
        }
        @keyframes vignetteFlash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes cardShine {
          0%   { transform: translateX(-100%); opacity: 0; }
          18%  { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        @keyframes scorePopRise {
          0%   { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
          15%  { transform: translate(-50%, -55%) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, calc(-50% - 40px)) scale(1); opacity: 0; }
        }
        @keyframes miniBurst {
          0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--bx)), calc(-50% + var(--by))) scale(0.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
