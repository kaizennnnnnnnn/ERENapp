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
import { playSound } from '@/lib/sounds'
import { startKioskAmbience, type KioskAmbience } from '@/lib/kioskAmbience'
import { useTasks } from '@/contexts/TaskContext'
import CurtainGlitter from '@/components/CurtainGlitter'
import { useKioskShift } from './useKioskShift'
import { useCoverBox } from './useCoverBox'
import ToppingTrays from './ToppingTrays'
import MeatSpit from './MeatSpit'
import CustomerWindow from './CustomerWindow'
import FridgeOverlay from './FridgeOverlay'
import ServiceHud from './ServiceHud'
import KioskCoins from './KioskCoins'
import KioskPhone from './KioskPhone'
import PhoneCallHud from './PhoneCallHud'
import { useKioskPhone } from './useKioskPhone'
import WallTarget from './WallTarget'
import ShiftReport from './ShiftReport'
import {
  FRIDGE_HIT, FRIDGE_TAG, DOOR_HIT, DOOR_TAG, MAX_USES, SILL_PCT,
} from './kioskShift'
import { orderBase, SHIFT_MS } from './kioskEconomy'
import type { KioskRecord } from './useKioskRecord'

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
  { id: 'back',   src: '/KioskBackReal.webp',   label: 'Fridge',     feature: 'fridge'   },
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
  /** What the kiosk remembers. Owned by the page, because the board out
   *  front reads it too and two copies would mean two fetches. */
  record: KioskRecord
  /** Whether tonight's takings actually go home with you. */
  payable: boolean
  /** And if not, why not — printed on the receipt. */
  practiceReason: string | null
}

export default function KioskInterior({ onExit, record, payable, practiceReason }: Props) {
  const [idx, setIdx] = useState(0)
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left')
  const [animKey, setAnimKey] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [fridgeOpen, setFridgeOpen] = useState(false)

  const { addCoins } = useTasks()
  /** Did the night make it into the book? Only a recorded shift can carry a
   *  note to whoever works next. */
  const [recorded, setRecorded] = useState(false)

  const shift = useKioskShift({
    menu: record.menu,
    regulars: record.regulars,
    lifetimeWraps: record.lifetimeWraps,
    payable,
    onBank: useCallback((coins: number) => { addCoins(coins).catch(() => {}) }, [addCoins]),
    onClose: useCallback((report, regulars) => {
      void record.closeShift({
        takings: report.takings,
        grade: report.grade,
        rained: report.rained,
        regulars,
        paid: report.paid,
      }).then(setRecorded)
    }, [record]),
  })
  // The phone lives up here rather than on the back wall, because it has to
  // ring whichever way you happen to be facing.
  const phone = useKioskPhone()
  // Anything pinned to the art has to live inside the cover-cropped picture
  // box, not the viewport, or it slides off its pan on a different screen.
  const box = useCoverBox(768, 1376)

  // The street, the fridge, the spit and the weather. Started once, mixed as
  // you turn: the rotisserie is loud on its own wall and a suggestion from the
  // others, which is most of what makes turning round feel like turning round.
  const ambience = useRef<KioskAmbience | null>(null)
  useEffect(() => {
    ambience.current = startKioskAmbience()
    return () => { ambience.current?.stop(); ambience.current = null }
  }, [])

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

  /** Spin straight round to a wall, the short way. The ringing chip uses it
   *  so a call you can hear is a call you can reach. */
  function turnTo(feature: KioskView['feature']) {
    const target = VIEWS.findIndex(v => v.feature === feature)
    if (target < 0 || target === idx) return
    const forward = (target - idx + VIEWS.length) % VIEWS.length
    playSound('ui_swipe_room')
    setSlideDir(forward <= VIEWS.length - forward ? 'left' : 'right')
    setAnimKey(k => k + 1)
    setIdx(target)
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
  // Something out front is running low, so the fridge tag lights up properly
  // instead of just idling.
  const needsStock = Object.values(shift.stock).some(n => n < MAX_USES)
  // Anything at all happened tonight? Then walking out is closing up, and it
  // pays. Walk straight back through the door and it's just a door.
  const worked = shift.till.served + shift.till.wrong + shift.till.walked

  // The rotisserie is loud on its own wall and a hiss from anywhere else,
  // which is most of what makes turning round feel like turning round. Rain
  // is the opposite: loudest at the open window, muffled by three walls.
  useEffect(() => {
    ambience.current?.setSizzle(view.feature === 'meat' ? 1 : 0.2)
  }, [view.feature])
  useEffect(() => {
    if (!shift.rained) { ambience.current?.setRain(0); return }
    ambience.current?.setRain(view.feature === 'window' ? 1 : 0.4)
  }, [shift.rained, view.feature])
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
    <div className="absolute inset-0 overflow-hidden select-none game-shell"
      // The walls are wider than the screen, so the pans at either end hang
      // off the edge. Tapping one focuses it, and the browser answers by
      // scrolling this box to bring it into view — which slides the whole
      // room sideways and never slides back, because `overflow: hidden`
      // hides the scrollbar but does not stop the scrolling. Snap it shut.
      onScroll={e => {
        const el = e.currentTarget
        if (el.scrollLeft || el.scrollTop) { el.scrollLeft = 0; el.scrollTop = 0 }
      }}>
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
        /* Customers rise from behind the sill rather than fading in on the
           road. --rise is however much of them clears it, set per sprite, so
           they start exactly out of sight. The two beats past zero are the
           bob of someone leaning up to a window a touch too eagerly. */
        @keyframes kioskCustomerPop {
          0%   { transform: translateX(-50%) translateY(var(--rise)); }
          62%  { transform: translateX(-50%) translateY(-7%);         }
          82%  { transform: translateX(-50%) translateY(2%);          }
          100% { transform: translateX(-50%) translateY(0);           }
        }
        @keyframes kioskCustomerDuck {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0);           }
          65%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(var(--rise)); }
        }
        /* Paid, and delighted about it: two hops on the spot, the second one
           smaller, with the squash landing on the counter side of each. Every
           keyframe carries its own easing — the rise has to slow and the fall
           has to speed up, and a single easing over the whole thing floats
           like the moon rather than dropping like a cat. */
        @keyframes kioskCheer {
          0%   { transform: translateY(0)    scale(1, 1);       animation-timing-function: ease-out; }
          9%   { transform: translateY(1.5%) scale(1.05, 0.95); animation-timing-function: cubic-bezier(0.15, 0.85, 0.4, 1); }
          32%  { transform: translateY(-11%) scale(0.97, 1.04); animation-timing-function: cubic-bezier(0.55, 0, 0.9, 0.45); }
          50%  { transform: translateY(0)    scale(1.06, 0.94); animation-timing-function: cubic-bezier(0.15, 0.85, 0.4, 1); }
          71%  { transform: translateY(-6%)  scale(0.98, 1.02); animation-timing-function: cubic-bezier(0.55, 0, 0.9, 0.45); }
          87%  { transform: translateY(0)    scale(1.04, 0.96); animation-timing-function: ease-out; }
          100% { transform: translateY(0)    scale(1, 1);       }
        }
        /* Given up on you: they sink under the sill AND slide off down the
           street, so a walk-out never reads as the same beat as a sale. */
        @keyframes kioskCustomerWalk {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-140%) translateY(calc(var(--rise) * 0.7)); }
        }
        /* Rain on the street outside the window. The streaks are a repeating
           gradient and only its POSITION moves, so a downpour costs one
           composited layer rather than a hundred elements. */
        @keyframes kioskRain {
          from { background-position: 0 0; }
          to   { background-position: -90px 340px; }
        }
        /* The till roll printing. */
        @keyframes kioskReceiptIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
        @keyframes kioskGradeIn {
          0%   { opacity: 0; transform: scale(0.5) rotate(-8deg); }
          70%  { opacity: 1; transform: scale(1.12) rotate(2deg); }
          100% { opacity: 1; transform: scale(1)   rotate(0deg);  }
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
        @keyframes kioskLineIn {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        /* Heat off the cone. Every wisp sets its own drift, rise and peak
           opacity, so nine of them read as a haze around the meat rather than
           one column out of the top. */
        @keyframes kioskSmoke {
          0%   { opacity: 0;                        transform: translate(0, 0)                     scale(0.45); }
          13%  { opacity: var(--puff);              }
          /* Held near full for most of the rise. Fading from the first frame
             leaves every wisp but one sitting at almost nothing, and eleven
             invisible wisps look exactly like no smoke at all. */
          58%  { opacity: calc(var(--puff) * 0.74); }
          100% { opacity: 0;                        transform: translate(var(--drift), var(--lift)) scale(1.75); }
        }
        /* Only opacity + scale: the positioning and the hand-placed tilt live
           on wrappers, because a forwards-filling animation would otherwise
           overwrite whatever transform the element was given inline. */
        @keyframes kioskDropOn {
          0%   { opacity: 0; transform: scale(1.55); }
          60%  { opacity: 1; }
          100% { opacity: 1; transform: scale(1);    }
        }
        /* A slice coming off the cone: it peels away from the blade, then
           drops to the tray with the weight of a wet thing. */
        @keyframes kioskShave {
          0%   { opacity: 0; transform: translate(0, 0)          rotate(-8deg) scale(0.65); }
          14%  { opacity: 1; transform: translate(-8%, 12%)      rotate(4deg)  scale(1);    }
          100% { opacity: 0; transform: translate(-34%, 190%)    rotate(64deg) scale(0.9);  }
        }
        /* The carve gauge topping out. */
        @keyframes kioskGaugeFlash {
          0%   { transform: translateX(-50%) scale(1);    filter: brightness(2.1); }
          100% { transform: translateX(-50%) scale(1);    filter: brightness(1);   }
        }
        /* The value of a wrap, riding under the till while its coins fly. */
        @keyframes kioskEarn {
          0%   { opacity: 0; transform: translateY(-4px); }
          18%  { opacity: 1; transform: translateY(0);    }
          72%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(3px);  }
        }
        /* The handset rattling in its cradle. Two bursts inside one 1.6s
           cycle, landing on the two brrrings of kiosk_ring, with a rest
           after — a phone that buzzes continuously reads as an alarm. */
        @keyframes kioskRingShake {
          0%,  27%, 35%, 62%, 100% { transform: translateX(0)      rotate(0deg);    }
          3%,  38%                 { transform: translateX(-2.2px) rotate(-3.6deg); }
          7%,  42%                 { transform: translateX(2.4px)  rotate(3.8deg);  }
          11%, 46%                 { transform: translateX(-2px)   rotate(-3deg);   }
          15%, 50%                 { transform: translateX(2px)    rotate(3deg);    }
          19%, 54%                 { transform: translateX(-1.4px) rotate(-2deg);   }
          23%, 58%                 { transform: translateX(1.2px)  rotate(1.6deg);  }
        }
        /* Answered: the handset tips out of the cradle and stays there for as
           long as the message runs. */
        @keyframes kioskHandsetOff {
          0%   { transform: translate(0, 0)        rotate(0deg);   }
          60%  { transform: translate(-9%, 3.5%)   rotate(-19deg); }
          100% { transform: translate(-7.5%, 2.8%) rotate(-15deg); }
        }
        @keyframes kioskRingGlow {
          0%, 100% { opacity: 0.16; }
          14%      { opacity: 0.62; }
          40%      { opacity: 0.22; }
          54%      { opacity: 0.58; }
        }
        @keyframes kioskRingChip {
          0%, 100% { transform: translateY(0)    scale(1);    }
          12%      { transform: translateY(-2px) scale(1.05); }
          24%      { transform: translateY(0)    scale(1);    }
          46%      { transform: translateY(-2px) scale(1.05); }
          58%      { transform: translateY(0)    scale(1);    }
        }
        @keyframes kioskCallIn {
          from { opacity: 0; transform: translateY(-7px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes kioskCaret {
          0%, 49%   { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes kioskRollShut {
          0%   { transform: scaleX(1)    scaleY(1);    }
          45%  { transform: scaleX(0.55) scaleY(1.06); }
          100% { transform: scaleX(1)    scaleY(1);    }
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
            <ToppingTrays
              stock={shift.stock}
              menu={record.menu}
              sauce={shift.build.sauce}
              sides={shift.tray.sides}
              onTap={id => guard(() => shift.addTopping(id))()}
              onSauce={id => guard(() => shift.addSauce(id))()}
              onSide={id => guard(() => shift.takeSide(id))()}
            />
          )}

          {view.feature === 'meat' && (
            <MeatSpit
              meat={shift.meat}
              canCarve={shift.meat > 0 && !shift.build.meat && shift.status === 'waiting'}
              onCarve={guard(shift.carveMeat)}
              onRestock={shift.restockMeat}
            />
          )}

          {/* Rain, out in the street where it belongs — clipped to the same
              sill the customers stand behind, so it falls OUTSIDE rather than
              in the kiosk with you. */}
          {view.feature === 'window' && shift.rained && (
            <div aria-hidden className="absolute left-0 right-0 top-0 pointer-events-none" style={{
              height: `${SILL_PCT}%`, zIndex: 3, overflow: 'hidden',
              background:
                'repeating-linear-gradient(104deg,' +
                ' transparent 0 7px, rgba(190,214,255,0.17) 7px 8px, transparent 8px 15px)',
              animation: 'kioskRain 700ms linear infinite',
            }} />
          )}

          {view.feature === 'window' && (
            <CustomerWindow
              order={shift.order}
              status={shift.status}
              speech={shift.speech}
              patience={shift.patience}
              ticketOpen={shift.ticketOpen}
              revealed={shift.revealed}
              value={shift.order ? orderBase(shift.order) : 0}
              onRepeat={guard(shift.repeatOrder)}
            />
          )}

          {/* The back wall holds both the way to restock and the way out.
              Neither is a button by nature, so both wear a tag. */}
          {view.feature === 'fridge' && (
            <>
              <KioskPhone state={phone.state} lifted={phone.lifted} onAnswer={guard(phone.answer)} />
              <WallTarget
                hit={FRIDGE_HIT} tag={FRIDGE_TAG} label="OPEN"
                aria-label="Open the fridge"
                urgent={needsStock}
                onClick={guard(() => setFridgeOpen(true))}
              />
              {/* The only way out, and the only way to get paid. Serve
                  nobody and it's just a door. */}
              <WallTarget
                hit={DOOR_HIT} tag={DOOR_TAG} label={worked > 0 ? 'CLOSE UP' : 'EXIT ›'}
                aria-label={worked > 0 ? 'Close up for the night' : 'Step back outside'}
                urgent={shift.lastCall && worked > 0}
                onClick={guard(() => {
                  if (!shift.closeUp(phone.missed)) { playSound('ui_back'); onExit() }
                })}
              />
            </>
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

      {/* There's no back button up here on purpose — you leave the way you'd
          leave a real kiosk, through the door on the back wall. */}

      {/* ══ THE CALL ══ audible from any wall, so it has to be visible from
          one too. */}
      <PhoneCallHud
        phone={phone}
        facing={view.feature === 'fridge'}
        onTurn={() => turnTo('fridge')}
      />

      {/* ══ THE CLOCK ══ how much night is left. The bar under it is the
          same countdown as the numbers, for when you're not reading. */}
      <div className="absolute pointer-events-none" style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 14px)', left: 12, zIndex: 57,
        display: 'flex', flexDirection: 'column', gap: 4, width: 74,
      }}>
        <div className="font-pixel" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '7px 8px 6px',
          background: 'rgba(14,10,8,0.82)',
          border: `2px solid ${shift.lastCall ? 'rgba(228,72,60,0.6)' : 'rgba(245,156,69,0.5)'}`,
          borderRadius: 9,
          boxShadow: '0 3px 0 rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          fontSize: 9, letterSpacing: 1, color: shift.lastCall ? '#F5A79C' : '#FFE7C4',
        }}>
          {shift.clock}
        </div>
        <div style={{
          height: 4, background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(245,156,69,0.28)', borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', transformOrigin: '0% 50%',
            transform: `scaleX(${Math.max(0, 1 - shift.elapsed / SHIFT_MS)})`,
            background: shift.lastCall ? '#E4483C' : '#F59C45',
            transition: 'transform 200ms linear',
          }} />
        </div>
        {shift.lastCall && (
          <div className="font-pixel" style={{
            fontSize: 5.5, letterSpacing: 1, color: '#F5A79C', textAlign: 'center',
            textShadow: '0 1px 0 rgba(0,0,0,0.7)',
          }}>
            LAST CALL
          </div>
        )}
      </div>

      {/* ══ TILL ══ tonight's takings, on every wall, all the time. */}
      <KioskCoins paid={shift.paid} till={shift.till} streak={shift.streak} practice={shift.practice} />

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
        tray={shift.tray}
        wrapsWanted={shift.wrapsWanted}
        nudge={shift.nudge}
        canRoll={shift.build.meat && shift.tray.wraps.length < shift.wrapsWanted && shift.status === 'waiting'}
        canServe={shift.tray.wraps.length >= shift.wrapsWanted && !!shift.order && shift.status === 'waiting'}
        onTrash={shift.trashBuild}
        onRoll={shift.rollWrap}
        onServe={shift.serve}
      />

      {shift.report && (
        <ShiftReport
          report={shift.report}
          practiceReason={shift.report.paid ? null : practiceReason}
          canNote={recorded}
          onSaveNote={note => { void record.saveNote(note) }}
          onDone={onExit}
        />
      )}

      {fridgeOpen && (
        <FridgeOverlay
          stock={shift.stock}
          hasPepsi={shift.tray.sides.includes('pepsi')}
          onRestock={shift.restockTopping}
          onTakePepsi={() => shift.takeSide('pepsi')}
          onClose={() => setFridgeOpen(false)}
        />
      )}
    </div>
  )
}
