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
// matter.
//
// ONE timer drives the whole night — the clock, every customer's patience and
// the fading ticket are all derived from the same accumulated elapsed time, so
// they can't drift apart, and backgrounding the app freezes all three at once
// instead of running a shift you can't see.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import {
  MAX_USES, EMPTY_BUILD, EMPTY_TRAY, rollOrder, orderMatches, rememberOrder,
  REFUSALS, HAPPY_LINES, IMPATIENT_LINES, USUAL_MISS, WALKOUT_LINES, pick,
  unlockedBetween, CHEER_MS, LINGER_MS, DUCK_MS,
  type Build, type MenuState, type Order, type Regulars, type SauceId,
  type SideId, type ToppingId, type Tray, type Unlock,
} from './kioskShift'
import {
  SHIFT_MS, PATIENCE_MS, GRUMBLE_AT, NEXT_CUSTOMER_MS, NEXT_AFTER_SALE_MS, clockText,
  orderBase, orderTip, MISSED_CALL_COST, RAIN_BONUS, USUAL_BONUS,
  EMPTY_TAKINGS, gradeNight, type Grade, type Takings,
} from './kioskEconomy'

/** Why an action was refused — drives the one-line hint over the HUD. */
export type Nudge = { id: number; text: string } | null

/** What the customer is saying right now. `id` re-triggers the bubble anim. */
export type Speech = { id: number; text: string } | null

/** A wrap that just got paid for. A fresh object every time, so the till can
 *  key its coin flight off identity rather than off a total that changes for
 *  other reasons too. */
export type Payout = { id: number; amount: number } | null

export type ShiftStatus = 'waiting' | 'paid' | 'refused' | 'left'

/** How long the ticket stays legible before it fades to ghosts. Tap the
 *  customer and they'll say it again. */
const TICKET_MS = 5_600
/** Chance of rain on any given night. */
const RAIN_CHANCE = 0.3
/** The tick that drives the clock, the patience meters and the ticket. */
const TICK_MS = 100
/** How long after the hand-over the verdict lands — the coins, or the no. */
const PAY_SOUND_MS = 260

export interface ShiftReport {
  takings: Takings
  grade: Grade
  /** What actually went into the wallet. Zero on a practice night. */
  coins: number
  paid: boolean
  rained: boolean
  /** Closed before the street emptied — the tips stayed in the till. */
  early: boolean
  /** Crossed on this shift. */
  unlock: Unlock | null
}

export interface KioskShift {
  // ── the night ───────────────────────────────────────────────────────────
  /** Real ms into the night. */
  elapsed: number
  /** The clock on the wall. */
  clock: string
  /** Past closing: nobody new is coming. */
  lastCall: boolean
  rained: boolean
  /** Tonight's pay is already spent, or Eren is too tired to work. */
  practice: boolean
  /** Set the moment you close up. */
  report: ShiftReport | null

  // ── the counter ─────────────────────────────────────────────────────────
  stock: Record<ToppingId, number>
  meat: number
  build: Build
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
  rollWrap: () => void
  restockTopping: (id: ToppingId) => void
  restockMeat: () => void
  trashBuild: () => void
  serve: () => void
  /** Ask them to say it again. */
  repeatOrder: () => void
  /** Shutters down. `missedCalls` comes from the phone, which the interior
   *  owns because it has to ring whichever way you're facing. */
  closeUp: (missedCalls: number) => ShiftReport | null
}

const FULL_STOCK: Record<ToppingId, number> = {
  tomato: MAX_USES, onion: MAX_USES, cheese: MAX_USES, lettuce: MAX_USES,
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
  /** False when tonight's pay is already spent or Eren is too tired. */
  payable: boolean
  /** Bank the takings. */
  onBank: (coins: number) => void
  /** Write the night down. */
  onClose: (report: ShiftReport, regulars: Regulars) => void
}

export function useKioskShift(opts: ShiftOpts): KioskShift {
  const { menu, regulars, lifetimeWraps, payable, onBank, onClose } = opts

  const [stock, setStock] = useState<Record<ToppingId, number>>({ ...FULL_STOCK })
  const [meat, setMeat] = useState(MAX_USES)
  const [build, setBuild] = useState<Build>(EMPTY_BUILD)
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

  // The night's own clock, and everything derived from it.
  const [elapsed, setElapsed] = useState(0)
  const [patience, setPatience] = useState(1)
  const [ticketOpen, setTicketOpen] = useState(true)

  const [rained] = useState(() => Math.random() < RAIN_CHANCE)

  const lineId = useRef(0)
  const payId = useRef(0)
  const elapsedRef = useRef(0)
  const pausedRef = useRef(false)
  /** Elapsed when the customer at the window arrived, and when the ticket was
   *  last said out loud. */
  const arrivedAt = useRef(0)
  const ticketAt = useRef(0)
  const statusRef = useRef<ShiftStatus>('waiting')
  const orderRef = useRef<Order | null>(null)
  const closedRef = useRef(false)
  /** Who we've learned tonight, folded into what the household already knew. */
  const learned = useRef<Regulars>({})
  const streakRef = useRef(0)

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

  // ── who's next ──────────────────────────────────────────────────────────
  const nextCustomer = useCallback(() => {
    if (closedRef.current || elapsedRef.current >= SHIFT_MS) return
    const next = rollOrder(menu, { ...regulars, ...learned.current })
    arriveWhenDrawn(next).then(() => {
      if (!alive.current || closedRef.current) return
      arrivedAt.current = elapsedRef.current
      ticketAt.current = elapsedRef.current
      setPatience(1)
      setTicketOpen(true)
      setRevealed(false)
      setBuild(EMPTY_BUILD)
      setTray(EMPTY_TRAY)
      setPhase('waiting')
      orderRef.current = next
      setOrder(next)
      speak(next.line)
    })
  }, [menu, regulars, speak, setPhase])

  // First customer walks up a beat after you're through the door.
  useEffect(() => {
    const t = setTimeout(nextCustomer, 1400)
    return () => clearTimeout(t)
    // Deliberately once: re-running this on a menu change would walk a second
    // customer up to a window that already has one.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      setBuild(EMPTY_BUILD)
      setTray(EMPTY_TRAY)
      setPhase('waiting')
    }, DUCK_MS + 160)
    later(nextCustomer, DUCK_MS + NEXT_CUSTOMER_MS)
  }, [later, nextCustomer, speak, setPhase])

  // ── the one timer ───────────────────────────────────────────────────────
  // Reached through a ref so the interval below can be created ONCE. It
  // ticks ten times a second and every tick re-renders; an effect that
  // depended on the callback itself would spend the whole night being torn
  // down and started again.
  const walkOffRef = useRef(walkOff)
  useEffect(() => { walkOffRef.current = walkOff }, [walkOff])

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

      if (orderRef.current && statusRef.current === 'waiting') {
        const waited = elapsedRef.current - arrivedAt.current
        const left = Math.max(0, 1 - waited / PATIENCE_MS)
        setPatience(left)
        setTicketOpen(elapsedRef.current - ticketAt.current < TICKET_MS)
        if (left <= 0) walkOffRef.current()
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  useVisibilityPause(
    useCallback(() => { pausedRef.current = true }, []),
    useCallback(() => { pausedRef.current = false }, []),
  )

  // They start commenting on the wait once their patience is most of the way
  // gone — one remark, not a running commentary.
  const grumbled = useRef(false)
  useEffect(() => { grumbled.current = false }, [order])
  useEffect(() => {
    if (!order || status !== 'waiting' || grumbled.current) return
    if (patience > GRUMBLE_AT) return
    grumbled.current = true
    speak(pick(IMPATIENT_LINES))
  }, [patience, order, status, speak])

  // ── building ────────────────────────────────────────────────────────────
  const boardBusy = build.meat || build.toppings.length > 0 || build.sauce !== null
  const wrapsWanted = order?.wraps.length ?? 1
  const trayFull = tray.wraps.length >= wrapsWanted

  const addTopping = useCallback((id: ToppingId) => {
    if (!build.meat) { say('meat on the wrap first'); playSound('ui_back'); return }
    if (build.toppings.includes(id)) { say('already on there'); playSound('ui_back'); return }
    if (stock[id] <= 0) { say('empty — restock at the fridge'); playSound('ui_back'); return }
    setStock(s => ({ ...s, [id]: s[id] - 1 }))
    setBuild(b => ({ ...b, toppings: [...b.toppings, id] }))
    playSound('ui_select')
  }, [build.meat, build.toppings, stock, say])

  const addSauce = useCallback((id: SauceId) => {
    if (!build.meat) { say('meat on the wrap first'); playSound('ui_back'); return }
    // Tapping the bottle you already used wipes it off — the only way back
    // from the wrong sauce, short of the bin.
    setBuild(b => ({ ...b, sauce: b.sauce === id ? null : id }))
    playSound(build.sauce === id ? 'ui_back' : 'kiosk_squeeze')
  }, [build.meat, build.sauce, say])

  const carveMeat = useCallback(() => {
    if (build.meat) { say('already carved'); playSound('ui_back'); return }
    if (meat <= 0) { say('spit is bare — load a new cone'); playSound('ui_back'); return }
    setMeat(m => m - 1)
    setBuild(b => ({ ...b, meat: true }))
    playSound('ui_select')
  }, [build.meat, meat, say])

  // Sides ride alongside the wrap, so they're still fair game after a
  // tortilla is shut.
  const takeSide = useCallback((id: SideId) => {
    if (tray.sides.includes(id)) { say('already grabbed one'); playSound('ui_back'); return }
    setTray(t => ({ ...t, sides: [...t.sides, id] }))
    playSound('ui_select')
  }, [tray.sides, say])

  const rollWrap = useCallback(() => {
    if (!build.meat) { say('nothing on the tortilla yet'); playSound('ui_back'); return }
    if (trayFull) { say('that’s all they asked for'); playSound('ui_back'); return }
    setTray(t => ({ ...t, wraps: [...t.wraps, build] }))
    setBuild(EMPTY_BUILD)
    playSound('ui_toggle')
  }, [build, trayFull, say])

  const restockTopping = useCallback((id: ToppingId) => {
    setStock(s => ({ ...s, [id]: MAX_USES }))
    playSound('ui_toggle')
  }, [])

  const restockMeat = useCallback(() => {
    setMeat(MAX_USES)
    playSound('ui_toggle')
  }, [])

  const trashBuild = useCallback(() => {
    setBuild(EMPTY_BUILD)
    setTray(EMPTY_TRAY)
    playSound('ui_back')
  }, [])

  /** Ask them to say it again — free, and the only way back once the ticket
   *  has faded. A regular asking for "the usual" has nothing to repeat. */
  const repeatOrder = useCallback(() => {
    if (!orderRef.current || statusRef.current !== 'waiting') return
    ticketAt.current = elapsedRef.current
    setTicketOpen(true)
    speak(orderRef.current.usual ? pick(['the usual. you know.', 'same as ever.']) : orderRef.current.line)
    playSound('ui_select', { volume: 0.4 })
  }, [speak])

  // ── handing it over ─────────────────────────────────────────────────────
  const serve = useCallback(() => {
    const current = orderRef.current
    if (!current) return
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
      const tip = Math.round(
        orderTip(base, patience, streakRef.current) * (rained ? 1 + RAIN_BONUS : 1)
      ) + (current.usual ? USUAL_BONUS : 0)

      setPhase('paid')
      setPaid({ id: ++payId.current, amount: base + tip })
      setTill(t => ({
        ...t,
        served: t.served + 1,
        base: t.base + base,
        tips: t.tips + tip,
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
      speak(pick(HAPPY_LINES))
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
        setBuild(EMPTY_BUILD)
        setTray(EMPTY_TRAY)
        setPhase('waiting')
      }, gone + 120)
      later(nextCustomer, gone + NEXT_AFTER_SALE_MS)
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
  }, [boardBusy, tray, patience, rained, regulars, later, nextCustomer, say, speak, setPhase])

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
    const coins = payable ? takings.base + takings.tips : 0
    const next: ShiftReport = {
      takings, grade, coins, paid: payable, rained, early,
      unlock: unlockedBetween(lifetimeWraps, lifetimeWraps + takings.served),
    }
    setReport(next)
    if (coins > 0) onBank(coins)
    onClose(next, { ...regulars, ...learned.current })
    return next
  }, [till, payable, rained, lifetimeWraps, regulars, report, onBank, onClose])

  const clock = useMemo(() => clockText(elapsed), [elapsed])

  return {
    elapsed, clock, lastCall, rained, practice: !payable, report,
    stock, meat, build, tray, wrapsWanted,
    order, status, patience, ticketOpen, revealed,
    till, streak, paid,
    nudge, speech,
    addTopping, addSauce, carveMeat, takeSide, rollWrap,
    restockTopping, restockMeat, trashBuild, serve, repeatOrder, closeUp,
  }
}
