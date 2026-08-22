'use client'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// JELLY SLICE — flick the jellies out of the air; Eren catches what falls.
//
// ── Why it isn't "swipe and everything dies" any more ──────────────────────
// The first build cut anything the pointer passed over, which meant a finger
// held down and scribbled in circles cleared every wave. Three rules fixed it,
// and they compound:
//
//   1. SPEED GATE.  A cut only registers where the blade was moving faster
//      than MIN_CUT_SPEED. Dragging slowly through a jelly does nothing at all,
//      so the verb is a FLICK, not a scribble, and the stroke has to be aimed
//      before it's thrown.
//   2. SOUR JELLIES.  Cutting one costs a life. Scribbling is now the worst
//      strategy in the game rather than the best one — you have to look at
//      what you're about to hit. Letting one fall is free, so the hazard only
//      ever punishes a bad cut, never a cautious player.
//   3. SHELLED JELLIES.  Two cuts, and the crust eats the first one. A single
//      wide sweep no longer collects the whole wave; you have to come back.
//
// Difficulty is a director rather than a timer: as the round ages, waves come
// closer together, get bigger, and shift composition toward sour and shelled.
//
// ── Engine ─────────────────────────────────────────────────────────────────
// Entities live in a ref and are written straight to the DOM inside one rAF
// loop. React re-renders only on EVENTS (a slice, a miss, game over), never per
// frame: at 60fps with a dozen flyers plus halves and droplets, a state update
// per frame is the difference between smooth and a slideshow on a phone.
//
// Slicing is a segment-vs-circle test against the pointer's travel THIS frame,
// not a point test on its current position. A fast flick moves 200px between
// events, and a point test simply misses everything it passed through — which
// reads to the player as the game ignoring them.
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
import SliceStage, { SliceCounter } from '@/components/jelly/SliceStage'
import SliceFlyer, { type FlyerKind } from '@/components/jelly/SliceFlyer'
import PixelEren, { type ErenPose } from '@/components/games/PixelEren'
import { IconJelly } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

// ─── Tuning ────────────────────────────────────────────────────────────────
const GRAVITY = 1000          // px/s²
const PEAK_FRAC = 0.55        // a jelly tops out this far up the field
const LIVES = 3
const R_NORMAL = 30           // hit radius, px
const R_GOLD = 21             // the precision target is genuinely smaller
const BASE_POINTS = 10
const GOLD_POINTS = 50
const SHELL_POINTS = 25
/** Score that earns a jelly. Twelve plain cuts, or far fewer on a chain. */
const THRESHOLD = 120
const TRAIL_MS = 160          // how long a blade point stays on the trail
/** Slices within this window chain into one combo. */
const COMBO_MS = 620
/**
 * The blade only bites above this speed (px/s). Tuned against a real flick:
 * a deliberate swipe crosses a phone in ~0.25s (≈1400px/s), a slow drag sits
 * near 200. 620 rejects the drag with room to spare while never fighting an
 * honest stroke — and it is why the game can't be scribbled.
 */
const MIN_CUT_SPEED = 620
const WAVE_MS_START = 1500
const WAVE_MS_MIN = 560
/** Every wave shortens the gap a touch. */
const WAVE_RAMP = 0.962
/** Seconds of round after which the director is at full strength. */
const RAMP_SECONDS = 150

interface Fly {
  id: number
  kind: FlyerKind
  jelly: JellyDef
  r: number
  x: number; y: number
  vx: number; vy: number
  spin: number; spinV: number
  sliced: boolean
  /** SHELLED: the crust is off and the next cut splits it. */
  cracked: boolean
  /**
   * The stroke that last touched this one. One stroke may only interact with a
   * given jelly ONCE: a swipe fires many pointermove events, several of which
   * pass through the same jelly, so without this a single sweep cracked a
   * sugared jelly and split it in the same gesture — which quietly deleted the
   * two-cut rule. Combos are unaffected: separate jellies have separate marks.
   */
  lastStroke: number
  /** Halves fly apart with their own drift once cut. */
  halfDir: number
  el?: HTMLDivElement | null
}

interface Bit {
  id: number
  x: number; y: number
  vx: number; vy: number
  colour: string
  size: number
  life: number
  el?: HTMLDivElement | null
}

interface Pop {
  id: number
  x: number; y: number
  text: string
  tone: 'score' | 'bad'
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
  const [pops, setPops] = useState<Pop[]>([])
  const [wins, setWins] = useState<JellyWin[]>([])
  const [result, setResult] = useState<{ isBest: boolean; duel: DuelLine } | null>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
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
  const startedAt = useRef(0)
  /** Bumped on every press. Starts at 1 so it can never equal a fresh
   *  flyer's `lastStroke` of 0. */
  const stroke = useRef(1)
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

  /** Floating "+30" / "SOUR!" over the cut. Self-clearing. */
  const popup = useCallback((x: number, y: number, text: string, tone: Pop['tone']) => {
    const id = ++uid
    setPops(p => [...p.slice(-6), { id, x, y, text, tone }])
    window.setTimeout(() => setPops(p => p.filter(q => q.id !== id)), 780)
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

  /**
   * The loop must NOT depend on endRound.
   *
   * endRound closes over `jellies` and `duel`, which are fresh objects from
   * their hooks on every render — so it changes identity constantly, and an
   * effect that lists it tears the rAF loop down and rebuilds it on every
   * score tick. That resets the wave clock and the difficulty ramp several
   * times a second, which is why the round never got harder. Calling through a
   * ref keeps the loop mounted for the whole round.
   */
  const endRoundRef = useRef(endRound)
  useEffect(() => { endRoundRef.current = endRound }, [endRound])

  // ── Spawning ──────────────────────────────────────────────────────────────
  /**
   * The difficulty director. `heat` runs 0→1 over RAMP_SECONDS and is the only
   * thing that changes about the game over a round: what gets thrown, and how
   * often. Composition is deliberately ordered — sour appears immediately (so
   * the rule is taught in the first ten seconds, while a life is cheap),
   * shelled joins about twelve seconds in — late enough that the first cuts
   * are unobstructed, early enough that a beginner who dies at forty seconds
   * has still met all three.
   */
  const launch = useCallback((W: number, H: number, heat: number) => {
    const roll = Math.random()
    const sourChance = 0.10 + heat * 0.20
    const shellChance = heat < 0.08 ? 0 : 0.10 + heat * 0.14
    const kind: FlyerKind = roll < 0.045 ? 'golden'
      : roll < 0.045 + sourChance ? 'sour'
        : roll < 0.045 + sourChance + shellChance ? 'shelled'
          : 'jelly'

    const r = kind === 'golden' ? R_GOLD : R_NORMAL
    // Gold flies higher and faster; it should feel like a chance you take.
    const peak = H * PEAK_FRAC * (kind === 'golden' ? 1.16 : 1) * (0.9 + Math.random() * 0.2)
    const v0 = Math.sqrt(2 * GRAVITY * peak)
    const x = W * (0.14 + Math.random() * 0.72)
    // Aim the arc back toward the middle so nothing leaves sideways unplayable.
    const drift = ((W / 2 - x) / (W / 2)) * (60 + Math.random() * 90) * (kind === 'golden' ? 1.5 : 1)

    flies.current.push({
      id: ++uid,
      kind,
      jelly: JELLIES[Math.floor(Math.random() * JELLIES.length)],
      r,
      x, y: H + r,
      vx: drift, vy: -v0,
      spin: 0, spinV: (Math.random() - 0.5) * 200,
      sliced: false, cracked: false, halfDir: 0, lastStroke: 0,
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
      const heat = Math.min(1, (now - startedAt.current) / (RAMP_SECONDS * 1000))

      let spawned = false
      if (now >= nextWave.current) {
        // Wave size grows with heat, and a big wave is what makes one aimed
        // stroke worth more than three panicked ones.
        const n = 1 + (Math.random() < 0.3 + heat * 0.4 ? 1 : 0) + (Math.random() < heat * 0.5 ? 1 : 0)
        for (let i = 0; i < n; i++) launch(W, H, heat)
        spawned = true
        waveGap.current = Math.max(WAVE_MS_MIN, waveGap.current * WAVE_RAMP)
        nextWave.current = now + waveGap.current
      }

      let listChanged = false
      let missed = 0
      if (spawned) listChanged = true   // new flyers need a render to get an el
      flies.current = flies.current.filter(f => {
        f.vy += GRAVITY * dt
        f.x += f.vx * dt
        f.y += f.vy * dt
        f.spin += f.spinV * dt
        if (f.sliced) f.x += f.halfDir * 90 * dt

        if (f.y > H + f.r * 2.4) {
          // Letting a SOUR one fall is exactly right, so it costs nothing.
          if (!f.sliced && f.kind !== 'sour') missed++
          listChanged = true
          return false
        }
        if (f.el) {
          f.el.style.transform =
            `translate3d(${f.x - f.r}px, ${f.y - f.r}px, 0) rotate(${f.spin}deg)`
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
        if (livesRef.current <= 0 && phaseRef.current === 'play') void endRoundRef.current()
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
  }, [phase, launch, flash])

  // ── Slicing ───────────────────────────────────────────────────────────────
  const burst = useCallback((f: Fly, n: number, colour?: string) => {
    for (let i = 0; i < n; i++) {
      bits.current.push({
        id: ++uid, x: f.x, y: f.y,
        vx: (Math.random() - 0.5) * 420, vy: -60 - Math.random() * 260,
        colour: colour ?? f.jelly.colour,
        size: 6 + Math.random() * 5,
        life: 0.45 + Math.random() * 0.3,
      })
    }
  }, [])

  /**
   * Resolve one blade segment. `fast` is the speed gate: below it the blade is
   * a finger resting on glass and passes through everything.
   */
  const cutAt = useCallback((ax: number, ay: number, bx: number, by: number, fast: boolean) => {
    if (!fast) return
    let hits = 0
    let gained = 0
    let stung = false

    const sid = stroke.current
    for (const f of flies.current) {
      if (f.sliced) continue
      if (f.lastStroke === sid) continue      // one interaction per jelly per stroke
      if (!segmentHitsCircle(ax, ay, bx, by, f.x, f.y, f.r)) continue
      f.lastStroke = sid

      if (f.kind === 'sour') {
        // The one thing you must not do. It ends the chain, costs a life, and
        // the jelly itself is removed so a wild follow-through can't hit it twice.
        f.sliced = true
        f.halfDir = bx >= ax ? 1 : -1
        stung = true
        burst(f, 10, '#B6FF3D')
        popup(f.x, f.y, 'SOUR!', 'bad')
        continue
      }

      if (f.kind === 'shelled' && !f.cracked) {
        // The crust takes this cut. No points, no combo — but no penalty either.
        f.cracked = true
        f.spinV = (bx >= ax ? 1 : -1) * 260
        burst(f, 6, '#FFFFFF')
        playSound('jl_slice')
        force(v => v + 1)
        continue
      }

      f.sliced = true
      f.halfDir = bx >= ax ? 1 : -1
      f.spinV = f.halfDir * 320
      hits++
      gained += f.kind === 'golden' ? GOLD_POINTS : f.kind === 'shelled' ? SHELL_POINTS : BASE_POINTS
      burst(f, f.kind === 'golden' ? 12 : 7, f.kind === 'golden' ? '#FFD86B' : undefined)
    }

    if (stung) {
      // One life per STROKE, not per sour jelly: catching two in one sweep is a
      // single mistake, and taking two lives for it reads as a bug to the player.
      livesRef.current -= 1
      setLives(Math.max(0, livesRef.current))
      comboRef.current = { n: 0, until: 0 }
      setCombo(0)
      kick(rootRef.current)
      playSound('jl_miss')
    }

    if (hits > 0) {
      const now = performance.now()
      const c = comboRef.current
      // A chain continues while slices keep landing inside the window; slicing
      // several in ONE stroke counts each, which is what makes a big sweep pay.
      // If the same sweep also hit a sour one the chain was just reset above,
      // so those cuts start a fresh chain at x1 rather than being thrown away.
      c.n = now <= c.until ? c.n + hits : hits
      c.until = now + COMBO_MS
      const mult = Math.min(5, 1 + Math.floor((c.n - 1) / 2))
      const won = gained * mult
      scoreRef.current += won
      setScore(scoreRef.current)
      setCombo(c.n)
      popup(bx, by, `+${won}`, 'score')
      if (!stung) playSound(c.n >= 3 ? 'jl_combo' : 'jl_slice')
    }

    if (stung || hits > 0) {
      flash(stung ? 'wobble' : 'cheer')
      force(v => v + 1)
    }

    // Death is resolved LAST, so a sweep that took the final life still banks
    // the good jellies it cut on the way through.
    if (stung && livesRef.current <= 0 && phaseRef.current === 'play') void endRoundRef.current()
  }, [burst, popup, flash])

  const lastPt = useRef<{ x: number; y: number; t: number } | null>(null)
  /**
   * Only the finger that started the stroke draws the blade.
   *
   * `lastPt` is a single shared point, so a second finger landing elsewhere
   * would make the next segment run from finger A's last position to finger
   * B's — a blade across the whole screen that cuts everything between them.
   */
  const activePointer = useRef<number | null>(null)
  const endStroke = useCallback(() => { activePointer.current = null; lastPt.current = null }, [])

  const onPointer = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current !== 'play') return
    if (activePointer.current !== null && e.pointerId !== activePointer.current) return
    const field = fieldRef.current
    if (!field) return
    const r = field.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    // e.timeStamp, not performance.now(): pointer events are delivered in
    // batches, so several moves can land in one task and read as near-zero
    // elapsed time on the handler's clock — which inflates the measured speed
    // and would let a slow drag through the gate.
    const t = e.timeStamp || performance.now()
    trail.current.push({ x, y, t: performance.now() })
    const p = lastPt.current
    if (p) {
      const dx = x - p.x, dy = y - p.y
      // Guard the divisor: coalesced events can report a sub-millisecond gap,
      // which would read a 2px nudge as thousands of px/s and open the gate.
      const dtSec = Math.max(t - p.t, 6) / 1000
      const speed = Math.hypot(dx, dy) / dtSec
      cutAt(p.x, p.y, x, y, speed >= MIN_CUT_SPEED)
    }
    lastPt.current = { x, y, t }
  }, [cutAt])

  const start = useCallback(() => {
    flies.current = []; bits.current = []; trail.current = []
    scoreRef.current = 0; livesRef.current = LIVES
    comboRef.current = { n: 0, until: 0 }
    savedRef.current = false
    lastPt.current = null
    startedAt.current = performance.now()
    setScore(0); setLives(LIVES); setCombo(0); setPops([]); setWins([]); setResult(null)
    phaseRef.current = 'play'
    setPhase('play')
  }, [])

  useEffect(() => () => { if (poseTimer.current) window.clearTimeout(poseTimer.current) }, [])

  const mult = Math.min(5, 1 + Math.floor((Math.max(combo, 1) - 1) / 2))

  return (
    <div ref={rootRef} className="fixed inset-0 overflow-hidden select-none"
      style={{ background: '#3E1526', touchAction: 'none' }}>
      <SliceStage />

      {/* ── HUD ── */}
      <div className="absolute left-0 right-0 flex items-center gap-2 px-3" style={{
        top: 'calc(var(--safe-top) + 8px)', zIndex: 30,
      }}>
        <button onClick={() => { playSound('ui_back'); router.push('/jelly') }} aria-label="Back"
          className="flex items-center justify-center active:translate-y-[1px] transition-transform"
          style={{ width: 34, height: 34, background: '#FFF8EE', borderRadius: 8, border: '3px solid #3A1F2B', boxShadow: '0 3px 0 #3A1F2B' }}>
          <ChevronLeft size={15} style={{ color: '#3A1F2B' }} />
        </button>
        <div className="flex items-center gap-1 px-2.5 py-1.5" style={{
          background: '#FFF8EE', borderRadius: 8, border: '3px solid #3A1F2B', boxShadow: '0 3px 0 #3A1F2B',
        }}>
          <IconJelly size={12} />
          <span className="font-pixel" style={{ fontSize: 10, color: '#3A1F2B' }}>{score}</span>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1" aria-label={`${lives} lives left`}>
          {Array.from({ length: LIVES }).map((_, i) => (
            <span key={i} style={{
              width: 13, height: 13, borderRadius: '50%',
              background: i < lives ? '#FF4D77' : 'rgba(255,248,238,0.16)',
              border: '2.5px solid #3A1F2B',
            }} />
          ))}
        </div>
      </div>

      {/* Combo banner — only while a chain is alive. */}
      {combo >= 2 && phase === 'play' && (
        <div className="absolute left-1/2 -translate-x-1/2 px-3 py-1.5" style={{
          top: 'calc(var(--safe-top) + 52px)', zIndex: 30,
          background: '#3A1F2B', borderRadius: 999, border: '2.5px solid #FFD9E6',
          animation: reduced ? undefined : 'jellyComboPop 320ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          <span className="font-pixel" style={{ fontSize: 8, color: '#FFD9E6' }}>{combo} CHAIN · x{mult}</span>
        </div>
      )}

      {/* ── Field ── */}
      <div ref={fieldRef} className="absolute inset-0" style={{ zIndex: 5 }}
        onPointerDown={e => {
          (e.target as Element).setPointerCapture?.(e.pointerId)
          // A new stroke. This is what lets a sugared jelly be SPLIT by a
          // second swipe after the first cracked it — without the bump every
          // jelly stays marked with stroke 1 forever and can be touched once,
          // ever. It also has to happen before the first onPointer of the press.
          stroke.current += 1
          activePointer.current = e.pointerId
          lastPt.current = null
          onPointer(e)
        }}
        onPointerMove={onPointer}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}>

        {flies.current.map(f => (
          <div key={f.id} ref={el => { f.el = el }} style={{
            position: 'absolute', left: 0, top: 0, width: f.r * 2, height: f.r * 2,
            willChange: 'transform', pointerEvents: 'none',
          }}>
            <SliceFlyer kind={f.kind} jelly={f.jelly} r={f.r} sliced={f.sliced} cracked={f.cracked} />
          </div>
        ))}

        {bits.current.map(b => (
          <div key={b.id} ref={el => { b.el = el }} aria-hidden style={{
            position: 'absolute', left: 0, top: 0, width: b.size, height: b.size, borderRadius: '50%',
            background: b.colour, willChange: 'transform, opacity', pointerEvents: 'none',
          }} />
        ))}

        {pops.map(p => (
          <span key={p.id} aria-hidden className="font-pixel" style={{
            position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%, -50%)',
            fontSize: p.tone === 'bad' ? 11 : 10,
            color: p.tone === 'bad' ? '#B6FF3D' : '#FFF8EE',
            textShadow: '2px 2px 0 rgba(0,0,0,0.65)', pointerEvents: 'none',
            animation: reduced ? undefined : 'slicePop 780ms ease-out forwards',
          }}>{p.text}</span>
        ))}

        {/* Blade trail — one polyline, repointed each frame. */}
        <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }} width="100%" height="100%">
          <polyline ref={trailRef} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={7}
            strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px rgba(255,120,170,0.9))' }} />
        </svg>
      </div>

      {/* ── Eren + counter ── */}
      <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom: 0, zIndex: 10 }}>
        <div className="flex justify-center" style={{ marginBottom: -3 }}>
          <PixelEren pose={pose} size={70} />
        </div>
        <SliceCounter />
      </div>

      {/* ── Start card ── */}
      {phase === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center px-6" style={{ zIndex: 40, background: 'rgba(30,8,18,0.62)' }}>
          <div className="w-full flex flex-col items-center gap-2.5" style={{
            maxWidth: 292, padding: 18, borderRadius: 16, background: '#FFF8EE',
            border: '3px solid #3A1F2B', boxShadow: '0 6px 0 #3A1F2B',
          }}>
            <IconJelly size={26} />
            <p className="font-pixel text-center" style={{ fontSize: 11, color: '#3A1F2B' }}>JELLY SLICE</p>
            <p className="text-center" style={{ fontSize: 10.5, lineHeight: 1.5, color: '#7A4B5E' }}>
              <strong style={{ color: '#3A1F2B' }}>Flick</strong> — a slow drag cuts nothing.
              Catch several in one stroke to chain a combo.
            </p>
            <div className="w-full flex flex-col gap-1.5 my-0.5">
              <Rule swatch="#B6FF3D" text="SOUR ones cost a life if you cut them. Let them fall." />
              <Rule swatch="#DCE9FF" text="SUGARED ones need two cuts — the crust eats the first." />
              <Rule swatch="#FFD86B" text="GOLDEN ones are small, fast and worth five." />
            </div>
            <p className="text-center" style={{ fontSize: 10, color: '#9A7484' }}>
              Let three jellies past Eren and the round is over.
            </p>
            <button onClick={() => { playSound('ui_select'); start() }}
              className="w-full py-3 mt-1 active:translate-y-[1px] transition-transform"
              style={{ borderRadius: 12, background: 'linear-gradient(180deg, #FF7FA6, #E14C7C)', border: '3px solid #3A1F2B', boxShadow: '0 4px 0 #3A1F2B' }}>
              <span className="font-pixel" style={{ fontSize: 9, color: '#FFF8EE' }}>START</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'over' && result && (
        <JellyPrize
          score={score} best={Math.max(duel.best, score)} isBest={result.isBest}
          unit="PTS" threshold={THRESHOLD} duel={result.duel} wins={wins}
          trayCount={jellies.trayCount} traySize={jellies.traySize}
          onPlayAgain={start}
          onExit={() => router.push('/jelly')}
        />
      )}
    </div>
  )
}

function Rule({ swatch, text }: { swatch: string; text: string }) {
  return (
    <span className="flex items-start gap-2">
      <span style={{
        width: 11, height: 11, borderRadius: '50%', background: swatch,
        border: '2px solid #3A1F2B', flexShrink: 0, marginTop: 1,
      }} />
      <span style={{ fontSize: 9.5, lineHeight: 1.35, color: '#7A4B5E' }}>{text}</span>
    </span>
  )
}

/**
 * Restart the screen-shake on an element that may already be mid-shake.
 *
 * Imperative on purpose. Driving it from React state means changing a `key` or
 * a style every time a sour jelly is cut, which throws away and rebuilds the
 * whole field's DOM (and every entity's ref) in the middle of a round. This
 * touches one style property and the standard reflow-to-restart trick.
 */
function kick(el: HTMLElement | null) {
  if (!el) return
  el.style.animation = 'none'
  void el.offsetWidth
  el.style.animation = 'sliceShake 260ms ease-out'
}

/**
 * Does the pointer's travel this frame pass through the jelly?
 *
 * Closest point on segment AB to the circle centre, then a radius test. A point
 * test on the pointer's CURRENT position would miss everything a fast flick
 * jumped over between events.
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
