'use client'

// ═══════════════════════════════════════════════════════════════════════════
// KIOSK INTERIOR — standing inside the shawarma stand, turning on the spot.
// ──────────────────────────────────────────────────────────────────────────
// Four painted walls in a RING: swipe left to turn left (window → left side →
// back → right side → window again), swipe right to turn back the other way.
// Unlike the care rooms there are no ends to rubber-band against — every
// direction is legal, it just wraps.
//
// The gesture itself is the care-room swipe verbatim: same 20%-of-width /
// 0.4-px-per-ms thresholds, same drag-follow, same 0.45s slide with the
// incoming wall easing up from 0.92 scale. What changes is the PALETTE — the
// rooms' violet twilight void and pink fairy glitter would look like a
// different game in here, so the gap between walls is the black street
// outside and the seam burns amber like the kiosk's own lamps.
// ═══════════════════════════════════════════════════════════════════════════

import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft } from 'lucide-react'
import { playSound } from '@/lib/sounds'
import CurtainGlitter from '@/components/CurtainGlitter'
import { useKioskShift } from './useKioskShift'
import { useCoverBox } from './useCoverBox'
import ToppingTrays from './ToppingTrays'
import MeatSpit from './MeatSpit'
import CustomerWindow from './CustomerWindow'
import FridgeOverlay from './FridgeOverlay'
import ServiceHud from './ServiceHud'
import { FRIDGE_HIT, payout } from './kioskShift'

interface KioskView {
  id: string
  src: string
  label: string
  /** What you can DO at this wall. Keyed off the art, never off `id` — the
   *  two side walls hang opposite their slot names, so anything that keys off
   *  position ends up painting pans onto the rotisserie. */
  feature: 'window' | 'toppings' | 'meat' | 'fridge'
}

// Ring order for a LEFT swipe, i.e. turning to your left. Reversed for a
// right swipe by walking the index the other way.
// `id` is the wall's place in the ring; the filenames are just what the art
// was drawn as, and the two side walls hang the other way round from their
// names — the spit is on your left, the trays on your right. Labels name
// what you're looking AT, so they travel with the picture, not the slot.
const VIEWS: KioskView[] = [
  { id: 'window', src: '/InsideOfKiosk.webp',   label: 'The Window', feature: 'window'   },
  { id: 'left',   src: '/KioskRightSide.webp',  label: 'Meat',       feature: 'meat'     },
  { id: 'back',   src: '/BackOffTheKiosk.webp', label: 'Fridge',     feature: 'fridge'   },
  { id: 'right',  src: '/KioskLeftSide.webp',   label: 'Toppings',   feature: 'toppings' },
]

// Exported so the kiosk front can warm all four before the door opens — see
// the preload effect in the shawarma page.
export const KIOSK_VIEW_SRCS = VIEWS.map(v => v.src)

// Lamp amber, the same hue as the dock button that leads here.
const LAMP = '#F59C45'
// Sparse dust-in-lamplight instead of the care rooms' pink/violet fairy dust.
const DUST = ['#F5C89A', '#FFE7C4', '#C98F4E', '#FFFFFF']

interface Props {
  onExit: () => void
}

export default function KioskInterior({ onExit }: Props) {
  const [idx, setIdx] = useState(0)
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left')
  const [animKey, setAnimKey] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [fridgeOpen, setFridgeOpen] = useState(false)

  const shift = useKioskShift()
  // Anything pinned to the art has to live inside the cover-cropped picture
  // box, not the viewport, or it slides off its pan on a different screen.
  const box = useCoverBox(768, 1376)

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)
  const isDragging = useRef(false)
  // A swipe that starts on a pan still ends in a click on some browsers.
  // Everything you can tap on a wall goes through this guard.
  const lastDragEnd = useRef(0)
  const guard = useCallback((fn: () => void) => () => {
    if (Date.now() - lastDragEnd.current < 260) return
    fn()
  }, [])

  // Wall-name label: shown on arrival so you know where you're standing,
  // then faded out. Same 1.4s dwell as the care rooms.
  const [labelVisible, setLabelVisible] = useState(true)
  const labelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashLabel = useCallback(() => {
    setLabelVisible(true)
    if (labelTimerRef.current) clearTimeout(labelTimerRef.current)
    labelTimerRef.current = setTimeout(() => setLabelVisible(false), 1400)
  }, [])
  useEffect(() => {
    flashLabel()
    return () => { if (labelTimerRef.current) clearTimeout(labelTimerRef.current) }
  }, [flashLabel])

  function navigate(dir: 'left' | 'right') {
    const next = dir === 'left'
      ? (idx + 1) % VIEWS.length
      : (idx - 1 + VIEWS.length) % VIEWS.length
    playSound('ui_swipe_room')
    setSlideDir(dir)
    setAnimKey(k => k + 1)
    setIdx(next)
    flashLabel()
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
    isDragging.current = false
    setDragX(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // Commit to a horizontal drag only once it's clearly horizontal, so a
    // vertical flick doesn't drag the wall sideways.
    if (!isDragging.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        isDragging.current = true
        flashLabel()
      } else {
        return
      }
    }
    // No rubber-band clamp: the ring has no first or last wall.
    setDragX(dx)
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    const elapsed = Date.now() - touchStartTime.current
    const velocity = Math.abs(dx) / elapsed

    setDragX(0)
    if (!isDragging.current) return
    isDragging.current = false
    lastDragEnd.current = Date.now()

    const threshold = window.innerWidth * 0.2
    if (Math.abs(dx) > threshold || velocity > 0.4) {
      if (Math.abs(dx) > Math.abs(dy) * 1.2) navigate(dx > 0 ? 'left' : 'right')
    }
  }

  const view = VIEWS[idx]
  const dragging = dragX !== 0
  const vw = typeof window !== 'undefined' ? window.innerWidth : 390
  const dragProgress = Math.min(1, Math.abs(dragX) / vw)

  const wallStyle: React.CSSProperties = dragging
    ? { transform: `translateX(${dragX}px)`, transition: 'none' }
    : { animation: `kioskSlideIn${slideDir === 'left' ? 'Right' : 'Left'} 0.45s cubic-bezier(0.32, 0.72, 0, 1) both` }

  // Which edge the seam hugs: mid-drag it sits in the gap the wall is
  // opening; during the slide it rides the incoming wall's leading edge.
  const seamSide: 'left' | 'right' = dragging
    ? (dragX > 0 ? 'left' : 'right')
    : (slideDir === 'left' ? 'left' : 'right')

  return (
    <div className="absolute inset-0 overflow-hidden select-none game-shell">
      <style>{`
        @keyframes kioskSlideInRight {
          from { transform: translateX(100%) scale(0.92); }
          to   { transform: translateX(0)    scale(1);    }
        }
        @keyframes kioskSlideInLeft {
          from { transform: translateX(-100%) scale(0.92); }
          to   { transform: translateX(0)     scale(1);    }
        }
        @keyframes kioskWallArrive {
          from { opacity: 0.6; }
          to   { opacity: 0;   }
        }
        @keyframes kioskSeam {
          0%   { opacity: 0; }
          35%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes kioskLabelIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes kioskCarve {
          from { transform: translateX(-50%) scale(1.04); }
          to   { transform: translateX(-50%) scale(1);    }
        }
        @keyframes kioskHint {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1;    }
        }
        @keyframes kioskCustomerArrive {
          from { opacity: 0; transform: translateX(-50%) translateY(26px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
        }
        @keyframes kioskCustomerLeave {
          from { opacity: 1; transform: translateX(-50%) translateY(0);    }
          to   { opacity: 0; transform: translateX(-50%) translateY(30px); }
        }
        @keyframes kioskBubbleIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.9); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1);   }
        }
        @keyframes kioskBubbleOut {
          from { opacity: 1; transform: translateX(-50%) scale(1);    }
          to   { opacity: 0; transform: translateX(-50%) scale(0.92); }
        }
        @keyframes kioskRefuse {
          0%, 100% { transform: translateX(0);    }
          20%      { transform: translateX(-7px); }
          45%      { transform: translateX(6px);  }
          70%      { transform: translateX(-4px); }
        }
        @keyframes kioskNudge {
          0%   { opacity: 0; transform: translateY(5px); }
          10%  { opacity: 1; transform: translateY(0);   }
          78%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes kioskFridgeIn {
          from { opacity: 0; transform: scale(1.14); }
          to   { opacity: 1; transform: scale(1);    }
        }
      `}</style>

      {/* ══ THE GAP ══ what shows behind a wall as it slides away. The care
          rooms open onto a violet dream; the kiosk opens onto the street it
          stands on — near-black, with a low amber pool from the lamps. */}
      <div className="absolute inset-0" style={{
        background:
          'radial-gradient(85% 55% at 26% 18%, rgba(245,156,69,0.16), transparent 62%),' +
          'radial-gradient(75% 50% at 78% 86%, rgba(120,90,150,0.10), transparent 62%),' +
          'linear-gradient(180deg, #0A0810 0%, #060509 55%, #0C0A10 100%)',
      }}>
        <div className="absolute inset-0" style={{ opacity: 0.5 }}>
          <CurtainGlitter count={18} seed={515151} colors={DUST} />
        </div>
      </div>

      {/* ══ WALL ══ the painted view, cropped to fill like a care room. */}
      <div
        key={animKey}
        className="absolute inset-0"
        style={wallStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* The picture, sized and centred exactly as `cover` would crop it —
            but as a real box, so the pans, the spit and the customer can be
            positioned in the ART's coordinates instead of the viewport's. */}
        <div style={{
          position: 'absolute',
          left: box.left, top: box.top, width: box.width, height: box.height,
          containerType: 'inline-size',
        }}>
          <img src={view.src} alt={view.label} draggable={false} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill',
            WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
            pointerEvents: 'none',
          }} />

          {view.feature === 'toppings' && (
            <ToppingTrays stock={shift.stock} onTap={id => guard(() => shift.addTopping(id))()} />
          )}

          {view.feature === 'meat' && (
            <MeatSpit
              meat={shift.meat}
              onCarve={guard(shift.carveMeat)}
              onRestock={shift.restockMeat}
            />
          )}

          {view.feature === 'window' && (
            <CustomerWindow
              order={shift.order}
              status={shift.status}
              coins={shift.order ? payout(shift.order) : 0}
            />
          )}

          {view.feature === 'fridge' && (
            <button
              type="button"
              aria-label="Open the fridge"
              onClick={guard(() => setFridgeOpen(true))}
              className="active:scale-[0.98] transition-transform"
              style={{
                position: 'absolute',
                left: `${FRIDGE_HIT.left}%`, top: `${FRIDGE_HIT.top}%`,
                width: `${FRIDGE_HIT.width}%`, height: `${FRIDGE_HIT.height}%`,
                background: 'none', border: 0, padding: 0,
              }}
            />
          )}
        </div>

        {/* Depth veil — the wall darkens as it recedes under your finger and
            lifts back off as the next one settles. Pushed harder than the
            care rooms' 0.5: in here the light source is a couple of bulbs. */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: '#050408', zIndex: 41,
          ...(dragging
            ? { opacity: 0.6 * dragProgress }
            : { opacity: 0, animation: 'kioskWallArrive 0.45s ease-out both' }),
        }} />

        {/* Seam — lamplight spilling through the gap between walls. */}
        <div aria-hidden className="absolute top-0 bottom-0 pointer-events-none" style={{
          width: 130, zIndex: 45,
          left:  seamSide === 'left'  ? 0 : undefined,
          right: seamSide === 'right' ? 0 : undefined,
          transform: `translateX(${seamSide === 'left' ? '-50%' : '50%'})`,
          ...(dragging
            ? { opacity: 0.2 + 0.8 * dragProgress }
            : { animation: 'kioskSeam 0.5s ease-out both' }),
        }}>
          <div className="absolute inset-0" style={{
            background: seamSide === 'left'
              ? 'linear-gradient(90deg, transparent, rgba(245,156,69,0.16) 40%, rgba(255,229,190,0.20) 55%, rgba(140,90,40,0.12) 70%, transparent)'
              : 'linear-gradient(90deg, transparent, rgba(140,90,40,0.12) 30%, rgba(255,229,190,0.20) 45%, rgba(245,156,69,0.16) 60%, transparent)',
          }} />
          <CurtainGlitter count={26} seed={626262} colors={DUST} />
        </div>
      </div>

      {/* ══ VIGNETTE ══ same closed-in feel as the kiosk front. */}
      <div className="absolute inset-0 pointer-events-none" style={{
        zIndex: 50,
        background: 'radial-gradient(circle at 50% 48%, rgba(0,0,0,0) 44%, rgba(0,0,0,0.32) 78%, rgba(0,0,0,0.6) 100%)',
      }} />

      {/* ══ BACK ══ out through the window again. */}
      <div className="absolute top-0 inset-x-0 flex items-center px-3"
        style={{ zIndex: 55, paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={() => { playSound('ui_back'); onExit() }}
          aria-label="Step back outside"
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'rgba(20,10,8,0.65)',
            border: `2px solid ${LAMP}A6`,
            boxShadow: '0 2px 0 rgba(0,0,0,0.45)',
          }}>
          <ChevronLeft size={16} className="text-orange-100" />
        </button>
      </div>

      {/* ══ WALL NAME ══ fades in on arrival, out 1.4s later. */}
      <div className="absolute left-1/2 pointer-events-none"
        style={{
          zIndex: 55,
          top: 'calc(env(safe-area-inset-top, 0px) + 58px)',
          transform: 'translateX(-50%)',
          opacity: labelVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}>
        <span key={view.id} className="font-pixel px-3 py-1"
          style={{
            fontSize: 7, color: '#FFE7C4',
            background: 'rgba(0,0,0,0.45)', borderRadius: 10,
            backdropFilter: 'blur(4px)',
            animation: 'kioskLabelIn 0.3s ease both',
          }}>
          {view.label}
        </span>
      </div>

      {/* ══ DOTS ══ which way you're facing. Sits above the service HUD. */}
      <div className="absolute left-1/2 flex items-center gap-2 px-3 py-1.5"
        style={{
          zIndex: 55,
          bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
          transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.4)',
          borderRadius: 20, backdropFilter: 'blur(6px)', pointerEvents: 'none',
          opacity: labelVisible ? 1 : 0, transition: 'opacity 0.3s ease',
        }}>
        {VIEWS.map((v, i) => (
          <div key={v.id} style={{
            width: i === idx ? 18 : 7,
            height: 7,
            borderRadius: 4,
            background: i === idx ? LAMP : 'rgba(255,255,255,0.35)',
            transition: 'all 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            boxShadow: i === idx ? `0 0 6px 2px ${LAMP}66` : 'none',
          }} />
        ))}
      </div>

      {/* ══ SERVICE ══ the wrap in your hands, the bin, and the hand-over.
          Outside the sliding wall so it stays put while you turn around. */}
      <ServiceHud
        build={shift.build}
        earned={shift.earned}
        nudge={shift.nudge}
        canServe={shift.build.meat && !!shift.order && shift.status !== 'paid'}
        onTrash={shift.trashBuild}
        onServe={shift.serve}
      />

      {fridgeOpen && (
        <FridgeOverlay
          stock={shift.stock}
          hasPepsi={shift.build.pepsi}
          onRestock={shift.restockTopping}
          onTakePepsi={shift.addPepsi}
          onClose={() => setFridgeOpen(false)}
        />
      )}
    </div>
  )
}
