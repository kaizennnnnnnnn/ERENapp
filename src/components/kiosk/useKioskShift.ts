'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useKioskShift — one night behind the counter.
// ──────────────────────────────────────────────────────────────────────────
// The night runs on a clock. The kiosk opens at 22:00, the street empties at
// 02:00, and closing time stops NEW customers rather than cutting you off —
// whoever is already at the window can always be served. You close up when
// you're ready, through the door on the back wall.
//
// Money does not land per wrap. It piles up in the till and is banked when you
// close, which is what makes closing a moment instead of a door — and what
// keeps the kiosk from being an open tap. One paid shift each per night; the
// second is practice and pays nothing.
//
// Stock is deliberately in-memory: it refills every time you walk in, so the
// kiosk can't be left unplayable, and there's no row for the two of you to
// fight over.
//
// A wrap goes: bare tortilla → meat → toppings → sauce → ROLLED onto the tray.
// Rolling is the point of no return; once it's shut you can't fix what's
// inside, which is what makes reading the ticket before you roll actually
// matter. A two-wrap order gets two boards, so both can be open at once.
//
// Not everything at the window is a sale. Someone turns up in a mood and has
// to be won over; someone else turns up with nothing to buy at all. The cone
// on the spit is raw when you hang it and ruined if you leave it. And the
// weather decides how busy the street is and what it pays.
//
// ONE timer drives the whole night — the clock, every customer's patience, the
// fading ticket, the cone's heat and the power cut are all derived from the
// same accumulated elapsed time, so they can't drift apart, and backgrounding
// the app freezes all of them at once instead of running a shift you can't see.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import {
  MAX_USES, MAX_PORTIONS, EMPTY_BUILD, EMPTY_TRAY, TOPPING_BY_ID,
  rollOrder, rollChat, rollLate, orderMatches, rememberOrder, portionsOf,
  REFUSALS, HAPPY_LINES, IMPATIENT_LINES, USUAL_MISS, WALKOUT_LINES,
  RUDE_HAPPY, RUDE_FLAT, LATE_HAPPY, CHAT_THANKS,
  RAW_LINES, BURNT_LINES, MESSY_LINES,
  pick, unlockedBetween, meatState, rollWeather, WEATHER_BY_ID,
  MEAT_GOOD_MS, MEAT_WARN_MS, CHEER_MS, LINGER_MS, DUCK_MS,
  type Build, type MenuState, type Order, type Regulars, type SauceId,
  type SideId, type Tidiness, type ToppingId, type Tray, type Unlock,
  type MeatState, type WeatherId,
} from './kioskShift'
import {
  SHIFT_MS, PATIENCE_MS, GRUMBLE_AT, NEXT_CUSTOMER_MS, NEXT_AFTER_SALE_MS,
  clockText, orderBase, orderTip, MISSED_CALL_COST, USUAL_BONUS,
  RUDE_CHANCE, RUDE_EARNS_IT, RUDE_MULT,
  CHAT_CHANCE, CHAT_PATIENCE_MS, CHAT_LEAVE_MS, CHAT_TIP,
  LATE_CHANCE, LATE_ARRIVES_MS, LATE_MULT,
  BAD_MEAT_MULT, TIDY_BONUS,
  BLACKOUT_CHANCE, BLACKOUT_MS, BLACKOUT_BONUS,
  NIGHT_GOAL, GOAL_BONUS,
  EMPTY_TAKINGS, gradeNight, type Grade, type Takings,
} from './kioskEconomy'

/** Why an action was refused — drives the one-line hint over the HUD. */
export type Nudge = { id: number; text: string } | null

/** What the customer is saying right now. `id` re-triggers the bubble anim. */
export type Speech = { id: number; text: string } | null

/** A wrap that just got paid for. A fresh object every time, so the till can
 *  key its coin flight off identity rather than off a total that changes for
 *  other reasons too.
 *
 *  `sale` is false for money that arrived without anything being sold — a
 *  visitor who only came to talk still leaves something in the jar. The coins
 *  fly either way, because they really did leave it; the register does not,
 *  because there is nothing to ring up and nothing to print a receipt for. */
export type Payout = { id: number; amount: number; tip: number; sale: boolean } | null

export type ShiftStatus = 'waiting' | 'paid' | 'refused' | 'left'

/** How long the ticket stays legible before it fades to ghosts. Tap the
 *  customer and they'll say it again. Wind takes it off the counter faster. */
const TICKET_MS = 5_600
/** The tick that drives the clock, the patience meters and the ticket. */
const TICK_MS = 100
/** How long after the hand-over the verdict lands — the coins, or the no. */
const PAY_SOUND_MS = 260
/** The cone that's already hanging when you walk in has been on a while —
 *  starting a shift by waiting for raw meat is nobody's idea of an opening. */
const CONE_ALREADY_ON = 26_000

export interface ShiftReport {
  takings: Takings
  grade: Grade
  /** What actually went into the wallet. Zero on a practice night. */
  coins: number
  paid: boolean
  weather: WeatherId
  /** Closed before the street emptied — the tips stayed in the till. */
  early: boolean
  /** Crossed on this shift. */
  unlock: Unlock | null
  /** Wraps the household has served tonight, yours included. */
  nightTotal: number
  /** And whether that cleared the two of you. */
  goalMet: boolean
}

export interface KioskShift {
  // ── the night ───────────────────────────────────────────────────────────
  /** Real ms into the night. */
  elapsed: number
  /** The clock on the wall. */
  clock: string
  /** Past closing: nobody new is coming. */
  lastCall: boolean
  weather: WeatherId
  /** The street has no power. */
  blackout: boolean
  /** Tonight's pay is already spent, or Eren is too tired to work. */
  practice: boolean
  /** Set the moment you close up. */
  report: ShiftReport | null

  // ── the counter ─────────────────────────────────────────────────────────
  stock: Record<ToppingId, number>
  meat: number
  /** How long the cone has been hanging, and what that's done to it. */
  meatOn: number
  meatCooked: MeatState
  /** One board per wrap they asked for. Both can be open at once. */
  boards: Build[]
  /** Which one a pan tap lands on. */
  active: number
  tray: Tray
  /** How many wraps this order still wants. */
  wrapsWanted: number

  // ── the window ──────────────────────────────────────────────────────────
  order: Order | null
  status: ShiftStatus
  /** 1 → just arrived, 0 → walking away. */
  patience: number
  /** Whether the ticket is still legible. */
  ticketOpen: boolean
  /** A missed "usual" shows the ticket for good. */
  revealed: boolean

  // ── the money ───────────────────────────────────────────────────────────
  till: Takings
  streak: number
  paid: Payout

  // ── talk ────────────────────────────────────────────────────────────────
  nudge: Nudge
  speech: Speech

  // ── what you can do ─────────────────────────────────────────────────────
  addTopping: (id: ToppingId) => void
  addSauce: (id: SauceId) => void
  carveMeat: () => void
  takeSide: (id: SideId) => void
  /** Roll the open board onto the tray. `tidy` is how the hold went. */
  rollWrap: (tidy: Tidiness) => void
  /** Move a pan tap to the other board. */
  setActive: (i: number) => void
  restockTopping: (id: ToppingId) => void
  restockMeat: () => void
  trashBuild: () => void
  serve: () => void
  /** Ask them to say it again — or, for someone who came to talk, let them
   *  say the next bit. */
  repeatOrder: () => void
  /** Shutters down. `missedCalls` comes from the phone, which the interior
   *  owns because it has to ring whichever way you're facing. */
  closeUp: (missedCalls: number) => ShiftReport | null
}

const FULL_STOCK: Record<ToppingId, number> = {
  tomato: MAX_USES, onion: MAX_USES, cheese: MAX_USES, lettuce: MAX_USES,
}

function isBusy(b: Build): boolean {
  return b.meat || b.toppings.length > 0 || b.sauce !== null
}

/** Fresh boards for an order — one per wrap they asked for. */
function boardsFor(order: Order | null): Build[] {
  const n = Math.max(1, order?.wraps.length ?? 1)
  return Array.from({ length: n }, () => EMPTY_BUILD)
}

/**
 * Decode a customer's sprite before anyone knows they're coming.
 *
 * Without this the ticket wins the race every time: the order is plain state
 * and paints on the next frame, while the costume is a PNG that still has to
 * be fetched and decoded — so you'd read what they wanted a beat before they
 * showed up to want it.
 */
function arriveWhenDrawn(order: Order): Promise<void> {
  const art = [order.customer.src, order.customer.tailSrc].filter(Boolean) as string[]
  return Promise.all(art.map(src => {
    const img = new window.Image()
    img.src = src
    return img.decode().catch(() => undefined)
  })).then(() => undefined)
}

export interface ShiftOpts {
  /** What the kiosk currently sells. */
  menu: MenuState
  /** Who's been here before, and what they had. */
  regulars: Regulars
  /** Lifetime wraps before tonight, for spotting an unlock. */
  lifetimeWraps: number
  /** Wraps the household has already served tonight, on somebody else's
   *  shift — the head start on the night's shared goal. */
  nightSoFar: number
  /** False when tonight's pay is already spent or Eren is too tired. */
  payable: boolean
  /** Bank the takings. */
  onBank: (coins: number) => void
  /** Write the night down. */
  onClose: (report: ShiftReport, regulars: Regulars) => void
}

export function useKioskShift(opts: ShiftOpts): KioskShift {
  const { menu, regulars, lifetimeWraps, nightSoFar, payable, onBank, onClose } = opts

  const [stock, setStock] = useState<Record<ToppingId, number>>({ ...FULL_STOCK })
  const [meat, setMeat] = useState(MAX_USES)
  const [meatOn, setMeatOn] = useState(CONE_ALREADY_ON)
  const [boards, setBoards] = useState<Build[]>([EMPTY_BUILD])
  const [active, setActiveBoard] = useState(0)
  const [tray, setTray] = useState<Tray>(EMPTY_TRAY)
  const [order, setOrder] = useState<Order | null>(null)
  const [status, setStatus] = useState<ShiftStatus>('waiting')
  const [nudge, setNudge] = useState<Nudge>(null)
  const [speech, setSpeech] = useState<Speech>(null)
  const [paid, setPaid] = useState<Payout>(null)
  const [till, setTill] = useState<Takings>(EMPTY_TAKINGS)
  const [streak, setStreak] = useState(0)
  const [report, setReport] = useState<ShiftReport | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [blackout, setBlackout] = useState(false)

  // The night's own clock, and everything derived from it.
  const [elapsed, setElapsed] = useState(0)
  const [patience, setPatience] = useState(1)
  const [ticketOpen, setTicketOpen] = useState(true)

  // Rolled once, and it colours everything: the street, the flow, the ticket,
  // the tips.
  const [weather] = useState<WeatherId>(rollWeather)
  const sky = WEATHER_BY_ID[weather]

  const lineId = useRef(0)
  const payId = useRef(0)
  const elapsedRef = useRef(0)
  const pausedRef = useRef(false)
  /** Elapsed when the customer at the window arrived, when the ticket was
   *  last said out loud, and when the cone went on. */
  const arrivedAt = useRef(0)
  const ticketAt = useRef(0)
  const meatAt = useRef(-CONE_ALREADY_ON)
  const statusRef = useRef<ShiftStatus>('waiting')
  const orderRef = useRef<Order | null>(null)
  const closedRef = useRef(false)
  /** Who we've learned tonight, folded into what the household already knew. */
  const learned = useRef<Regulars>({})
  const streakRef = useRef(0)
  const blackoutRef = useRef(false)
  /** Which line of a chat they're on, and whether they've finished. */
  const chatIdx = useRef(0)
  const chatDone = useRef(false)
  /** The closing-time regular comes once or not at all. */
  const lateBooked = useRef(false)
  /** Whether anyone at all has been to the window yet. Nobody's first
   *  customer should be someone in a mood. */
  const arrivals = useRef(0)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  const say = useCallback((text: string) => {
    setNudge({ id: ++lineId.current, text })
  }, [])
  const speak = useCallback((text: string) => {
    setSpeech({ id: ++lineId.current, text })
  }, [])

  // Guards the async arrival below. Set on mount as well as cleared on
  // unmount: StrictMode mounts, unmounts and remounts in dev, and a ref that
  // only ever gets cleared stays false through the second mount — so nobody
  // would ever walk up to the window again.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const setPhase = useCallback((next: ShiftStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const lastCall = elapsed >= SHIFT_MS
  const meatCooked = meatState(meatOn)

  /** How long this particular visitor will stand there. */
  const patienceMs = useCallback((o: Order): number => {
    if (o.kind === 'chat') return CHAT_PATIENCE_MS
    if (o.late) return PATIENCE_MS * 1.3
    if (o.mood === 'rude') return PATIENCE_MS * 0.82
    return PATIENCE_MS
  }, [])

  // ── who's next ──────────────────────────────────────────────────────────
  /** Put somebody at the window, once their costume can actually be drawn. */
  const walkUp = useCallback((next: Order) => {
    arriveWhenDrawn(next).then(() => {
      if (!alive.current || closedRef.current) return
      arrivals.current += 1
      arrivedAt.current = elapsedRef.current
      ticketAt.current = elapsedRef.current
      chatIdx.current = 0
      chatDone.current = false
      setPatience(1)
      setTicketOpen(true)
      setRevealed(false)
      setBoards(boardsFor(next))
      setActiveBoard(0)
      setTray(EMPTY_TRAY)
      setPhase('waiting')
      orderRef.current = next
      setOrder(next)
      speak(next.line)
    })
  }, [speak, setPhase])

  const nextCustomer = useCallback(() => {
    if (closedRef.current || elapsedRef.current >= SHIFT_MS) return
    // Never on the first knock: the kiosk introduces itself politely, and a
    // chat before you've served anyone reads as the game being broken.
    const roll = Math.random()
    const settled = arrivals.current > 0
    if (settled && roll < CHAT_CHANCE) { walkUp(rollChat()); return }
    const rude = settled && roll < CHAT_CHANCE + RUDE_CHANCE
    walkUp(rollOrder(menu, { ...regulars, ...learned.current }, rude))
  }, [menu, regulars, walkUp])

  /** The one who turns up after the shutters should already be down. */
  const lateCustomer = useCallback(() => {
    if (closedRef.current || orderRef.current) return
    walkUp(rollLate(menu))
  }, [menu, walkUp])

  // First customer walks up a beat after you're through the door.
  useEffect(() => {
    const t = setTimeout(nextCustomer, 1400)
    return () => clearTimeout(t)
    // Deliberately once: re-running this on a menu change would walk a second
    // customer up to a window that already has one.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── the lights ──────────────────────────────────────────────────────────
  // Somewhere in the middle of the night the street can lose power. Booked on
  // mount so it lands at the same moment however the night goes.
  useEffect(() => {
    if (Math.random() >= BLACKOUT_CHANCE) return
    const at = SHIFT_MS * (0.32 + Math.random() * 0.36)
    const on = setTimeout(() => {
      // Booked on real time rather than the shift clock, so it can land while
      // the receipt is up if you close early. Nothing to see then.
      if (closedRef.current) return
      blackoutRef.current = true
      setBlackout(true)
      playSound('kiosk_blackout')
    }, at)
    const off = setTimeout(() => {
      if (!blackoutRef.current) return
      blackoutRef.current = false
      setBlackout(false)
      playSound('kiosk_power')
    }, at + BLACKOUT_MS)
    return () => { clearTimeout(on); clearTimeout(off) }
  }, [])

  // ── they gave up ────────────────────────────────────────────────────────
  const walkOff = useCallback(() => {
    setPhase('left')
    speak(pick(WALKOUT_LINES))
    playSound('kiosk_walkout')
    setStreak(0)
    streakRef.current = 0
    setTill(t => ({ ...t, walked: t.walked + 1 }))
    later(() => {
      orderRef.current = null
      setOrder(null)
      setBoards([EMPTY_BUILD])
      setActiveBoard(0)
      setTray(EMPTY_TRAY)
      setPhase('waiting')
    }, DUCK_MS + 160)
    later(nextCustomer, DUCK_MS + NEXT_CUSTOMER_MS * sky.flow)
  }, [later, nextCustomer, speak, setPhase, sky.flow])

  /** A visitor who came to talk, going home. `heard` = you let them finish. */
  const chatLeaves = useCallback((heard: boolean) => {
    if (statusRef.current !== 'waiting') return
    // Heard out, they hop off happy; ignored, they just wander away. Two
    // different exits, because they were two different visits.
    setPhase(heard ? 'paid' : 'left')
    if (heard) {
      speak(pick(CHAT_THANKS))
      setPaid({ id: ++payId.current, amount: CHAT_TIP, tip: CHAT_TIP, sale: false })
      setTill(t => ({ ...t, tips: t.tips + CHAT_TIP }))
      playSound('coin_pickup')
    } else {
      speak('right. i’ll leave you to it.')
    }
    const gone = heard ? CHEER_MS + LINGER_MS + DUCK_MS : DUCK_MS
    later(() => {
      orderRef.current = null
      setOrder(null)
      setBoards([EMPTY_BUILD])
      setActiveBoard(0)
      setTray(EMPTY_TRAY)
      setPhase('waiting')
    }, gone + 120)
    later(nextCustomer, gone + NEXT_AFTER_SALE_MS * sky.flow)
  }, [later, nextCustomer, speak, setPhase, sky.flow])

  // ── the one timer ───────────────────────────────────────────────────────
  // Reached through refs so the interval below can be created ONCE. It
  // ticks ten times a second and every tick re-renders; an effect that
  // depended on the callbacks themselves would spend the whole night being
  // torn down and started again.
  const walkOffRef = useRef(walkOff)
  useEffect(() => { walkOffRef.current = walkOff }, [walkOff])
  const chatLeavesRef = useRef(chatLeaves)
  useEffect(() => { chatLeavesRef.current = chatLeaves }, [chatLeaves])
  const lateRef = useRef(lateCustomer)
  useEffect(() => { lateRef.current = lateCustomer }, [lateCustomer])
  const patienceMsRef = useRef(patienceMs)
  useEffect(() => { patienceMsRef.current = patienceMs }, [patienceMs])
  const burnRef = useRef(sky.ticketBurn)
  useEffect(() => { burnRef.current = sky.ticketBurn }, [sky.ticketBurn])
  const sayRef = useRef(say)
  useEffect(() => { sayRef.current = say }, [say])

  /** What the cone was last time we looked, and whether the "nearly gone
   *  over" heads-up has already been given for THIS cone. Both reset when a
   *  fresh one goes on, so it's a warning rather than a commentary. */
  const coneWas = useRef<MeatState>('good')
  const coneNagged = useRef(false)

  useEffect(() => {
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = now - last
      last = now
      // Backgrounded: keep the cursor moving with real time but bank none of
      // it, so a glance at a notification isn't a customer lost.
      if (pausedRef.current || closedRef.current) return

      elapsedRef.current += dt
      setElapsed(elapsedRef.current)

      // The cone cooks on the same clock as everything else, so it doesn't
      // burn down while the app is in your pocket.
      const on = elapsedRef.current - meatAt.current
      setMeatOn(on)
      const cooked = meatState(on)
      if (cooked !== coneWas.current) {
        // Said wherever you're standing: the spit is one wall away, and a
        // cone that quietly ruins itself while you're at the window is a
        // trap rather than a mechanic.
        if (cooked === 'charred') sayRef.current('the cone has caught — hang a fresh one')
        if (cooked === 'good') sayRef.current('the cone is ready')
        coneWas.current = cooked
      } else if (cooked === 'good' && !coneNagged.current && on > MEAT_GOOD_MS - MEAT_WARN_MS) {
        coneNagged.current = true
        sayRef.current('the cone is nearly gone over')
      }

      // The last one of the night, booked the moment the street empties.
      if (elapsedRef.current >= SHIFT_MS && !lateBooked.current) {
        lateBooked.current = true
        if (Math.random() < LATE_CHANCE) {
          const [lo, hi] = LATE_ARRIVES_MS
          timers.current.push(setTimeout(() => lateRef.current(), lo + Math.random() * (hi - lo)))
        }
      }

      const current = orderRef.current
      if (current && statusRef.current === 'waiting') {
        const waited = elapsedRef.current - arrivedAt.current
        const left = Math.max(0, 1 - waited / patienceMsRef.current(current))
        setPatience(left)
        setTicketOpen(elapsedRef.current - ticketAt.current < TICKET_MS / burnRef.current)
        if (left <= 0) {
          if (current.kind === 'chat') { if (!chatDone.current) chatLeavesRef.current(false) }
          else walkOffRef.current()
        }
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  useVisibilityPause(
    useCallback(() => { pausedRef.current = true }, []),
    useCallback(() => { pausedRef.current = false }, []),
  )

  // They start commenting on the wait once their patience is most of the way
  // gone — one remark, not a running commentary. Never someone who only came
  // to talk: they're not waiting for anything.
  const grumbled = useRef(false)
  useEffect(() => { grumbled.current = false }, [order])
  useEffect(() => {
    if (!order || order.kind === 'chat' || status !== 'waiting' || grumbled.current) return
    if (patience > GRUMBLE_AT) return
    grumbled.current = true
    speak(pick(IMPATIENT_LINES))
  }, [patience, order, status, speak])

  // ── building ────────────────────────────────────────────────────────────
  const board = boards[active] ?? EMPTY_BUILD
  const boardBusy = boards.some(isBusy)
  // A chat has no wraps, but the HUD still needs a board and a slot to be
  // about — an order for nought reads as the strip having broken.
  const wrapsWanted = order?.kind === 'chat' ? 1 : (order?.wraps.length ?? 1)
  const trayFull = tray.wraps.length >= wrapsWanted

  /** Change the open board. Everything you can put on a wrap goes through
   *  here, so a two-wrap order only ever needs one extra tap. */
  const editBoard = useCallback((fn: (b: Build) => Build) => {
    setBoards(bs => bs.map((b, i) => (i === active ? fn(b) : b)))
  }, [active])

  const setActive = useCallback((i: number) => {
    // Compared against the current value rather than decided inside the
    // updater: StrictMode runs updaters twice, and a sound in one of them is
    // a double click.
    setActiveBoard(prev => {
      if (prev !== i) playSound('ui_tap')
      return i
    })
  }, [])

  const addTopping = useCallback((id: ToppingId) => {
    if (!board.meat) { say('meat on the wrap first'); playSound('ui_back'); return }
    const on = portionsOf(board.toppings, id)
    if (on >= MAX_PORTIONS) { say('that is plenty of that'); playSound('ui_back'); return }
    if (stock[id] <= 0) { say('empty — restock at the fridge'); playSound('ui_back'); return }
    setStock(s => ({ ...s, [id]: s[id] - 1 }))
    editBoard(b => ({ ...b, toppings: [...b.toppings, id] }))
    // The second scoop is a decision, not a slip — say so, because from the
    // pan alone the two taps look identical.
    if (on === 1) say(`extra ${TOPPING_BY_ID[id].label.toLowerCase()}`)
    playSound(on === 1 ? 'ui_toggle' : 'ui_select')
  }, [board.meat, board.toppings, stock, say, editBoard])

  const addSauce = useCallback((id: SauceId) => {
    if (!board.meat) { say('meat on the wrap first'); playSound('ui_back'); return }
    // Tapping the bottle you already used wipes it off — the only way back
    // from the wrong sauce, short of the bin.
    editBoard(b => ({ ...b, sauce: b.sauce === id ? null : id }))
    playSound(board.sauce === id ? 'ui_back' : 'kiosk_squeeze')
  }, [board.meat, board.sauce, say, editBoard])

  const carveMeat = useCallback(() => {
    if (board.meat) { say('already carved'); playSound('ui_back'); return }
    if (meat <= 0) { say('spit is bare — load a new cone'); playSound('ui_back'); return }
    const cooked = meatState(elapsedRef.current - meatAt.current)
    setMeat(m => m - 1)
    // What the cone was like at the moment of carving rides with the wrap.
    // Hang a fresh cone afterwards and this slice is still what it is.
    editBoard(b => ({ ...b, meat: true, meatBad: cooked === 'good' ? null : cooked }))
    if (cooked === 'raw') say('that came off raw')
    if (cooked === 'charred') say('that came off burnt')
    playSound('ui_select')
  }, [board.meat, meat, say, editBoard])

  // Sides ride alongside the wrap, so they're still fair game after a
  // tortilla is shut.
  const takeSide = useCallback((id: SideId) => {
    if (tray.sides.includes(id)) { say('already grabbed one'); playSound('ui_back'); return }
    setTray(t => ({ ...t, sides: [...t.sides, id] }))
    playSound('ui_select')
  }, [tray.sides, say])

  const rollWrap = useCallback((tidy: Tidiness) => {
    if (!board.meat) { say('nothing on the tortilla yet'); playSound('ui_back'); return }
    if (trayFull) { say('that is all they asked for'); playSound('ui_back'); return }
    setTray(t => ({ ...t, wraps: [...t.wraps, { ...board, tidy }] }))
    setBoards(bs => bs.map((b, i) => (i === active ? EMPTY_BUILD : b)))
    // Straight to whichever board still has nothing on it, so a two-wrap
    // order never needs a tap just to carry on.
    setActiveBoard(prev => {
      const next = boards.findIndex((b, i) => i !== prev && !isBusy(b))
      return next >= 0 ? next : prev
    })
    if (tidy === 'split') say('that one split')
    playSound(tidy === 'split' ? 'ui_back' : 'ui_toggle')
  }, [board, boards, active, trayFull, say])

  const restockTopping = useCallback((id: ToppingId) => {
    setStock(s => ({ ...s, [id]: MAX_USES }))
    playSound('ui_toggle')
  }, [])

  const restockMeat = useCallback(() => {
    setMeat(MAX_USES)
    meatAt.current = elapsedRef.current
    setMeatOn(0)
    coneWas.current = 'raw'
    coneNagged.current = false
    playSound('ui_toggle')
  }, [])

  const trashBuild = useCallback(() => {
    setBoards(boardsFor(orderRef.current))
    setActiveBoard(0)
    setTray(EMPTY_TRAY)
    playSound('ui_back')
  }, [])

  /** Ask them to say it again — free, and the only way back once the ticket
   *  has faded. A regular asking for "the usual" has nothing to repeat, and
   *  somebody who came to talk has the next bit of what they came to say. */
  const repeatOrder = useCallback(() => {
    const current = orderRef.current
    if (!current || statusRef.current !== 'waiting') return

    if (current.kind === 'chat') {
      if (chatDone.current) return
      const next = chatIdx.current + 1
      if (next >= current.chat.length) return
      chatIdx.current = next
      speak(current.chat[next])
      playSound('ui_select', { volume: 0.4 })
      if (next === current.chat.length - 1) {
        // Heard out. They stop watching the clock and go when they're ready.
        chatDone.current = true
        later(() => chatLeavesRef.current(true), CHAT_LEAVE_MS)
      }
      return
    }

    ticketAt.current = elapsedRef.current
    setTicketOpen(true)
    speak(current.usual ? pick(['the usual. you know.', 'same as ever.']) : current.line)
    playSound('ui_select', { volume: 0.4 })
  }, [speak, later])

  // ── handing it over ─────────────────────────────────────────────────────
  const serve = useCallback(() => {
    const current = orderRef.current
    if (!current) return
    if (current.kind === 'chat') { say('they are not buying anything'); playSound('ui_back'); return }
    if (boardBusy) { say('roll it up before you hand it over'); playSound('ui_back'); return }
    if (tray.wraps.length < current.wraps.length) {
      say(current.wraps.length > 1 ? 'they asked for two' : 'roll it up first')
      playSound('ui_back')
      return
    }

    // The physical act, before anyone has an opinion about it. Right or
    // wrong, the wrap crosses the counter the same way.
    playSound('kiosk_handover')

    if (orderMatches(current, tray)) {
      const base = orderBase(current)

      // Everything that happened to the food, and then everything about the
      // person it's going to. Kept in this order on purpose: a burnt wrap is
      // a burnt wrap no matter who's buying it.
      const badMeat = tray.wraps.find(w => w.meatBad)?.meatBad ?? null
      const split = tray.wraps.some(w => w.tidy === 'split')
      const craft = tray.wraps.reduce((sum, w) => sum + TIDY_BONUS[w.tidy], 0) / tray.wraps.length

      let tip = orderTip(base, patience, streakRef.current) * sky.tip * (1 + craft)
      if (badMeat) tip *= BAD_MEAT_MULT
      if (current.usual) tip += USUAL_BONUS

      // A rude one pays nothing on principle — unless you were right AND
      // quick, at which point they climb down and pay over the odds.
      const wonOver = current.mood === 'rude' && patience >= RUDE_EARNS_IT
      if (current.mood === 'rude') tip = wonOver ? tip * RUDE_MULT : 0

      if (blackoutRef.current) tip += BLACKOUT_BONUS * tray.wraps.length

      let earned = base + Math.round(tip)
      // The last one of the night is worth staying open for, all of it.
      if (current.late) earned = Math.round(earned * LATE_MULT)
      const tipPart = earned - base

      setPhase('paid')
      setPaid({ id: ++payId.current, amount: earned, tip: Math.max(0, tipPart), sale: true })
      setTill(t => ({
        ...t,
        served: t.served + 1,
        base: t.base + base,
        tips: t.tips + Math.max(0, tipPart),
        inDark: t.inDark + (blackoutRef.current ? 1 : 0),
        bestStreak: Math.max(t.bestStreak, streakRef.current + 1),
      }))
      streakRef.current += 1
      setStreak(streakRef.current)
      // A costume you got right is a costume the kiosk remembers.
      learned.current = {
        ...learned.current,
        [current.customer.id]: rememberOrder(
          current,
          learned.current[current.customer.id] ?? regulars[current.customer.id],
        ),
      }

      // What they say. The complaints come first: a line about burnt meat is
      // the only way you ever find out the cone went over while you were at
      // the window, so it outranks being thanked.
      speak(
        badMeat ? pick(badMeat === 'raw' ? RAW_LINES : BURNT_LINES)
        : split ? pick(MESSY_LINES)
        : current.mood === 'rude' ? pick(wonOver ? RUDE_HAPPY : RUDE_FLAT)
        : current.late ? pick(LATE_HAPPY)
        : pick(HAPPY_LINES),
      )
      // The wrap goes over the counter first and the money answers it — one
      // sound on top of the other reads as a single event, and pressing GIVE
      // should sound like giving rather than like being paid.
      later(() => playSound('coin_pickup'), PAY_SOUND_MS)

      // They hop, then they STAND there being pleased with you, and only then
      // do they duck. The middle beat is the one you read the line in.
      const gone = CHEER_MS + LINGER_MS + DUCK_MS
      later(() => {
        orderRef.current = null
        setOrder(null)
        setBoards([EMPTY_BUILD])
        setActiveBoard(0)
        setTray(EMPTY_TRAY)
        setPhase('waiting')
      }, gone + 120)
      later(nextCustomer, gone + NEXT_AFTER_SALE_MS * sky.flow)
    } else {
      setPhase('refused')
      // A regular who asked for "the usual" and got something else finally
      // shows you the ticket. Everyone else stays vague on purpose — you're
      // meant to re-read your own order, not be told the answer.
      if (current.usual) setRevealed(true)
      speak(pick(current.usual ? USUAL_MISS : REFUSALS))
      // Same beat as the payment: handed over, LOOKED at, then answered.
      later(() => playSound('kiosk_refuse'), PAY_SOUND_MS)
      setStreak(0)
      streakRef.current = 0
      setTill(t => ({ ...t, wrong: t.wrong + 1 }))
      later(() => setPhase('waiting'), 1600)
    }
  }, [boardBusy, tray, patience, sky.tip, sky.flow, regulars, later, nextCustomer, say, speak, setPhase])

  // ── shutters down ───────────────────────────────────────────────────────
  const closeUp = useCallback((missedCalls: number): ShiftReport | null => {
    if (closedRef.current) return report
    const attempts = till.served + till.wrong + till.walked
    // Walking straight back out isn't a shift, and shouldn't spend tonight's.
    if (attempts === 0) return null

    closedRef.current = true
    const early = elapsedRef.current < SHIFT_MS
    const takings: Takings = {
      ...till,
      missedCalls,
      // Tips are what you carry out only if you stayed to the end. Leave the
      // street early and the base pay follows you home; the rest stays in the
      // till.
      tips: Math.max(0, (early ? 0 : till.tips) - missedCalls * MISSED_CALL_COST),
    }
    const grade = gradeNight(takings)
    const nightTotal = nightSoFar + takings.served
    const goalMet = nightTotal >= NIGHT_GOAL
    const coins = payable
      ? takings.base + takings.tips + (goalMet ? GOAL_BONUS : 0)
      : 0
    const next: ShiftReport = {
      takings, grade, coins, paid: payable, weather, early, nightTotal, goalMet,
      unlock: unlockedBetween(lifetimeWraps, lifetimeWraps + takings.served),
    }
    setReport(next)
    if (coins > 0) onBank(coins)
    onClose(next, { ...regulars, ...learned.current })
    return next
  }, [till, payable, weather, lifetimeWraps, nightSoFar, regulars, report, onBank, onClose])

  const practice = !payable

  return {
    elapsed, clock: clockText(elapsed), lastCall, weather, blackout, practice, report,
    stock, meat, meatOn, meatCooked, boards, active, tray, wrapsWanted,
    order, status, patience, ticketOpen, revealed,
    till, streak, paid,
    nudge, speech,
    addTopping, addSauce, carveMeat, takeSide, rollWrap, setActive,
    restockTopping, restockMeat, trashBuild, serve, repeatOrder, closeUp,
  }
}
