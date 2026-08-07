'use client'

// ─── HangingDonut ────────────────────────────────────────────────────────────
// The donut hanging from the attic's ceiling ring, on a rope you can grab and
// swing.
//
// It's a rigid pendulum: the rope and the donut are one body rotating about the
// ring, which is what a taut rope with something heavy on the end actually
// does. Angular acceleration is `-ω₀²·sinθ - damping·ω` — the real equation,
// not an eased keyframe, so a hard flick behaves differently from a nudge and
// the swing decays on its own.
//
// The tuning constant is a natural FREQUENCY, not a gravity in pixels. A
// px/s² gravity would make the donut swing at a different speed on every phone
// size; ω₀ keeps the period identical everywhere.
//
// ── Geometry ────────────────────────────────────────────────────────────────
// Every number below was measured, not guessed:
//   · the ceiling ring is painted into AtticDay/Night at (468.75, 426) of
//     941×1672 — the rope has to start inside it or it reads as floating
//   · the donut art already has a rope painted onto it, running down into the
//     hole and ending in a knot. The CSS rope is a continuation of THAT rope,
//     so it matches its width and colours and meets it at the donut's top edge,
//     47.17% across. Change one and the seam shows.
//
// Sizes are fractions of the room's HEIGHT, never its width: the backdrop is
// `background-size: cover` on a portrait image, so height maps 1:1 to the
// viewport while width is cropped. Sizing off width would drift the donut off
// its rope on a wider screen.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useIsDark } from '@/hooks/useIsDark'

// ── Measured against the room art (941×1672) ──
const ANCHOR_X = 468.75 / 941   // the painted ceiling ring
const ANCHOR_Y = 426 / 1672
const ROPE_LEN = 234 / 1672     // ring → donut top
const DONUT_H  = 179 / 1672
// ── Measured against donut.png (300×292) ──
const DONUT_AR     = 300 / 292
const ROPE_ENTRY_X = 0.4717     // where its painted rope meets the top edge
const ROPE_W_FRAC  = 14 / 300   // that painted rope's width

// ── Swing ──
const OMEGA0    = 5.2   // rad/s. Period ≈ 1.2s — heavy enough to read as dough.
const DAMPING   = 0.9   // settles over ~6 swings
const MAX_ANGLE = 1.25  // can't be flung above horizontal
const MAX_SPIN  = 9     // caps a violent flick
// Below ~0.005 rad the donut has moved less than a pixel, so the loop parks
// itself rather than burning frames on invisible motion.
const REST_A    = 0.005
const REST_W    = 0.02
const INTRO     = 0.10  // a small sway on arrival, as if the door disturbed it
const TAP_NUDGE = 2.4   // a tap that never moved still pushes it
const TAP_SLOP  = 6     // px of travel below which a drag counts as a tap

// The night plate is painted at ~0.68 of the day plate's luminance (measured
// off the gable wall in both). A prop that ignores that reads as a sticker
// pasted on the room, so the donut and its rope dim with everything else.
const NIGHT_FILTER = 'brightness(0.7) saturate(0.88)'

export default function HangingDonut() {
  const rootRef  = useRef<HTMLDivElement>(null)
  const pivotRef = useRef<HTMLDivElement>(null)
  const reduced  = useReducedMotion()
  const isDark   = useIsDark()

  // Room size drives every dimension AND the drag maths, so it's measured
  // rather than expressed in vh (which on mobile means the *large* viewport,
  // not the box this actually renders into).
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => setRoom({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Physics state lives in refs: it updates every frame and must not re-render
  // React 60 times a second. The pivot's transform is written directly.
  const theta = useRef(reduced ? 0 : INTRO)
  const omega = useRef(0)
  const raf   = useRef<number | null>(null)
  const last  = useRef(0)

  const drag = useRef<{
    id: number
    offset: number      // pointer angle − θ at grab, so grabbing never teleports it
    moved: number       // px travelled, to tell a drag from a tap
    startX: number
    startY: number
    lastT: number
    lastA: number
  } | null>(null)

  const paint = useCallback(() => {
    const el = pivotRef.current
    if (el) el.style.transform = `rotate(${theta.current}rad)`
  }, [])

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
    const el = pivotRef.current
    if (el) el.style.willChange = 'auto'
  }, [])

  const step = useCallback((now: number) => {
    // Clamped so a backgrounded tab doesn't resume with a 3-second dt and
    // explode the integration.
    const dt = Math.min((now - last.current) / 1000, 1 / 30)
    last.current = now

    const a = -(OMEGA0 * OMEGA0) * Math.sin(theta.current) - DAMPING * omega.current
    omega.current += a * dt
    theta.current += omega.current * dt

    paint()

    if (Math.abs(theta.current) < REST_A && Math.abs(omega.current) < REST_W) {
      theta.current = 0
      omega.current = 0
      paint()
      stop()
      return
    }
    raf.current = requestAnimationFrame(step)
  }, [paint, stop])

  const run = useCallback(() => {
    if (reduced || raf.current !== null) return
    const el = pivotRef.current
    if (el) el.style.willChange = 'transform'
    last.current = performance.now()
    raf.current = requestAnimationFrame(step)
  }, [reduced, step])

  // Intro sway, and the initial paint for the reduced-motion case.
  useEffect(() => {
    paint()
    if (!reduced) run()
    return stop
  }, [reduced, paint, run, stop])

  /**
   * The rotation that puts the donut under the pointer — θ is a CSS angle, not
   * a maths one, so `paint` can apply it directly.
   *
   * dx is negated on purpose: a positive CSS rotation is CLOCKWISE, which
   * swings something hanging below the pivot to the LEFT. Without the flip the
   * donut runs away from your finger.
   */
  const angleTo = useCallback((clientX: number, clientY: number) => {
    const el = rootRef.current
    if (!el || !room) return 0
    const r = el.getBoundingClientRect()
    const dx = clientX - (r.left + room.w * ANCHOR_X)
    const dy = clientY - (r.top + room.h * ANCHOR_Y)
    return Math.atan2(-dx, Math.max(dy, 1))
  }, [room])

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    stop()
    omega.current = 0
    ;(e.target as Element).setPointerCapture(e.pointerId)
    drag.current = {
      id: e.pointerId,
      offset: angleTo(e.clientX, e.clientY) - theta.current,
      moved: 0,
      startX: e.clientX,
      startY: e.clientY,
      lastT: performance.now(),
      lastA: theta.current,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    e.stopPropagation()

    d.moved = Math.max(d.moved, Math.hypot(e.clientX - d.startX, e.clientY - d.startY))

    const next = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, angleTo(e.clientX, e.clientY) - d.offset))
    const now = performance.now()
    const dt = (now - d.lastT) / 1000
    // Throw velocity comes from the last real movement. Sub-millisecond gaps
    // divide into a nonsense number, so they're skipped rather than smoothed.
    if (dt > 0.004) {
      omega.current = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, (next - d.lastA) / dt))
      d.lastT = now
      d.lastA = next
    }
    theta.current = next
    paint()
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    e.stopPropagation()
    drag.current = null

    // A tap that never travelled: poke it away from centre, rather than
    // letting a deliberate press do nothing at all.
    if (d.moved < TAP_SLOP) {
      omega.current += TAP_NUDGE * (angleTo(e.clientX, e.clientY) >= 0 ? 1 : -1)
    }

    if (reduced) { theta.current = 0; omega.current = 0; paint(); return }
    run()
  }

  if (!room) {
    // First pass exists only to be measured — it has no size of its own.
    return <div ref={rootRef} className="absolute inset-0 pointer-events-none" />
  }

  const donutH = room.h * DONUT_H
  const donutW = donutH * DONUT_AR
  const ropeH  = room.h * ROPE_LEN
  const ropeW  = Math.max(3, Math.round(donutW * ROPE_W_FRAC))

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 pointer-events-none"
      // Filter lives here, not on the pivot: the pivot's transform is rewritten
      // every frame of a swing, and a filter on the same element would be
      // re-evaluated with it.
      style={{ zIndex: 5, filter: isDark ? NIGHT_FILTER : undefined }}
    >
      <div
        ref={pivotRef}
        style={{
          position: 'absolute',
          left: `${ANCHOR_X * 100}%`,
          top: `${ANCHOR_Y * 100}%`,
          width: 0,
          height: 0,
          transformOrigin: '0 0',
        }}
      >
        {/* ── Rope ── two dark strands round a lit core, plus a diagonal twist.
            Colours lifted straight off the rope painted on donut.png so the
            join at the donut's top edge is invisible. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: -ropeW / 2,
            top: 0,
            width: ropeW,
            height: ropeH + 1,   // 1px of overlap kills the subpixel seam
            background: `
              repeating-linear-gradient(114deg,
                rgba(58,32,16,0.34) 0 2px, rgba(255,225,195,0.16) 2px 3px, transparent 3px 7px),
              linear-gradient(90deg,
                #754B3C 0%, #754B3C 32%,
                #D2A082 38%, #D7A386 60%,
                #7D553F 66%, #7D553F 100%)
            `,
          }}
        />
        {/* The wrap where it's tied through the ring — without it the rope
            reads as passing through the ceiling rather than knotted to it. */}
        <div aria-hidden style={{
          position: 'absolute',
          left: -ropeW / 2 - 1,
          top: 0,
          width: ropeW + 2,
          height: Math.max(4, Math.round(ropeW * 1.4)),
          background: 'linear-gradient(180deg, #4C2E1C 0%, #6B4630 60%, #55351F 100%)',
          borderRadius: 1,
        }} />

        <img
          src="/donut.png"
          alt=""
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          // The host swipes rooms on touch. Without this, dragging the donut
          // sideways scrolls you into the Serbian class.
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: ropeH,
            left: -donutW * ROPE_ENTRY_X,
            width: donutW,
            height: donutH,
            // The pivot is a zero-width point, and Tailwind's preflight sets
            // `img { max-width: 100% }` — which resolves to 0 and collapses
            // the donut to nothing. Same trap that ate the wash-room pose.
            maxWidth: 'none',
            // Hi-res art downscaled ~3x AND rotated — `pixelated` would crawl
            // and alias along every swing.
            imageRendering: 'auto',
            pointerEvents: 'auto',
            touchAction: 'none',
            cursor: 'grab',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
        />
      </div>
    </div>
  )
}
