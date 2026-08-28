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
import { startRadio, STATIONS } from '@/lib/kioskRadio'
import { useTasks } from '@/contexts/TaskContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'
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
import TipJar from './TipJar'
import KioskRadio from './KioskRadio'
import StreetWeather from './StreetWeather'
import GlassMist from './GlassMist'
import TipCoin, { COIN_MS } from './TipCoin'
import { ShiftNote, ChampionApron } from './WallProps'
import {
  FRIDGE_HIT, FRIDGE_TAG, DOOR_HIT, DOOR_TAG, MAX_USES, WEATHER_BY_ID,
  type WeatherId,
} from './kioskShift'
import { orderBase, SHIFT_MS, NIGHT_GOAL } from './kioskEconomy'
import { KIOSK_KEYFRAMES } from './kioskKeyframes'
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

/** Which station this device was left on. */
const RADIO_KEY = 'eren_kiosk_radio'

/** How long a clean pane takes to go completely, per kind of night. A warm
 *  kiosk fogs its own glass whatever the weather; wet and foggy nights just
 *  get on with it. */
const MIST_MS: Record<WeatherId, number> = {
  clear: 132_000, wind: 150_000, rain: 88_000, fog: 54_000,
}

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
    // What the two of you have already served tonight, so the shared goal
    // knows where the night stands before you touched it.
    nightSoFar: record.tonight,
    payable,
    onBank: useCallback((coins: number) => { addCoins(coins).catch(() => {}) }, [addCoins]),
    onClose: useCallback((report, regulars) => {
      void record.closeShift({
        takings: report.takings,
        grade: report.grade,
        weather: report.weather,
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
  // A hundred drops falling for four minutes is exactly the kind of endless
  // decorative motion the reduced-motion setting is asking about. The weather
  // stays — it still reads as a wet night, it just stops moving.
  const reduced = useReducedMotion()

  // ── the pane ────────────────────────────────────────────────────────────
  // Elapsed when the glass was last wiped. The mist is derived from it, so
  // it freezes with everything else when the app is in your pocket.
  const [wipedAt, setWipedAt] = useState(0)
  const [wipes, setWipes] = useState(0)
  const mist = Math.min(1, Math.max(0, (shift.elapsed - wipedAt) / MIST_MS[shift.weather]))
  const wipeGlass = useCallback(() => {
    setWipedAt(shift.elapsed)
    setWipes(n => n + 1)
    playSound('kiosk_wipe')
  }, [shift.elapsed])

  // ── the jar ─────────────────────────────────────────────────────────────
  // The level waits for the coin to land. Without the delay the jar rises
  // while the coin is still in the air, and then the coin arrives at a jar
  // that has already been paid.
  const [jarTips, setJarTips] = useState(0)
  useEffect(() => {
    if (shift.till.tips === jarTips) return
    const t = setTimeout(() => setJarTips(shift.till.tips), COIN_MS - 90)
    return () => clearTimeout(t)
  }, [shift.till.tips, jarTips])

  // The coin itself only exists for the length of its flight. `shift.paid`
  // stays set for the rest of the night, so rendering off it directly meant a
  // coin flew every time you turned back to the window.
  const [coin, setCoin] = useState<{ id: number } | null>(null)
  useEffect(() => {
    if (!shift.paid || shift.paid.tip <= 0) return
    setCoin({ id: shift.paid.id })
    const t = setTimeout(() => setCoin(null), COIN_MS + 80)
    return () => clearTimeout(t)
  }, [shift.paid])

  // Off, or one of three stations. Kept in localStorage rather than the
  // database: which station you like is a thing about YOU, not about the cat.
  const [station, setStation] = useState(0)
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(RADIO_KEY) ?? 0)
    if (saved > 0 && saved <= STATIONS.length) setStation(saved)
  }, [])
  useEffect(() => {
    if (station === 0) return
    const stop = startRadio(station - 1)
    return stop
  }, [station])

  const cycleStation = useCallback(() => {
    setStation(prev => {
      const next = (prev + 1) % (STATIONS.length + 1)
      try { window.localStorage.setItem(RADIO_KEY, String(next)) } catch { /* private mode */ }
      playSound(next === 0 ? 'ui_back' : 'ui_toggle')
      return next
    })
  }, [])

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
  // Who's wearing the apron. Null on a tie or an empty week — an apron on
  // nobody in particular is just a coat.
  const leader: boolean | null =
    record.week.mine === record.week.theirs ? null
    : record.week.mine + record.week.theirs === 0 ? null
    : record.week.mine > record.week.theirs
  // Anything at all happened tonight? Then walking out is closing up, and it
  // pays. Walk straight back through the door and it's just a door.
  const worked = shift.till.served + shift.till.wrong + shift.till.walked

  // The rotisserie is loud on its own wall and a hiss from anywhere else,
  // which is most of what makes turning round feel like turning round. Rain
  // is the opposite: loudest at the open window, muffled by three walls.
  useEffect(() => {
    ambience.current?.setSizzle(view.feature === 'meat' ? 1 : 0.2)
  }, [view.feature])
  // Weather is loudest at the open window and muffled by three walls. Fog is
  // the one that has no sound of its own — the quiet IS the fog.
  useEffect(() => {
    const near = view.feature === 'window' ? 1 : 0.4
    ambience.current?.setRain(shift.weather === 'rain' ? near : 0)
    ambience.current?.setWind(shift.weather === 'wind' ? near : 0)
  }, [shift.weather, view.feature])
  // And when the street loses power, the fridge and the lamps go with it.
  useEffect(() => {
    ambience.current?.setPower(shift.blackout ? 0 : 1)
  }, [shift.blackout])
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
      {/* Injected as raw HTML, not as a text child. React ESCAPES text
          children — so every apostrophe in a CSS comment went into the
          server HTML as &#x27;, the browser's parser left it alone (a <style>
          element is raw text, entities and all), and the string React then
          compared it against on the client still had the apostrophe. That
          mismatch threw away the whole server tree and re-rendered the root
          on the client, every time, invisibly. The content is a compile-time
          constant in this file's own module; there is no input to sanitise. */}
      <style dangerouslySetInnerHTML={{ __html: KIOSK_KEYFRAMES }} />

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
              board={shift.boards[shift.active] ?? shift.boards[0]}
              sides={shift.tray.sides}
              onTap={id => guard(() => shift.addTopping(id))()}
              onSauce={id => guard(() => shift.addSauce(id))()}
              onSide={id => guard(() => shift.takeSide(id))()}
            />
          )}

          {view.feature === 'toppings' && (
            <KioskRadio station={station} onCycle={guard(cycleStation)} />
          )}

          {view.feature === 'meat' && (
            <MeatSpit
              meat={shift.meat}
              meatOn={shift.meatOn}
              cooked={shift.meatCooked}
              canCarve={shift.meat > 0 && !shift.boards[shift.active]?.meat && shift.status === 'waiting'}
              onCarve={guard(shift.carveMeat)}
              onRestock={shift.restockMeat}
            />
          )}

          {/* Whatever the street is doing — clipped to the GLASS, not to the
              sill. Clipping at the sill covered the whole top of the wall:
              the shutter, the tiled corners and the ceiling lamps all got
              rained on, indoors, with you. */}
          {view.feature === 'window' && (
            <StreetWeather weather={shift.weather} still={reduced} />
          )}

          {/* The pane misting over, and your sleeve. */}
          {view.feature === 'window' && (
            <GlassMist mist={mist} wipe={wipes} onWipe={guard(wipeGlass)} still={reduced} />
          )}

          {/* The night's tips, as a depth of coins on the ledge people are
              leaving them on — and the coin somebody just put there. */}
          {view.feature === 'window' && <TipJar tips={jarTips} />}
          {view.feature === 'window' && coin && <TipCoin key={coin.id} id={coin.id} />}

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
              {/* What whoever worked last wrote at the till, taped up by the
                  door you'll leave through. */}
              {record.note && (
                <ShiftNote note={record.note.text} mine={record.note.mine} when={record.note.when} />
              )}
              {/* And the apron, on whoever's ahead this week. */}
              {leader !== null && <ChampionApron mine={leader} />}
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
        {/* What kind of night it is. Under the clock because it's the other
            half of the same fact: this is when you are and this is what it's
            doing out there. A clear night says nothing. */}
        {WEATHER_BY_ID[shift.weather].note && (
          <div className="font-pixel" style={{
            fontSize: 5.5, letterSpacing: 1, textAlign: 'center',
            color: 'rgba(198,214,240,0.75)',
            textShadow: '0 1px 0 rgba(0,0,0,0.7)',
          }}>
            {WEATHER_BY_ID[shift.weather].label}
          </div>
        )}
      </div>

      {/* ══ THE LIGHTS ══ the street losing power. Over the walls AND over the
          HUD — a blackout that politely leaves your interface lit is not a
          blackout — but only down to where you can still work by the glow off
          the spit, because you're still expected to. */}
      {shift.blackout && (
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
          zIndex: 58,
          background:
            'radial-gradient(58% 34% at 50% 62%, rgba(0,0,0,0.28), rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.88) 100%)',
          animation: 'kioskLightsOut 700ms ease-out both',
        }} />
      )}
      {shift.blackout && (
        <div className="font-pixel absolute left-1/2 pointer-events-none" style={{
          zIndex: 59,
          top: 'calc(env(safe-area-inset-top, 0px) + 96px)',
          transform: 'translateX(-50%)', whiteSpace: 'nowrap',
          fontSize: 6.5, letterSpacing: 1.6, color: '#F5A79C',
          background: 'rgba(10,7,6,0.8)', padding: '6px 10px 5px',
          border: '2px solid rgba(228,72,60,0.45)', borderRadius: 8,
          animation: 'kioskLineIn 400ms ease-out both',
        }}>
          THE STREET HAS GONE DARK
        </div>
      )}

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
        boards={shift.boards}
        active={shift.active}
        tray={shift.tray}
        wrapsWanted={shift.wrapsWanted}
        nudge={shift.nudge}
        canRoll={
          !!shift.boards[shift.active]?.meat
          && shift.tray.wraps.length < shift.wrapsWanted
          && shift.status === 'waiting'
        }
        canServe={
          shift.tray.wraps.length >= shift.wrapsWanted
          && !!shift.order && shift.order.kind === 'order'
          && shift.status === 'waiting'
        }
        onTrash={shift.trashBuild}
        onPick={shift.setActive}
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
