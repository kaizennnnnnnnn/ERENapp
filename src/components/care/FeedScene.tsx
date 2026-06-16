'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats, getCachedIsSleeping } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'
import { foodDrag } from './foodDragFlag'
import type { FoodInventory } from '@/types'
import { playSound } from '@/lib/sounds'
import AnalogClock from '@/components/AnalogClock'
import BlinkingEren from '@/components/BlinkingEren'
import ErenIdleLayer from '@/components/ErenIdleLayer'
import StinkyFlies from '@/components/StinkyFlies'
import LightSwitch from '@/components/LightSwitch'
import { useIsDark } from '@/hooks/useIsDark'
import { useWish } from '@/contexts/WishContext'
import WishHintBanner from '@/components/wish/WishHintBanner'
import { wishHintRoom } from '@/lib/wishes'
import { useErenReaction } from '@/hooks/useErenReaction'
import { happyFinisherBeats, WORD_COLOR } from '@/lib/erenReactions'
import SoundWord from '@/components/SoundWord'
import { FoodBowl, Crumbs, Hearts } from '@/components/care/ReactionFx'
import KitchenNavButton from '@/components/kitchen/KitchenNavButton'
import PoseSprite from '@/components/care/PoseSprite'
import PixelPoof from '@/components/PixelPoof'
import { preloadImages } from '@/lib/preloadImages'

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
  // Sweet (new — referenced by Phase 3 wishes)
  { id: 'monster'    as const, name: 'Monster Zero',price: 12, hungerD: 5,  happyD: 15, weightD: 0.01, desc: 'Sugar-free buzz',  color: '#1ED760', cat: 'special' },
  { id: 'donut'      as const, name: 'Donut',       price: 14, hungerD: 12, happyD: 22, weightD: 0.04, desc: 'Pink & sprinkled', color: '#FF8FB0', cat: 'special' },
  { id: 'cookie'     as const, name: 'Cookie',      price: 7,  hungerD: 8,  happyD: 18, weightD: 0.02, desc: 'Choc-chip warm',   color: '#C89A6B', cat: 'special' },
  { id: 'jelly_caka' as const, name: 'Jelly Caka',  price: 20, hungerD: 14, happyD: 30, weightD: 0.05, desc: 'Sweet wobble',     color: '#E83A4A', cat: 'special' },
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
  if (id === 'monster') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,1,4,8,'#0F0F0F')}{r(3,0,4,1,'#2A2A2A')}{r(3,9,4,1,'#1A1A1A')}
      {r(4,2,2,2,'#00FF6A')}{r(4,4,1,1,'#00FF6A')}{r(5,4,1,1,'#00FF6A')}
      {r(3,6,4,1,'#FFFFFF')}{r(4,6,1,1,'#0F0F0F')}{r(5,6,1,1,'#0F0F0F')}
      {r(3,1,1,3,'rgba(255,255,255,0.15)')}
    </svg>
  )
  if (id === 'donut') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,3,6,4,'#C89460')}{r(3,2,4,1,'#C89460')}{r(3,7,4,1,'#A0703D')}
      {r(4,4,2,2,'#FDF6FF')}
      {r(2,3,6,1,'#FF8FB0')}{r(3,2,4,1,'#FFB0C8')}
      {r(3,3,1,1,'#FFD700')}{r(5,2,1,1,'#5BA3D9')}{r(6,3,1,1,'#1ED760')}
    </svg>
  )
  if (id === 'cookie') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,3,6,4,'#C89A6B')}{r(3,2,4,1,'#D8AA7B')}{r(3,7,4,1,'#A07A4B')}
      {r(2,4,1,2,'#B88858')}{r(7,4,1,2,'#B88858')}
      {r(3,4,1,1,'#4A2A1A')}{r(5,3,1,1,'#4A2A1A')}
      {r(6,5,1,1,'#4A2A1A')}{r(4,5,1,1,'#4A2A1A')}
      {r(3,3,1,1,'rgba(255,255,255,0.3)')}
    </svg>
  )
  if (id === 'jelly_caka') return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(2,6,6,2,'#F5E6C8')}{r(2,4,6,2,'#FFB0C8')}{r(2,2,6,2,'#E83A4A')}
      {r(3,1,4,1,'#FF5060')}{r(2,8,6,1,'#B07840')}
      {r(2,5,1,1,'#E8909C')}{r(7,5,1,1,'#C89090')}
      {r(3,2,1,1,'rgba(255,255,255,0.35)')}
    </svg>
  )
  // fallback
  return (
    <svg width={S} height={S} viewBox={V} shapeRendering="crispEdges" style={base}>
      {r(3,3,4,4,'#aaa')}{r(4,4,2,2,'#888')}
    </svg>
  )
}

// Where Eren's nose/mouth sits in each head-down eating pose, as a % of the
// trimmed sprite's WIDTH. The crouch poses include his tail trailing right, so
// his face is LEFT of the sprite centre — the bowl/crumbs/words anchor here,
// not at the container centre, or they'd land under his body.
// (measured by scripts/measure_eat_nose.py)
const EAT_NOSE_X = [32.7, 31.3, 30.6, 40.1]

export default function FeedScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, feedWithFood, addToMyFood, consumeMyFood } = useErenStats(profile?.household_id ?? null)
  const { completeTask, coins, spendCoins } = useTasks()
  const isDark = useIsDark()
  const wish = useWish()
  const wishMatchesThisRoom = wish?.wish ? wishHintRoom(wish.wish) === 'feed' : false

  const [tab, setTab] = useState<'shop' | 'fridge' | null>(null)
  // Active shop category. null = show the category picker; set = show that
  // category's items. Resets whenever the shop drawer closes so re-opening
  // always lands on the picker.
  const [shopCat, setShopCat] = useState<string | null>(null)
  const [fridgeCat, setFridgeCat] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('eren_fridge_cat') || null
    return null
  })
  const [foodIdx, setFoodIdx] = useState(0)
  const [buying, setBuying] = useState<string | null>(null)
  const [feeding, setFeeding] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

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
  const ghostRef = useRef<HTMLDivElement>(null)
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
      foodDrag.active = true
      tick()

      function onMove(ev: TouchEvent) {
        // Only cancel when the browser still lets us — once a gesture is
        // committed to scrolling, touchmove arrives with cancelable=false and
        // preventDefault() is a no-op that logs an Intervention warning.
        if (ev.cancelable) ev.preventDefault()
        ev.stopPropagation()
        const t2 = ev.touches[0]
        const d2 = dragRef.current
        const wasActive = d2.active
        const wasNear = d2.near
        if (d2.startPos) {
          const dx = Math.abs(t2.clientX - d2.startPos.x)
          const dy = Math.abs(t2.clientY - d2.startPos.y)
          if (dx > 6 || dy > 6) d2.active = true
        }
        d2.pos = { x: t2.clientX, y: t2.clientY }
        d2.near = erenZone(t2.clientX, t2.clientY)
        // Position the drag ghost imperatively — re-rendering the whole
        // 860-line scene per touchmove is the expensive part, so only
        // tick() on the active/near transitions that change other visuals.
        const g = ghostRef.current
        if (g) {
          g.style.left = `${t2.clientX - 20}px`
          g.style.top = `${t2.clientY - 20}px`
        }
        if (d2.active !== wasActive || d2.near !== wasNear) tick()
      }
      function onEnd() {
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend', onEnd)
        const d2 = dragRef.current
        if (d2.item && d2.active && d2.near) handleFeed(d2.item)
        d2.item = null; d2.pos = null; d2.startPos = null
        d2.active = false; d2.near = false
        foodDrag.active = false
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

  // Fall back to the module-level cache (set by any prior useErenStats
  // fetch this tab session) so Eren doesn't flash visible-then-hidden,
  // and doesn't pop in after waking up either. Only when nothing has
  // been fetched yet do we conservatively default to sleeping.
  const isSleeping = stats?.is_sleeping ?? getCachedIsSleeping() ?? true

  // Reaction runner — drives the eating choreography on a successful feed.
  const reaction = useErenReaction()
  // The food just fed, so the bowl + crumbs can take its color.
  const [fedItem, setFedItem] = useState<typeof SHOP_ITEMS[number] | null>(null)
  const [eatIdx, setEatIdx] = useState(0)       // which head-down pose (0–3)
  const [showPoof, setShowPoof] = useState(false)

  // Warm the four eating stickers so the poof reveals a decoded bitmap.
  useEffect(() => {
    preloadImages(['/erenEat1.png?v=2', '/erenEat2.png?v=2', '/erenEat3.png?v=2', '/erenEat4.png?v=2'])
  }, [])

  // Memoize the bare sprite so stat changes from feeding don't re-render it.
  // Cleanliness is in the deps so the flies update — feeding never changes
  // cleanliness, so this never recomputes mid-feed (no sprite flicker).
  const cleanliness = stats?.cleanliness ?? 100
  const erenSprite = useMemo(() => (
    <>
      {/* Kitchen pose: ErenCook.png (redrawn — no watermark cross).
          Coords come from a pixel-scan of the 959×1536 sprite,
          translated to the 210×210 BlinkingEren container (portrait
          sprite height-fits so the image occupies the middle ~62.6%
          of container width). Catchlights are MIRRORED on this
          sprite: eye A's in the upper-RIGHT of its iris, eye B's in
          the upper-LEFT — they point toward the nose. */}
      <BlinkingEren size={210} src="/ErenCook_notail.png" tailSrc="/ErenCook_tail.png" tailOrigin="71.8% 80.7%" eyes={{
        lidTop:    '37.19%',
        lidWidth:  '5.42%',
        lidLeftA:  '40.79%',
        lidLeftB:  '54.79%',
        maskTop:   '37.19%',
        maskLeftA: '40.79%',
        maskLeftB: '54.79%',
        maskW:     '5.42%',
        maskH:     '4.62%',
        glintLeftA: '60.3%',
        glintTopA:  '3%',
        glintLeftB: '20.5%',
        glintTopB:  '3%',
        glintW:     '18%',
      }} />
      <StinkyFlies cleanliness={cleanliness} />
    </>
  ), [cleanliness]) // eslint-disable-line react-hooks/exhaustive-deps

  // Eren block — sprite + crouch-to-eat body animation + bowl/crumbs/word/hearts
  // particles, all anchored to this container. Idle is paused mid-reaction.
  const phase = reaction.phase
  // Both eat sub-beats keep the same body animation string, so it plays through
  // 2650ms without restarting while the chew sound re-fires on 'eat2'.
  const eating = phase === 'eat' || phase === 'eat2'
  const bowlColor = fedItem?.color ?? '#D4A44A'
  const noseLeft = `${EAT_NOSE_X[eatIdx]}%`   // bowl/crumbs anchor at his mouth
  // Poof-mask the standing<->crouch sticker swap at each end of the meal.
  const prevEating = useRef(false)
  useEffect(() => {
    if (prevEating.current !== eating) { prevEating.current = eating; setShowPoof(true) }
  }, [eating])
  const erenElement = (
    <div className="absolute z-20 bottom-[10%]"
      style={{ left: '50%', transform: 'translateX(-50%)' }}>
      {eating ? (
        // Head-down eating pose (random pick, eyes painted in). A gentle chew
        // bob over the sticker carries the munching; the standing<->crouch swap
        // is hidden by the poof at each end of the meal.
        <div style={{ animation: 'erenChew 440ms ease-in-out infinite' }}>
          <PoseSprite src={`/erenEat${eatIdx + 1}.png?v=2`} width={140} breathe={false} />
        </div>
      ) : (
        <ErenIdleLayer disabled={reaction.active}>
          <div style={{
            animation: phase === 'finish' ? 'erenIdleHop 800ms ease-in-out' : undefined,
            transformOrigin: 'bottom center',
          }}>
            {erenSprite}
          </div>
        </ErenIdleLayer>
      )}

      {/* Bowl + crumbs sit under his lowered face (off-centre in the crouch).
          The bowl is nudged a touch down-and-left of the nose so it reads as
          sitting on the floor in front of his mouth, not stuck to his chin. */}
      {eating && <FoodBowl color={bowlColor} left={`${EAT_NOSE_X[eatIdx] - 11}%`} bottom="-14%" width={34} />}
      {eating && <Crumbs color={bowlColor} left={noseLeft} bottom="2%" />}
      {eating && <SoundWord word="NOM NOM" color={WORD_COLOR.food} left={EAT_NOSE_X[eatIdx] + 8} top={12} />}
      {eating && <SoundWord word="NOM NOM" color={WORD_COLOR.food} left={EAT_NOSE_X[eatIdx] + 6} top={9} delayMs={1400} />}
      {/* Happy finisher. */}
      {phase === 'finish' && <>
        <Hearts count={2} bottom="60%" />
        <SoundWord word="YUM!" color={WORD_COLOR.happy} left={50} top={6} />
      </>}

      {/* Poof that masks the standing<->crouch sticker swap. */}
      {showPoof && <PixelPoof size={200} onDone={() => setShowPoof(false)} />}
    </div>
  )

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
    // Eren starts munching the moment the food lands — fire the eating
    // sound before the network round-trip so playback feels immediate, and
    // kick off the eat reaction (bowl → crouch-and-chomp → happy finisher).
    playSound('care_eat')
    setFedItem(item)
    // Random head-down pose for this meal.
    setEatIdx(Math.floor(Math.random() * 4))
    reaction.play([
      { name: 'bowl', ms: 150 },
      { name: 'eat',  ms: 1300 },
      // Second chew sound lands mid-meal, not stacked on the first.
      { name: 'eat2', ms: 1350, onEnter: () => playSound('care_eat') },
      ...happyFinisherBeats(),
    ])
    // Signal the food key for the Daily Wish system — useDailyWish picks
    // this up to match food-specific wishes like "i'm craving salmon".
    try {
      window.dispatchEvent(new CustomEvent('eren:fed-food', { detail: {
        food: item.id, user_id: user.id, household_id: profile?.household_id,
      } }))
    } catch { /* SSR/no-window */ }
    const result = await feedWithFood(user.id, item.hungerD, item.happyD, item.weightD)
    showToast(result.message, result.success)
    setFeeding(null)
    if (result.success) completeTask('daily_feed')
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none" style={{ touchAction: 'none' }}>

      {/* Daily wish hint — only renders when today's wish maps to feeding. */}
      {wish?.wish && (
        <WishHintBanner
          text={wish.text}
          status={wish.status}
          matchesThisRoom={wishMatchesThisRoom}
        />
      )}

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
      {!isSleeping && erenElement}

      {/* ══ UI ══ */}

      {toast && (
        <div className={cn('absolute left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 animate-float whitespace-nowrap', toast.ok ? '' : '')}
          style={{ top: 145, background: toast.ok ? '#1F1F2E' : '#CC2222', borderRadius: 3, border: `2px solid ${toast.ok ? '#3A3A5E' : '#AA1111'}`, boxShadow: `3px 3px 0 ${toast.ok ? 'rgba(0,0,0,0.4)' : '#880000'}`, fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast.msg}
        </div>
      )}

      {/* ══ DRAG GHOST — just the food icon, no frame ══ */}
      {dragRef.current.item && dragRef.current.pos && dragRef.current.active && (
        <div ref={ghostRef} className="fixed pointer-events-none z-[60]" style={{
          left: dragRef.current.pos.x - 20, top: dragRef.current.pos.y - 20,
          filter: `drop-shadow(0 2px 6px ${dragRef.current.item.color}88)`,
          transform: 'scale(1.3)',
        }}>
          <FoodIcon id={dragRef.current.item.id} color={dragRef.current.item.color} />
        </div>
      )}

      {/* ══ EREN GLOW — always mounted, opacity toggles to avoid DOM churn ══ */}
      <div className="fixed pointer-events-none z-[19]" style={{
        left: '50%', bottom: '10%',
        transform: 'translateX(-50%)',
        width: 220, height: 220,
        borderRadius: '50%',
        background: dragRef.current.near && dragRef.current.item
          ? `radial-gradient(circle, ${dragRef.current.item.color}30 0%, transparent 70%)`
          : 'transparent',
        opacity: dragRef.current.near ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }} />

      {/* ══ BOTTOM BAR — Fridge (left), Food center, Shop (right) ══ */}
      <div className="absolute bottom-6 left-0 right-0 z-30 px-4">
        <div className="flex items-end justify-between">

          {/* LEFT: Fridge button */}
          <KitchenNavButton
            variant="fridge"
            disabled={isSleeping}
            onClick={() => { if (!isSleeping) { playSound('ui_modal_open'); setTab('fridge') } }}
          />

          {/* CENTER: Current food with arrows */}
          {(() => {
            // Hide the draggable food while he's eating so it doesn't sit over
            // the crouch pose / bowl at the bottom of the scene.
            if (reaction.active) return <div className="flex-1" />
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

          {/* RIGHT: Shop button — toggling shut also resets the shop
              category, so re-opening always lands on the category picker. */}
          <KitchenNavButton
            variant="shop"
            active={tab === 'shop'}
            disabled={isSleeping}
            onClick={() => {
              const closing = tab === 'shop'
              playSound(closing ? 'ui_modal_close' : 'ui_modal_open')
              if (closing) { setShopCat(null); setTab(null) } else { setTab('shop') }
            }}
          />
        </div>
      </div>

      {/* ══ FRIDGE CATEGORY PAGE — full screen overlay ══ */}
      {tab === 'fridge' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', animation: 'scrimIn 200ms ease-out' }}>
          <div className="w-full max-w-xs px-6" style={{ animation: 'modalPop 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
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

      {/* ══ SLIDE-UP DRAWER — shop ══ */}
      {/* Two phases: shopCat=null → category picker; shopCat=<id> → items in
          that category with a back arrow. Closing the drawer (X or via the
          bottom-bar shop button) resets shopCat so a fresh open lands on
          the picker. */}
      {tab === 'shop' && (() => {
        const activeCat = shopCat ? FRIDGE_CATEGORIES.find(c => c.id === shopCat) ?? null : null
        const closeShop = () => { playSound('ui_modal_close'); setShopCat(null); setTab(null) }
        return (
        <div className="absolute bottom-0 left-0 right-0 z-40 flex flex-col"
          style={{ height: '52%', background: 'linear-gradient(180deg, #FFFBF0 0%, #FFF8E8 100%)', borderRadius: '16px 16px 0 0', borderTop: '3px solid #F5C842', boxShadow: '0 -4px 0 #E8A020', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>

          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              {activeCat && (
                <button onClick={() => { playSound('ui_back'); setShopCat(null) }}
                  className="active:scale-90 transition-transform"
                  style={{ background: '#F5EDD0', borderRadius: 6, border: '2px solid #E8C870', padding: '2px 7px', fontFamily: '"Press Start 2P"', fontSize: 8, color: '#A07020' }}
                  aria-label="Back to categories">
                  ◂
                </button>
              )}
              <span className="font-pixel text-amber-700 flex items-center gap-2" style={{ fontSize: 9 }}>
                <ShoppingCart size={12} />
                {activeCat ? `SHOP · ${activeCat.label}` : 'SHOP'}
              </span>
            </div>
            <button onClick={closeShop}
              className="active:scale-90 transition-transform"
              style={{ background: '#F5EDD0', borderRadius: 8, border: '2px solid #E8C870', padding: '3px 8px', fontFamily: '"Press Start 2P"', fontSize: 8, color: '#A07020' }}>
              ✕
            </button>
          </div>
          <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #F5C842, transparent)', marginBottom: 4 }} />

          <div className="overflow-y-auto px-3 py-2 flex-1">
            {!activeCat ? (
              /* PHASE 1 — category picker. Mirrors the fridge category list:
                 colored row per category, two preview food icons + count. */
              <div className="flex flex-col gap-2">
                {FRIDGE_CATEGORIES.map(c => {
                  const catItems = SHOP_ITEMS.filter(i => i.cat === c.id)
                  const previewIcons = catItems.slice(0, 2)
                  const cheapest = catItems.reduce((min, i) => i.price < min ? i.price : min, Infinity)
                  return (
                    <button key={c.id}
                      onClick={() => { playSound('ui_select'); setShopCat(c.id) }}
                      className="flex items-center gap-3 px-4 py-3 active:scale-[0.98] transition-transform w-full"
                      style={{
                        background: `linear-gradient(135deg, ${c.color}28 0%, ${c.color}10 100%)`,
                        borderRadius: 6,
                        border: `2px solid ${c.color}88`,
                        boxShadow: `2px 2px 0 ${c.color}33`,
                      }}>
                      <div className="flex gap-1 flex-shrink-0">
                        {previewIcons.map(i => (
                          <FoodIcon key={i.id} id={i.id} color={i.color} />
                        ))}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="font-pixel block" style={{ fontSize: 9, color: c.color, letterSpacing: 1.5 }}>{c.label}</span>
                        <span className="text-[10px]" style={{ color: '#8A7050' }}>
                          {catItems.length} item{catItems.length !== 1 ? 's' : ''} · from {cheapest}c
                        </span>
                      </div>
                      <span className="font-pixel" style={{ fontSize: 12, color: c.color }}>▸</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              /* PHASE 2 — items in the active category. Same card layout as
                 before; just filtered to one category. */
              <div className="grid grid-cols-2 gap-2">
                {SHOP_ITEMS.filter(i => i.cat === activeCat.id).map(item => {
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
            )}
          </div>
        </div>
        )
      })()}

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

      {/* Kitchen-only "dramatic" bulb — full glowing fixture with rays
          instead of the small lamp dot the other rooms use. Position
          tracks the ceiling-bulb spot in kitchen.png; nudge bulbTop /
          bulbLeft if it drifts from the in-art fixture. */}
      <LightSwitch
        targetBottom="12%"
        targetLeft="50%"
        lampTop="13%"
        dramatic
        bulbTop="13%"
        bulbLeft="50%"
        persistKey="kitchen"
      />
    </div>
  )
}
