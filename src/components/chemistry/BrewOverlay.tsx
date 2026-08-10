'use client'

// EREN'S BREW — the lab's second door, and the one that isn't a quiz.
//
// You get one order a day, written in properties rather than names ("something
// liquid at room temperature, and two noble gases"), and you fill it by picking
// element tiles off the shelf. Getting it right is a matter of knowing what
// things ARE and where they sit, which is the half of the table the eight
// existing study modes never touch.
//
// Tapping places a tile — not dragging. The shelf is a 3×3 of small tiles on a
// phone and the flask is a fixed target; asking for drag precision one-handed
// would make a gentle game fiddly for no gain.
//
// Wrong picks cost nothing but a puff of soot. This is the thing you do while
// the kettle boils, not an exam.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X as XIcon, Sun, Moon, RotateCw } from 'lucide-react'
import { playSound } from '@/lib/sounds'
import { useTasks } from '@/contexts/TaskContext'
import { getDailyKey } from '@/lib/tasks'
import { ChemistryThemeProvider, useChemistryTheme, neoShadow, CHEM_FONT, type Palette } from '@/lib/chemistry/theme'
import { CATEGORY_COLORS } from '@/lib/chemistry/colors'
import { buildBrew, slotFor, whyItFits, type BrewOrder } from '@/lib/chemistry/brew'
import type { Element } from '@/lib/chemistry/elements'
import BrewFlask from './BrewFlask'
import BlinkingEren from '@/components/BlinkingEren'
import { LAB_EREN } from './labEren'

interface Props { onClose: () => void }

export default function BrewOverlay({ onClose }: Props) {
  return (
    <ChemistryThemeProvider>
      <BrewInner onClose={onClose} />
    </ChemistryThemeProvider>
  )
}

/** localStorage marker so a finished daily brew stays finished on reopen. */
const DONE_KEY = (key: string) => `eren_brew_done_${key}`

function BrewInner({ onClose }: Props) {
  const { palette, theme, toggle } = useChemistryTheme()
  const { completeTask } = useTasks()

  const dailyKey = getDailyKey()
  // `round` 0 is today's official brew; anything above is a free replay, which
  // pays nothing but lets you keep playing.
  const [round, setRound] = useState(0)
  const orderKey = round === 0 ? dailyKey : `${dailyKey}-free${round}`
  const order = useMemo<BrewOrder>(() => buildBrew(orderKey), [orderKey])

  const [filled, setFilled] = useState<(Element | null)[]>(() => order.slots.map(() => null))
  const [placed, setPlaced] = useState<Set<number>>(new Set())   // shelf atomic numbers used
  const [flying, setFlying] = useState<number | null>(null)      // tile mid-flight
  const [rejected, setRejected] = useState<number | null>(null)
  const [soot, setSoot] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [misses, setMisses] = useState(0)

  // A brew already finished today reopens in its solved state rather than
  // silently handing out a second one.
  const [alreadyDone, setAlreadyDone] = useState(false)
  useEffect(() => {
    if (round !== 0) return
    try { setAlreadyDone(localStorage.getItem(DONE_KEY(dailyKey)) === '1') } catch { /* ignore */ }
  }, [dailyKey, round])

  const total = order.slots.length
  const solvedNow = filled.every(Boolean)
  const done = alreadyDone || solvedNow
  const fillFrac = alreadyDone ? 1 : filled.filter(Boolean).length / total
  // Came back to a brew finished earlier today. We don't store WHICH elements
  // were used, so the slot chips would all read "needed" under a card saying
  // it's brewed. Show the finished state on its own instead of contradicting
  // itself.
  const reopened = alreadyDone && !solvedNow

  // Reward + celebration, once per finished order. The daily brew counts as the
  // lab's "finish a lesson" quest; replays are just for fun.
  const rewardedRef = useRef(false)
  useEffect(() => {
    if (!filled.every(Boolean) || rewardedRef.current) return
    rewardedRef.current = true
    playSound('care_happy')
    if (round === 0 && !alreadyDone) {
      try { localStorage.setItem(DONE_KEY(dailyKey), '1') } catch { /* ignore */ }
      void completeTask('daily_chem_lesson')
    }
  }, [filled, round, alreadyDone, dailyKey, completeTask])

  const sootTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flyTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (sootTimer.current) clearTimeout(sootTimer.current)
    if (flyTimer.current) clearTimeout(flyTimer.current)
  }, [])

  function handleTile(el: Element) {
    if (done || flying !== null || placed.has(el.atomicNumber)) return
    const live: BrewOrder = { ...order, slots: order.slots.map((s, i) => ({ ...s, filled: filled[i] })) }
    const idx = slotFor(live, el)

    if (idx < 0) {
      playSound('ui_back')
      setRejected(el.atomicNumber)
      setSoot(true)
      setMisses(m => m + 1)
      setNote(`${el.symbol} · ${el.name} doesn't fit this order.`)
      if (sootTimer.current) clearTimeout(sootTimer.current)
      sootTimer.current = setTimeout(() => { setSoot(false); setRejected(null) }, 650)
      return
    }

    playSound('care_drink')
    setFlying(el.atomicNumber)
    setNote(whyItFits(el, order.slots[idx].askId))
    if (flyTimer.current) clearTimeout(flyTimer.current)
    flyTimer.current = setTimeout(() => {
      setFilled(f => f.map((v, i) => (i === idx ? el : v)))
      setPlaced(p => new Set(p).add(el.atomicNumber))
      setFlying(null)
    }, 260)
  }

  function brewAnother() {
    playSound('ui_tap')
    rewardedRef.current = false
    setRound(r => r + 1)
    setFilled(order.slots.map(() => null))
    setPlaced(new Set())
    setNote(null)
    setMisses(0)
    setAlreadyDone(false)
  }

  // Re-seed the board whenever the order changes (a replay round).
  useEffect(() => { setFilled(order.slots.map(() => null)); setPlaced(new Set()) }, [order])

  const body = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: palette.bg, color: palette.fg, fontFamily: CHEM_FONT,
      display: 'flex', flexDirection: 'column',
      animation: 'brewPop 240ms cubic-bezier(0.34,1.3,0.64,1) both',
    }}>
      <Header palette={palette} theme={theme} onToggle={toggle} onClose={() => { playSound('ui_tap'); onClose() }} />

      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '10px 14px calc(20px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <OrderCard order={order} palette={palette} isReplay={round > 0} />

        {/* ── The bench: Eren watching, and the flask ──
            On a card, not on the bare page. In dark mode `ink` is near-black,
            so an ink-outlined flask floating on the plum background loses its
            outline entirely and reads as a grey blob; over a card surface it
            reads the way every other outlined thing here does. */}
        <div style={{
          position: 'relative',
          background: palette.card, border: `3px solid ${palette.ink}`, borderRadius: 16,
          boxShadow: neoShadow(palette.ink), padding: '6px 12px 2px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2,
        }}>
          <div style={{ marginBottom: 6, flexShrink: 0 }}>
            <BlinkingEren size={112} {...LAB_EREN} />
          </div>
          <BrewFlask
            fill={fillFrac}
            deep={order.potion.deep}
            light={order.potion.light}
            ink={palette.ink}
            glass={palette.fgFaint}
            done={done}
            soot={soot}
          />
        </div>

        {!reopened && <SlotRow slots={order.slots} filled={filled} palette={palette} done={done} />}

        {done
          ? <DoneCard order={order} filled={filled} misses={misses} reopened={reopened} palette={palette} onAgain={brewAnother} />
          : <>
              <Shelf
                shelf={order.shelf}
                placed={placed}
                flying={flying}
                rejected={rejected}
                palette={palette}
                onPick={handleTile}
              />
              <NoteLine note={note} palette={palette} />
            </>}
      </div>
    </div>
  )

  return createPortal(body, document.body)
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Header({ palette, theme, onToggle, onClose }: {
  palette: Palette; theme: string; onToggle: () => void; onClose: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: 'calc(10px + env(safe-area-inset-top, 0px)) 14px 10px',
      borderBottom: `3px solid ${palette.ink}`, background: palette.card,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.2 }}>Eren&apos;s Brew</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: palette.fgMuted }}>one order a day</div>
      </div>
      <IconBtn palette={palette} onClick={onToggle} label="Toggle theme">
        {theme === 'light' ? <Moon size={16} strokeWidth={3} /> : <Sun size={16} strokeWidth={3} />}
      </IconBtn>
      <IconBtn palette={palette} onClick={onClose} label="Close">
        <XIcon size={16} strokeWidth={3} />
      </IconBtn>
    </div>
  )
}

function IconBtn({ palette, onClick, label, children }: {
  palette: Palette; onClick: () => void; label: string; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} style={{
      flexShrink: 0, width: 34, height: 34, display: 'grid', placeItems: 'center',
      background: palette.cardRaised, color: palette.fg,
      border: `2.5px solid ${palette.ink}`, borderRadius: 10, boxShadow: neoShadow(palette.ink, 'sm'),
    }}>{children}</button>
  )
}

function OrderCard({ order, palette, isReplay }: { order: BrewOrder; palette: Palette; isReplay: boolean }) {
  return (
    <div style={{
      background: palette.card, border: `3px solid ${palette.ink}`, borderRadius: 16,
      boxShadow: neoShadow(palette.ink), padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          width: 14, height: 14, borderRadius: 4, flexShrink: 0,
          background: order.potion.deep, border: `2px solid ${palette.ink}`,
        }} />
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: palette.fgMuted }}>
          {isReplay ? 'EXTRA ORDER' : "TODAY'S ORDER"}
        </span>
      </div>
      <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.1, marginBottom: 6 }}>
        {order.potion.name}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45, color: palette.fg }}>
        &ldquo;I need {order.sentence}.&rdquo;
      </div>
    </div>
  )
}

function SlotRow({ slots, filled, palette, done }: {
  slots: BrewOrder['slots']; filled: (Element | null)[]; palette: Palette; done: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      {slots.map((s, i) => {
        const el = done && !filled[i] ? null : filled[i]
        return (
          <div key={i} style={{
            minWidth: 86, padding: '7px 10px', borderRadius: 12,
            background: el ? palette.green : palette.cardMuted,
            border: `2.5px solid ${palette.ink}`,
            boxShadow: neoShadow(palette.ink, 'sm'),
            textAlign: 'center',
            animation: el ? 'brewPop 300ms cubic-bezier(0.34,1.3,0.64,1) both' : undefined,
          }}>
            <div style={{
              fontSize: el ? 15 : 9, fontWeight: 900, lineHeight: 1.2,
              color: el ? '#0A2E14' : palette.fgMuted,
              letterSpacing: el ? 0 : 0.8,
            }}>
              {el ? el.symbol : s.chip}
            </div>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: el ? '#0A2E14' : palette.fgFaint, marginTop: 1 }}>
              {el ? el.name : 'needed'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Shelf({ shelf, placed, flying, rejected, palette, onPick }: {
  shelf: Element[]; placed: Set<number>; flying: number | null; rejected: number | null
  palette: Palette; onPick: (el: Element) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
      {shelf.map(el => {
        const used = placed.has(el.atomicNumber)
        const isFlying = flying === el.atomicNumber
        const isRejected = rejected === el.atomicNumber
        return (
          <button
            key={el.atomicNumber}
            type="button"
            disabled={used}
            onClick={() => onPick(el)}
            aria-label={`${el.name}, number ${el.atomicNumber}`}
            style={{
              position: 'relative',
              padding: '9px 6px 8px',
              borderRadius: 13,
              background: used ? palette.cardMuted : CATEGORY_COLORS[el.category],
              border: `2.5px solid ${palette.ink}`,
              boxShadow: used ? 'none' : neoShadow(palette.ink, 'sm'),
              opacity: used ? 0.55 : 1,
              transform: used ? 'translate(2px, 2px)' : undefined,
              // A spent tile keeps its symbol legible. The live tiles sit on
              // bright category pastels so dark ink is right for them, but a
              // used tile drops to the muted card surface — dark-on-dark, and
              // the tile went blank in dark mode.
              color: used ? palette.fgMuted : '#1A0F2D',
              animation: isFlying ? 'brewTileIn 260ms ease-in both'
                : isRejected ? 'brewShake 380ms ease-in-out both'
                : undefined,
            }}
          >
            <div style={{ position: 'absolute', top: 5, left: 7, fontSize: 9, fontWeight: 800, opacity: 0.7 }}>
              {el.atomicNumber}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.05, marginTop: 6 }}>{el.symbol}</div>
            <div style={{
              fontSize: 9.5, fontWeight: 700, lineHeight: 1.15, marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {el.name}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function NoteLine({ note, palette }: { note: string | null; palette: Palette }) {
  return (
    <div style={{
      minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '0 6px',
      fontSize: 12, fontWeight: 700, lineHeight: 1.35,
      color: note ? palette.fg : palette.fgFaint,
    }}>
      {note ?? 'tap what the order asks for'}
    </div>
  )
}

function DoneCard({ order, filled, misses, reopened, palette, onAgain }: {
  order: BrewOrder; filled: (Element | null)[]; misses: number; reopened: boolean
  palette: Palette; onAgain: () => void
}) {
  const clean = misses === 0
  const used = filled.filter(Boolean) as Element[]
  return (
    <div style={{
      background: palette.sun, color: '#1A0F2D',
      border: `3px solid ${palette.ink}`, borderRadius: 16,
      boxShadow: neoShadow(palette.ink), padding: '14px 14px 12px',
      animation: 'brewPop 340ms cubic-bezier(0.34,1.3,0.64,1) both',
    }}>
      <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>
        {order.potion.name} — brewed!
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4, opacity: 0.85 }}>
        {reopened ? "You filled today's order already. There's a fresh one tomorrow."
          : clean ? 'Not one wrong pour. Eren is impressed.'
          : `${misses} splash${misses === 1 ? '' : 'es'} on the bench. He drank it anyway.`}
      </div>

      {used.length > 0 && (
        <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {used.map(el => (
            <div key={el.atomicNumber} style={{
              background: 'rgba(255,255,255,0.55)', border: `2px solid ${palette.ink}`,
              borderRadius: 10, padding: '6px 9px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 900 }}>{el.symbol} · {el.name}</div>
              {el.funFact && (
                <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.35, marginTop: 2 }}>{el.funFact}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={onAgain} style={{
        marginTop: 12, width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 12px', borderRadius: 12,
        background: palette.card, color: palette.fg,
        border: `2.5px solid ${palette.ink}`, boxShadow: neoShadow(palette.ink, 'sm'),
        fontFamily: CHEM_FONT, fontSize: 13, fontWeight: 900,
      }}>
        <RotateCw size={15} strokeWidth={3} />
        Brew another (just for fun)
      </button>
    </div>
  )
}
