'use client'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// JELLY SLICE — swipe the jellies out of the air; Eren catches what falls.
//
// Entities live in a ref and are written straight to the DOM inside one rAF
// loop. React only re-renders on EVENTS (a slice, a miss, game over), never per
// frame: at 60fps with a dozen jellies plus their halves and droplets, a state
// update per frame is the difference between smooth and a slideshow on a phone.
//
// Slicing is a segment-vs-circle test against the pointer's travel THIS frame,
// not a point test on the pointer's current position. A fast flick moves 200px
// between frames, and a point test simply misses everything it passed through —
// which reads to the player as the game ignoring them.
//
// Failing is missing, not hitting: three jellies allowed to fall past Eren ends
// the round. That keeps the pressure on the thing the game is about (reading
// arcs and committing to a stroke) instead of on avoiding a hazard.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCare } from '@/contexts/CareContext'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useJellies, type JellyWin } from '@/hooks/useJellies'
import { useJellyDuel } from '@/hooks/useJellyDuel'
import { JELLIES, type JellyDef } from '@/lib/jellies'
import JellyPrize, { type DuelLine } from '@/components/jelly/JellyPrize'
import PixelEren, { type ErenPose } from '@/components/games/PixelEren'
import { IconJelly } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

// ─── Tuning ────────────────────────────────────────────────────────────────
const GRAVITY = 1000          // px/s²
const PEAK_FRAC = 0.55        // a jelly tops out this far up the field
const LIVES = 3
const JELLY_R = 34            // hit radius, px — generous on purpose (fat fingers)
const BASE_POINTS = 10
const THRESHOLD = 120         // score needed to earn a jelly
const TRAIL_MS = 190          // how long a blade point stays on the trail
/** Slices within this window chain into one combo. */
const COMBO_MS = 620
const WAVE_MS_START = 1500
const WAVE_MS_MIN = 620
/** Every wave shortens the gap a touch — the whole difficulty curve. */
const WAVE_RAMP = 0.965

interface Fly {
  id: number
  jelly: JellyDef
  x: number; y: number
  vx: number; vy: number
  spin: number; spinV: number
  sliced: boolean
  /** Halves fly apart with their own drift once cut. */
  halfDir: number
  born: number
  el?: HTMLDivElement | null
}

interface Bit {
  id: number
  x: number; y: number
  vx: number; vy: number
  colour: string
  life: number
  el?: HTMLDivElement | null
}

let uid = 0

export default function JellySlicePage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const reduced = useReducedMotion()
  const jellies = useJellies()
  const duel = useJellyDuel('slice')

  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [combo, setCombo] = useState(0)
  const [pose, setPose] = useState<ErenPose>('idle')
  const [wins, setWins] = useState<JellyWin[]>([])
  const [result, setResult] = useState<{ isBest: boolean; duel: DuelLine } | null>(null)

  const fieldRef = useRef<HTMLDivElement | null>(null)
  const trailRef = useRef<SVGPolylineElement | null>(null)
  const flies = useRef<Fly[]>([])
  const bits = useRef<Bit[]>([])
  const trail = useRef<{ x: number; y: number; t: number }[]>([])
  const scoreRef = useRef(0)
  const livesRef = useRef(LIVES)
  const comboRef = useRef({ n: 0, until: 0 })
  const phaseRef = useRef<'ready' | 'play' | 'over'>('ready')
  const savedRef = useRef(false)
  const nextWave = useRef(0)
  const waveGap = useRef(WAVE_MS_START)
  const poseTimer = useRef<number | null>(null)
  const [, force] = useState(0)   // re-render when the entity LIST changes

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  const flash = useCallback((p: ErenPose) => {
    setPose(p)
    if (poseTimer.current) window.clearTimeout(poseTimer.current)
    poseTimer.current = window.setTimeout(() => setPose('idle'), 520)
  }, [])

  // ── End of round ──────────────────────────────────────────────────────────
  const endRound = useCallback(async () => {
    if (savedRef.current) return
    savedRef.current = true
    phaseRef.current = 'over'
    setPhase('over')
    playSound('jl_over')

    const final = scoreRef.current
    const submitted = await duel.submit(final)
    const won: JellyWin[] = []
    if (final >= THRESHOLD) {
      const w = await jellies.awardJelly()
      if (w) won.push(w)
      // Taking today's lead pays a second jelly — the duel's whole reward.
      if (submitted.bonusJelly) {
        const b = await jellies.awardJelly()
        if (b) won.push(b)
      }
    }
    setWins(won)
    setResult({
      isBest: submitted.isBest,
      duel: { theirName: duel.theirName, theirsToday: duel.theirsToday, tookLead: submitted.tookLead },
    })
    if (final > 0 && user?.id) {
      completeTask('daily_game')
      void applyAction(user.id, 'play')
    }
  }, [duel, jellies, user?.id, completeTask, applyAction])

  // ── Spawning ──────────────────────────────────────────────────────────────
  const launch = useCallback((W: number, H: number) => {
    const peak = H * PEAK_FRAC
    const v0 = Math.sqrt(2 * GRAVITY * peak)
    const x = W * (0.14 + Math.random() * 0.72)
    // Aim the arc back toward the middle so nothing leaves sideways unplayable.
    const drift = ((W / 2 - x) / (W / 2)) * (60 + Math.random() * 90)
    flies.current.push({
      id: ++uid,
      jelly: JELLIES[Math.floor(Math.random() * JELLIES.length)],
      x, y: H + JELLY_R,
      vx: drift, vy: -v0 * (0.9 + Math.random() * 0.2),
      spin: 0, spinV: (Math.random() - 0.5) * 200,
      sliced: false, halfDir: 0, born: performance.now(),
    })
  }, [])

  // ── The loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    let last = performance.now()
    nextWave.current = performance.now() + 400
    waveGap.current = WAVE_MS_START

    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      const field = fieldRef.current
      if (!field) return
      const W = field.clientWidth, H = field.clientHeight
      // Clamp dt: a backgrounded tab returns with a huge delta that would
      // teleport every jelly past Eren and end the round on resume.
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      if (now >= nextWave.current) {
        const n = 1 + (Math.random() < 0.35 ? 1 : 0) + (waveGap.current < 900 && Math.random() < 0.3 ? 1 : 0)
        for (let i = 0; i < n; i++) launch(W, H)
        waveGap.current = Math.max(WAVE_MS_MIN, waveGap.current * WAVE_RAMP)
        nextWave.current = now + waveGap.current
      }

      let listChanged = false
      let missed = 0
      flies.current = flies.current.filter(f => {
        f.vy += GRAVITY * dt
        f.x += f.vx * dt
        f.y += f.vy * dt
        f.spin += f.spinV * dt
        if (f.sliced) f.x += f.halfDir * 90 * dt

        if (f.y > H + JELLY_R * 2.4) {
          if (!f.sliced) missed++
          listChanged = true
          return false
        }
        if (f.el) {
          f.el.style.transform =
            `translate3d(${f.x - JELLY_R}px, ${f.y - JELLY_R}px, 0) rotate(${f.spin}deg)`
        }
        return true
      })

      bits.current = bits.current.filter(b => {
        b.vy += GRAVITY * 0.6 * dt
        b.x += b.vx * dt
        b.y += b.vy * dt
        b.life -= dt
        if (b.life <= 0) { listChanged = true; return false }
        if (b.el) {
          b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`
          b.el.style.opacity = String(Math.max(0, Math.min(1, b.life * 2)))
        }
        return true
      })

      if (missed > 0) {
        livesRef.current -= missed
        setLives(Math.max(0, livesRef.current))
        comboRef.current = { n: 0, until: 0 }
        setCombo(0)
        playSound('jl_miss')
        flash('wobble')
        if (livesRef.current <= 0 && phaseRef.current === 'play') void endRound()
      }

      // Age out the blade trail and redraw it.
      const cutoff = now - TRAIL_MS
      trail.current = trail.current.filter(p => p.t >= cutoff)
      if (trailRef.current) {
        trailRef.current.setAttribute('points', trail.current.map(p => `${p.x},${p.y}`).join(' '))
      }

      if (listChanged) force(v => v + 1)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, launch, endRound, flash])

  // ── Slicing ───────────────────────────────────────────────────────────────
  const cutAt = useCallback((ax: number, ay: number, bx: number, by: number) => {
    let hits = 0
    for (const f of flies.current) {
      if (f.sliced) continue
      if (!segmentHitsCircle(ax, ay, bx, by, f.x, f.y, JELLY_R)) continue
      f.sliced = true
      f.halfDir = bx >= ax ? 1 : -1
      f.spinV = f.halfDir * 320
      hits++
      for (let i = 0; i < 7; i++) {
        bits.current.push({
          id: ++uid, x: f.x, y: f.y,
          vx: (Math.random() - 0.5) * 420, vy: -60 - Math.random() * 260,
          colour: f.jelly.colour, life: 0.45 + Math.random() * 0.3,
        })
      }
    }
    if (hits === 0) return

    const now = performance.now()
    const c = comboRef.current
    // A chain continues while slices keep landing inside the window; slicing
    // several in ONE stroke counts each, which is what makes a big sweep pay.
    c.n = now <= c.until ? c.n + hits : hits
    c.until = now + COMBO_MS
    const mult = Math.min(5, 1 + Math.floor((c.n - 1) / 2))
    scoreRef.current += BASE_POINTS * hits * mult
    setScore(scoreRef.current)
    setCombo(c.n)
    playSound(c.n >= 3 ? 'jl_combo' : 'jl_slice')
    flash('cheer')
    force(v => v + 1)
  }, [flash])

  const lastPt = useRef<{ x: number; y: number } | null>(null)
  const onPointer = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current !== 'play') return
    const field = fieldRef.current
    if (!field) return
    const r = field.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    trail.current.push({ x, y, t: performance.now() })
    const p = lastPt.current
    if (p) cutAt(p.x, p.y, x, y)
    lastPt.current = { x, y }
  }, [cutAt])

  const start = useCallback(() => {
    flies.current = []; bits.current = []; trail.current = []
    scoreRef.current = 0; livesRef.current = LIVES
    comboRef.current = { n: 0, until: 0 }
    savedRef.current = false
    lastPt.current = null
    setScore(0); setLives(LIVES); setCombo(0); setWins([]); setResult(null)
    phaseRef.current = 'play'
    setPhase('play')
  }, [])

  useEffect(() => () => { if (poseTimer.current) window.clearTimeout(poseTimer.current) }, [])

  const mult = Math.min(5, 1 + Math.floor((Math.max(combo, 1) - 1) / 2))

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{
      background: 'linear-gradient(180deg, #FFF3F7 0%, #FFE1EC 42%, #F9C6DB 100%)',
      touchAction: 'none',
    }}>
      {/* ── Parlour dressing ── purely decorative, behind everything: a strip
          of bunting, a back shelf of jars, and a vignette that pushes the play
          field forward. Static, so it costs one paint. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: 26,
          backgroundImage:
            'linear-gradient(135deg, #FF9EC0 25%, transparent 25%), linear-gradient(225deg, #FF9EC0 25%, transparent 25%)',
          backgroundSize: '34px 34px', backgroundPosition: '0 -8px', opacity: 0.55,
        }} />
        {/* Back shelf with jars — flat blocks, no art, so it reads as depth
            rather than competing with the jellies in play. */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '30%', height: 3, background: 'rgba(107,33,64,0.10)' }} />
        {[14, 40, 66, 88].map((x, i) => (
          <span key={i} style={{
            position: 'absolute', left: `${x}%`, top: `calc(30% - ${16 + (i % 2) * 5}px)`,
            width: 18, height: 16 + (i % 2) * 5, borderRadius: '6px 6px 3px 3px',
            background: ['#FFC2D6', '#C9E8D2', '#FFE3A8', '#D8C6F0'][i], opacity: 0.5,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(78% 58% at 50% 46%, rgba(255,255,255,0) 0%, rgba(214,120,160,0.22) 100%)',
        }} />
      </div>

      {/* ── HUD ── */}
      <div className="absolute left-0 right-0 flex items-center gap-2 px-3" style={{
        top: 'calc(var(--safe-top) + 8px)', zIndex: 30,
      }}>
        <button onClick={() => { playSound('ui_back'); router.push('/jelly') }} aria-label="Back"
          className="flex items-center justify-center active:translate-y-[1px] transition-transform"
          style={{ width: 34, height: 34, background: '#FFFDF6', borderRadius: 8, border: '3px solid #6B2140', boxShadow: '0 3px 0 #6B2140' }}>
          <ChevronLeft size={15} style={{ color: '#6B2140' }} />
        </button>
        <div className="flex items-center gap-1 px-2.5 py-1.5" style={{
          background: '#FFFDF6', borderRadius: 8, border: '3px solid #6B2140', boxShadow: '0 3px 0 #6B2140',
        }}>
          <IconJelly size={12} />
          <span className="font-pixel" style={{ fontSize: 10, color: '#6B2140' }}>{score}</span>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1" aria-label={`${lives} lives left`}>
          {Array.from({ length: LIVES }).map((_, i) => (
            <span key={i} style={{
              width: 13, height: 13, borderRadius: '50%',
              background: i < lives ? '#FF4D77' : 'rgba(107,33,64,0.18)',
              border: '2.5px solid #6B2140',
            }} />
          ))}
        </div>
      </div>

      {/* Combo banner — only while a chain is alive. */}
      {combo >= 2 && phase === 'play' && (
        <div className="absolute left-1/2 -translate-x-1/2 px-3 py-1.5" style={{
          top: 'calc(var(--safe-top) + 52px)', zIndex: 30,
          background: '#6B2140', borderRadius: 999, border: '2.5px solid #FFFDF6',
          animation: reduced ? undefined : 'jellyComboPop 320ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          <span className="font-pixel" style={{ fontSize: 8, color: '#FFD9E6' }}>{combo} CHAIN · x{mult}</span>
        </div>
      )}

      {/* ── Field ── */}
      <div ref={fieldRef} className="absolute inset-0" onPointerDown={e => {
        (e.target as Element).setPointerCapture?.(e.pointerId)
        lastPt.current = null
        onPointer(e)
      }} onPointerMove={onPointer} onPointerUp={() => { lastPt.current = null }}>
        {flies.current.map(f => (
          <div key={f.id} ref={el => { f.el = el }} style={{
            position: 'absolute', left: 0, top: 0, width: JELLY_R * 2, height: JELLY_R * 2,
            willChange: 'transform', pointerEvents: 'none',
          }}>
            {f.sliced ? (
              // A cut jelly: the same art split down the middle, halves parting.
              <>
                <img src={f.jelly.art} alt="" draggable={false} style={{ ...halfStyle, clipPath: 'inset(0 50% 0 0)', transform: 'translateX(-7px)' }} />
                <img src={f.jelly.art} alt="" draggable={false} style={{ ...halfStyle, clipPath: 'inset(0 0 0 50%)', transform: 'translateX(7px)' }} />
              </>
            ) : (
              <img src={f.jelly.art} alt="" draggable={false} style={halfStyle} />
            )}
          </div>
        ))}

        {bits.current.map(b => (
          <div key={b.id} ref={el => { b.el = el }} aria-hidden style={{
            position: 'absolute', left: 0, top: 0, width: 9, height: 9, borderRadius: '50%',
            background: b.colour, willChange: 'transform, opacity', pointerEvents: 'none',
          }} />
        ))}

        {/* Blade trail — one polyline, repointed each frame. */}
        <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }} width="100%" height="100%">
          <polyline ref={trailRef} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={7}
            strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px rgba(255,120,170,0.9))' }} />
        </svg>
      </div>

      {/* ── Eren + counter ── */}
      <div className="absolute left-0 right-0 flex flex-col items-center pointer-events-none" style={{
        bottom: 'calc(var(--safe-bottom) + 4px)', zIndex: 10,
      }}>
        <PixelEren pose={pose} size={62} />
        <div style={{
          width: '100%', height: 26,
          background: 'linear-gradient(180deg, #E8A8C2, #C97A9C)',
          borderTop: '3px solid #6B2140',
        }} />
      </div>

      {/* ── Start card ── */}
      {phase === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center px-6" style={{ zIndex: 40, background: 'rgba(107,33,64,0.42)' }}>
          <div className="w-full flex flex-col items-center gap-3" style={{
            maxWidth: 280, padding: 18, borderRadius: 16, background: '#FFFDF6',
            border: '3px solid #6B2140', boxShadow: '0 6px 0 #6B2140',
          }}>
            <IconJelly size={26} />
            <p className="font-pixel text-center" style={{ fontSize: 11, color: '#6B2140' }}>JELLY SLICE</p>
            <p className="text-center" style={{ fontSize: 10.5, lineHeight: 1.55, color: '#7A4B5E' }}>
              Swipe across the jellies to cut them. Catch several in one stroke to
              chain a combo. Let three fall past Eren and the round is over.
            </p>
            <button onClick={() => { playSound('ui_select'); start() }}
              className="w-full py-3 mt-1 active:translate-y-[1px] transition-transform"
              style={{ borderRadius: 12, background: 'linear-gradient(180deg, #FF7FA6, #E14C7C)', border: '3px solid #6B2140', boxShadow: '0 4px 0 #6B2140' }}>
              <span className="font-pixel" style={{ fontSize: 9, color: '#FFFDF6' }}>START</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'over' && result && (
        <JellyPrize
          score={score} best={Math.max(duel.best, score)} isBest={result.isBest}
          unit="PTS" threshold={THRESHOLD} duel={result.duel} wins={wins}
          ownedCount={jellies.ownedCount} total={jellies.total}
          onPlayAgain={start}
          onExit={() => router.push('/jelly')}
        />
      )}
    </div>
  )
}

const halfStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  objectFit: 'contain', imageRendering: 'auto',
}

/**
 * Does the pointer's travel this frame pass through the jelly?
 *
 * Closest point on segment AB to the circle centre, then a radius test. A point
 * test on the pointer's CURRENT position would miss everything a fast flick
 * jumped over between frames.
 */
function segmentHitsCircle(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, r: number,
): boolean {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((cx - ax) * dx + (cy - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const px = ax + t * dx - cx, py = ay + t * dy - cy
  return px * px + py * py <= r * r
}
