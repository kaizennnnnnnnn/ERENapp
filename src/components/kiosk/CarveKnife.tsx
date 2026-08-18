'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE CARVING KNIFE — hold it against the cone and saw it up and down.
// ──────────────────────────────────────────────────────────────────────────
// Tapping the meat to make a portion appear was a button dressed up as a
// machine. This is the actual motion: the blade tracks your finger down the
// cone, the gauge under the drip tray fills with every inch of travel, and
// when it tops out a slice comes away and drops to the tray.
//
// Progress is bought with DISTANCE, not time — and distance measured in % of
// the picture's height, so a slice costs the same amount of hand movement on
// any screen. Only movement inside the stroke band counts, so scrubbing
// somewhere off the meat earns nothing. Let go part-way and the gauge bleeds
// back down over a second and a half: forgiving enough to shift your grip,
// too fast to bank a stroke and wander off.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'
import SegmentMeter, { type MeterPalette } from '@/components/care/SegmentMeter'
import { KNIFE, KNIFE_SPRITE, KNIFE_TAG, CARVE_TRAVEL, CARVE_BAR, SHAVED_MEAT } from './kioskShift'

interface Props {
  /** False when the spit is bare, the wrap already has meat, or it's rolled. */
  canCarve: boolean
  /** Fires on a full gauge — and on a grab you aren't allowed to make, so the
   *  hook gets to say why. */
  onCarve: () => void
}

/** How long a released gauge takes to empty. */
const DRAIN_MS = 1500
/** Lit segments in the gauge, and how often the saw ticks. */
const SEGMENTS = 10
/** Below this, in % of picture height, it's finger jitter and not sawing. */
const DEADZONE = 0.05

/** The shared care-room gauge, in the kiosk's lamplight instead of its usual
 *  bathroom blues. */
const CARVE_PALETTE: MeterPalette = {
  fillHi:    '#FFDCA6',
  fillBase:  '#F59C45',
  fillLo:    '#B85C15',
  fillEdge:  '#7C3D0C',
  glow:      'rgba(245,156,69,0.55)',
  track:     '#2A201A',
  trackEdge: '#3E2E23',
  groove:    '#161010',
  frame:     '#0A0706',
  rivet:     '#C08A3E',
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export default function CarveKnife({ canCarve, onCarve }: Props) {
  const [y, setY] = useState(KNIFE.home)
  const [progress, setProgress] = useState(0)
  const [held, setHeld] = useState(false)
  const [tilt, setTilt] = useState(0)
  const [shavings, setShavings] = useState<{ id: number; y: number }[]>([])

  // The picture's box, so a pointer's clientY can be read as a % of the ART
  // rather than of the screen. Sampled on grab: the wall doesn't move while
  // you're holding the knife.
  const frameRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)
  const heldRef = useRef(false)
  const yRef = useRef(KNIFE.home)
  const progRef = useRef(0)
  const drainRef = useRef<number | null>(null)
  const shavingId = useRef(0)

  const stopDrain = useCallback(() => {
    if (drainRef.current !== null) cancelAnimationFrame(drainRef.current)
    drainRef.current = null
  }, [])
  useEffect(() => stopDrain, [stopDrain])

  const startDrain = useCallback(() => {
    stopDrain()
    let last = performance.now()
    const tick = (now: number) => {
      const next = Math.max(0, progRef.current - (now - last) / DRAIN_MS)
      last = now
      progRef.current = next
      setProgress(next)
      drainRef.current = next > 0 ? requestAnimationFrame(tick) : null
    }
    drainRef.current = requestAnimationFrame(tick)
  }, [stopDrain])

  /** Spend a stroke's worth of travel, and cut when the gauge tops out. */
  const saw = useCallback((moved: number) => {
    const before = progRef.current
    const after = before + moved / CARVE_TRAVEL

    if (after >= 1) {
      progRef.current = 0
      setProgress(0)
      setShavings(s => [...s, { id: ++shavingId.current, y: yRef.current }])
      playSound('ui_select')
      onCarve()
      return
    }

    // One tick per segment, so the fill is audible under your thumb as well
    // as visible past it.
    if (Math.floor(after * SEGMENTS) !== Math.floor(before * SEGMENTS)) {
      playSound('ui_toggle', { volume: 0.16 })
    }
    progRef.current = after
    setProgress(after)
  }, [onCarve])

  const release = useCallback(() => {
    if (!heldRef.current) return
    heldRef.current = false
    setHeld(false)
    setTilt(0)
    yRef.current = KNIFE.home
    setY(KNIFE.home)
    if (progRef.current > 0) startDrain()
  }, [startDrain])

  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    // Not allowed to cut? Grabbing the knife is still how you find out why.
    if (!canCarve) { onCarve(); return }
    const frame = frameRef.current
    if (!frame) return
    rectRef.current = frame.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    stopDrain()
    heldRef.current = true
    setHeld(true)
    playSound('ui_tap', { volume: 0.3 })
  }

  function onMove(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = rectRef.current
    if (!heldRef.current || !rect) return

    const pct = ((e.clientY - rect.top) / rect.height) * 100
    const next = clamp(pct, KNIFE.top, KNIFE.bottom)
    const moved = next - yRef.current
    if (Math.abs(moved) < DEADZONE) return

    // Travel is credited from the CLAMPED blade, so dragging away past either
    // end of the cone earns nothing.
    yRef.current = next
    setY(next)
    setTilt(moved > 0 ? 5 : -5)
    saw(Math.abs(moved))
  }

  const cutting = shavings.length > 0
  const dim = !canCarve && !cutting

  return (
    <div ref={frameRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
      {/* ══ THE GAUGE ══ how far through this slice you are. Sits on the tiles
          under the drip tray, where you're already looking. */}
      {(canCarve || cutting) && (
        <div className="absolute" style={{
          left: '50%', top: `${CARVE_BAR.y}%`, width: `${CARVE_BAR.width}%`,
          transform: 'translateX(-50%)',
          animation: cutting ? 'kioskGaugeFlash 420ms ease-out both' : undefined,
        }}>
          <SegmentMeter
            label="CARVE"
            value={cutting ? 100 : progress * 100}
            valueText=""
            segments={SEGMENTS}
            palette={CARVE_PALETTE}
            labelColor="#FFE7C4"
            valueColor="#F59C45"
          />
        </div>
      )}

      {/* ══ SHAVINGS ══ what comes off when the gauge tops out. Each removes
          itself on animationend, so there's no timer to leak. */}
      {shavings.map(s => (
        <img
          key={s.id}
          src={SHAVED_MEAT}
          alt=""
          aria-hidden
          draggable={false}
          onAnimationEnd={() => setShavings(list => list.filter(v => v.id !== s.id))}
          style={{
            position: 'absolute', left: `${KNIFE.x - 6}%`, top: `${s.y}%`,
            width: '9cqi', height: 'auto',
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))',
            animation: 'kioskShave 780ms cubic-bezier(0.4, 0, 0.7, 1) both',
          }}
        />
      ))}

      {/* The one thing a knife propped against a machine can't say for
          itself: that it's yours to move. Pinned to the wall rather than to
          the blade, so it holds still while the blade doesn't. */}
      {canCarve && !held && progress === 0 && (
        <span className="font-pixel" style={{
          position: 'absolute', left: `${KNIFE_TAG.x}%`, top: `${KNIFE_TAG.y}%`,
          transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap',
          fontSize: 6, letterSpacing: 0.6, color: '#3A1B08',
          background: '#F59C45', padding: '7px 7px 6px',
          border: '2px solid #5A2E12', borderRadius: 6,
          boxShadow: '0 3px 0 #DC772A',
          animation: 'kioskHint 1.8s ease-in-out infinite',
        }}>
          ‹ HOLD · SAW
        </span>
      )}

      {/* ══ THE KNIFE ══ */}
      <button
        type="button"
        aria-label="Carve the meat — hold and slide up and down"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onContextMenu={e => e.preventDefault()}
        // The wall behind reads raw touches to turn the room. A vertical saw
        // wouldn't clear its horizontal threshold, but there's no reason to
        // let it watch.
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: `${KNIFE.x}%`, top: `${y}%`,
          transform: 'translate(-50%, -50%)',
          padding: 0, border: 0, background: 'none',
          pointerEvents: 'auto', touchAction: 'none',
          opacity: dim ? 0.45 : 1,
          transition: held ? 'none' : 'top 280ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease',
        }}
      >
        <span style={{
          display: 'block',
          transform: `rotate(${8 + tilt}deg) scale(${held ? 1.06 : 1})`,
          transformOrigin: '50% 22%',
          transition: 'transform 160ms ease-out',
        }}>
          <img src={KNIFE_SPRITE} alt="" draggable={false} style={{
            display: 'block', height: `${KNIFE.size}cqi`, width: 'auto',
            filter: held
              ? 'drop-shadow(0 3px 3px rgba(0,0,0,0.55)) brightness(1.12)'
              : 'drop-shadow(0 3px 3px rgba(0,0,0,0.55))',
          }} />
        </span>

      </button>
    </div>
  )
}
