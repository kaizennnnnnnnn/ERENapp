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
import { IconStar } from '@/components/PixelIcons'

const ROWS = 8
const COLS = 6
const STARTING_MOVES = 30
const N_TYPES = 6

interface Tile {
  id: number
  type: number   // 0..5
  matched?: boolean
}

type Grid = (Tile | null)[][]

let _tid = 0
const newTile = (type: number): Tile => ({ id: ++_tid, type })

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// ─── Pure functions: grid generation, match detection, gravity ──────────────
function genGrid(): Grid {
  const g: Grid = []
  for (let r = 0; r < ROWS; r++) {
    const row: (Tile | null)[] = []
    for (let c = 0; c < COLS; c++) {
      let t = 0
      let attempts = 0
      do {
        t = Math.floor(Math.random() * N_TYPES)
        attempts++
      } while (
        attempts < 60 && (
          (c >= 2 && row[c-1]?.type === t && row[c-2]?.type === t) ||
          (r >= 2 && g[r-1]?.[c]?.type === t && g[r-2]?.[c]?.type === t)
        )
      )
      row.push(newTile(t))
    }
    g.push(row)
  }
  return g
}

function detectMatches(g: Grid): Set<string> {
  const matched = new Set<string>()
  for (let r = 0; r < ROWS; r++) {
    let runStart = 0
    for (let c = 1; c <= COLS; c++) {
      const cur = c < COLS ? g[r][c] : null
      const start = g[r][runStart]
      const breaks = c === COLS || !cur || !start || cur.type !== start.type
      if (breaks) {
        if (c - runStart >= 3 && start) {
          for (let i = runStart; i < c; i++) matched.add(`${r},${i}`)
        }
        runStart = c
      }
    }
  }
  for (let c = 0; c < COLS; c++) {
    let runStart = 0
    for (let r = 1; r <= ROWS; r++) {
      const cur = r < ROWS ? g[r][c] : null
      const start = g[runStart][c]
      const breaks = r === ROWS || !cur || !start || cur.type !== start.type
      if (breaks) {
        if (r - runStart >= 3 && start) {
          for (let i = runStart; i < r; i++) matched.add(`${i},${c}`)
        }
        runStart = r
      }
    }
  }
  return matched
}

function gridCopy(g: Grid): Grid { return g.map(row => row.map(t => t ? { ...t } : null)) }

function applyGravityFn(g: Grid): Grid {
  const ng = gridCopy(g)
  for (let c = 0; c < COLS; c++) {
    let writeR = ROWS - 1
    for (let readR = ROWS - 1; readR >= 0; readR--) {
      if (ng[readR][c] !== null) {
        if (writeR !== readR) {
          ng[writeR][c] = ng[readR][c]
          ng[readR][c] = null
        }
        writeR--
      }
    }
  }
  return ng
}

function refillTop(g: Grid): Grid {
  const ng = gridCopy(g)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (ng[r][c] === null) ng[r][c] = newTile(Math.floor(Math.random() * N_TYPES))
    }
  }
  return ng
}

function isAdjacent(a: { r: number; c: number }, b: { r: number; c: number }) {
  const dr = Math.abs(a.r - b.r)
  const dc = Math.abs(a.c - b.c)
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1)
}

function doSwap(g: Grid, a: { r: number; c: number }, b: { r: number; c: number }): Grid {
  const ng = gridCopy(g)
  const tmp = ng[a.r][a.c]
  ng[a.r][a.c] = ng[b.r][b.c]
  ng[b.r][b.c] = tmp
  return ng
}

// ─── Game component ─────────────────────────────────────────────────────────
export default function YarnPopGame() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask, addCoins } = useTasks()

  const [phase, setPhase]     = useState<'idle' | 'playing' | 'gameover'>('idle')
  const [grid, setGrid]       = useState<Grid>(() => genGrid())
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null)
  const [moves, setMoves]     = useState(STARTING_MOVES)
  const [score, setScore]     = useState(0)
  const [bestScore, setBest]  = useState(0)
  const [combo, setCombo]     = useState(0)
  const [processing, setProcessing] = useState(false)
  const [floater, setFloater] = useState<{ id: number; text: string; x: number; y: number; color: string } | null>(null)
  const savedRef = useRef(false)

  function startGame() {
    let g = genGrid()
    // Make sure starting board has no immediate matches.
    while (detectMatches(g).size > 0) g = genGrid()
    setGrid(g)
    setMoves(STARTING_MOVES)
    setScore(0)
    setCombo(0)
    setSelected(null)
    setProcessing(false)
    savedRef.current = false
    setPhase('playing')
  }

  async function processCascades(initialGrid: Grid) {
    setProcessing(true)
    let g = initialGrid
    let comboLocal = 0
    let totalScore = 0

    while (true) {
      const matches = detectMatches(g)
      if (matches.size === 0) break
      comboLocal++
      setCombo(comboLocal)

      // Mark matched tiles for fade animation
      g = gridCopy(g)
      matches.forEach(k => {
        const [r, c] = k.split(',').map(Number)
        if (g[r][c]) g[r][c] = { ...g[r][c]!, matched: true }
      })
      setGrid(g)
      playSound(comboLocal === 1 ? 'ui_modal_close' : 'ui_modal_open')

      // Score: 10 per cell, multiplied by cascade
      const gained = matches.size * 10 * comboLocal
      totalScore += gained
      setScore(s => s + gained)
      flashFloater(comboLocal > 1 ? `${gained} · COMBO x${comboLocal}!` : `+${gained}`,
                   comboLocal > 1 ? '#FBBF24' : '#FBCFE8')

      await sleep(280)

      // Clear matched cells
      g = gridCopy(g)
      matches.forEach(k => {
        const [r, c] = k.split(',').map(Number)
        g[r][c] = null
      })

      // Gravity
      g = applyGravityFn(g)
      setGrid(g)
      await sleep(220)

      // Refill from top
      g = refillTop(g)
      setGrid(g)
      await sleep(180)
    }

    setCombo(0)
    setProcessing(false)
    void totalScore

    // Check game over
    if (movesRef.current <= 0) {
      // small grace pause then end
      setTimeout(endGame, 250)
    }
  }

  const movesRef = useRef(STARTING_MOVES)
  useEffect(() => { movesRef.current = moves }, [moves])

  function endGame() {
    setPhase('gameover')
    setBest(b => Math.max(b, score))
    if (!savedRef.current && user?.id && score > 0) {
      savedRef.current = true
      supabase.from('game_scores').insert({ user_id: user.id, game_type: 'yarn_pop', score })
        .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('yarn_pop save:', error) })
      addCoins(Math.min(60, Math.floor(score / 25)))
      completeTask('daily_game')
      if (score >= 600) completeTask('weekly_high_score')
      applyAction(user.id, 'play')
    }
  }

  function flashFloater(text: string, color: string) {
    const id = ++_tid
    setFloater({ id, text, x: 50, y: 12, color })
    setTimeout(() => setFloater(f => f && f.id === id ? null : f), 900)
  }

  async function handleTileTap(r: number, c: number) {
    if (phase !== 'playing' || processing) return
    if (!selected) {
      setSelected({ r, c })
      return
    }
    if (selected.r === r && selected.c === c) {
      setSelected(null)
      return
    }
    if (!isAdjacent(selected, { r, c })) {
      setSelected({ r, c })
      return
    }

    // Attempt swap
    const a = selected
    const b = { r, c }
    setSelected(null)
    let next = doSwap(grid, a, b)
    setGrid(next)
    playSound('ui_swipe_room')

    await sleep(160)

    // Validate match
    if (detectMatches(next).size === 0) {
      // Revert
      next = doSwap(next, a, b)
      setGrid(next)
      flashFloater('NO MATCH', '#FCA5A5')
      return
    }

    setMoves(m => m - 1)
    await processCascades(next)
  }

  function reset() {
    setPhase('idle')
    setGrid(genGrid())
    setMoves(STARTING_MOVES)
    setScore(0)
    setSelected(null)
    setProcessing(false)
  }

  // Auto-process initial board (in case it has matches from a wonky gen)
  useEffect(() => {
    if (phase !== 'playing') return
    if (detectMatches(grid).size > 0) {
      processCascades(grid)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{
      background: 'radial-gradient(ellipse at top, #500A38 0%, #2C0623 55%, #170210 100%)',
    }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{
        background: 'linear-gradient(180deg, rgba(20,4,18,0.95) 0%, rgba(20,4,18,0.6) 100%)',
        borderBottom: '2px solid rgba(244,114,182,0.35)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', borderRadius: 6, border: '2px solid rgba(244,114,182,0.45)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={16} className="text-pink-200" />
        </button>
        <span className="font-pixel text-white px-2.5 py-1.5"
          style={{ background: 'linear-gradient(135deg, #DB2777, #EC4899)', border: '2px solid #831843', borderRadius: 4, fontSize: 8, letterSpacing: 2, boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          YARN POP
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 px-2 py-1.5 font-pixel"
          style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, fontSize: 8, color: '#FDE68A' }}>
          BEST {bestScore}
        </div>
      </div>

      {/* Score / moves bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div>
          <div className="font-pixel" style={{ fontSize: 6, color: '#FBCFE8', letterSpacing: 2 }}>SCORE</div>
          <div className="font-pixel" style={{ fontSize: 22, color: '#FFFFFF', textShadow: '2px 2px 0 #831843', letterSpacing: 1 }}>{score}</div>
        </div>
        {combo > 1 && (
          <div className="font-pixel" style={{
            background: 'rgba(0,0,0,0.5)',
            border: '2px solid #FBBF24',
            borderRadius: 3,
            padding: '4px 10px',
            fontSize: 9, color: '#FBBF24', letterSpacing: 2,
            boxShadow: '0 0 14px rgba(251,191,36,0.5)',
            animation: 'yp-combo 0.5s ease-out',
          }}>
            COMBO x{combo}
          </div>
        )}
        <div className="text-right">
          <div className="font-pixel" style={{ fontSize: 6, color: '#FBCFE8', letterSpacing: 2 }}>MOVES</div>
          <div className="font-pixel" style={{ fontSize: 22, color: moves <= 5 ? '#FCA5A5' : '#FFFFFF', textShadow: '2px 2px 0 #831843', letterSpacing: 1 }}>{moves}</div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center px-3 pb-4">
        <div className="relative" style={{
          width: 'min(94vw, 380px)',
          aspectRatio: `${COLS} / ${ROWS}`,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.5), rgba(0,0,0,0.7))',
          border: '3px solid #DB2777',
          borderRadius: 6,
          boxShadow: '0 4px 0 #831843, inset 0 1px 0 rgba(255,255,255,0.1), 0 0 30px rgba(244,114,182,0.35)',
          padding: 4,
        }}>
          <div className="relative w-full h-full">
            {grid.flatMap((row, r) =>
              row.map((tile, c) => tile ? (
                <button key={tile.id}
                  onClick={() => handleTileTap(r, c)}
                  disabled={processing}
                  className="absolute flex items-center justify-center active:scale-95 transition-transform"
                  style={{
                    left:  `${(c / COLS) * 100}%`,
                    top:   `${(r / ROWS) * 100}%`,
                    width:  `${100 / COLS}%`,
                    height: `${100 / ROWS}%`,
                    padding: 2,
                    cursor: processing ? 'default' : 'pointer',
                    transition: 'left 0.18s, top 0.28s ease-out, opacity 0.25s, transform 0.18s',
                    opacity: tile.matched ? 0 : 1,
                    transform: tile.matched ? 'scale(0.5)' : 'scale(1)',
                    zIndex: selected && selected.r === r && selected.c === c ? 5 : 1,
                  }}>
                  <div style={{
                    width: '100%', height: '100%',
                    boxShadow: selected && selected.r === r && selected.c === c
                      ? '0 0 0 3px #FDE68A, 0 0 14px rgba(253,230,138,0.8)'
                      : 'none',
                    borderRadius: 5,
                    transition: 'box-shadow 0.15s',
                  }}>
                    <TileVisual type={tile.type} />
                  </div>
                </button>
              ) : null)
            )}
          </div>

          {/* Floater */}
          {floater && (
            <div className="absolute font-pixel pointer-events-none"
              style={{
                left: '50%', top: floater.y,
                transform: 'translateX(-50%)',
                fontSize: 9, color: floater.color,
                letterSpacing: 1.5,
                textShadow: '2px 2px 0 rgba(0,0,0,0.6)',
                animation: 'yp-floater 0.9s ease-out forwards',
              }}>
              {floater.text}
            </div>
          )}
        </div>
      </div>

      {/* Idle overlay */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="px-6 py-5 flex flex-col items-center gap-3"
            style={{ background: 'rgba(15,3,18,0.85)', border: '3px solid #EC4899', borderRadius: 6, boxShadow: '0 4px 0 #831843, 0 0 24px rgba(236,72,153,0.4)' }}>
            <p className="font-pixel" style={{ fontSize: 10, letterSpacing: 2, color: '#FDE68A' }}>YARN POP</p>
            <p className="font-pixel text-center" style={{ fontSize: 7, color: '#FBCFE8', letterSpacing: 1, lineHeight: 1.6 }}>
              TAP TWO ADJACENT TILES.<br/>MATCH 3+ TO POP.
            </p>
            <button onClick={() => { playSound('ui_tap'); startGame() }}
              className="mt-1 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
                border: '2px solid #831843',
                borderRadius: 3,
                boxShadow: '0 4px 0 #831843',
                fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1.5,
              }}>
              <IconStar size={12} /> START
            </button>
          </div>
        </div>
      )}

      {/* Game over */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: 'rgba(8,5,18,0.7)', backdropFilter: 'blur(2px)' }}>
          <div className="flex flex-col items-center gap-3 px-6 py-5"
            style={{
              background: 'linear-gradient(180deg, #2A0820 0%, #170210 100%)',
              border: '3px solid #EC4899',
              borderRadius: 6,
              boxShadow: '0 6px 0 #831843, 0 0 24px rgba(236,72,153,0.4)',
              animation: 'yp-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
            <p className="font-pixel" style={{ fontSize: 11, color: '#FCA5A5', letterSpacing: 3 }}>OUT OF MOVES</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FBCFE8', letterSpacing: 1 }}>SCORE</span>
                <span className="font-pixel text-white" style={{ fontSize: 22 }}>{score}</span>
              </div>
              <div style={{ width: 1, height: 28, background: '#831843' }} />
              <div className="flex flex-col items-center">
                <span className="font-pixel" style={{ fontSize: 6, color: '#FDE68A', letterSpacing: 1 }}>BEST</span>
                <span className="font-pixel" style={{ fontSize: 22, color: '#FDE68A' }}>{bestScore}</span>
              </div>
            </div>
            <button onClick={() => { playSound('ui_tap'); reset() }}
              className="mt-3 px-5 py-2 text-white active:translate-y-[2px] transition-transform inline-flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
                border: '2px solid #831843',
                borderRadius: 3,
                boxShadow: '0 4px 0 #831843',
                fontFamily: '"Press Start 2P"', fontSize: 8, letterSpacing: 1.5,
              }}>
              <RefreshCw size={11} /> AGAIN
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes yp-pop {
          0%   { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes yp-combo {
          0%   { transform: scale(0.6); opacity: 0; }
          50%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes yp-floater {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-22px); }
        }
      `}</style>
    </div>
  )
}

// ─── Tile visuals — six bold pixel-art types ────────────────────────────────
function TileVisual({ type }: { type: number }) {
  switch (type) {
    case 0: return <YarnTile />
    case 1: return <FishTile />
    case 2: return <PawTile />
    case 3: return <StarTile />
    case 4: return <KibbleTile />
    default: return <HeartTile />
  }
}

function bg(color: string) {
  return {
    width: '100%', height: '100%',
    background: `linear-gradient(135deg, ${color}DD, ${color}88)`,
    border: '2px solid rgba(0,0,0,0.4)',
    borderRadius: 4,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 0 rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as const
}

function YarnTile() {
  return (
    <div style={bg('#F472B6')}>
      <svg width="68%" height="68%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="3" y="2" width="6" height="1" fill="#F9A8D4" />
        <rect x="2" y="3" width="8" height="6" fill="#F9A8D4" />
        <rect x="3" y="9" width="6" height="1" fill="#F9A8D4" />
        <rect x="3" y="3" width="6" height="1" fill="#F472B6" />
        <rect x="2" y="5" width="8" height="1" fill="#F472B6" />
        <rect x="3" y="7" width="6" height="1" fill="#F472B6" />
        <rect x="6" y="2" width="1" height="8" fill="#9D174D" />
      </svg>
    </div>
  )
}
function FishTile() {
  return (
    <div style={bg('#6BAED6')}>
      <svg width="68%" height="68%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="4" width="6" height="4" fill="#6BAED6" />
        <rect x="3" y="3" width="4" height="6" fill="#6BAED6" />
        <rect x="3" y="3" width="4" height="1" fill="#A0CCE5" />
        <rect x="8" y="4" width="1" height="4" fill="#3A88B8" />
        <rect x="9" y="3" width="1" height="2" fill="#3A88B8" />
        <rect x="9" y="7" width="1" height="2" fill="#3A88B8" />
        <rect x="4" y="5" width="1" height="1" fill="#1A1A2E" />
      </svg>
    </div>
  )
}
function PawTile() {
  return (
    <div style={bg('#A78BFA')}>
      <svg width="68%" height="68%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="4" y="6" width="4" height="3" fill="#DDD6FE" />
        <rect x="3" y="7" width="6" height="2" fill="#DDD6FE" />
        <rect x="2" y="3" width="2" height="2" fill="#DDD6FE" />
        <rect x="5" y="2" width="2" height="2" fill="#DDD6FE" />
        <rect x="8" y="3" width="2" height="2" fill="#DDD6FE" />
        <rect x="3" y="5" width="2" height="1" fill="#DDD6FE" />
      </svg>
    </div>
  )
}
function StarTile() {
  return (
    <div style={bg('#FBBF24')}>
      <svg width="68%" height="68%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="5" y="1" width="2" height="2" fill="#FEF3C7" />
        <rect x="4" y="3" width="4" height="2" fill="#FEF3C7" />
        <rect x="2" y="4" width="8" height="2" fill="#FEF3C7" />
        <rect x="3" y="6" width="6" height="2" fill="#FEF3C7" />
        <rect x="3" y="8" width="2" height="2" fill="#FEF3C7" />
        <rect x="7" y="8" width="2" height="2" fill="#FEF3C7" />
      </svg>
    </div>
  )
}
function KibbleTile() {
  return (
    <div style={bg('#FB923C')}>
      <svg width="68%" height="68%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="3" y="3" width="6" height="6" fill="#FED7AA" />
        <rect x="4" y="4" width="4" height="4" fill="#FB923C" />
        <rect x="4" y="4" width="1" height="1" fill="#FFEDD5" />
      </svg>
    </div>
  )
}
function HeartTile() {
  return (
    <div style={bg('#F87171')}>
      <svg width="68%" height="68%" viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        <rect x="2" y="3" width="3" height="2" fill="#FCA5A5" />
        <rect x="7" y="3" width="3" height="2" fill="#FCA5A5" />
        <rect x="2" y="5" width="8" height="2" fill="#FCA5A5" />
        <rect x="3" y="7" width="6" height="2" fill="#FCA5A5" />
        <rect x="4" y="9" width="4" height="1" fill="#FCA5A5" />
        <rect x="5" y="10" width="2" height="1" fill="#FCA5A5" />
      </svg>
    </div>
  )
}
