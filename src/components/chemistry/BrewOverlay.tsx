'use client'

// ═════════════════════════════════════════════════════════════════════════════
// EREN'S BREW — the lab's bench, and the one door in here that isn't a quiz.
//
// The loop, end to end:
//   1. An order arrives, written in PROPERTIES rather than names ("a plain
//      nonmetal, something heavier than lead, a metalloid"). That's the half of
//      the periodic table the eight study modes never touch.
//   2. You fill it off the tray. A wrong pour puffs soot and costs a burner pip;
//      pips decide the GRADE, never whether you finish. This is the thing you do
//      while the kettle boils, not an exam.
//   3. The order bottles into a real potion with a real perk, and the potion
//      goes on the shelf. Pouring one for Eren is capped at once a day — see
//      lib/chemistry/brewShelf for why — so extra batches stock tomorrow's
//      choice and fill the twelve-recipe book instead of trivialising care.
//
// Tapping places a tile, never dragging: the tray is nine small tiles on a
// phone and the flask is a fixed target, so asking for drag precision one-handed
// would make a gentle game fiddly for nothing.
// ═════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '@/lib/sounds'
import { useTasks } from '@/contexts/TaskContext'
import { useErenStats } from '@/hooks/useErenStats'
import { getDailyKey } from '@/lib/tasks'
import { ChemistryThemeProvider, useChemistryTheme } from '@/lib/chemistry/theme'
import { CATEGORY_COLORS } from '@/lib/chemistry/colors'
import { buildBrew, slotFor, whyItFits, type BrewOrder } from '@/lib/chemistry/brew'
import {
  GRADES, POTION_BY_ID, buffLines, gradeFor, scaleBuff,
  type BrewGrade, type Potion,
} from '@/lib/chemistry/potions'
import {
  canPour, extrasToday, noteExtra, pourBottle, readShelf, shelveBottle, writeShelf,
  EXTRA_TIP_COINS, EXTRA_TIP_LIMIT, type Bottle, type ShelfState,
} from '@/lib/chemistry/brewShelf'
import type { Element } from '@/lib/chemistry/elements'
import BrewFlask from './BrewFlask'
import BrewShelfView from './BrewShelfView'
import BlinkingEren from '@/components/BlinkingEren'
import { LAB_EREN } from './labEren'
import {
  PixelPanel, PixelButton, PixelLabel, Scanlines, Rivets,
  pixelSkin, hard, PIXEL_FONT, BODY_FONT, type PixelSkin,
} from './pixel'
import {
  IconClose, IconFlask, IconSun, IconMoon, IconCoin, IconLightning, IconPaw,
} from '@/components/PixelIcons'

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

/** Burner pips. Running out doesn't fail the brew — it just costs the grade. */
const HEAT = 3
/** How long the pour beat runs before the perk lands. */
const POUR_MS = 1500

type Phase = 'brewing' | 'bottled' | 'closed'

function BrewInner({ onClose }: Props) {
  const { theme, toggle } = useChemistryTheme()
  const skin = pixelSkin(theme)
  const { completeTask, addCoins } = useTasks()
  const { applyBuff } = useErenStats()

  const dailyKey = getDailyKey()
  // Round 0 is today's official order; anything above is an extra batch.
  const [round, setRound] = useState(0)
  const orderKey = round === 0 ? dailyKey : `${dailyKey}-free${round}`
  const order = useMemo<BrewOrder>(() => buildBrew(orderKey), [orderKey])

  // ── Board ──
  const [filled, setFilled] = useState<(Element | null)[]>(() => order.slots.map(() => null))
  const [placed, setPlaced] = useState<Set<number>>(new Set())
  const [flying, setFlying] = useState<number | null>(null)
  const [rejected, setRejected] = useState<number | null>(null)
  const [hinted, setHinted] = useState<number | null>(null)
  const [soot, setSoot] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [misses, setMisses] = useState(0)

  // ── Shelf + phase ──
  const [shelf, setShelf] = useState<ShelfState>(() => readShelf())
  const [phase, setPhase] = useState<Phase>('brewing')
  const [view, setView] = useState<'bench' | 'shelf'>('bench')
  const [grade, setGrade] = useState<BrewGrade>('perfect')
  const [earned, setEarned] = useState<{ coins: number; xp: number } | null>(null)

  // ── The pour ──
  const [pouring, setPouring] = useState<Potion | null>(null)
  const [served, setServed] = useState<{ potion: Potion; lines: string[] } | null>(null)

  // A brew already filled today reopens finished rather than silently handing
  // out a second official order.
  useEffect(() => {
    const fresh = readShelf()
    setShelf(fresh)
    try {
      if (localStorage.getItem(DONE_KEY(dailyKey)) === '1') setPhase('closed')
    } catch { /* private mode */ }
  }, [dailyKey])

  const persist = useCallback((next: ShelfState) => { setShelf(next); writeShelf(next) }, [])

  const total = order.slots.length
  const placedCount = filled.filter(Boolean).length
  const heatLeft = Math.max(0, HEAT - misses)
  const flaskPotion = pouring ?? order.potion
  const fillFrac = pouring ? 0
    : phase === 'brewing' ? placedCount / total
    : served ? 0
    : 1

  // ── Timers ──
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  // ── Bottling: fires once, the moment the last slot fills ──
  const bottledRef = useRef(false)
  useEffect(() => { bottledRef.current = false }, [orderKey])
  useEffect(() => {
    if (phase !== 'brewing' || placedCount < total || bottledRef.current) return
    bottledRef.current = true

    const g = gradeFor(misses)
    const bottle: Bottle = { potionId: order.potion.id, grade: g }
    setGrade(g)
    playSound('care_happy')

    const current = readShelf()
    let next = shelveBottle(current, bottle)

    if (round === 0) {
      try { localStorage.setItem(DONE_KEY(dailyKey), '1') } catch { /* ignore */ }
      const bonus = GRADES[g].bonusCoins
      if (bonus > 0) void addCoins(bonus)
      void completeTask('daily_chem_lesson').then(res => {
        setEarned({ coins: (res?.coins ?? 0) + bonus, xp: res?.xp ?? 0 })
      })
    } else {
      // Extra batches pay a small tip, capped, so "brew another" is worth
      // doing without becoming a coin faucet.
      const paid = extrasToday(next, dailyKey) < EXTRA_TIP_LIMIT
      if (paid) { void addCoins(EXTRA_TIP_COINS); setEarned({ coins: EXTRA_TIP_COINS, xp: 0 }) }
      else setEarned(null)
      next = noteExtra(next, dailyKey)
    }

    persist(next)
    setPhase('bottled')
  }, [placedCount, total, phase, misses, order.potion.id, round, dailyKey, addCoins, completeTask, persist])

  // ── Placing a tile ──
  function handleTile(el: Element) {
    if (phase !== 'brewing' || flying !== null || placed.has(el.atomicNumber)) return
    const live: BrewOrder = { ...order, slots: order.slots.map((s, i) => ({ ...s, filled: filled[i] })) }
    const idx = slotFor(live, el)

    if (idx < 0) {
      playSound('ui_back')
      setRejected(el.atomicNumber)
      setSoot(true)
      setMisses(m => m + 1)
      setNote(`${el.symbol} · ${el.name} doesn't fit this order.`)
      later(() => { setSoot(false); setRejected(null) }, 650)
      return
    }

    playSound('care_drink')
    setHinted(null)
    setFlying(el.atomicNumber)
    setNote(whyItFits(el, order.slots[idx].askId))
    later(() => {
      setFilled(f => f.map((v, i) => (i === idx ? el : v)))
      setPlaced(p => new Set(p).add(el.atomicNumber))
      setFlying(null)
    }, 260)
  }

  /** A hint costs a burner pip — the same currency a wrong pour costs. */
  function handleHint() {
    if (phase !== 'brewing' || hinted !== null) return
    const live: BrewOrder = { ...order, slots: order.slots.map((s, i) => ({ ...s, filled: filled[i] })) }
    const answer = order.tray.find(el => !placed.has(el.atomicNumber) && slotFor(live, el) >= 0)
    if (!answer) return
    playSound('ui_toggle')
    setMisses(m => m + 1)
    setHinted(answer.atomicNumber)
    setNote(`The bench smells faintly of ${answer.name.toLowerCase()}.`)
  }

  /** Start a fresh extra batch. */
  function brewAnother() {
    playSound('ui_tap')
    setRound(r => r + 1)
    setPhase('brewing')
    setView('bench')
    setFilled(order.slots.map(() => null))
    setPlaced(new Set())
    setNote(null)
    setMisses(0)
    setHinted(null)
    setEarned(null)
    setServed(null)
  }

  // Re-seed the board whenever the order changes.
  useEffect(() => {
    setFilled(order.slots.map(() => null))
    setPlaced(new Set())
  }, [order])

  // ── Pouring a bottle for Eren ──
  const pourBusy = pouring !== null
  const pour = useCallback((index: number) => {
    const bottle = shelf.bottles[index]
    const potion = bottle && POTION_BY_ID[bottle.potionId]
    if (!potion || pourBusy || !canPour(shelf, dailyKey)) return

    playSound('care_drink')
    setView('bench')
    setServed(null)
    setPouring(potion)

    later(() => {
      const buff = scaleBuff(potion.buff, bottle.grade)
      void applyBuff(buff)
      if (buff.coins) void addCoins(buff.coins)
      persist(pourBottle(readShelf(), index, dailyKey))
      setPouring(null)
      setServed({ potion, lines: buffLines(buff) })
      playSound('care_gulp')
      later(() => playSound('care_happy'), 260)
    }, POUR_MS)
  }, [shelf, dailyKey, pourBusy, applyBuff, addCoins, persist, later])

  const pourable = canPour(shelf, dailyKey)

  const body = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: skin.bg, color: skin.fg,
      display: 'flex', flexDirection: 'column',
      animation: 'brewPop 240ms steps(5) both',
    }}>
      <Scanlines skin={skin} />

      <Header
        skin={skin}
        theme={theme}
        bottles={shelf.bottles.length}
        view={view}
        pourable={pourable}
        onView={v => { playSound('ui_tap'); setView(v); setServed(null) }}
        onToggle={() => { playSound('ui_toggle'); toggle() }}
        onClose={() => { playSound('ui_tap'); onClose() }}
      />

      <div style={{
        position: 'relative', zIndex: 2,
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '12px 12px calc(24px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', gap: 12,
        maxWidth: 460, width: '100%', margin: '0 auto',
      }}>
        {view === 'shelf' ? (
          <BrewShelfView
            skin={skin} shelf={shelf} dailyKey={dailyKey} onPour={pour} busy={pourBusy}
          />
        ) : (
          <>
            <OrderCard order={order} skin={skin} isExtra={round > 0} done={phase !== 'brewing'} />

            <Bench
              skin={skin}
              potion={flaskPotion}
              fill={fillFrac}
              done={phase !== 'brewing' && !served}
              soot={soot}
              pouring={pourBusy}
              heatLeft={heatLeft}
              showHeat={phase === 'brewing'}
            />

            {phase === 'brewing' && (
              <SlotRow slots={order.slots} filled={filled} skin={skin} />
            )}

            {served ? (
              <ServedCard
                skin={skin} served={served}
                onDone={() => { playSound('ui_tap'); setServed(null) }}
              />
            ) : phase === 'brewing' ? (
              <>
                <Tray
                  tray={order.tray} placed={placed} flying={flying} rejected={rejected}
                  hinted={hinted} skin={skin} onPick={handleTile}
                />
                <NoteLine note={note} skin={skin} />
                <PixelButton
                  skin={skin} onClick={handleHint} disabled={hinted !== null} size={7}
                  style={{ alignSelf: 'center', padding: '8px 14px' }}
                >
                  <IconLightning size={12} />
                  {hinted !== null ? 'HINT USED' : 'HINT · COSTS A PIP'}
                </PixelButton>
              </>
            ) : phase === 'bottled' ? (
              <BottledCard
                skin={skin} order={order} filled={filled} grade={grade} earned={earned}
                pourable={pourable} busy={pourBusy}
                onPour={() => pour(shelf.bottles.length - 1)}
                onShelf={() => { playSound('ui_tap'); setView('shelf') }}
                onAgain={brewAnother}
              />
            ) : (
              <ClosedCard
                skin={skin} bottles={shelf.bottles.length} pourable={pourable}
                onShelf={() => { playSound('ui_tap'); setView('shelf') }}
                onAgain={brewAnother}
              />
            )}
          </>
        )}
      </div>
    </div>
  )

  return createPortal(body, document.body)
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({ skin, theme, bottles, view, pourable, onView, onToggle, onClose }: {
  skin: PixelSkin; theme: 'light' | 'dark'; bottles: number
  view: 'bench' | 'shelf'; pourable: boolean
  onView: (v: 'bench' | 'shelf') => void; onToggle: () => void; onClose: () => void
}) {
  return (
    <div style={{
      position: 'relative', zIndex: 3,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: 'calc(10px + env(safe-area-inset-top, 0px)) 12px 10px',
      borderBottom: `3px solid ${skin.edge}`,
      background: skin.panel,
      boxShadow: `0 3px 0 ${skin.ink}`,
    }}>
      <span style={{ flexShrink: 0 }}><IconFlask size={26} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: PIXEL_FONT, fontSize: 10, lineHeight: 1.5, color: skin.fg }}>
          EREN&apos;S BREW
        </div>
        <PixelLabel color={skin.fgDim} size={5} style={{ display: 'block', marginTop: 3 }}>
          {view === 'shelf' ? 'BOTTLES & RECIPES' : 'ONE POUR A DAY'}
        </PixelLabel>
      </div>

      {/* Shelf toggle carries the count, and a dot when a pour is still owed. */}
      <button
        type="button"
        onClick={() => onView(view === 'shelf' ? 'bench' : 'shelf')}
        aria-label={view === 'shelf' ? 'Back to the bench' : 'Open the shelf'}
        className="chem-pixel-btn"
        style={{
          position: 'relative', flexShrink: 0,
          padding: '7px 9px',
          background: view === 'shelf' ? skin.gold : skin.raised,
          color: view === 'shelf' ? skin.onAccent : skin.fg,
          border: `3px solid ${skin.edge}`, boxShadow: hard(skin.ink, 2),
          fontFamily: PIXEL_FONT, fontSize: 7, letterSpacing: 1, lineHeight: 1.4,
        }}
      >
        {view === 'shelf' ? 'BENCH' : `SHELF ${bottles}`}
        {view !== 'shelf' && pourable && bottles > 0 && (
          <span aria-hidden style={{
            position: 'absolute', top: -4, right: -4, width: 7, height: 7,
            background: '#4ADE80', boxShadow: `1px 1px 0 ${skin.ink}`,
          }} />
        )}
      </button>

      <HeaderIcon skin={skin} onClick={onToggle} label="Toggle theme">
        {theme === 'light' ? <IconMoon size={16} /> : <IconSun size={16} />}
      </HeaderIcon>
      <HeaderIcon skin={skin} onClick={onClose} label="Close">
        <IconClose size={16} tone={skin.fgDim} />
      </HeaderIcon>
    </div>
  )
}

function HeaderIcon({ skin, onClick, label, children }: {
  skin: PixelSkin; onClick: () => void; label: string; children: React.ReactNode
}) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label} className="chem-pixel-btn"
      style={{
        flexShrink: 0, width: 32, height: 32, display: 'grid', placeItems: 'center',
        background: skin.raised, border: `3px solid ${skin.edge}`, boxShadow: hard(skin.ink, 2),
      }}
    >
      {children}
    </button>
  )
}

// ─── The order ───────────────────────────────────────────────────────────────

function OrderCard({ order, skin, isExtra, done }: {
  order: BrewOrder; skin: PixelSkin; isExtra: boolean; done: boolean
}) {
  return (
    <PixelPanel skin={skin} rivets style={{ padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span aria-hidden style={{
          width: 12, height: 12, flexShrink: 0,
          background: order.potion.deep, boxShadow: `2px 2px 0 ${skin.ink}`,
        }} />
        <PixelLabel color={skin.gold} size={7}>
          {isExtra ? 'EXTRA BATCH' : "TODAY'S ORDER"}
        </PixelLabel>
        {done && <PixelLabel color="#4ADE80" size={7} style={{ marginLeft: 'auto' }}>FILLED</PixelLabel>}
      </div>

      <div style={{ fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 1.5, color: skin.fg }}>
        {order.potion.name.toUpperCase()}
      </div>

      <p style={{
        fontFamily: BODY_FONT, fontSize: 13, fontWeight: 600, lineHeight: 1.5,
        color: skin.fg, margin: '9px 0 0',
      }}>
        &ldquo;I need {order.sentence}.&rdquo;
      </p>

      <div style={{
        marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 8px', background: skin.panelLo,
        border: `2px solid ${order.potion.deep}`,
      }}>
        <span aria-hidden style={{ width: 5, height: 5, background: order.potion.light }} />
        <PixelLabel color={skin.fg} size={6}>{order.potion.effect}</PixelLabel>
      </div>
    </PixelPanel>
  )
}

// ─── The bench ───────────────────────────────────────────────────────────────

/** Droplets crossing from the flask mouth to Eren during a pour. */
const DROPS = [
  { delay: '0.30s', dx: -66, dy: 26 },
  { delay: '0.46s', dx: -70, dy: 22 },
  { delay: '0.62s', dx: -62, dy: 30 },
  { delay: '0.78s', dx: -72, dy: 24 },
  { delay: '0.94s', dx: -64, dy: 28 },
]

function Bench({ skin, potion, fill, done, soot, pouring, heatLeft, showHeat }: {
  skin: PixelSkin; potion: Potion; fill: number; done: boolean; soot: boolean
  pouring: boolean; heatLeft: number; showHeat: boolean
}) {
  return (
    <div style={{
      position: 'relative',
      background: skin.panel,
      border: `3px solid ${skin.edge}`,
      boxShadow: hard(skin.ink),
      padding: '10px 12px 4px',
      overflow: 'hidden',
      // `overflow: hidden` drops this item's automatic minimum size to zero, so
      // as a flex child it was the ONE panel the column could squash — once the
      // bottled card made the page taller than the viewport, the whole bench
      // collapsed to a 40px sliver instead of the page scrolling.
      flexShrink: 0,
    }}>
      <Rivets color={skin.gold} ink={skin.ink} />

      {showHeat && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <PixelLabel color={skin.fgDim} size={5}>BURNER</PixelLabel>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: HEAT }).map((_, i) => {
              const lit = i < heatLeft
              return (
                <span key={i} aria-hidden style={{
                  width: 9, height: 12,
                  background: lit ? '#FB923C' : skin.panel,
                  borderTop: `3px solid ${lit ? '#FCD34D' : skin.edge}`,
                  boxShadow: `1px 1px 0 ${skin.ink}`,
                  animation: lit ? undefined : 'brewPipOut 200ms steps(2) both',
                }} />
              )
            })}
          </div>
          <PixelLabel color={skin.fgDim} size={5} style={{ marginLeft: 'auto' }}>
            {heatLeft === HEAT ? 'CLEAN BATCH' : heatLeft > 0 ? 'RUNNING WARM' : 'MURKY'}
          </PixelLabel>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
        <div style={{
          marginBottom: 4, flexShrink: 0,
          animation: pouring ? `brewGulp ${POUR_MS}ms steps(8) 0.35s both` : undefined,
        }}>
          <BlinkingEren size={112} {...LAB_EREN} />
        </div>

        <div style={{
          position: 'relative', flexShrink: 0,
          transformOrigin: '50% 85%',
          animation: pouring ? `brewTip ${POUR_MS}ms steps(8) both` : undefined,
        }}>
          <BrewFlask
            fill={fill}
            deep={potion.deep}
            light={potion.light}
            ink={skin.glassEdge}
            glass={skin.glassFill}
            done={done && !pouring}
            soot={soot}
            cell={5}
          />
          {pouring && DROPS.map((d, i) => (
            <span key={i} aria-hidden style={{
              position: 'absolute', left: 34, top: 6, width: 5, height: 5,
              background: potion.light, boxShadow: `1px 1px 0 ${potion.deep}`,
              animation: `brewPourDrop 700ms steps(7) ${d.delay} both`,
              ['--pour-dx' as string]: `${d.dx}px`,
              ['--pour-dy' as string]: `${d.dy}px`,
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Slots + tray ────────────────────────────────────────────────────────────

function SlotRow({ slots, filled, skin }: {
  slots: BrewOrder['slots']; filled: (Element | null)[]; skin: PixelSkin
}) {
  return (
    <div style={{ display: 'flex', gap: 7, justifyContent: 'center', flexWrap: 'wrap' }}>
      {slots.map((s, i) => {
        const el = filled[i]
        return (
          <div key={i} style={{
            minWidth: 82, padding: '7px 8px',
            background: el ? '#4ADE80' : skin.panelLo,
            border: `3px solid ${el ? '#166534' : skin.edge}`,
            boxShadow: hard(skin.ink, 2),
            textAlign: 'center',
            animation: el ? 'brewPop 260ms steps(5) both' : undefined,
          }}>
            <div style={{
              fontFamily: PIXEL_FONT, fontSize: el ? 12 : 6, letterSpacing: el ? 0 : 0.6,
              lineHeight: 1.5, color: el ? '#0A2E14' : skin.fgDim,
            }}>
              {el ? el.symbol : s.chip}
            </div>
            <div style={{
              fontFamily: PIXEL_FONT, fontSize: 5, lineHeight: 1.6, marginTop: 3,
              color: el ? '#14532D' : skin.fgDim, opacity: el ? 1 : 0.7,
            }}>
              {el ? el.name.toUpperCase() : 'NEEDED'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Tray({ tray, placed, flying, rejected, hinted, skin, onPick }: {
  tray: Element[]; placed: Set<number>; flying: number | null; rejected: number | null
  hinted: number | null; skin: PixelSkin; onPick: (el: Element) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {tray.map(el => {
        const used = placed.has(el.atomicNumber)
        const isHint = hinted === el.atomicNumber && !used
        return (
          <button
            key={el.atomicNumber}
            type="button"
            disabled={used}
            onClick={() => onPick(el)}
            aria-label={`${el.name}, number ${el.atomicNumber}`}
            className="chem-pixel-btn"
            style={{
              position: 'relative',
              padding: '10px 4px 8px',
              background: used ? skin.panelLo : CATEGORY_COLORS[el.category],
              border: `3px solid ${isHint ? skin.gold : skin.edge}`,
              boxShadow: used ? 'none' : isHint ? `${hard(skin.ink)}, 0 0 0 3px ${skin.gold}` : hard(skin.ink),
              transform: used ? 'translate(3px, 3px)' : undefined,
              // A spent tile drops to the recessed surface, so its symbol has to
              // switch to the panel's own foreground or it goes dark-on-dark.
              color: used ? skin.fgDim : '#1A0F2D',
              animation: flying === el.atomicNumber ? 'brewTileIn 260ms steps(6) both'
                : rejected === el.atomicNumber ? 'brewShake 380ms steps(8) both'
                : undefined,
            }}
          >
            <span style={{
              position: 'absolute', top: 4, left: 5,
              fontFamily: PIXEL_FONT, fontSize: 5, opacity: 0.75,
            }}>
              {el.atomicNumber}
            </span>
            <span style={{
              display: 'block', fontFamily: PIXEL_FONT, fontSize: 15, lineHeight: 1.4, marginTop: 7,
            }}>
              {el.symbol}
            </span>
            <span style={{
              display: 'block', fontFamily: PIXEL_FONT, fontSize: 5, lineHeight: 1.7, marginTop: 4,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {el.name.toUpperCase()}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function NoteLine({ note, skin }: { note: string | null; skin: PixelSkin }) {
  return (
    <div style={{
      minHeight: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '0 6px',
      fontFamily: BODY_FONT, fontSize: 12, fontWeight: 600, lineHeight: 1.4,
      color: note ? skin.fg : skin.fgDim,
    }}>
      {note ?? 'Tap what the order asks for.'}
    </div>
  )
}

// ─── Result cards ────────────────────────────────────────────────────────────

function BottledCard({
  skin, order, filled, grade, earned, pourable, busy, onPour, onShelf, onAgain,
}: {
  skin: PixelSkin; order: BrewOrder; filled: (Element | null)[]
  grade: BrewGrade; earned: { coins: number; xp: number } | null
  pourable: boolean; busy: boolean
  onPour: () => void; onShelf: () => void; onAgain: () => void
}) {
  const g = GRADES[grade]
  const used = filled.filter(Boolean) as Element[]
  return (
    <PixelPanel skin={skin} rivets style={{ padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PixelLabel color={skin.gold} size={7}>BOTTLED</PixelLabel>
          <div style={{ fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 1.5, color: skin.fg, marginTop: 7 }}>
            {order.potion.name.toUpperCase()}
          </div>
          <p style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 1.45, color: skin.fgDim, margin: '7px 0 0' }}>
            {order.potion.blurb}
          </p>
        </div>
        <span style={{
          flexShrink: 0, padding: '6px 8px',
          background: g.color, color: '#0A2E14',
          border: `3px solid ${skin.ink}`, boxShadow: hard(skin.ink, 2),
          fontFamily: PIXEL_FONT, fontSize: 8, letterSpacing: 1, lineHeight: 1.4,
          animation: 'brewStamp 420ms steps(6) both',
        }}>
          {g.label}
        </span>
      </div>

      <p style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 1.45, color: skin.fgDim, margin: '10px 0 0' }}>
        {g.line} A {g.label.toLowerCase()} batch pours at {Math.round(g.mult * 100)}% strength.
      </p>

      {earned && (earned.coins > 0 || earned.xp > 0) && (
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 9px', background: skin.panelLo, border: `2px solid ${skin.gold}`,
        }}>
          <IconCoin size={14} />
          <PixelLabel color={skin.fg} size={6}>
            +{earned.coins} COINS{earned.xp > 0 ? ` · +${earned.xp} XP` : ''}
          </PixelLabel>
        </div>
      )}

      <PixelButton
        skin={skin}
        tone={pourable ? '#4ADE80' : undefined}
        disabled={!pourable || busy}
        onClick={pourable ? onPour : onShelf}
        style={{ width: '100%', marginTop: 12 }}
      >
        <IconPaw size={14} />
        {pourable ? 'POUR IT FOR EREN' : 'SHELVED FOR TOMORROW'}
      </PixelButton>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <PixelButton skin={skin} onClick={onShelf} size={7} style={{ flex: 1 }}>
          THE SHELF
        </PixelButton>
        <PixelButton skin={skin} onClick={onAgain} size={7} style={{ flex: 1 }}>
          BREW ANOTHER
        </PixelButton>
      </div>

      {used.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <PixelLabel color={skin.fgDim} size={6}>WHAT WENT IN</PixelLabel>
          {used.map(el => (
            <div key={el.atomicNumber} style={{
              background: skin.panelLo, border: `2px solid ${skin.edge}`, padding: '7px 9px',
            }}>
              <div style={{ fontFamily: PIXEL_FONT, fontSize: 7, lineHeight: 1.6, color: skin.fg }}>
                {el.symbol} · {el.name.toUpperCase()}
              </div>
              {el.funFact && (
                <div style={{
                  fontFamily: BODY_FONT, fontSize: 11.5, lineHeight: 1.4,
                  color: skin.fgDim, marginTop: 4,
                }}>
                  {el.funFact}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PixelPanel>
  )
}

function ClosedCard({ skin, bottles, pourable, onShelf, onAgain }: {
  skin: PixelSkin; bottles: number; pourable: boolean
  onShelf: () => void; onAgain: () => void
}) {
  return (
    <PixelPanel skin={skin} rivets style={{ padding: '14px' }}>
      <PixelLabel color={skin.gold} size={7}>ORDER FILLED</PixelLabel>
      <p style={{ fontFamily: BODY_FONT, fontSize: 12.5, lineHeight: 1.5, color: skin.fgDim, margin: '9px 0 0' }}>
        {pourable && bottles > 0
          ? "Today's order is done and there's a bottle on the shelf waiting to be poured."
          : bottles > 0
            ? "Today's order is done and today's pour is spent. Extra batches still stock the shelf."
            : "Today's order is done. A fresh one lands tomorrow — extra batches stock the shelf in the meantime."}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <PixelButton
          skin={skin} tone={pourable && bottles > 0 ? '#4ADE80' : undefined}
          onClick={onShelf} size={7} style={{ flex: 1 }}
        >
          THE SHELF {bottles > 0 ? `· ${bottles}` : ''}
        </PixelButton>
        <PixelButton skin={skin} onClick={onAgain} size={7} style={{ flex: 1 }}>
          BREW ANOTHER
        </PixelButton>
      </div>
    </PixelPanel>
  )
}

function ServedCard({ skin, served, onDone }: {
  skin: PixelSkin; served: { potion: Potion; lines: string[] }; onDone: () => void
}) {
  return (
    <PixelPanel skin={skin} rivets style={{ padding: '14px', animation: 'brewPop 300ms steps(6) both' }}>
      <PixelLabel color={skin.gold} size={7}>HE DRANK IT</PixelLabel>
      <div style={{ fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 1.5, color: skin.fg, marginTop: 8 }}>
        {served.potion.name.toUpperCase()}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>
        {served.lines.map(line => (
          <span key={line} style={{
            padding: '6px 8px',
            background: served.potion.deep, color: '#FFFFFF',
            border: `2px solid ${skin.ink}`, boxShadow: hard(skin.ink, 2),
            fontFamily: PIXEL_FONT, fontSize: 6, letterSpacing: 0.6, lineHeight: 1.5,
          }}>
            {line}
          </span>
        ))}
      </div>

      <p style={{ fontFamily: BODY_FONT, fontSize: 12, lineHeight: 1.45, color: skin.fgDim, margin: '11px 0 0' }}>
        That&apos;s today&apos;s pour. Keep brewing — the shelf holds twelve, and tomorrow you
        get to pick which one he gets.
      </p>

      <PixelButton skin={skin} onClick={onDone} style={{ width: '100%', marginTop: 12 }}>
        BACK TO THE BENCH
      </PixelButton>
    </PixelPanel>
  )
}
