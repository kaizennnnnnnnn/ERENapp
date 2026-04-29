'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { playSound } from '@/lib/sounds'

// X = player, O = Eren
type Cell = 'X' | 'O' | null
type Status = 'playing' | 'won' | 'lost' | 'draw'

const WIN_LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
]

function checkWin(board: Cell[]): { winner: 'X' | 'O' | null; line: number[] | null } {
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as 'X' | 'O', line }
    }
  }
  return { winner: null, line: null }
}

function isFull(board: Cell[]): boolean {
  return board.every(c => c !== null)
}

// ─── Minimax — Eren plays O and tries to win, falling back to draw ──────────
// Depth-aware so Eren prefers faster wins / slower losses; this also lets him
// pick the most aggressive move when several have equal terminal value.
function minimax(board: Cell[], current: 'X' | 'O', depth = 0): { score: number; move: number } {
  const { winner } = checkWin(board)
  if (winner === 'O') return { score: 10 - depth, move: -1 }
  if (winner === 'X') return { score: depth - 10, move: -1 }
  if (isFull(board)) return { score: 0, move: -1 }

  const isMax = current === 'O'
  let best = { score: isMax ? -Infinity : Infinity, move: -1 }

  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue
    const next = board.slice()
    next[i] = current
    const opp: 'X' | 'O' = current === 'X' ? 'O' : 'X'
    const { score } = minimax(next, opp, depth + 1)
    if (isMax ? score > best.score : score < best.score) {
      best = { score, move: i }
    }
  }
  return best
}

export default function TicTacToePage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const [board, setBoard]   = useState<Cell[]>(() => Array(9).fill(null))
  const [turn, setTurn]     = useState<'X' | 'O'>('X')
  const [status, setStatus] = useState<Status>('playing')
  const [winLine, setWinLine] = useState<number[] | null>(null)
  const [thinking, setThinking] = useState(false)
  const [thinkText, setThinkText] = useState('hmm…')
  const [wins, setWins]     = useState(0)
  const [losses, setLosses] = useState(0)
  const [draws, setDraws]   = useState(0)
  // Easter-egg state — the energy can sitting next to Eren. Once a match,
  // the player can tap it to knock it over; while it's spilled Eren is
  // distracted and picks a random move instead of running minimax. Resets
  // each new match so it's a one-shot tactical option per round.
  const [canKnocked, setCanKnocked] = useState(false)
  const matchSavedRef = useRef(false)

  // ─── Player move ────────────────────────────────────────────────────────────
  function handleCellClick(i: number) {
    if (status !== 'playing' || turn !== 'X' || thinking || board[i] !== null) return
    playSound('ui_tap')
    const next = board.slice()
    next[i] = 'X'
    setBoard(next)

    const { winner, line } = checkWin(next)
    if (winner === 'X') {
      finishMatch('won', line, next)
      return
    }
    if (isFull(next)) { finishMatch('draw', null, next); return }
    setTurn('O')
  }

  // ─── Eren's turn ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (turn !== 'O' || status !== 'playing') return
    setThinking(true)

    // Two phrase pools — focused vs distracted. When the energy can is
    // spilled Eren mutters about the mess instead of his usual catty
    // strategy chatter, which is the visual cue that he's about to misplay.
    const focusedSets = [
      ['purr…',        'i see it…',  'got it!'],
      ['*tail flick*', 'tricky…',    'pounce!'],
      ['hmm purr',     'mrrp…',      'paw it!'],
      ['watch this',   '*ears up*',  'nya~'],
      ['sniff…',       'aha!',       'this one'],
      ['*licks paw*',  'meow?',      'gotcha'],
    ]
    const distractedSets = [
      ['spilllll…',     'where was i?', 'uhh…'],
      ['*sniffs spill*','huh?',          '…oops'],
      ['my drink!',     '*paws at it*', 'nooo'],
      ['oh no',         '*confused*',    'whatever'],
    ]
    const phrases = (canKnocked ? distractedSets : focusedSets)[
      Math.floor(Math.random() * (canKnocked ? distractedSets.length : focusedSets.length))
    ]
    let pi = 0
    setThinkText(phrases[0])
    const phraseTick = setInterval(() => {
      pi = (pi + 1) % phrases.length
      setThinkText(phrases[pi])
    }, 320)

    const t = setTimeout(() => {
      clearInterval(phraseTick)
      let move: number
      if (canKnocked) {
        // Distracted — pick a random empty cell instead of running minimax.
        // Player wins because Eren stops blocking + stops attacking.
        const empties: number[] = []
        board.forEach((c, i) => { if (c === null) empties.push(i) })
        move = empties.length > 0 ? empties[Math.floor(Math.random() * empties.length)] : -1
      } else {
        move = minimax(board, 'O').move
      }
      if (move < 0) { setThinking(false); return }
      const next = board.slice()
      next[move] = 'O'
      setBoard(next)
      setThinking(false)
      playSound('ui_modal_close')

      const { winner, line } = checkWin(next)
      if (winner === 'O') { finishMatch('lost', line, next); return }
      if (isFull(next))   { finishMatch('draw', null, next); return }
      setTurn('X')
    }, 950)

    return () => { clearInterval(phraseTick); clearTimeout(t) }
  }, [turn, status, board, canKnocked])

  // ─── Match end ──────────────────────────────────────────────────────────────
  function finishMatch(result: Exclude<Status, 'playing'>, line: number[] | null, finalBoard: Cell[]) {
    setStatus(result)
    setWinLine(line)

    if (result === 'won')  setWins(w => w + 1)
    if (result === 'lost') setLosses(l => l + 1)
    if (result === 'draw') setDraws(d => d + 1)

    if (result === 'won' && user?.id && !matchSavedRef.current) {
      matchSavedRef.current = true
      const newWins = wins + 1
      // Score = running win streak in this session; the leaderboard's MAX
      // surfaces the player's best streak.
      supabase.from('game_scores').insert({ user_id: user.id, game_type: 'tic_tac_toe', score: newWins })
        .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('ttt score save error:', error) })
      addCoins(8)
      completeTask('daily_game')
      if (newWins >= 5) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }

    // Suppress unused for the linter when running through draw/lost branch
    void finalBoard
  }

  function newMatch() {
    setBoard(Array(9).fill(null))
    setTurn('X')
    setStatus('playing')
    setWinLine(null)
    setThinking(false)
    setCanKnocked(false)   // reset the easter egg — one knock per match
    matchSavedRef.current = false
  }

  function knockCan() {
    if (canKnocked || status !== 'playing') return
    setCanKnocked(true)
    playSound('ui_back')   // glug/spill cue
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{
      background: 'radial-gradient(ellipse at top, #2D1659 0%, #1A0A33 55%, #0F0620 100%)',
    }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(12,6,26,0.95) 0%, rgba(12,6,26,0.6) 100%)',
        borderBottom: '2px solid rgba(167,139,250,0.3)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', borderRadius: 6, border: '2px solid rgba(167,139,250,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={16} className="text-purple-200" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #DB2777, #EC4899)', border: '2px solid #831843', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          X &amp; O VS EREN
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 4, fontSize: 7 }}>
          <span style={{ color: '#FF9EC8' }}>{wins}W</span>
          <span style={{ color: '#9CA3AF' }}>·</span>
          <span style={{ color: '#A78BFA' }}>{losses}L</span>
          <span style={{ color: '#9CA3AF' }}>·</span>
          <span style={{ color: '#FDE68A' }}>{draws}D</span>
        </div>
      </div>

      {/* Can + Eren + thought bubble — order matters now: the can sits to the
          LEFT of Eren so the bubble's left-pointing tail unambiguously points
          at Eren's face, not at the can. When the can spills Eren leans left
          and starts licking the puddle. */}
      <div className="flex items-end justify-center gap-3 pt-4 px-4 flex-shrink-0">
        {/* Energy can — bigger, more presence. Tap once per match to spill it.
            Subtle wobble hint while standing tells the player it's tappable. */}
        <button onClick={knockCan}
          disabled={canKnocked || status !== 'playing'}
          aria-label={canKnocked ? 'Spilled energy drink' : 'Knock over the energy drink'}
          className="active:scale-90 transition-transform"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            marginBottom: -2,
            cursor: canKnocked || status !== 'playing' ? 'default' : 'pointer',
            animation: !canKnocked && status === 'playing' ? 'tttCanWobble 2.6s ease-in-out infinite' : undefined,
          }}>
          <CanSprite knocked={canKnocked} />
        </button>
        {/* Eren — leans toward the spill when the can is knocked, with a
            tongue licking the puddle on a loop. */}
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          <div style={{
            transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)',
            transform: canKnocked
              ? 'rotate(-22deg) translate(-10px, 6px)'
              : 'rotate(0) translate(0)',
            transformOrigin: '50% 95%',
          }}>
            <ErenChibi size={64} hop={false} thinking={turn === 'O' && status === 'playing' && thinking} />
          </div>
          {/* Tongue extending from Eren's mouth toward the puddle, lapping.
              Sits OUTSIDE the rotated chibi container so its rest position
              stays anchored to the puddle as Eren's head tilts. */}
          {canKnocked && (
            <div className="absolute pointer-events-none" aria-hidden style={{
              bottom: '24%',
              left: '-22px',
              width: 22, height: 4,
              background: 'linear-gradient(90deg, #DB2777 0%, #F48B9B 60%, #FBCFE8 100%)',
              borderRadius: '60% 90% 90% 60%',
              boxShadow: '0 1px 0 rgba(0,0,0,0.4), 0 0 6px rgba(236,72,153,0.6)',
              transformOrigin: '100% 50%',
              animation: 'tttLick 0.55s ease-in-out infinite',
            }} />
          )}
        </div>
        <div className="relative" style={{ minWidth: 130 }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            border: '2px solid #FBCFE8',
            borderRadius: 8,
            boxShadow: '2px 2px 0 #DB2777',
            padding: '8px 12px',
            opacity: turn === 'O' && status === 'playing' ? 1 : 0.55,
            transition: 'opacity 0.3s',
          }}>
            <p className="font-pixel" style={{ fontSize: 7, color: '#831843' }}>
              {status === 'won'  ? 'aw, you got me!'
              : status === 'lost' ? 'gotcha! :3'
              : status === 'draw' ? 'good match!'
              : turn === 'O'      ? thinkText
              : 'your move →'}
            </p>
          </div>
          <div className="absolute" style={{
            left: -8, top: '60%',
            width: 0, height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderRight: '8px solid #FBCFE8',
          }} />
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center px-4 py-4">
        <div className="relative" style={{
          width: 'min(85vw, 320px)',
          aspectRatio: '1 / 1',
          background: 'linear-gradient(135deg, #1F0F3A 0%, #15081E 100%)',
          border: '4px solid #4C1D95',
          borderRadius: 8,
          boxShadow: '4px 6px 0 #2E0F5C, inset 0 1px 0 rgba(255,255,255,0.05), 0 0 28px rgba(167,139,250,0.3)',
          padding: 8,
        }}>
          {/* Corner pixel ticks */}
          <div style={{ position: 'absolute', top: 5, left: 5, width: 5, height: 5, background: '#FBBF24' }} />
          <div style={{ position: 'absolute', top: 5, right: 5, width: 5, height: 5, background: '#FBBF24' }} />
          <div style={{ position: 'absolute', bottom: 5, left: 5, width: 5, height: 5, background: '#FBBF24' }} />
          <div style={{ position: 'absolute', bottom: 5, right: 5, width: 5, height: 5, background: '#FBBF24' }} />

          <div className="relative w-full h-full grid" style={{
            gridTemplateColumns: '1fr 1fr 1fr',
            gridTemplateRows: '1fr 1fr 1fr',
            gap: 4,
          }}>
            {board.map((cell, i) => {
              const inWinLine = winLine?.includes(i) ?? false
              return (
                <button key={i}
                  onClick={() => handleCellClick(i)}
                  disabled={status !== 'playing' || turn !== 'X' || cell !== null || thinking}
                  className="relative flex items-center justify-center transition-transform active:scale-95"
                  style={{
                    background: inWinLine
                      ? 'linear-gradient(135deg, rgba(251,191,36,0.4), rgba(245,158,11,0.25))'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                    border: `2px solid ${inWinLine ? '#FDE68A' : 'rgba(167,139,250,0.35)'}`,
                    borderRadius: 4,
                    boxShadow: inWinLine
                      ? 'inset 0 0 12px rgba(253,230,138,0.5), 0 0 16px rgba(251,191,36,0.6)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                    cursor: status === 'playing' && turn === 'X' && cell === null && !thinking ? 'pointer' : 'default',
                  }}>
                  {cell === 'X' && <PixelX animate winning={inWinLine} />}
                  {cell === 'O' && <PixelO animate winning={inWinLine} />}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* End-of-match overlay */}
      {status !== 'playing' && (
        <div className="absolute inset-0 flex items-end justify-center pb-32 pointer-events-none">
          <div className="pointer-events-auto px-5 py-3 flex items-center gap-3"
            style={{
              background: status === 'won'
                ? 'linear-gradient(135deg, #15803D, #16A34A)'
                : status === 'lost'
                  ? 'linear-gradient(135deg, #831843, #BE185D)'
                  : 'linear-gradient(135deg, #4C1D95, #7C3AED)',
              border: '3px solid rgba(255,255,255,0.5)',
              borderRadius: 6,
              boxShadow: '0 6px 0 rgba(0,0,0,0.45), 0 0 24px rgba(255,255,255,0.2)',
              animation: 'tttPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
            <span className="font-pixel text-white" style={{ fontSize: 11, letterSpacing: 2 }}>
              {status === 'won' ? 'YOU WIN!' : status === 'lost' ? 'EREN WINS' : 'TIE!'}
            </span>
            <button onClick={() => { playSound('ui_tap'); newMatch() }}
              className="px-3 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-1.5"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '2px solid rgba(255,255,255,0.7)',
                borderRadius: 3,
                fontFamily: '"Press Start 2P"',
                fontSize: 7,
                letterSpacing: 1.5,
              }}>
              <RefreshCw size={10} />
              AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Footer score chip */}
      <div className="flex items-center justify-center pb-4 flex-shrink-0">
        <button onClick={() => { playSound('ui_tap'); newMatch() }}
          className="font-pixel text-white px-3 py-2 active:translate-y-[1px] inline-flex items-center gap-1.5"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '2px dashed rgba(167,139,250,0.45)',
            borderRadius: 3,
            fontSize: 6,
            letterSpacing: 1.5,
            color: '#C4B5FD',
          }}>
          <RefreshCw size={9} />
          NEW MATCH
        </button>
      </div>

      <style jsx global>{`
        @keyframes tttPop {
          0%   { transform: translateY(20px) scale(0.7); opacity: 0; }
          100% { transform: translateY(0)    scale(1);   opacity: 1; }
        }
        @keyframes drawX1 {
          from { stroke-dashoffset: 60; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes drawO {
          from { stroke-dashoffset: 100; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes thinkBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        @keyframes tttCanWobble {
          0%, 100%   { transform: rotate(0deg); }
          92%, 96%   { transform: rotate(-3deg); }
          94%        { transform: rotate(3deg); }
        }
        @keyframes tttSpillRipple {
          0%   { transform: scale(0.2); opacity: 0; }
          40%  { transform: scale(0.85); opacity: 0.95; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes tttSpillPulse {
          0%, 100% { opacity: 0.9; }
          50%      { opacity: 1; }
        }
        @keyframes tttDrip {
          0%   { transform: translateY(-2px); opacity: 0; }
          25%  { transform: translateY(0);    opacity: 1; }
          75%  { transform: translateY(10px); opacity: 0.6; }
          100% { transform: translateY(14px); opacity: 0; }
        }
        @keyframes tttBubble {
          0%, 100% { transform: translateY(0)    scale(1);   opacity: 0.85; }
          50%      { transform: translateY(-1px) scale(1.4); opacity: 1; }
        }
        @keyframes tttLick {
          0%, 100% { transform: rotate(28deg) scaleX(0.35); }
          45%, 55% { transform: rotate(8deg)  scaleX(1); }
        }
      `}</style>
    </div>
  )
}

// ─── Energy can — easter-egg sprite. Upright (clickable) or knocked over
// (spilling lime puddle, no longer interactive). Pixel art with crisp
// edges so it sits in the same visual register as the X and O.
function CanSprite({ knocked }: { knocked: boolean }) {
  if (knocked) {
    // Big knocked-over composition — viewBox is 100×72, rendered 1:1 so the
    // pixel art stays crisp. The can lies horizontally with its mouth pointing
    // RIGHT toward Eren, and the lime puddle pools on the right side of the
    // sprite — abutting Eren's left edge so his tongue can dip in.
    return (
      <svg width="100" height="72" viewBox="0 0 100 72" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated', overflow: 'visible' }}>
        {/* ── Puddle — many layers for dramatic depth ───────────────────── */}
        {/* Outer wet halo seeping into the floor */}
        <ellipse cx="62" cy="60" rx="40" ry="7" fill="#064E3B" opacity="0.4" />
        {/* Main puddle body — pulsing slightly so it reads as wet/active */}
        <g style={{ animation: 'tttSpillPulse 1.6s ease-in-out infinite' }}>
          <ellipse cx="62" cy="58" rx="36" ry="6"   fill="#065F46" />
          <ellipse cx="62" cy="57" rx="34" ry="5.5" fill="#0F5C44" />
        </g>
        {/* The bright lime layer — animates in with a ripple on first paint */}
        <g style={{ transformOrigin: '62px 56px', animation: 'tttSpillRipple 0.55s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          <ellipse cx="62" cy="56" rx="32" ry="5"   fill="#10B981" />
          <ellipse cx="64" cy="55.5" rx="26" ry="4" fill="#34D399" />
          <ellipse cx="68" cy="55" rx="18" ry="2.5" fill="#A3F0C0" />
          <ellipse cx="72" cy="54.5" rx="9" ry="1.2" fill="#FFFFFF" opacity="0.75" />
        </g>

        {/* Splash specks scattered around the puddle's edge */}
        <rect x="22" y="55" width="2" height="2" fill="#10B981" />
        <rect x="20" y="58" width="1" height="1" fill="#34D399" />
        <rect x="26" y="61" width="2" height="1" fill="#10B981" />
        <rect x="94" y="56" width="2" height="2" fill="#10B981" />
        <rect x="98" y="58" width="1" height="1" fill="#A3F0C0" />
        <rect x="90" y="62" width="2" height="1" fill="#10B981" />
        <rect x="56" y="63" width="2" height="1" fill="#10B981" />
        <rect x="74" y="63" width="1" height="1" fill="#34D399" />

        {/* Floating bubbles in the puddle — life signs */}
        <circle cx="48" cy="56" r="1.4" fill="#FFFFFF" opacity="0.9"
          style={{ animation: 'tttBubble 1.4s ease-in-out infinite' }} />
        <circle cx="80" cy="56" r="1.1" fill="#FFFFFF" opacity="0.75"
          style={{ animation: 'tttBubble 1.7s ease-in-out 0.4s infinite' }} />
        <circle cx="88" cy="57" r="0.9" fill="#FFFFFF" opacity="0.65"
          style={{ animation: 'tttBubble 1.2s ease-in-out 0.7s infinite' }} />
        <circle cx="60" cy="57" r="0.8" fill="#A3F0C0" opacity="0.85"
          style={{ animation: 'tttBubble 1.5s ease-in-out 0.2s infinite' }} />
        <circle cx="70" cy="58" r="0.7" fill="#FFFFFF" opacity="0.7"
          style={{ animation: 'tttBubble 1.3s ease-in-out 0.9s infinite' }} />

        {/* Drip stream from the can mouth — staggered for a continuous trickle */}
        <circle cx="46" cy="40" r="1.6" fill="#10B981"
          style={{ animation: 'tttDrip 1.0s ease-in-out infinite' }} />
        <circle cx="48" cy="44" r="1.3" fill="#34D399"
          style={{ animation: 'tttDrip 1.0s ease-in-out 0.35s infinite' }} />
        <circle cx="47" cy="48" r="1.0" fill="#A3F0C0"
          style={{ animation: 'tttDrip 1.0s ease-in-out 0.7s infinite' }} />

        {/* Knocked-over can — rotated +90° about its center so the mouth
            points right; placed on the left half of the sprite. */}
        <g transform="translate(15 10) rotate(90 11 21)">
          <CanBody />
        </g>
      </svg>
    )
  }
  // Upright can — bigger now (32×60 from 22×42) so it reads as a proper prop
  // next to the chibi instead of a small icon.
  return (
    <svg width="32" height="60" viewBox="0 0 22 42" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <CanBody />
    </svg>
  )
}

// Body of the can — same pixels for upright + knocked-over.
function CanBody() {
  return (
    <g>
      {/* Pull tab */}
      <rect x="9" y="0" width="4" height="2" fill="#9CA3AF" />
      <rect x="9" y="0" width="1" height="2" fill="#D1D5DB" />
      {/* Top metallic ring */}
      <rect x="2" y="2" width="18" height="2" fill="#525252" />
      <rect x="3" y="2" width="16" height="1" fill="#D1D5DB" />
      <rect x="3" y="3" width="16" height="1" fill="#525252" />
      <rect x="2" y="3" width="1" height="1" fill="#0A0A0A" />
      <rect x="19" y="3" width="1" height="1" fill="#0A0A0A" />
      <rect x="2" y="4" width="18" height="1" fill="#0A0A0A" />
      {/* Body — black with vertical sheen */}
      <rect x="2" y="5" width="18" height="32" fill="#0F0F0F" />
      <rect x="3" y="5" width="2" height="32" fill="#262626" />
      <rect x="3" y="5" width="1" height="32" fill="#3A3A3A" />
      <rect x="17" y="5" width="2" height="32" fill="#1A1A1A" />
      <rect x="18" y="5" width="1" height="32" fill="#000000" />
      <rect x="2" y="5" width="1" height="32" fill="#0A0A0A" />
      <rect x="19" y="5" width="1" height="32" fill="#0A0A0A" />
      {/* Lime claw-mark accents */}
      <rect x="6"  y="11" width="2" height="14" fill="#10B981" />
      <rect x="6"  y="11" width="1" height="14" fill="#34D399" />
      <rect x="6"  y="10" width="2" height="1"  fill="#A3F0C0" />
      <rect x="10" y="13" width="2" height="11" fill="#10B981" />
      <rect x="10" y="13" width="1" height="11" fill="#34D399" />
      <rect x="10" y="12" width="2" height="1"  fill="#A3F0C0" />
      <rect x="14" y="11" width="2" height="14" fill="#10B981" />
      <rect x="14" y="11" width="1" height="14" fill="#34D399" />
      <rect x="14" y="10" width="2" height="1"  fill="#A3F0C0" />
      {/* Bottom metallic ring */}
      <rect x="2" y="37" width="18" height="2" fill="#525252" />
      <rect x="3" y="37" width="16" height="1" fill="#9CA3AF" />
      <rect x="3" y="38" width="16" height="1" fill="#525252" />
      <rect x="2" y="39" width="18" height="1" fill="#0A0A0A" />
    </g>
  )
}

// ─── Pixel X ────────────────────────────────────────────────────────────────
function PixelX({ animate = false, winning = false }: { animate?: boolean; winning?: boolean }) {
  const stroke = winning ? '#FBBF24' : '#FF6B9D'
  const glow   = winning ? 'drop-shadow(0 0 6px rgba(251,191,36,0.7))' : 'drop-shadow(0 0 4px rgba(255,107,157,0.5))'
  return (
    <svg width="62%" height="62%" viewBox="0 0 30 30" style={{ filter: glow }}>
      <line x1="5" y1="5" x2="25" y2="25" stroke={stroke} strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={animate ? 60 : undefined}
        style={animate ? { animation: 'drawX1 0.22s linear forwards' } : undefined} />
      <line x1="25" y1="5" x2="5" y2="25" stroke={stroke} strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={animate ? 60 : undefined}
        style={animate ? { animation: 'drawX1 0.22s linear 0.18s forwards', strokeDashoffset: 60 } : undefined} />
    </svg>
  )
}

// ─── Pixel O ────────────────────────────────────────────────────────────────
function PixelO({ animate = false, winning = false }: { animate?: boolean; winning?: boolean }) {
  const stroke = winning ? '#FBBF24' : '#A78BFA'
  const glow   = winning ? 'drop-shadow(0 0 6px rgba(251,191,36,0.7))' : 'drop-shadow(0 0 4px rgba(167,139,250,0.55))'
  return (
    <svg width="62%" height="62%" viewBox="0 0 30 30" style={{ filter: glow }}>
      <circle cx="15" cy="15" r="9.5" stroke={stroke} strokeWidth="4.5" fill="none" strokeLinecap="round"
        strokeDasharray={animate ? 100 : undefined}
        style={animate ? { animation: 'drawO 0.36s ease-out forwards' } : undefined} />
    </svg>
  )
}

// ─── Eren chibi — cleaner proportions: bigger head, slimmer body, no mask
//                  spots blurring his face, pupils centered for a forward gaze.
function ErenChibi({ size = 64, hop = false, thinking = false }: { size?: number; hop?: boolean; thinking?: boolean }) {
  return (
    <div style={{
      animation: thinking ? 'thinkBob 0.6s ease-in-out infinite' : hop ? 'erenHop 0.9s ease-in-out infinite' : undefined,
    }}>
      <svg width={size} height={size} viewBox="0 0 22 22" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        {/* ears */}
        <rect x="3"  y="2" width="3" height="1" fill="#4A2E1A" />
        <rect x="16" y="2" width="3" height="1" fill="#4A2E1A" />
        <rect x="3"  y="3" width="3" height="2" fill="#9B7A5C" />
        <rect x="16" y="3" width="3" height="2" fill="#9B7A5C" />
        <rect x="4"  y="4" width="1" height="1" fill="#F4B0B8" />
        <rect x="17" y="4" width="1" height="1" fill="#F4B0B8" />

        {/* head outline */}
        <rect x="5"  y="3" width="12" height="1" fill="#4A2E1A" />
        <rect x="4"  y="4" width="14" height="1" fill="#4A2E1A" />
        <rect x="3"  y="5" width="16" height="1" fill="#4A2E1A" />
        <rect x="3"  y="6" width="1"  height="6" fill="#4A2E1A" />
        <rect x="18" y="6" width="1"  height="6" fill="#4A2E1A" />
        {/* head fill — clean cream, no mask blotches */}
        <rect x="4"  y="5" width="14" height="1" fill="#F9EDD5" />
        <rect x="4"  y="6" width="14" height="6" fill="#F9EDD5" />

        {/* eyes — round 2x2 blue iris with centered black pupil + top-outer
            white shine; both pupils sit at the inner edge so the gaze reads
            forward instead of cross-eyed or wandering. */}
        <rect x="6"  y="7" width="2" height="2" fill="#6BAED6" />
        <rect x="14" y="7" width="2" height="2" fill="#6BAED6" />
        <rect x="6"  y="7" width="1" height="1" fill="#FFFFFF" />
        <rect x="15" y="7" width="1" height="1" fill="#FFFFFF" />
        <rect x="7"  y="8" width="1" height="1" fill="#1A1A2E" />
        <rect x="14" y="8" width="1" height="1" fill="#1A1A2E" />

        {/* rosy cheeks — pushed below eyes to actually look like cheeks */}
        <rect x="4"  y="10" width="2" height="1" fill="#FFB6C8" />
        <rect x="16" y="10" width="2" height="1" fill="#FFB6C8" />

        {/* nose */}
        <rect x="10" y="9"  width="2" height="1" fill="#F48B9B" />
        <rect x="10" y="10" width="2" height="1" fill="#4A2E1A" />

        {/* mouth corners + smile bottom (drawn after chin so V shows on cream) */}
        <rect x="9"  y="11" width="1" height="1" fill="#4A2E1A" />
        <rect x="12" y="11" width="1" height="1" fill="#4A2E1A" />

        {/* chin outline */}
        <rect x="4"  y="12" width="14" height="1" fill="#4A2E1A" />
        <rect x="5"  y="12" width="12" height="1" fill="#F9EDD5" />
        <rect x="10" y="12" width="2" height="1" fill="#4A2E1A" />

        {/* body — narrower than head for chibi proportions */}
        <rect x="6"  y="13" width="10" height="1" fill="#4A2E1A" />
        <rect x="5"  y="14" width="1"  height="5" fill="#4A2E1A" />
        <rect x="16" y="14" width="1"  height="5" fill="#4A2E1A" />
        <rect x="6"  y="14" width="10" height="5" fill="#F9EDD5" />
        <rect x="6"  y="19" width="10" height="1" fill="#4A2E1A" />

        {/* small paws peeking under */}
        <rect x="6"  y="20" width="3" height="1" fill="#4A2E1A" />
        <rect x="13" y="20" width="3" height="1" fill="#4A2E1A" />
        <rect x="7"  y="19" width="2" height="1" fill="#D4B896" />
        <rect x="13" y="19" width="2" height="1" fill="#D4B896" />

        {/* tail curled to one side — adds a kitten silhouette */}
        <rect x="2"  y="14" width="1" height="2" fill="#4A2E1A" />
        <rect x="1"  y="15" width="1" height="2" fill="#4A2E1A" />
        <rect x="2"  y="16" width="1" height="1" fill="#4A2E1A" />
      </svg>
    </div>
  )
}
