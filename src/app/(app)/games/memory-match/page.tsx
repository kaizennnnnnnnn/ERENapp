'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  GameTopBar, GameStatRow, GameStat, GAME_BOARD_TOP, GAME_STAT_URGENT,
  GameFootnote, GameStartCard, GameArtTile, GameResultCard,
} from '@/components/games/GameChrome'
import { FONT_ROUNDED, GAME_TINT, M, MeadowIcon, RADIUS, TINT } from '@/components/meadow'
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
  label: string
  tint: string
  ink: string
}> = {
  yarn:  { Icon: IconYarn,  label: 'Yarn',  tint: TINT.love,  ink: M.love },
  fish:  { Icon: IconFish,  label: 'Fish',  tint: TINT.blue,  ink: M.text2 },
  paw:   { Icon: IconPaw,   label: 'Paw',   tint: TINT.leaf,  ink: M.leaf },
  mouse: { Icon: IconMouse, label: 'Mouse', tint: TINT.lilac, ink: M.text2 },
  heart: { Icon: IconHeart, label: 'Heart', tint: TINT.love,  ink: M.love },
  star:  { Icon: IconStar,  label: 'Star',  tint: TINT.amber, ink: M.coin },
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
        const colors = [M.love, M.leaf, M.coin, M.tuft, M.loveLight, M.energy]
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
        const tint = KIND_META[kind].ink
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
        setCombo(0)
        playSound('mm_miss')
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
    <div className="meadow-root memory-game fixed inset-0 z-40 overflow-hidden select-none game-shell"
      style={{
        background: GAME_TINT.memory_match,
        fontFamily: FONT_ROUNDED,
        color: M.text,
        touchAction: 'manipulation',
      }}>

      {/* Header + stats — the shared Meadow game chrome. */}
      <GameTopBar title="Purr-fect Memory" onBack={() => { playSound('ui_back'); router.push('/games') }} />

      <GameStatRow style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <GameStat icon={<MeadowIcon name="star" size={18} />} value={score}
          pulse={scorePulseKey} ariaLabel={`Score ${score}`} style={{ justifyContent: 'center', padding: '0 8px' }} />
        <GameStat
          icon={<MeadowIcon name="clock" size={18} />}
          value={`${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`}
          tone={timeLeft <= 10 ? 'warn' : 'plain'}
          ariaLabel={`${timeLeft} seconds left`}
          style={{ justifyContent: 'center', padding: '0 8px',
            ...(!reduced && timeLeft <= 10 && gameState === 'running' ? GAME_STAT_URGENT : {}) }}
        />
        <GameStat label="Combo" value={`×${combo}`} tone={combo >= 2 ? 'hot' : 'plain'} pulse={comboPulseKey}
          style={{ justifyContent: 'center', padding: '0 8px' }} />
      </GameStatRow>

      {/* ── Idle intro screen ──────────────────────────────────────────────── */}
      {gameState === 'idle' && (
        <GameStartCard
          title="Purr-fect Memory"
          art={KINDS.slice(0, 6).map(k => {
            const Icon = KIND_META[k].Icon
            return <GameArtTile key={k} size={38} tint={KIND_META[k].tint}><Icon size={22} /></GameArtTile>
          })}
          onStart={() => { playSound('ui_tap'); start() }}
          style={{ top: GAME_BOARD_TOP, paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)', overflowY: 'auto' }}
        >
          Flip two cards at a time and match all six pairs before time runs out.
          Matches in a row chain into combos for bonus points.
        </GameStartCard>
      )}

      {/* ── Board ──────────────────────────────────────────────────────────── */}
      {gameState !== 'idle' && (
        <div className="absolute inset-x-0 flex items-center justify-center z-10" style={{
          top: `calc(${GAME_BOARD_TOP} + 16px)`,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          margin: '0 18px', containerType: 'size',
        }}>
          <div
            ref={boardRef}
            className="memory-board grid gap-2.5 relative"
            role="group"
            aria-label="Memory cards"
            style={{
              gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
              width: 'min(100cqw, 75cqh, 348px)', aspectRatio: `${GRID_COLS}/${GRID_ROWS}`,
          }}>
            {deck.map((card, i) => {
              const meta = KIND_META[card.kind]
              const showFace = card.faceUp || card.matched
              return (
                <button
                  type="button"
                  key={card.id}
                  className="memory-card m-focus"
                  ref={el => { cardRefs.current[i] = el }}
                  onClick={() => tapCard(i)}
                  disabled={gameState !== 'running' || card.matched}
                  aria-label={`Card ${i + 1}, ${card.matched ? `${meta.label}, matched` : showFace ? meta.label : 'face down'}`}
                  aria-pressed={showFace}
                  style={{
                    perspective: 1000,
                    background: 'transparent',
                    border: 0, padding: 0, minWidth: 0, minHeight: 0,
                    borderRadius: RADIUS.tile,
                    position: 'relative',
                    cursor: gameState === 'running' && !card.matched ? 'pointer' : 'default',
                    animation: reduced ? 'none' : card.wobble === 'miss' ? 'mmCardShake 0.32s linear' :
                               card.wobble === 'match' ? 'mmCardPop 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
                  }}>
                  <div className="memory-card-turn" aria-hidden="true" style={{
                    position: 'relative',
                    width: '100%', height: '100%',
                    transformStyle: 'preserve-3d',
                    transform: showFace ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transition: reduced ? 'none' : 'transform 0.32s cubic-bezier(0.2, 0.7, 0.3, 1)',
                  }}>
                    {/* Back */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: M.ground,
                      borderRadius: RADIUS.tile,
                      boxShadow: `0 4px 0 ${M.groundLip}`,
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="flex items-center justify-center" style={{
                        width: '54%', aspectRatio: '1', maxWidth: 56,
                        borderRadius: '50%', background: TINT.love,
                      }}>
                        <MeadowIcon name="paw" size={28} color={M.love} mono />
                      </span>
                    </div>
                    {/* Front */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: meta.tint,
                      border: `2px solid ${card.matched ? M.leaf : M.ground}`,
                      borderRadius: RADIUS.tile,
                      boxShadow: `0 4px 0 ${card.matched ? M.leafLip : M.groundLip}`,
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      <span className="memory-card-icon"><meta.Icon size={38} /></span>
                      {card.matched && (
                        <span style={{
                          position: 'absolute', top: 6, right: 6,
                          width: 18, height: 18, borderRadius: '50%',
                          background: M.leaf,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <MeadowIcon name="check" size={12} color={M.ground} mono />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Floating "+N" / "+N xK!" score popups anchored to matched cards */}
            {scorePops.map(p => (
              <div key={p.id} className="memory-score-pop absolute pointer-events-none" style={{
                left: `${p.x}%`, top: `${p.y}%`,
                transform: 'translate(-50%, -50%)',
                color: M.leafInk, background: M.ground,
                padding: '5px 10px', borderRadius: RADIUS.pill,
                boxShadow: `0 3px 0 ${M.groundLip}`,
                fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap',
                animation: reduced ? 'none' : 'mmScorePopRise 0.6s ease-out forwards',
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
                borderRadius: 2,
                animation: 'mmMiniBurst 0.7s cubic-bezier(0.2,0.7,0.4,1) forwards',
                ['--bx' as string]: `${p.dx}px`,
                ['--by' as string]: `${p.dy}px`,
                zIndex: 24,
              } as React.CSSProperties} />
            ))}
          </div>
        </div>
      )}

      {/* Footer — flips counter */}
      {gameState === 'running' && (
        <GameFootnote style={{ height: 40, gap: 12 }}>
          <span role="status" aria-label={`${matchedCount / 2} of ${KINDS.length} pairs matched`}>
            Pairs {matchedCount / 2}/{KINDS.length}
          </span>
          <span aria-hidden="true" className="flex" style={{ gap: 4 }}>
            {KINDS.map((kind, i) => (
              <span key={kind} style={{ width: 7, height: 7, borderRadius: '50%',
                background: i < matchedCount / 2 ? M.leaf : M.track }} />
            ))}
          </span>
          <span>Flips {flips}</span>
        </GameFootnote>
      )}

      {/* Confetti */}
      {confetti.map(p => (
        <div key={p.id} className="absolute pointer-events-none" style={{ zIndex: 60,
          left: `${p.x}%`, top: `${p.y}%`, width: 6, height: 6,
          background: p.color, borderRadius: 1,
          animation: 'mmConfettiFall 2.4s ease-out forwards',
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
          scoreLabel="points"
          stats={[
            { label: 'Pairs', value: `${matchedCount / 2}/6` },
            { label: 'Flips', value: flips },
            { label: 'Time', value: `${GAME_DURATION - timeLeft}s` },
          ]}
          reward={reward && <GameCoinReward coins={reward.coins} blocked={reward.blocked} />}
          onAgain={() => { playSound('ui_tap'); start() }}
          onBack={() => { playSound('ui_back'); router.push('/games') }}
        />
      )}

      {/* Styles */}
      <style>{`
        @keyframes mmCardShake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-4px); }
          50%      { transform: translateX(4px); }
          75%      { transform: translateX(-3px); }
        }
        @keyframes mmCardPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes mmConfettiFall {
          0%   { transform: translate(-50%, -50%) rotate(0deg); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + 320px)) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes mmScorePopRise {
          0%   { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
          15%  { transform: translate(-50%, -55%) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, calc(-50% - 40px)) scale(1); opacity: 0; }
        }
        @keyframes mmMiniBurst {
          0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--bx)), calc(-50% + var(--by))) scale(0.4); opacity: 0; }
        }
        @container (max-height: 300px) {
          .memory-card-icon { transform: scale(0.75); }
        }
        @media (prefers-reduced-motion: reduce) {
          .memory-game *, .memory-game *::before, .memory-game *::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  )
}
