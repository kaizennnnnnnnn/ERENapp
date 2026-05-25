'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { ShoppingCart, Package } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats, getCachedIsSleeping } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'
import type { FoodInventory } from '@/types'
import { playSound } from '@/lib/sounds'
import AnalogClock from '@/components/AnalogClock'
import BlinkingEren from '@/components/BlinkingEren'
import LightSwitch from '@/components/LightSwitch'
import { useIsDark } from '@/hooks/useIsDark'

interface Props { onClose: () => void }

const SHOP_ITEMS = [
  // Dry
  { id: 'kibble'  as const, name: 'Kibble',     price: 5,  hungerD: 15, happyD: 3,  weightD: 0.03, desc: 'Daily dry food',     color: '#D4A44A', cat: 'dry'     },
  { id: 'treat'   as const, name: 'Cat Treat',  price: 8,  hungerD: 8,  happyD: 20, weightD: 0.01, desc: 'Sweet & crunchy',    color: '#FF6B9D', cat: 'dry'     },
  { id: 'biscuit' as const, name: 'Biscuit',    price: 6,  hungerD: 12, happyD: 5,  weightD: 0.02, desc: 'Crunchy snack',      color: '#C8956A', cat: 'dry'     },
  // Seafood
  { id: 'fish'    as const, name: 'Fish',        price: 12, hungerD: 25, happyD: 12, weightD: 0.05, desc: "Eren's favourite!",  color: '#5BA3D9', cat: 'seafood' },
  { id: 'tuna'    as const, name: 'Tuna Can',   price: 18, hungerD: 30, happyD: 15, weightD: 0.06, desc: 'Premium quality',    color: '#E8A020', cat: 'seafood' },
  { id: 'shrimp'  as const, name: 'Shrimp',     price: 15, hungerD: 20, happyD: 18, weightD: 0.03, desc: 'Pink & tasty',       color: '#F0836A', cat: 'seafood' },
  { id: 'salmon'  as const, name: 'Salmon',     price: 22, hungerD: 35, happyD: 20, weightD: 0.07, desc: 'Rich & flaky',       color: '#E8735A', cat: 'seafood' },
  { id: 'sardine' as const, name: 'Sardine',    price: 10, hungerD: 18, happyD: 8,  weightD: 0.04, desc: 'Tiny & oily',        color: '#7BAFC8', cat: 'seafood' },
  { id: 'sushi'   as const, name: 'Sushi',      price: 25, hungerD: 28, happyD: 28, weightD: 0.04, desc: 'Fancy roll',         color: '#2D9B6A', cat: 'seafood' },
  // Meat
  { id: 'steak'   as const, name: 'Steak',      price: 30, hungerD: 40, happyD: 25, weightD: 0.10, desc: 'Luxury cut',         color: '#CC3333', cat: 'meat'    },
  { id: 'chicken' as const, name: 'Chicken',    price: 14, hungerD: 28, happyD: 10, weightD: 0.06, desc: 'Juicy drumstick',    color: '#E8B44A', cat: 'meat'    },
  { id: 'sausage' as const, name: 'Sausage',    price: 12, hungerD: 22, happyD: 8,  weightD: 0.05, desc: 'Smoky & meaty',      color: '#A0522D', cat: 'meat'    },
  // Dairy
  { id: 'cream'   as const, name: 'Cream',      price: 10, hungerD: 10, happyD: 30, weightD: 0.02, desc: 'Sweet treat',        color: '#A78BFA', cat: 'dairy'   },
  { id: 'milk'    as const, name: 'Milk',       price: 6,  hungerD: 12, happyD: 15, weightD: 0.02, desc: 'Fresh & cold',       color: '#E8E4E0', cat: 'dairy'   },
  { id: 'cheese'  as const, name: 'Cheese',     price: 10, hungerD: 14, happyD: 16, weightD: 0.03, desc: 'Aged cheddar',       color: '#F5C842', cat: 'dairy'   },
  { id: 'yogurt'  as const, name: 'Yogurt',     price: 8,  hungerD: 10, happyD: 18, weightD: 0.01, desc: 'Creamy & smooth',    color: '#FFB6C1', cat: 'dairy'   },
  // Special
  { id: 'cake'    as const, name: 'Cake',       price: 35, hungerD: 15, happyD: 40, weightD: 0.08, desc: 'Birthday special',   color: '#FF85A2', cat: 'special' },
  { id: 'egg'     as const, name: 'Egg',        price: 4,  hungerD: 16, happyD: 4,  weightD: 0.03, desc: 'Simple & nutritious',color: '#F5E6C8', cat: 'special' },
]

const FRIDGE_CATEGORIES = [
  { id: 'dry',     label: 'DRY',     color: '#D4A44A' },
  { id: 'seafood', label: 'SEAFOOD', color: '#5BA3D9' },
  { id: 'meat',    label: 'MEAT',    color: '#CC3333' },
  { id: 'dairy',   label: 'DAIRY',   color: '#A78BFA' },
  { id: 'special', label: 'SPECIAL', color: '#FF85A2' },
]

function FoodIcon({ id }: { id: string; color?: string }) {
  const S = 32
  const V = '0 0 10 10'
  const base: React.CSSProperties = { imageRendering: 'pixelated' }
  const r = (x: number, y: number, w: number, h: number, f: string) =>
    <rect x={x} y={y} width={w} height={h} fill={f} />

  if (id === 'kibble') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,4,6,4,'#C8956A')}{r(2,3,6,1,'#D4A44A')}{r(3,2,4,1,'#D4A44A')}
      {r(3,5,1,1,'#A0724A')}{r(5,5,1,1,'#A0724A')}{r(7,6,1,1,'#A0724A')}
      {r(3,7,1,1,'#B08050')}{r(6,4,1,1,'#B08050')}
      {r(2,8,6,1,'#A06830')}{r(3,3,1,1,'rgba(255,255,255,0.3)')}
    </svg>
  )
  if (id === 'treat') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,2,4,1,'#FF85A2')}{r(2,3,6,4,'#FF6B9D')}{r(3,7,4,1,'#FF6B9D')}
      {r(4,4,2,2,'#FFB6CC')}{r(3,3,1,1,'rgba(255,255,255,0.4)')}
      {r(2,3,1,4,'#E05580')}{r(8,3,0,0,'transparent')}
    </svg>
  )
  if (id === 'biscuit') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,3,6,4,'#D4A060')}{r(3,2,4,1,'#D4A060')}{r(3,7,4,1,'#C89050')}
      {r(3,4,1,1,'#B07838')}{r(6,5,1,1,'#B07838')}{r(4,6,1,1,'#B07838')}
      {r(3,3,1,1,'rgba(255,255,255,0.35)')}{r(5,3,1,1,'rgba(255,255,255,0.25)')}
    </svg>
  )
  if (id === 'fish') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,4,5,3,'#5BA3D9')}{r(3,3,3,1,'#6BB5E8')}{r(3,7,3,1,'#4A8ABB')}
      {r(7,3,1,2,'#4A8ABB')}{r(7,6,1,2,'#4A8ABB')}{r(8,4,1,1,'#4A8ABB')}
      {r(8,6,1,1,'#4A8ABB')}{r(3,4,1,1,'#222')}{r(3,4,1,1,'#fff')}
      {r(4,5,1,1,'#222')}{r(2,5,1,1,'#6BB5E8')}
      {r(5,5,1,1,'#74C0F0')}{r(4,4,1,1,'#74C0F0')}
    </svg>
  )
  if (id === 'tuna') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,4,6,4,'#D4D4D0')}{r(2,3,6,1,'#E0E0DC')}{r(3,2,4,1,'#C8C8C4')}
      {r(2,8,6,1,'#B0B0AC')}{r(3,5,4,2,'#E8A020')}{r(4,4,2,1,'#F0B040')}
      {r(3,4,1,1,'rgba(255,255,255,0.4)')}{r(4,7,2,1,'#C88818')}
    </svg>
  )
  if (id === 'shrimp') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(4,2,2,1,'#F0836A')}{r(3,3,3,1,'#F0836A')}{r(3,4,4,1,'#E86A50')}
      {r(4,5,3,1,'#E86A50')}{r(5,6,2,1,'#F09080')}{r(5,7,3,1,'#FFB0A0')}
      {r(4,3,1,1,'rgba(255,255,255,0.3)')}{r(6,5,1,1,'#D05A40')}
      {r(3,5,1,1,'#F8A088')}{r(2,4,1,1,'#F8A088')}
    </svg>
  )
  if (id === 'salmon') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,3,6,4,'#E8735A')}{r(3,2,4,1,'#F08868')}{r(2,7,6,1,'#C85A42')}
      {r(3,4,2,1,'#FFB0A0')}{r(6,5,1,1,'#FFB0A0')}{r(4,6,2,1,'#FFB0A0')}
      {r(3,3,1,1,'rgba(255,255,255,0.4)')}{r(5,3,1,1,'rgba(255,255,255,0.25)')}
    </svg>
  )
  if (id === 'sardine') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(1,4,6,2,'#7BAFC8')}{r(2,3,4,1,'#8EC4D8')}{r(2,6,4,1,'#6A98B0')}
      {r(7,4,1,1,'#6A98B0')}{r(7,5,1,1,'#6A98B0')}{r(8,4,1,2,'#5888A0')}
      {r(2,4,1,1,'#fff')}{r(3,5,1,1,'#222')}
      {r(4,4,1,1,'#A0D0E8')}
    </svg>
  )
  if (id === 'sushi') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,4,6,3,'#fff')}{r(2,3,6,1,'#E8735A')}{r(3,2,4,1,'#F08060')}
      {r(2,7,6,1,'#1A1A2A')}{r(3,5,4,1,'#E8E4E0')}
      {r(3,3,1,1,'rgba(255,255,255,0.3)')}{r(2,8,6,1,'#2D9B6A')}
      {r(3,8,4,1,'#3AB87A')}
    </svg>
  )
  if (id === 'steak') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,3,6,5,'#CC3333')}{r(3,2,4,1,'#DD4444')}{r(2,8,6,1,'#993322')}
      {r(3,4,1,2,'#FF8888')}{r(5,5,2,1,'#FF8888')}{r(4,7,1,1,'#FF8888')}
      {r(3,3,1,1,'rgba(255,255,255,0.3)')}{r(7,4,1,1,'#B02828')}
    </svg>
  )
  if (id === 'chicken') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,2,4,5,'#E8B44A')}{r(2,4,1,3,'#E8B44A')}{r(7,4,1,3,'#D4A030')}
      {r(4,7,2,2,'#C89030')}{r(3,3,1,2,'#F5D070')}
      {r(5,3,1,1,'#F5D070')}{r(3,2,1,1,'rgba(255,255,255,0.3)')}
      {r(4,9,2,1,'#A07020')}
    </svg>
  )
  if (id === 'sausage') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,4,6,2,'#A0522D')}{r(3,3,4,1,'#B8633A')}{r(3,6,4,1,'#8B4020')}
      {r(1,4,1,2,'#C87850')}{r(8,4,1,2,'#8B4020')}
      {r(3,4,1,1,'#D09060')}{r(5,4,1,1,'#D09060')}{r(7,5,1,1,'#D09060')}
    </svg>
  )
  if (id === 'cream') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,5,4,3,'#A78BFA')}{r(2,6,1,2,'#A78BFA')}{r(7,6,1,2,'#A78BFA')}
      {r(3,8,4,1,'#8B6BDA')}{r(3,3,4,2,'#fff')}{r(4,2,2,1,'#fff')}
      {r(3,3,1,1,'rgba(200,180,255,0.4)')}{r(5,4,1,1,'rgba(200,180,255,0.3)')}
    </svg>
  )
  if (id === 'milk') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,3,4,5,'#E8E4E0')}{r(4,2,2,1,'#D0CCC8')}{r(3,8,4,1,'#C8C4C0')}
      {r(4,1,2,1,'#5BA3D9')}{r(3,2,1,1,'#D8D4D0')}{r(6,2,1,1,'#D8D4D0')}
      {r(4,4,1,2,'rgba(255,255,255,0.5)')}{r(5,5,1,1,'rgba(255,255,255,0.3)')}
    </svg>
  )
  if (id === 'cheese') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(1,4,7,4,'#F5C842')}{r(1,3,5,1,'#F5D060')}{r(8,7,1,1,'#F5C842')}
      {r(6,3,1,1,'#F5D060')}{r(7,4,1,2,'#E8B830')}{r(8,5,1,2,'#E8B830')}
      {r(3,5,2,2,'#E8B020')}{r(5,6,1,1,'#E8B020')}
      {r(2,4,1,1,'rgba(255,255,255,0.3)')}{r(1,8,7,1,'#D4A020')}
    </svg>
  )
  if (id === 'yogurt') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,4,4,4,'#FFB6C1')}{r(2,5,1,3,'#FFB6C1')}{r(7,5,1,3,'#FFB6C1')}
      {r(3,3,4,1,'#E8A0B0')}{r(4,2,2,1,'#C8C4C0')}{r(3,2,1,1,'#D8D4D0')}
      {r(6,2,1,1,'#D8D4D0')}{r(3,8,4,1,'#E898A8')}
      {r(4,5,2,1,'rgba(255,255,255,0.4)')}{r(4,4,1,1,'rgba(255,255,255,0.3)')}
    </svg>
  )
  if (id === 'cake') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,5,6,3,'#FF85A2')}{r(2,4,6,1,'#FFB0C4')}{r(3,3,4,1,'#FFD0DD')}
      {r(2,8,6,1,'#D86080')}{r(4,1,1,2,'#F5C842')}{r(4,0,1,1,'#FF8800')}
      {r(3,5,1,1,'#FFD0DD')}{r(6,6,1,1,'#FFD0DD')}
      {r(5,1,1,2,'#F5C842')}{r(5,0,1,1,'#FF8800')}
    </svg>
  )
  if (id === 'egg') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,2,4,2,'#F5E6C8')}{r(2,4,6,3,'#F5E6C8')}{r(3,7,4,1,'#E8D8B0')}
      {r(4,4,2,2,'#F5C842')}{r(3,3,1,1,'rgba(255,255,255,0.4)')}
      {r(5,3,1,1,'rgba(255,255,255,0.25)')}{r(2,7,1,0,'transparent')}
    </svg>
  )
  // fallback
  return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,3,4,4,'#aaa')}{r(4,4,2,2,'#888')}
    </svg>
  )
}

export default function FeedScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, feedWithFood, addToMyFood, consumeMyFood } = useErenStats(profile?.household_id ?? null)
  const { completeTask, coins, spendCoins } = useTasks()
  const isDark = useIsDark()

  const [tab, setTab] = useState<'shop' | 'fridge' | null>(null)
  const [fridgeCat, setFridgeCat] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('eren_fridge_cat') || null
    return null
  })
  const [foodIdx, setFoodIdx] = useState(0)
  const [buying, setBuying] = useState<string | null>(null)
  const [feeding, setFeeding] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [eatAnim, setEatAnim] = useState(false)

  // Drag-to-feed state — all stored in refs so document-level listeners
  // see current values without re-registering on every render.
  const [dragRender, setDragRender] = useState(0)
  const dragRef = useRef<{
    item: typeof SHOP_ITEMS[number] | null
    pos: { x: number; y: number } | null
    startPos: { x: number; y: number } | null
    active: boolean
    near: boolean
  }>({ item: null, pos: null, startPos: null, active: false, near: false })
  const tick = () => setDragRender(n => n + 1)
  void dragRender
  const foodElRef = useRef<HTMLDivElement>(null)
  const currentItemRef = useRef<typeof SHOP_ITEMS[number] | null>(null)

  const erenZone = useCallback((x: number, y: number) => {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight * 0.78
    const dx = x - cx, dy = y - cy
    return Math.sqrt(dx * dx + dy * dy) < 90
  }, [])

  // Native touchstart on the food element — passive:false so
  // preventDefault actually stops the browser from scrolling.
  useEffect(() => {
    const el = foodElRef.current
    if (!el) return
    function handleStart(e: TouchEvent) {
      const item = currentItemRef.current
      if (!item) return
      if (e.cancelable) e.preventDefault()
      e.stopImmediatePropagation()
      const t = e.touches[0]
      const d = dragRef.current
      d.item = item; d.startPos = { x: t.clientX, y: t.clientY }
      d.pos = { x: t.clientX, y: t.clientY }; d.active = false; d.near = false
      tick()

      function onMove(ev: TouchEvent) {
        ev.preventDefault()
        ev.stopPropagation()
        const t2 = ev.touches[0]
        const d2 = dragRef.current
        if (d2.startPos) {
          const dx = Math.abs(t2.clientX - d2.startPos.x)
          const dy = Math.abs(t2.clientY - d2.startPos.y)
          if (dx > 6 || dy > 6) d2.active = true
        }
        d2.pos = { x: t2.clientX, y: t2.clientY }
        d2.near = erenZone(t2.clientX, t2.clientY)
        tick()
      }
      function onEnd() {
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend', onEnd)
        const d2 = dragRef.current
        if (d2.item && d2.active && d2.near) handleFeed(d2.item)
        d2.item = null; d2.pos = null; d2.startPos = null
        d2.active = false; d2.near = false
        tick()
      }
      document.addEventListener('touchmove', onMove, { passive: false })
      document.addEventListener('touchend', onEnd)
    }
    el.addEventListener('touchstart', handleStart, { passive: false })
    return () => el.removeEventListener('touchstart', handleStart)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // "Your fridge" = the user's personal pile + the legacy shared pool. Buys
  // add to the personal pile only; feeds drain personal first, then shared.
  // Each user's personal pile is independent (the partner's is invisible
  // here — they have their own fridge view in their own session).
  const myPile: FoodInventory = (user?.id && stats?.food_by_user?.[user.id]) || {}
  const sharedPile: FoodInventory = stats?.food_inventory ?? {}
  const inventory: FoodInventory = Object.fromEntries(
    SHOP_ITEMS.map(i => [i.id, (myPile[i.id] ?? 0) + (sharedPile[i.id] ?? 0)])
  ) as FoodInventory
  const fridgeItems = SHOP_ITEMS.filter(i => (inventory[i.id] ?? 0) > 0)

  // Auto-pick a category if none saved or if saved one is now empty
  useEffect(() => {
    if (fridgeItems.length === 0) return
    const hasCatItems = fridgeCat && SHOP_ITEMS.some(i => i.cat === fridgeCat && (inventory[i.id] ?? 0) > 0)
    if (!hasCatItems) {
      const first = FRIDGE_CATEGORIES.find(c => SHOP_ITEMS.some(i => i.cat === c.id && (inventory[i.id] ?? 0) > 0))
      if (first) { setFridgeCat(first.id); setFoodIdx(0); localStorage.setItem('eren_fridge_cat', first.id) }
    }
  }, [fridgeItems.length]) // eslint-disable-line react-hooks/exhaustive-deps

  void eatAnim
  // Fall back to the module-level cache (set by any prior useErenStats
  // fetch this tab session) so Eren doesn't flash visible-then-hidden,
  // and doesn't pop in after waking up either. Only when nothing has
  // been fetched yet do we conservatively default to sleeping.
  const isSleeping = stats?.is_sleeping ?? getCachedIsSleeping() ?? true

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2200)
  }

  useEffect(() => { if (isSleeping) setTab(null) }, [isSleeping])

  async function handleBuy(item: typeof SHOP_ITEMS[number]) {
    if (!user?.id || isSleeping || buying || coins < item.price) return
    setBuying(item.id)
    const ok = await spendCoins(item.price)
    if (ok) {
      await addToMyFood(user.id, item.id)
      showToast(`Bought ${item.name}! In your fridge`)
    } else {
      showToast('Not enough coins!', false)
    }
    setBuying(null)
  }

  async function handleFeed(item: typeof SHOP_ITEMS[number]) {
    if (!user?.id || feeding || isSleeping) return
    setFeeding(item.id)
    const consumed = await consumeMyFood(user.id, item.id)
    if (!consumed) {
      showToast(`No ${item.name} in your fridge`, false)
      setFeeding(null)
      return
    }
    const result = await feedWithFood(user.id, item.hungerD, item.happyD, item.weightD)
    setEatAnim(true)
    setTimeout(() => setEatAnim(false), 2000)
    showToast(result.message, result.success)
    setFeeding(null)
    if (result.success) completeTask('daily_feed')
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none" style={{ touchAction: 'none' }}>

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{ backgroundImage: `url(${isDark ? '/KitchenDark.png' : '/kitchen.png'})`, backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

      {/* ══ KETTLE STEAM ══
        The kettle sits on the left burner of the stove. In the source kitchen.png
        (768×1376), the spout opening lands at roughly (142, 727) — about 18.5% x,
        52.8% y. The bg renders with `cover/center`, so to keep smoke pinned to the
        spout across viewports we use an aspect-ratio wrapper that mirrors the
        image's covered rect; percentages inside it map directly to image space. */}
      <div className="absolute pointer-events-none overflow-hidden" style={{ inset: 0, zIndex: 5 }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          minWidth: '100%',
          minHeight: '100%',
          aspectRatio: '768 / 1376',
        }}>
          <div className="absolute" style={{
            left: `calc(18.5% - ${isDark ? 10 : 5}px)`,
            top:  `calc(52.8% + ${isDark ? 15 : 13}px)`,
          }}>
            <div className="kettle-puff kettle-puff-a" />
            <div className="kettle-puff kettle-puff-b" />
            <div className="kettle-puff kettle-puff-c" />
          </div>

          {/* Wall clock on the back wall — replaces the pixel clock baked into
            kitchen.png. Center at ~(49%, 23.4%) of the source, ~10% diameter.
            At night, dim it so it doesn't glow against KitchenDark. */}
          <div style={{
            position: 'absolute',
            left: 'calc(51% - 1px)', top: '23.4%',
            width: '15%', aspectRatio: '1 / 1',
            transform: 'translate(-50%, -50%)',
            filter: isDark ? 'brightness(0.55) saturate(0.8)' : undefined,
            transition: 'filter 800ms ease',
          }}>
            <AnalogClock size="100%" mode="real" pixelated />
          </div>
        </div>
      </div>

      {/* ══ EREN ══ (hidden while sleeping in the bedroom) */}
      {!isSleeping && (
        <div className="absolute z-20 bottom-[10%]"
          style={{ left: '50%', transform: 'translateX(-50%)' }}>
          <BlinkingEren size={210} />
        </div>
      )}

      {/* ══ UI ══ */}

      {toast && (
        <div className={cn('absolute left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 animate-float whitespace-nowrap', toast.ok ? '' : '')}
          style={{ top: 145, background: toast.ok ? '#1F1F2E' : '#CC2222', borderRadius: 3, border: `2px solid ${toast.ok ? '#3A3A5E' : '#AA1111'}`, boxShadow: `3px 3px 0 ${toast.ok ? 'rgba(0,0,0,0.4)' : '#880000'}`, fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast.msg}
        </div>
      )}

      {/* ══ DRAG GHOST — just the food icon, no frame ══ */}
      {dragRef.current.item && dragRef.current.pos && dragRef.current.active && (
        <div className="fixed pointer-events-none z-[60]" style={{
          left: dragRef.current.pos.x - 20, top: dragRef.current.pos.y - 20,
          filter: `drop-shadow(0 2px 6px ${dragRef.current.item.color}88)`,
          transform: 'scale(1.3)',
        }}>
          <FoodIcon id={dragRef.current.item.id} color={dragRef.current.item.color} />
        </div>
      )}

      {/* ══ EREN GLOW — highlights when food is dragged near ══ */}
      {dragRef.current.near && dragRef.current.item && (
        <div className="fixed pointer-events-none z-[19]" style={{
          left: '50%', bottom: '10%',
          transform: 'translateX(-50%)',
          width: 220, height: 220,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${dragRef.current.item.color}30 0%, transparent 70%)`,
          animation: 'erenGlow 0.6s ease-in-out infinite alternate',
        }} />
      )}

      {/* ══ BOTTOM BAR — Fridge (left), Food center, Shop (right) ══ */}
      <div className="absolute bottom-6 left-0 right-0 z-30 px-4">
        <div className="flex items-end justify-between">

          {/* LEFT: Fridge button */}
          <button onClick={() => { if (!isSleeping) { playSound('ui_modal_open'); setTab('fridge') } }}
            disabled={isSleeping}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 active:scale-95 transition-transform disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #A8D8F8, #78B8E8)', borderRadius: 12, border: '2px solid #5898C8', boxShadow: '0 3px 0 #3870A8, inset 0 1px 0 rgba(255,255,255,0.4)', fontFamily: '"Press Start 2P"', fontSize: 7, color: '#1A5A8A' }}>
            <Package size={12} />
            FRIDGE
          </button>

          {/* CENTER: Current food with arrows */}
          {(() => {
            const catItems = fridgeCat
              ? SHOP_ITEMS.filter(i => i.cat === fridgeCat && (inventory[i.id] ?? 0) > 0)
              : []
            const idx = Math.min(foodIdx, catItems.length - 1)
            const item = catItems[idx]
            if (!item) return <div className="flex-1" />
            const qty = inventory[item.id] ?? 0
            const hasLeft = idx > 0
            const hasRight = idx < catItems.length - 1
            return (
              <div className="flex items-center gap-2">
                {/* Left arrow */}
                <button onClick={() => { if (hasLeft) { playSound('ui_tap'); setFoodIdx(idx - 1) } }}
                  className="active:scale-90 transition-transform"
                  style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: hasLeft ? 'rgba(255,255,255,0.15)' : 'transparent',
                    border: hasLeft ? '1.5px solid rgba(255,255,255,0.25)' : '1.5px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: '"Press Start 2P"', fontSize: 8,
                    color: hasLeft ? '#fff' : 'rgba(255,255,255,0.15)',
                  }}>◂</button>

                {/* Food item — draggable. currentItemRef lets the native
                    touchstart listener (attached via useEffect) know which
                    food to drag without going through React's passive handler. */}
                {(() => { currentItemRef.current = item; return null })()}
                <div ref={foodElRef}
                  style={{ position: 'relative', touchAction: 'none' }}>
                  <div style={{
                    width: 56, height: 56,
                    background: `radial-gradient(circle at 40% 35%, ${item.color}30, ${item.color}10)`,
                    borderRadius: 12,
                    border: `2px solid ${item.color}88`,
                    boxShadow: `2px 2px 0 ${item.color}44, 0 0 10px ${item.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      opacity: (dragRef.current.item?.id === item.id && dragRef.current.active) ? 0.15 : 1,
                      transition: 'opacity 0.15s ease',
                    }}>
                      <FoodIcon id={item.id} color={item.color} />
                    </div>
                  </div>
                  {/* Qty badge */}
                  <span className="font-pixel absolute" style={{
                    top: -5, right: -5,
                    minWidth: 18, height: 18,
                    background: item.color, color: '#fff',
                    borderRadius: 9, fontSize: 7,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1.5px solid rgba(0,0,0,0.2)',
                    boxShadow: '1px 1px 0 rgba(0,0,0,0.25)',
                    padding: '0 4px',
                  }}>{qty}</span>
                  {/* Name */}
                  <p className="font-pixel text-center mt-1" style={{
                    fontSize: 5, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5,
                  }}>{item.name.toUpperCase()}</p>
                </div>

                {/* Right arrow */}
                <button onClick={() => { if (hasRight) { playSound('ui_tap'); setFoodIdx(idx + 1) } }}
                  className="active:scale-90 transition-transform"
                  style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: hasRight ? 'rgba(255,255,255,0.15)' : 'transparent',
                    border: hasRight ? '1.5px solid rgba(255,255,255,0.25)' : '1.5px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: '"Press Start 2P"', fontSize: 8,
                    color: hasRight ? '#fff' : 'rgba(255,255,255,0.15)',
                  }}>▸</button>
              </div>
            )
          })()}

          {/* RIGHT: Shop button */}
          <button onClick={() => { playSound(tab === 'shop' ? 'ui_modal_close' : 'ui_modal_open'); setTab(tab === 'shop' ? null : 'shop') }}
            disabled={isSleeping}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-white active:scale-95 transition-transform disabled:opacity-40"
            style={{ background: tab === 'shop' ? 'linear-gradient(135deg, #E8A020, #C07010)' : 'linear-gradient(135deg, #F5C842, #E8A020)', borderRadius: 12, border: '2px solid #C88018', boxShadow: tab === 'shop' ? '0 2px 0 #904800' : '0 3px 0 #A06010, inset 0 1px 0 rgba(255,255,255,0.3)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
            <ShoppingCart size={12} />
            SHOP
          </button>
        </div>
      </div>

      {/* ══ FRIDGE CATEGORY PAGE — full screen overlay ══ */}
      {tab === 'fridge' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-xs px-6">
            <p className="font-pixel text-center mb-6" style={{ fontSize: 10, color: '#A8D8F8', letterSpacing: 2, textShadow: '0 0 8px rgba(168,216,248,0.5)' }}>
              PICK A CATEGORY
            </p>

            <div className="flex flex-col gap-3">
              {fridgeItems.length === 0 ? (
                <div className="text-center">
                  <p className="font-pixel mb-4" style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>FRIDGE IS EMPTY</p>
                  <button onClick={() => { playSound('ui_tap'); setTab('shop') }}
                    className="px-5 py-3 text-white active:translate-y-[1px]"
                    style={{ background: '#F5C842', borderRadius: 10, border: '2px solid #C88018', boxShadow: '0 3px 0 #A06010', fontFamily: '"Press Start 2P"', fontSize: 8 }}>
                    GO SHOP
                  </button>
                </div>
              ) : (
                FRIDGE_CATEGORIES.map(c => {
                  const catItems = SHOP_ITEMS.filter(i => i.cat === c.id)
                  const catCount = catItems.reduce((s, i) => s + (inventory[i.id] ?? 0), 0)
                  if (catCount === 0) return null
                  return (
                    <button key={c.id}
                      onClick={() => { playSound('ui_tap'); setFridgeCat(c.id); setFoodIdx(0); localStorage.setItem('eren_fridge_cat', c.id); setTab(null) }}
                      className="flex items-center gap-4 px-5 py-4 active:scale-95 transition-transform w-full"
                      style={{
                        background: `linear-gradient(135deg, ${c.color}20, ${c.color}08)`,
                        borderRadius: 10,
                        border: `2px solid ${c.color}88`,
                        boxShadow: `3px 3px 0 rgba(0,0,0,0.3), 0 0 12px ${c.color}22`,
                      }}>
                      <div className="flex gap-1 flex-shrink-0">
                        {catItems.filter(i => (inventory[i.id] ?? 0) > 0).slice(0, 2).map(i => (
                          <FoodIcon key={i.id} id={i.id} color={i.color} />
                        ))}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="font-pixel block" style={{ fontSize: 9, color: c.color, letterSpacing: 1.5 }}>{c.label}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{catCount} item{catCount !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="font-pixel" style={{ fontSize: 12, color: c.color }}>▸</span>
                    </button>
                  )
                })
              )}
            </div>

            <button onClick={() => { playSound('ui_modal_close'); setTab(null) }}
              className="mt-6 mx-auto block px-6 py-2 active:scale-95 transition-transform"
              style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', fontFamily: '"Press Start 2P"', fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ══ SLIDE-UP DRAWER — shop only ══ */}
      {tab === 'shop' && (
        <div className="absolute bottom-0 left-0 right-0 z-40 flex flex-col"
          style={{ height: '52%', background: 'linear-gradient(180deg, #FFFBF0 0%, #FFF8E8 100%)', borderRadius: '16px 16px 0 0', borderTop: '3px solid #F5C842', boxShadow: '0 -4px 0 #E8A020' }}>

          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
            <span className="font-pixel text-amber-700 flex items-center gap-2" style={{ fontSize: 9 }}>
              <ShoppingCart size={12} /> SHOP
            </span>
            <button onClick={() => { playSound('ui_modal_close'); setTab(null) }}
              className="active:scale-90 transition-transform"
              style={{ background: '#F5EDD0', borderRadius: 8, border: '2px solid #E8C870', padding: '3px 8px', fontFamily: '"Press Start 2P"', fontSize: 8, color: '#A07020' }}>
              ✕
            </button>
          </div>
          <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #F5C842, transparent)', marginBottom: 4 }} />

          <div className="overflow-y-auto px-3 py-1 flex-1">
            <div className="grid grid-cols-2 gap-2">
              {SHOP_ITEMS.map(item => {
                const canAfford = coins >= item.price
                return (
                  <div key={item.id} className={cn('p-3 transition-all', !canAfford && 'opacity-55')}
                    style={{ background: `linear-gradient(135deg, ${item.color}28 0%, ${item.color}10 100%)`, borderRadius: 3, border: `2px solid ${item.color}55`, boxShadow: `2px 2px 0 ${item.color}33` }}>
                    <div className="flex items-start justify-between mb-1">
                      <FoodIcon id={item.id} color={item.color} />
                      <div className="flex items-center gap-0.5 px-1.5 py-0.5" style={{ background: '#FFF3C0', borderRadius: 2, border: '1px solid #F5C842' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle at 38% 35%, #FFE878, #D4A818)', border: '1px solid #B08810' }} />
                        <span className="font-pixel text-amber-600" style={{ fontSize: 7 }}>{item.price}</span>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-gray-800">{item.name}</p>
                    <p className="text-[10px] text-gray-400 mb-1.5">{item.desc}</p>
                    <div className="flex gap-2 text-[9px] text-gray-500 mb-2">
                      <span>HGR +{item.hungerD}</span>
                      <span>JOY +{item.happyD}</span>
                    </div>
                    <button onClick={() => { playSound('ui_tap'); handleBuy(item) }} disabled={!canAfford || buying === item.id}
                      className="w-full py-1.5 text-white transition-all active:translate-y-[1px] disabled:opacity-40"
                      style={{ background: canAfford ? item.color : '#ccc', borderRadius: 2, border: `1px solid ${canAfford ? 'rgba(0,0,0,0.15)' : '#bbb'}`, boxShadow: canAfford ? `0 2px 0 rgba(0,0,0,0.18)` : 'none', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                      {buying === item.id ? '...' : canAfford ? 'BUY' : 'BROKE'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .kettle-puff {
          position: absolute;
          left: 0;
          top: 0;
          margin-left: -4px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.95), rgba(220,225,230,0.55));
          opacity: 0;
          filter: blur(0.6px);
        }
        .kettle-puff-a { animation: kettleRise 3.2s ease-out 0s    infinite; }
        .kettle-puff-b { animation: kettleRise 3.2s ease-out 1.05s infinite; }
        .kettle-puff-c { animation: kettleRise 3.2s ease-out 2.1s  infinite; }
        @keyframes kettleRise {
          0%   { transform: translate(0, 0) scale(0.5);   opacity: 0; }
          12%  { transform: translate(0, -2px) scale(0.8); opacity: 0.85; }
          50%  { transform: translate(-3px, -22px) scale(1.1); opacity: 0.6; }
          80%  { transform: translate(2px, -38px) scale(1.3); opacity: 0.25; }
          100% { transform: translate(-1px, -50px) scale(1.45); opacity: 0; }
        }
        @keyframes erenGlow {
          from { opacity: 0.5; transform: translateX(-50%) scale(0.95); }
          to   { opacity: 1;   transform: translateX(-50%) scale(1.05); }
        }
      `}</style>

      <LightSwitch targetBottom="12%" targetLeft="50%" />
    </div>
  )
}
