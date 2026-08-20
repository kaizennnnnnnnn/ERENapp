'use client'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// JELLY JUMP — bounce Eren up the wobbling jellies.
//
// Same engine discipline as Jelly Slice: entities in refs, one rAF loop writing
// transforms straight to the DOM, React re-rendering only when the platform
// LIST changes (a jelly recycled off the bottom) rather than every frame.
//
// The world scrolls, Eren doesn't. He's pinned near the middle of the screen
// and the platforms slide down past him, which keeps him in the player's eye
// line at every height and means the "camera" is one number instead of a
// transform on a container that would blur the sprite.
//
// Steering is HOLD, not tap: touch the left or right half and he accelerates
// that way, release and he coasts. Tapping to nudge reads as unresponsive on a
// body that's already in the air, and a run is one long arc of steering.
//
// Platforms squish on contact and then melt — one bounce each. That's what
// stops the safe strategy of camping on a single jelly, so the only way to
// score is to keep committing upward.
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
const GRAVITY = 1750          // px/s²
const BOUNCE_V = 780          // px/s launched off a jelly
const MOVE_A = 2600           // px/s² while steering
const MAX_VX = 430
const DRAG = 0.86             // per-frame coast damping when not steering
const EREN = 46               // sprite box
const PLAT_W = 76
const PLAT_H = 26
/** Eren sits this far down the screen; the world scrolls under him. */
const CAM_ANCHOR = 0.46
/** Vertical gap between platforms — tightened as you climb. */
const GAP_START = 118
const GAP_MIN = 96
const GAP_MAX = 152
const THRESHOLD = 400         // height needed to earn a jelly
/** Height (px) per point — a run reads in hundreds, not tens of thousands. */
const PX_PER_M = 8

interface Plat {
  id: number
  x: number
  /** World Y — grows downward; the camera subtracts from it. */
  wy: number
  jelly: JellyDef
  used: boolean
  /** 0..1 squish, decays after a bounce. */
  squish: number
  el?: HTMLDivElement | null
}

let uid = 0

export default function JellyJumpPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const reduced = useReducedMotion()
  const jellies = useJellies()
  const duel = useJellyDuel('jump')

  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [height, setHeight] = useState(0)
  const [pose, setPose] = useState<ErenPose>('idle')
  const [wins, setWins] = useState<JellyWin[]>([])
  const [result, setResult] = useState<{ isBest: boolean; duel: DuelLine } | null>(null)

  const fieldRef = useRef<HTMLDivElement | null>(null)
  const erenRef = useRef<HTMLDivElement | null>(null)
  const skyRef = useRef<HTMLDivElement | null>(null)
  const plats = useRef<Plat[]>([])
  const cat = useRef({ x: 0, wy: 0, vx: 0, vy: 0 })
  const cam = useRef(0)          // world Y currently at the top of the screen
  const bestWy = useRef(0)       // highest (smallest wy) reached
  const steer = useRef(0)        // -1 / 0 / +1
  const heightRef = useRef(0)
  const phaseRef = useRef<'ready' | 'play' | 'over'>('ready')
  const savedRef = useRef(false)
  const nextPlatWy = useRef(0)
  const milestone = useRef(0)
  const poseTimer = useRef<number | null>(null)
  const [, force] = useState(0)

  useEffect(() => { setHideStats(true); return () => setHideStats(false) }, [setHideStats])

  const flash = useCallback((p: ErenPose, ms = 420) => {
    setPose(p)
    if (poseTimer.current) window.clearTimeout(poseTimer.current)
    poseTimer.current = window.setTimeout(() => setPose('idle'), ms)
  }, [])

  const endRound = useCallback(async () => {
    if (savedRef.current) return
    savedRef.current = true
    phaseRef.current = 'over'
    setPhase('over')
    playSound('jl_over')

    const final = heightRef.current
    const submitted = await duel.submit(final)
    const won: JellyWin[] = []
    if (final >= THRESHOLD) {
      const w = await jellies.awardJelly()
      if (w) won.push(w)
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

  /** Add one platform above the highest so far, with a climbing-difficulty gap. */
  const addPlat = useCallback((W: number) => {
    const climbed = Math.max(0, -nextPlatWy.current) / 1000
    const gap = Math.max(GAP_MIN, Math.min(GAP_MAX, GAP_START + climbed * 9 + (Math.random() - 0.5) * 34))
    nextPlatWy.current -= gap
    plats.current.push({
      id: ++uid,
      x: PLAT_W / 2 + Math.random() * Math.max(1, W - PLAT_W),
      wy: nextPlatWy.current,
      jelly: JELLIES[Math.floor(Math.random() * JELLIES.length)],
      used: false, squish: 0,
    })
  }, [])

  // ── The loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return
    let raf = 0
    let last = performance.now()

    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      const field = fieldRef.current
      if (!field) return
      const W = field.clientWidth, H = field.clientHeight
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      const c = cat.current
      // Steering
      if (steer.current !== 0) c.vx += steer.current * MOVE_A * dt
      else c.vx *= Math.pow(DRAG, dt * 60)
      c.vx = Math.max(-MAX_VX, Math.min(MAX_VX, c.vx))
      c.x += c.vx * dt
      // Wrap around the sides — falling off the edge is a death the player
      // can't see coming on a narrow phone, and wrapping is a real tactic.
      if (c.x < -EREN / 2) c.x = W + EREN / 2
      if (c.x > W + EREN / 2) c.x = -EREN / 2

      c.vy += GRAVITY * dt
      c.wy += c.vy * dt

      // Bounce: only while falling, and only on the way DOWN through the top
      // face — otherwise he sticks to a jelly he's rising through.
      if (c.vy > 0) {
        for (const p of plats.current) {
          if (p.used) continue
          const dx = Math.abs(c.x - p.x)
          if (dx > PLAT_W / 2 + EREN / 4) continue
          const feet = c.wy + EREN / 2
          if (feet >= p.wy && feet <= p.wy + PLAT_H * 0.9) {
            c.vy = -BOUNCE_V
            p.used = true
            p.squish = 1
            playSound('jl_bounce')
            flash('cheer', 260)
            break
          }
        }
      }

      // Camera follows only upward, so a dip doesn't drag the view down.
      const wantCam = c.wy - H * CAM_ANCHOR
      if (wantCam < cam.current) cam.current = wantCam
      if (c.wy < bestWy.current) {
        bestWy.current = c.wy
        const m = Math.max(0, Math.round(-bestWy.current / PX_PER_M))
        if (m !== heightRef.current) {
          heightRef.current = m
          setHeight(m)
          if (m >= milestone.current + 250) {
            milestone.current = m - (m % 250)
            playSound('jl_high')
          }
        }
      }

      // Keep a screen and a half of platforms above, recycle below.
      while (nextPlatWy.current > cam.current - H * 0.6) addPlat(W)
      let listChanged = false
      plats.current = plats.current.filter(p => {
        if (p.wy - cam.current > H + PLAT_H * 3) { listChanged = true; return false }
        if (p.squish > 0) p.squish = Math.max(0, p.squish - dt * 3.2)
        if (p.el) {
          const sy = 1 - p.squish * 0.45
          const sx = 1 + p.squish * 0.3
          p.el.style.transform =
            `translate3d(${p.x - PLAT_W / 2}px, ${p.wy - cam.current}px, 0) scale(${sx}, ${sy})`
          p.el.style.opacity = p.used ? String(Math.max(0.15, 1 - (1 - p.squish) * 0.9)) : '1'
        }
        return true
      })

      // Parallax sky. Without it the climb has no motion cue at all — the
      // platforms scroll, but a screen of static blue reads as hovering. At
      // 0.35x it sits clearly behind the play field.
      if (skyRef.current) {
        skyRef.current.style.backgroundPositionY = `${-cam.current * 0.35}px`
      }

      if (erenRef.current) {
        erenRef.current.style.transform =
          `translate3d(${c.x - EREN / 2}px, ${c.wy - cam.current - EREN / 2}px, 0)`
      }

      // Fallen off the bottom of the view.
      if (c.wy - cam.current > H + EREN * 2 && phaseRef.current === 'play') {
        void endRound()
      }
      if (listChanged) force(v => v + 1)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, addPlat, endRound, flash])

  // ── Steering input ────────────────────────────────────────────────────────
  const setSteerFrom = useCallback((clientX: number) => {
    const field = fieldRef.current
    if (!field) return
    const r = field.getBoundingClientRect()
    steer.current = clientX - r.left < r.width / 2 ? -1 : 1
  }, [])

  // Keyboard for desktop play; the phone uses the halves.
  useEffect(() => {
    if (phase !== 'play') return
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') steer.current = -1
      if (e.key === 'ArrowRight') steer.current = 1
    }
    const up = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' && steer.current === -1) || (e.key === 'ArrowRight' && steer.current === 1)) {
        steer.current = 0
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [phase])

  const start = useCallback(() => {
    const field = fieldRef.current
    const W = field?.clientWidth ?? 360
    const H = field?.clientHeight ?? 640
    plats.current = []
    nextPlatWy.current = 0
    cam.current = -H * CAM_ANCHOR
    // A wide starting jelly right under him so the first bounce is free.
    plats.current.push({ id: ++uid, x: W / 2, wy: 0, jelly: JELLIES[0], used: false, squish: 0 })
    for (let i = 0; i < 9; i++) addPlat(W)
    cat.current = { x: W / 2, wy: -EREN, vx: 0, vy: 0 }
    bestWy.current = 0
    heightRef.current = 0
    milestone.current = 0
    steer.current = 0
    savedRef.current = false
    setHeight(0); setWins([]); setResult(null)
    phaseRef.current = 'play'
    setPhase('play')
  }, [addPlat])

  useEffect(() => () => { if (poseTimer.current) window.clearTimeout(poseTimer.current) }, [])

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{
      background: 'linear-gradient(180deg, #DDF3FF 0%, #B9E4FA 46%, #8FD0EF 100%)',
      touchAction: 'none',
    }}>
      {/* ── HUD ── */}
      <div className="absolute left-0 right-0 flex items-center gap-2 px-3" style={{
        top: 'calc(var(--safe-top) + 8px)', zIndex: 30,
      }}>
        <button onClick={() => { playSound('ui_back'); router.push('/jelly') }} aria-label="Back"
          className="flex items-center justify-center active:translate-y-[1px] transition-transform"
          style={{ width: 34, height: 34, background: '#FFFDF6', borderRadius: 8, border: '3px solid #14415C', boxShadow: '0 3px 0 #14415C' }}>
          <ChevronLeft size={15} style={{ color: '#14415C' }} />
        </button>
        <div className="flex items-center gap-1 px-2.5 py-1.5" style={{
          background: '#FFFDF6', borderRadius: 8, border: '3px solid #14415C', boxShadow: '0 3px 0 #14415C',
        }}>
          <IconJelly size={12} />
          <span className="font-pixel" style={{ fontSize: 10, color: '#14415C' }}>{height}</span>
          <span className="font-pixel" style={{ fontSize: 6, color: '#5C88A3' }}>M</span>
        </div>
        <div className="flex-1" />
        {/* Her line for today, so you can see what you're chasing mid-run. */}
        {duel.theirName && duel.theirsToday > 0 && (
          <div className="px-2 py-1.5" style={{
            background: height > duel.theirsToday ? '#2FA765' : '#14415C',
            borderRadius: 8, border: '2.5px solid #FFFDF6',
          }}>
            <span className="font-pixel" style={{ fontSize: 6, color: '#DDF3FF' }}>
              {duel.theirName.slice(0, 7).toUpperCase()} {duel.theirsToday}
            </span>
          </div>
        )}
      </div>

      {/* ── Field ── */}
      {/* Parallax sky — soft bubbles rising past, one tiled layer rather than
          a field of elements. */}
      <div ref={skyRef} aria-hidden className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:
          'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.55) 0 9px, rgba(255,255,255,0) 10px), ' +
          'radial-gradient(circle at 76% 52%, rgba(255,255,255,0.4) 0 14px, rgba(255,255,255,0) 15px), ' +
          'radial-gradient(circle at 44% 82%, rgba(255,255,255,0.32) 0 7px, rgba(255,255,255,0) 8px)',
        backgroundSize: '100% 420px',
        backgroundRepeat: 'repeat-y',
        zIndex: 0,
      }} />

      <div ref={fieldRef} className="absolute inset-0"
        onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); setSteerFrom(e.clientX) }}
        onPointerMove={e => { if (steer.current !== 0) setSteerFrom(e.clientX) }}
        onPointerUp={() => { steer.current = 0 }}
        onPointerCancel={() => { steer.current = 0 }}>

        {plats.current.map(p => (
          <div key={p.id} ref={el => { p.el = el }} aria-hidden style={{
            position: 'absolute', left: 0, top: 0, width: PLAT_W, height: PLAT_H,
            willChange: 'transform, opacity', pointerEvents: 'none',
            transformOrigin: 'center bottom',
          }}>
            <img src={p.jelly.art} alt="" draggable={false} style={{
              width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'auto',
            }} />
          </div>
        ))}

        <div ref={erenRef} style={{
          position: 'absolute', left: 0, top: 0, width: EREN, height: EREN,
          willChange: 'transform', pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PixelEren pose={pose} size={EREN} />
        </div>
      </div>

      {/* ── Start card ── */}
      {phase === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center px-6" style={{ zIndex: 40, background: 'rgba(20,65,92,0.42)' }}>
          <div className="w-full flex flex-col items-center gap-3" style={{
            maxWidth: 280, padding: 18, borderRadius: 16, background: '#FFFDF6',
            border: '3px solid #14415C', boxShadow: '0 6px 0 #14415C',
          }}>
            <IconJelly size={26} />
            <p className="font-pixel text-center" style={{ fontSize: 11, color: '#14415C' }}>JELLY JUMP</p>
            <p className="text-center" style={{ fontSize: 10.5, lineHeight: 1.55, color: '#4B6E84' }}>
              Hold the left or right side of the screen to steer him. Each jelly
              squishes once and melts, so keep climbing. Slip past the bottom and
              the run ends.
            </p>
            <button onClick={() => { playSound('ui_select'); start() }}
              className="w-full py-3 mt-1 active:translate-y-[1px] transition-transform"
              style={{ borderRadius: 12, background: 'linear-gradient(180deg, #7FD4F5, #3F9FD1)', border: '3px solid #14415C', boxShadow: '0 4px 0 #14415C' }}>
              <span className="font-pixel" style={{ fontSize: 9, color: '#FFFDF6' }}>START</span>
            </button>
          </div>
        </div>
      )}

      {/* Steering hint — first run only, fades on its own. */}
      {phase === 'play' && height === 0 && !reduced && (
        <div className="absolute left-0 right-0 flex justify-between px-8 pointer-events-none" style={{
          bottom: '22%', zIndex: 20, animation: 'jellyHintFade 2.6s ease-out forwards',
        }}>
          {['◀ HOLD', 'HOLD ▶'].map(t => (
            <span key={t} className="font-pixel px-2.5 py-1.5" style={{
              fontSize: 7, color: '#FFFDF6', background: 'rgba(20,65,92,0.65)', borderRadius: 999,
            }}>{t}</span>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {phase === 'over' && result && (
        <JellyPrize
          score={height} best={Math.max(duel.best, height)} isBest={result.isBest}
          unit="M" threshold={THRESHOLD} duel={result.duel} wins={wins}
          ownedCount={jellies.ownedCount} total={jellies.total}
          onPlayAgain={start}
          onExit={() => router.push('/jelly')}
        />
      )}
    </div>
  )
}
