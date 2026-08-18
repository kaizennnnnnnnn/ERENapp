'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useKioskShift — the running state of a shift behind the counter.
// ──────────────────────────────────────────────────────────────────────────
// Stock is deliberately in-memory: it refills every time you walk in, so the
// kiosk can't be left in an unplayable state, and there's no row for the two
// of you to fight over. Coins ARE real — they go through TaskContext into the
// profile like every other reward in the app.
//
// A wrap goes: bare tortilla → meat → toppings → ROLLED → handed over. Rolling
// is the point of no return; once it's shut you can't fix what's inside, which
// is what makes reading the ticket before you roll actually matter.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'
import {
  MAX_USES, EMPTY_BUILD, rollOrder, orderMatches, payout,
  REFUSALS, HAPPY_LINES, IMPATIENT_LINES, pick,
  type Build, type Order, type ToppingId,
} from './kioskShift'

/** Why an action was refused — drives the one-line hint over the HUD. */
export type Nudge = { id: number; text: string } | null

/** What the customer is saying right now. `id` re-triggers the bubble anim. */
export type Speech = { id: number; text: string } | null

/** How long someone stands there before they start commenting on the wait. */
const PATIENCE_MS = 16000

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

export interface KioskShift {
  stock: Record<ToppingId, number>
  meat: number
  build: Build
  /** Shut wraps can't be opened again — this gates every ingredient action. */
  rolled: boolean
  order: Order | null
  status: 'waiting' | 'paid' | 'refused'
  earned: number
  nudge: Nudge
  speech: Speech
  addTopping: (id: ToppingId) => void
  carveMeat: () => void
  addPepsi: () => void
  rollWrap: () => void
  restockTopping: (id: ToppingId) => void
  restockMeat: () => void
  trashBuild: () => void
  serve: () => void
}

const FULL_STOCK: Record<ToppingId, number> = { tomato: MAX_USES, onion: MAX_USES, cheese: MAX_USES, lettuce: MAX_USES }

export function useKioskShift(): KioskShift {
  const { addCoins } = useTasks()

  const [stock, setStock] = useState<Record<ToppingId, number>>({ ...FULL_STOCK })
  const [meat, setMeat] = useState(MAX_USES)
  const [build, setBuild] = useState<Build>(EMPTY_BUILD)
  const [rolled, setRolled] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [status, setStatus] = useState<'waiting' | 'paid' | 'refused'>('waiting')
  const [earned, setEarned] = useState(0)
  const [nudge, setNudge] = useState<Nudge>(null)
  const [speech, setSpeech] = useState<Speech>(null)

  const lineId = useRef(0)
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

  /** Walk a new customer up to the window with their opening line. */
  const nextCustomer = useCallback(() => {
    const next = rollOrder()
    arriveWhenDrawn(next).then(() => {
      if (!alive.current) return
      setOrder(next)
      speak(next.line)
    })
  }, [speak])

  // First customer walks up a beat after you're through the door.
  useEffect(() => {
    const t = setTimeout(() => {
      const first = rollOrder()
      arriveWhenDrawn(first).then(() => {
        if (!alive.current) return
        setOrder(first)
        setSpeech({ id: ++lineId.current, text: first.line })
      })
    }, 1400)
    return () => clearTimeout(t)
  }, [])

  // Stand there long enough and they start making remarks about it. Resets
  // with every new customer, so it's a wait timer, not a shift timer.
  useEffect(() => {
    if (!order || status !== 'waiting') return
    const t = setTimeout(() => speak(pick(IMPATIENT_LINES)), PATIENCE_MS)
    return () => clearTimeout(t)
  }, [order, status, speak])

  const addTopping = useCallback((id: ToppingId) => {
    if (rolled) { say('it’s already rolled shut'); playSound('ui_back'); return }
    if (!build.meat) { say('meat on the wrap first'); playSound('ui_back'); return }
    if (build.toppings.includes(id)) { say('already on there'); playSound('ui_back'); return }
    if (stock[id] <= 0) { say('empty — restock at the fridge'); playSound('ui_back'); return }
    setStock(s => ({ ...s, [id]: s[id] - 1 }))
    setBuild(b => ({ ...b, toppings: [...b.toppings, id] }))
    playSound('ui_select')
  }, [rolled, build.meat, build.toppings, stock, say])

  const carveMeat = useCallback(() => {
    if (rolled) { say('it’s already rolled shut'); playSound('ui_back'); return }
    if (build.meat) { say('already carved'); playSound('ui_back'); return }
    if (meat <= 0) { say('spit is bare — load a new cone'); playSound('ui_back'); return }
    setMeat(m => m - 1)
    setBuild(b => ({ ...b, meat: true }))
    playSound('ui_select')
  }, [rolled, build.meat, meat, say])

  // The drink rides along beside the wrap, so it's still fair game after the
  // tortilla is shut.
  const addPepsi = useCallback(() => {
    if (build.pepsi) { say('already grabbed one'); playSound('ui_back'); return }
    setBuild(b => ({ ...b, pepsi: true }))
    playSound('ui_select')
  }, [build.pepsi, say])

  const rollWrap = useCallback(() => {
    if (rolled) return
    if (!build.meat) { say('nothing on the tortilla yet'); playSound('ui_back'); return }
    setRolled(true)
    playSound('ui_toggle')
  }, [rolled, build.meat, say])

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
    setRolled(false)
    setStatus('waiting')
    playSound('ui_back')
  }, [])

  const serve = useCallback(() => {
    if (!order) return
    if (!rolled) { say('roll it up before you hand it over'); playSound('ui_back'); return }

    if (orderMatches(order, build)) {
      const coins = payout(order)
      setStatus('paid')
      setEarned(e => e + coins)
      speak(pick(HAPPY_LINES))
      playSound('coin_pickup')
      addCoins(coins).catch(() => {})
      // Customer pockets the wrap and goes; the next one wanders up after.
      later(() => {
        setBuild(EMPTY_BUILD)
        setRolled(false)
        setOrder(null)
        setStatus('waiting')
      }, 1500)
      later(nextCustomer, 2600)
    } else {
      setStatus('refused')
      speak(pick(REFUSALS))
      playSound('ui_back')
      later(() => setStatus('waiting'), 1600)
    }
  }, [order, rolled, build, addCoins, say, speak, later, nextCustomer])

  return {
    stock, meat, build, rolled, order, status, earned, nudge, speech,
    addTopping, carveMeat, addPepsi, rollWrap, restockTopping, restockMeat, trashBuild, serve,
  }
}
