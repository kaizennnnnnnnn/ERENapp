'use client'

// ═══════════════════════════════════════════════════════════════════════════
// useKioskShift — the running state of a shift behind the counter.
// ──────────────────────────────────────────────────────────────────────────
// Stock is deliberately in-memory: it refills every time you walk in, so the
// kiosk can't be left in an unplayable state, and there's no row for the two
// of you to fight over. Coins ARE real — they go through TaskContext into the
// profile like every other reward in the app.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTasks } from '@/contexts/TaskContext'
import { playSound } from '@/lib/sounds'
import {
  MAX_USES, EMPTY_BUILD, rollOrder, orderMatches, payout, REFUSALS,
  type Build, type Order, type ToppingId,
} from './kioskShift'

/** Why an action was refused — drives the one-line hint over the HUD. */
export type Nudge = { id: number; text: string } | null

export interface KioskShift {
  stock: Record<ToppingId, number>
  meat: number
  build: Build
  order: Order | null
  /** 'paid' holds the coin flash; 'gone' is the beat before the next arrival. */
  status: 'waiting' | 'paid' | 'refused'
  earned: number
  nudge: Nudge
  addTopping: (id: ToppingId) => void
  carveMeat: () => void
  addPepsi: () => void
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
  const [order, setOrder] = useState<Order | null>(null)
  const [status, setStatus] = useState<'waiting' | 'paid' | 'refused'>('waiting')
  const [earned, setEarned] = useState(0)
  const [nudge, setNudge] = useState<Nudge>(null)

  const nudgeId = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  const say = useCallback((text: string) => {
    setNudge({ id: ++nudgeId.current, text })
  }, [])

  // First customer walks up a beat after you're through the door.
  useEffect(() => {
    const t = setTimeout(() => setOrder(rollOrder()), 1400)
    return () => clearTimeout(t)
  }, [])

  const addTopping = useCallback((id: ToppingId) => {
    if (!build.meat) { say('meat on the wrap first'); playSound('ui_back'); return }
    if (build.toppings.includes(id)) { say('already on there'); playSound('ui_back'); return }
    if (stock[id] <= 0) { say('empty — restock at the fridge'); playSound('ui_back'); return }
    setStock(s => ({ ...s, [id]: s[id] - 1 }))
    setBuild(b => ({ ...b, toppings: [...b.toppings, id] }))
    playSound('ui_select')
  }, [build.meat, build.toppings, stock, say])

  const carveMeat = useCallback(() => {
    if (build.meat) { say('already carved'); playSound('ui_back'); return }
    if (meat <= 0) { say('spit is bare — hold to load a new one'); playSound('ui_back'); return }
    setMeat(m => m - 1)
    setBuild(b => ({ ...b, meat: true }))
    playSound('ui_select')
  }, [build.meat, meat, say])

  const addPepsi = useCallback(() => {
    if (build.pepsi) { say('already grabbed one'); playSound('ui_back'); return }
    setBuild(b => ({ ...b, pepsi: true }))
    playSound('ui_select')
  }, [build.pepsi, say])

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
    setStatus('waiting')
    playSound('ui_back')
  }, [])

  const serve = useCallback(() => {
    if (!order) return
    if (!build.meat) { say('there’s no meat on that'); playSound('ui_back'); return }

    if (orderMatches(order, build)) {
      const coins = payout(order)
      setStatus('paid')
      setEarned(e => e + coins)
      playSound('coin_pickup')
      addCoins(coins).catch(() => {})
      // Customer pockets the wrap and goes; the next one wanders up after.
      later(() => {
        setBuild(EMPTY_BUILD)
        setOrder(null)
        setStatus('waiting')
      }, 1500)
      later(() => setOrder(rollOrder()), 2600)
    } else {
      setStatus('refused')
      say(REFUSALS[Math.floor(Math.random() * REFUSALS.length)])
      playSound('ui_back')
      later(() => setStatus('waiting'), 1600)
    }
  }, [order, build, addCoins, say, later])

  return {
    stock, meat, build, order, status, earned, nudge,
    addTopping, carveMeat, addPepsi, restockTopping, restockMeat, trashBuild, serve,
  }
}
