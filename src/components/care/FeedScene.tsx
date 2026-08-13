'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats, getCachedIsSleeping } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'
import { inkOn, deepenOn } from '@/lib/contrastInk'
import FoodIcon from '@/components/care/FoodIcon'
import { foodDrag } from './foodDragFlag'
import type { FoodInventory } from '@/types'
import { playSound } from '@/lib/sounds'
import AnalogClock from '@/components/AnalogClock'
import BlinkingEren from '@/components/BlinkingEren'
import { useRoomEren } from '@/hooks/useRoomEren'
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
import ChewingEren, { EAT_NOSE_X, pickEatPose, preloadEatPoses } from '@/components/care/ChewingEren'
import PetTarget, { PurrFx, PURR } from '@/components/care/PetTarget'
import { DONUTS, getDonut, KITCHEN_DONUTS, TASTE_JOY, TASTE_LINE } from '@/lib/donuts'
import { dailyMenu } from '@/lib/foodMenu'
import { todayKey } from '@/lib/seededRng'
import { monstaBuff } from '@/lib/monstaBuffs'
import CanAura, { type CanVariant } from './CanAura'
import CanFeedBurst from './CanFeedBurst'
import SkinUnlockCinematic from './SkinUnlockCinematic'
import { DRINK_UNLOCK_SKINS, getSkin, type SkinDef } from '@/lib/skins'
import { grantDrinkSkin, wearSkinEverywhere } from '@/lib/drinkUnlock'
import PixelPoof from '@/components/PixelPoof'
import FoodStatsCard, { type FoodStatItem } from '@/components/care/FoodStatsCard'
import CareToast from '@/components/care/CareToast'
import { useLongPress } from '@/hooks/useLongPress'
import { IconClose, IconChevronLeft, IconChevronRight } from '@/components/PixelIcons'

interface Props { onClose: () => void }

/** Every Monsta costs the same — you're paying for the perk, not the flavour. */
const MONSTA_PRICE = 100

// A MEAL FEEDS HIM; IT DOESN'T CHEER HIM UP. Every ordinary food — staples,
// seafood, meat, dairy, and all twenty world dishes — is happyD 0 on purpose.
// Joy is a treat: only the sweets (cat treat, cream, cake, donut, cookie, jelly
// caka) and the energy drinks with a real perk still raise happiness. If you're
// adding a plain food, happyD stays 0; if you're adding a dessert, say so here.
const SHOP_ITEMS = [
  // Dry
  { id: 'kibble'  as const, name: 'Kibble',     price: 5,  hungerD: 15, happyD: 0,  weightD: 0.03, desc: 'Daily dry food',     color: '#D4A44A', cat: 'dry'     },
  { id: 'treat'   as const, name: 'Cat Treat',  price: 8,  hungerD: 8,  happyD: 20, weightD: 0.01, desc: 'Sweet & crunchy',    color: '#FF6B9D', cat: 'dry'     },
  { id: 'biscuit' as const, name: 'Biscuit',    price: 6,  hungerD: 12, happyD: 0,  weightD: 0.02, desc: 'Crunchy snack',      color: '#C8956A', cat: 'dry'     },
  // Seafood
  { id: 'fish'    as const, name: 'Fish',        price: 12, hungerD: 25, happyD:  0, weightD: 0.05, desc: "Eren's favourite!",  color: '#5BA3D9', cat: 'seafood' },
  { id: 'tuna'    as const, name: 'Tuna Can',   price: 18, hungerD: 30, happyD:  0, weightD: 0.06, desc: 'Premium quality',    color: '#E8A020', cat: 'seafood' },
  { id: 'shrimp'  as const, name: 'Shrimp',     price: 15, hungerD: 20, happyD:  0, weightD: 0.03, desc: 'Pink & tasty',       color: '#F0836A', cat: 'seafood' },
  { id: 'salmon'  as const, name: 'Salmon',     price: 22, hungerD: 35, happyD:  0, weightD: 0.07, desc: 'Rich & flaky',       color: '#E8735A', cat: 'seafood' },
  { id: 'sardine' as const, name: 'Sardine',    price: 10, hungerD: 18, happyD: 0,  weightD: 0.04, desc: 'Tiny & oily',        color: '#7BAFC8', cat: 'seafood' },
  { id: 'sushi'   as const, name: 'Sushi',      price: 25, hungerD: 28, happyD:  0, weightD: 0.04, desc: 'Fancy roll',         color: '#2D9B6A', cat: 'seafood' },
  // Meat
  { id: 'steak'   as const, name: 'Steak',      price: 30, hungerD: 40, happyD:  0, weightD: 0.10, desc: 'Luxury cut',         color: '#CC3333', cat: 'meat'    },
  { id: 'chicken' as const, name: 'Chicken',    price: 14, hungerD: 28, happyD:  0, weightD: 0.06, desc: 'Juicy drumstick',    color: '#E8B44A', cat: 'meat'    },
  { id: 'sausage' as const, name: 'Sausage',    price: 12, hungerD: 22, happyD: 0,  weightD: 0.05, desc: 'Smoky & meaty',      color: '#A0522D', cat: 'meat'    },
  // Dairy
  { id: 'cream'   as const, name: 'Cream',      price: 10, hungerD: 10, happyD: 30, weightD: 0.02, desc: 'Sweet treat',        color: '#A78BFA', cat: 'dairy'   },
  { id: 'milk'    as const, name: 'Milk',       price: 6,  hungerD: 12, happyD:  0, weightD: 0.02, desc: 'Fresh & cold',       color: '#E8E4E0', cat: 'dairy'   },
  { id: 'cheese'  as const, name: 'Cheese',     price: 10, hungerD: 14, happyD:  0, weightD: 0.03, desc: 'Aged cheddar',       color: '#F5C842', cat: 'dairy'   },
  { id: 'yogurt'  as const, name: 'Yogurt',     price: 8,  hungerD: 10, happyD:  0, weightD: 0.01, desc: 'Creamy & smooth',    color: '#FFB6C1', cat: 'dairy'   },
  // Sweets. The donut case is spread in at the bottom of this list — `donut`
  // itself lives there now, not here, or it would be in SHOP_ITEMS twice.
  { id: 'cake'    as const, name: 'Cake',       price: 35, hungerD: 15, happyD: 40, weightD: 0.08, desc: 'Birthday special',   color: '#FF85A2', cat: 'sweets'  },
  // An egg is not a sweet — it sits with the other fridge staples.
  { id: 'egg'     as const, name: 'Egg',        price: 4,  hungerD: 16, happyD: 0,  weightD: 0.03, desc: 'Simple & nutritious',color: '#F5E6C8', cat: 'dairy'   },
  { id: 'cookie'     as const, name: 'Cookie',      price: 7,  hungerD: 8,  happyD: 18, weightD: 0.02, desc: 'Choc-chip warm',   color: '#C89A6B', cat: 'sweets'  },
  { id: 'jelly_caka' as const, name: 'Jelly Caka',  price: 20, hungerD: 14, happyD: 30, weightD: 0.05, desc: 'Sweet wobble',     color: '#E83A4A', cat: 'sweets'  },
  // Monsta flavours — the can family.
  // Barely any hunger, near-zero weight: they're drinks, not meals. What you
  // actually buy is the ENERGY (every can fills the bar) plus that flavour's
  // own perk — see MONSTA_BUFFS in lib/monstaBuffs.ts. One flat MONSTA_PRICE
  // for all ten, so you pick a can for what it does, never for what it costs.
  // That only holds while no can pays back more than it costs: every coin perk
  // in MONSTA_BUFFS stays under MONSTA_PRICE, or the shop mints money.
  { id: 'monsta_original' as const, name: 'Original Monsta', price: MONSTA_PRICE, hungerD: 6, happyD: 18, weightD: 0.01, desc: 'The green classic', color: '#A6E728', cat: 'energy'  },
  { id: 'monsta_white'    as const, name: 'White Monsta',    price: MONSTA_PRICE, hungerD: 5, happyD: 16, weightD: 0.01, desc: 'Zero sugar ultra',  color: '#2FBCB3', cat: 'energy'  },
  { id: 'monsta_mango'    as const, name: 'Mango Monsta',    price: MONSTA_PRICE, hungerD: 6, happyD: 18, weightD: 0.01, desc: 'Mango loco kick',   color: '#F9A300', cat: 'energy'  },
  { id: 'monsta_loco'     as const, name: 'Loco Monsta',     price: MONSTA_PRICE, hungerD: 6, happyD: 18, weightD: 0.01, desc: 'Tropical loco',     color: '#69C7EB', cat: 'energy'  },
  { id: 'monsta_pipeline' as const, name: 'Pipeline Monsta', price: MONSTA_PRICE, hungerD: 5, happyD: 17, weightD: 0.01, desc: 'Pipeline punch',    color: '#F96679', cat: 'energy'  },
  { id: 'monsta_punch'    as const, name: 'Punch Monsta',    price: MONSTA_PRICE, hungerD: 5, happyD: 17, weightD: 0.01, desc: 'Punchy citrus',     color: '#E9665C', cat: 'energy'  },
  { id: 'monsta_rosa'     as const, name: 'Rosa Monsta',     price: MONSTA_PRICE, hungerD: 5, happyD: 19, weightD: 0.01, desc: 'Ultra rosa fizz',   color: '#D05C8D', cat: 'energy'  },
  { id: 'monsta_peachy'   as const, name: 'Peachy Monsta',   price: MONSTA_PRICE, hungerD: 5, happyD: 19, weightD: 0.01, desc: 'Peachy keen',       color: '#F9AB94', cat: 'energy'  },
  { id: 'monsta_rainbow'  as const, name: 'Rainbow Monsta',  price: MONSTA_PRICE, hungerD: 8, happyD: 40, weightD: 0.01, desc: 'Ultimate blast',    color: '#B65CF0', cat: 'energy'  },
  { id: 'monsta_gold'     as const, name: 'Gold Monsta',     price: MONSTA_PRICE, hungerD: 8, happyD: 40, weightD: 0.01, desc: 'Special edition',   color: '#D89C24', cat: 'energy'  },

  // ─── World dishes ────────────────────────────────────────────────────────
  // Full plated meals (pixel-art art in /public/food), grouped by cuisine so
  // the picker stays browsable instead of dumping 21 dishes into SPECIAL.
  // Priced above the staples — these are real meals: high hunger and heavier
  // (weightD) than a treat. No joy: a dinner is a dinner, not a present.
  // Italian
  { id: 'pizza'     as const, name: 'Pizza',       price: 26, hungerD: 34, happyD:  0, weightD: 0.09, desc: 'Hot cheesy slice',   color: '#E4703A', cat: 'italian' },
  { id: 'carbonara' as const, name: 'Carbonara',   price: 24, hungerD: 32, happyD:  0, weightD: 0.08, desc: 'Silky egg & pepper', color: '#EFC663', cat: 'italian' },
  { id: 'lasagna'   as const, name: 'Lasagna',     price: 28, hungerD: 38, happyD:  0, weightD: 0.10, desc: 'Layered and baked',  color: '#D9793F', cat: 'italian' },
  { id: 'risotto'   as const, name: 'Risotto',     price: 24, hungerD: 30, happyD:  0, weightD: 0.08, desc: 'Creamy saffron rice',color: '#E8C765', cat: 'italian' },
  // Sushi
  { id: 'nigiri'    as const, name: 'Nigiri',      price: 22, hungerD: 22, happyD:  0, weightD: 0.04, desc: 'Tuna on rice',       color: '#F0736F', cat: 'sushi'   },
  { id: 'temaki'    as const, name: 'Temaki',      price: 20, hungerD: 20, happyD:  0, weightD: 0.04, desc: 'Hand-rolled cone',   color: '#3C6E52', cat: 'sushi'   },
  { id: 'maki'      as const, name: 'Maki Roll',   price: 24, hungerD: 26, happyD:  0, weightD: 0.05, desc: 'Seaweed-wrapped',    color: '#2F3B33', cat: 'sushi'   },
  // Asian
  { id: 'ramen'     as const, name: 'Ramen',       price: 28, hungerD: 36, happyD:  0, weightD: 0.09, desc: 'Steamy bowl of joy', color: '#C8632E', cat: 'asian'   },
  { id: 'pad_thai'  as const, name: 'Pad Thai',    price: 26, hungerD: 32, happyD:  0, weightD: 0.08, desc: 'Tangy peanut noodles',color: '#E08A3C', cat: 'asian'  },
  { id: 'gyoza'     as const, name: 'Gyoza',       price: 20, hungerD: 24, happyD:  0, weightD: 0.06, desc: 'Pan-fried dumplings',color: '#E7D2A6', cat: 'asian'   },
  { id: 'xiaolongbao' as const, name: 'Soup Buns', price: 24, hungerD: 28, happyD:  0, weightD: 0.07, desc: 'Steamed in a basket',color: '#D9BE8E', cat: 'asian'   },
  // Balkan
  { id: 'cevapi'    as const, name: 'Ćevapi',      price: 26, hungerD: 36, happyD:  0, weightD: 0.09, desc: 'Grilled little logs',color: '#A9663C', cat: 'balkan'  },
  { id: 'sarma'     as const, name: 'Sarma',       price: 24, hungerD: 32, happyD:  0, weightD: 0.08, desc: 'Rolled cabbage',     color: '#7E9B4E', cat: 'balkan'  },
  { id: 'doner'     as const, name: 'Döner',       price: 22, hungerD: 34, happyD:  0, weightD: 0.08, desc: 'Wrapped and stacked',color: '#D2A15C', cat: 'balkan'  },
  // World
  { id: 'tacos'     as const, name: 'Tacos',       price: 22, hungerD: 28, happyD:  0, weightD: 0.07, desc: 'Three of them!',     color: '#E0A93F', cat: 'world'   },
  { id: 'wrap'      as const, name: 'Wrap',        price: 18, hungerD: 26, happyD:  0, weightD: 0.06, desc: 'Rolled up tight',    color: '#DDBE84', cat: 'world'   },
  { id: 'paella'    as const, name: 'Paella',      price: 30, hungerD: 38, happyD:  0, weightD: 0.10, desc: 'Straight from the pan',color: '#DE9A3E', cat: 'world' },
  { id: 'stew'      as const, name: 'Stew',        price: 24, hungerD: 34, happyD:  0, weightD: 0.09, desc: 'Slow-cooked & warm', color: '#8E5A2E', cat: 'world'   },
  { id: 'meatballs' as const, name: 'Meatballs',   price: 26, hungerD: 34, happyD:  0, weightD: 0.09, desc: 'Simmered in sauce',  color: '#C4452F', cat: 'world'   },
  { id: 'roast_chicken' as const, name: 'Roast Chicken', price: 32, hungerD: 42, happyD:  0, weightD: 0.12, desc: 'The whole bird',color: '#D8973C', cat: 'world'  },

  // ─── Donuts ──────────────────────────────────────────────────────────────
  // The whole case, so a donut you got anywhere shows up in the fridge and can
  // be dragged to Eren like any other food. Only the kitchen pair is on SALE
  // here (see SHELF_ITEMS) — the rest come from the bakery's daily tray or the
  // Snacks & Drinks machine.
  ...DONUTS.map(d => ({
    id: d.id, name: d.name, price: d.price,
    hungerD: d.hungerD, happyD: d.happyD, weightD: d.weightD,
    desc: d.desc, color: d.color, cat: 'sweets',
  })),
]

// What the SHOP is allowed to sell, as opposed to what the FRIDGE can hold.
// Everything is on sale except the donuts you're supposed to earn elsewhere:
// the bakery's rotating case and the three gacha exclusives are in SHOP_ITEMS
// only so they render in your fridge once you own one.
//
// Keyed on the CATALOGUE, never on the category. This filter used to read
// `cat !== 'donuts'`, and the moment the donuts were folded into SWEETS that
// stopped matching anything and quietly put all 27 on the shelf. An id is the
// thing that actually identifies a donut; a category is a display grouping and
// is free to be renamed.
const ALL_DONUT_IDS: ReadonlySet<string> = new Set(DONUTS.map(d => d.id))
const KITCHEN_SHELF: ReadonlySet<string> = new Set(KITCHEN_DONUTS.map(d => d.id))
const SHELF_ITEMS = SHOP_ITEMS.filter(i => !ALL_DONUT_IDS.has(i.id) || KITCHEN_SHELF.has(i.id))

// Foods Eren LAPS instead of chews. Feeding one of these swaps the chewing
// sample for the drinking one, so a bowl of milk doesn't crunch. Every Monsta
// is a drink by construction, so the can family is matched by prefix — a new
// flavour lands here for free instead of needing a second edit.
const LAPPED_FOODS = new Set(['milk', 'cream', 'yogurt'])
const isDrink = (id: string) => LAPPED_FOODS.has(id) || id.startsWith('monsta_')

// The two SPECIAL EDITION cans dress themselves — animated border, sparkle
// aura, and a burst when they go down. Keyed rather than branched on an id
// literal in four places, so a third special can is one line here.
const SPECIAL_CAN: Record<string, CanVariant> = {
  monsta_rainbow: 'rainbow',
  monsta_gold:    'gold',
}

/** What the unlock cinematic needs, captured at the moment the can goes down. */
interface UnlockPayload { skin: SkinDef; variant: CanVariant; drinkName: string }

// Icon size for the food you carry to Eren — the tray tile and the drag ghost
// share it so the plate never changes size when you pick it up, and the ghost's
// centring offset stays derived from one number.
const DRAG_ICON = 50

// Shop drawer header buttons (back / close). One style object so the pair can
// never drift apart again, sized as a proper 30px tap target.
const SHOP_HDR_BTN: React.CSSProperties = {
  width: 30, height: 30,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#F7E9B8', borderRadius: 8, border: '2px solid #E8C870',
  boxShadow: '0 2px 0 #D9B45C',
}

// Darkest a category row's background gets: the MEAT tint (#CC3333 at 0x26)
// over the drawer cream. Deepening every category label against this one
// reference keeps each of them readable on its own, lighter row.
const ROW_TINT_FLOOR = '#F7DDD4'

const FRIDGE_CATEGORIES = [
  { id: 'dry',     label: 'DRY',     color: '#D4A44A' },
  { id: 'seafood', label: 'SEAFOOD', color: '#5BA3D9' },
  { id: 'meat',    label: 'MEAT',    color: '#CC3333' },
  { id: 'dairy',   label: 'DAIRY',   color: '#A78BFA' },
  // SWEETS is the old SPECIAL: cake, cookie, jelly and the whole donut case.
  // The ten Monsta cans used to sit here too and swamped it — they're a drink,
  // not a dessert, and they now have their own shelf at the end.
  { id: 'sweets',  label: 'SWEETS',  color: '#FF85A2' },
  { id: 'italian', label: 'ITALIAN', color: '#E4703A' },
  { id: 'sushi',   label: 'SUSHI',   color: '#F0736F' },
  { id: 'asian',   label: 'ASIAN',   color: '#C8632E' },
  { id: 'balkan',  label: 'BALKAN',  color: '#A9663C' },
  { id: 'world',   label: 'WORLD',   color: '#DE9A3E' },
  { id: 'energy',  label: 'ENERGY',  color: '#A6E728' },
]


// The head-down eating pose (sticker set, chew bob, and the EAT_NOSE_X muzzle
// measurements the bowl/crumbs/words anchor to) lives in ChewingEren — the vet
// shares it for the lolipop.

// Kitchen idle look (ErenCook) — default when no Closet skin is set. Stable
// module ref so useRoomEren's memo holds across the 60fps-free re-renders.
const FEED_EREN_FALLBACK = {
  src: '/ErenCook_notail.png', tailSrc: '/ErenCook_tail.png', tailOrigin: '71.8% 80.7%',
  eyes: {
    lidTop: '37.19%', lidWidth: '5.42%', lidLeftA: '40.79%', lidLeftB: '54.79%',
    maskTop: '37.19%', maskLeftA: '40.79%', maskLeftB: '54.79%', maskW: '5.42%', maskH: '4.62%',
    glintLeftA: '60.3%', glintTopA: '3%', glintLeftB: '20.5%', glintTopB: '3%', glintW: '18%',
  },
}

export default function FeedScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, feedWithFood, addToMyFood, consumeMyFood, markDonutTasted, noteMenuFed } = useErenStats(profile?.household_id ?? null)
  const { completeTask, coins, spendCoins, addCoins } = useTasks()
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
  // Which category the FRIDGE OVERLAY is currently looking inside. Separate
  // from fridgeCat, which is what the bottom bar is carrying: opening a
  // category to browse it shouldn't change what's in your hand until you pick
  // something. null = the category list.
  const [fridgeNav, setFridgeNav] = useState<string | null>(null)
  // The food being inspected by a long press, from either the fridge or shop.
  const [statsFor, setStatsFor] = useState<FoodStatItem | null>(null)
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
          // Half the ghost icon (DRAG_ICON) so it stays centred under the finger.
          g.style.left = `${t2.clientX - DRAG_ICON / 2}px`
          g.style.top = `${t2.clientY - DRAG_ICON / 2}px`
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

  // What you actually own in a category, in the ONE order everything else
  // agrees on: the fridge grid renders it, and foodIdx indexes into it, so
  // picking the third tile has to land on the third food.
  const ownedIn = (catId: string) =>
    SHOP_ITEMS.filter(i => i.cat === catId && (inventory[i.id] ?? 0) > 0)

  // Hold any food — in the fridge or on the shelf — to read its stats.
  const hold = useLongPress<FoodStatItem>(setStatsFor)

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

  // A first pour of a SPECIAL EDITION can grants the matching look. The grant
  // resolves DURING the meal (it's a network write kicked off mid-animation), so
  // it parks in `pendingUnlock` and only becomes the on-screen cinematic once the
  // eat sequence has finished — the reveal is the reward for watching him drink,
  // not something that interrupts it.
  const [pendingUnlock, setPendingUnlock] = useState<UnlockPayload | null>(null)
  const [unlock, setUnlock] = useState<UnlockPayload | null>(null)
  useEffect(() => {
    if (pendingUnlock && !reaction.active) { setUnlock(pendingUnlock); setPendingUnlock(null) }
  }, [pendingUnlock, reaction.active])

  // Warm the four eating stickers so the poof reveals a decoded bitmap.
  useEffect(() => { preloadEatPoses() }, [])

  // Memoize the bare sprite so stat changes from feeding don't re-render it.
  // Cleanliness is in the deps so the flies update — feeding never changes
  // cleanliness, so this never recomputes mid-feed (no sprite flicker).
  const cleanliness = stats?.cleanliness ?? 100
  const feedEren = useRoomEren('feed', FEED_EREN_FALLBACK)
  const erenSprite = useMemo(() => (
    <>
      {/* Kitchen pose: ErenCook.png (redrawn — no watermark cross).
          Coords come from a pixel-scan of the 959×1536 sprite,
          translated to the 210×210 BlinkingEren container (portrait
          sprite height-fits so the image occupies the middle ~62.6%
          of container width). Catchlights are MIRRORED on this
          sprite: eye A's in the upper-RIGHT of its iris, eye B's in
          the upper-LEFT — they point toward the nose. */}
      <BlinkingEren size={210} {...feedEren} />
      <StinkyFlies cleanliness={cleanliness} />
    </>
  ), [cleanliness, feedEren]) // eslint-disable-line react-hooks/exhaustive-deps

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
        // Head-down eating pose (random pick, eyes painted in). The standing
        // <-> crouch swap is hidden by the poof at each end of the meal.
        <ChewingEren idx={eatIdx} />
      ) : (
        <PetTarget reaction={reaction}>
          <ErenIdleLayer disabled={reaction.active}>
            <div style={{
              animation: phase === 'finish' ? 'erenIdleHop 800ms ease-in-out' : undefined,
              transformOrigin: 'bottom center',
            }}>
              {erenSprite}
            </div>
          </ErenIdleLayer>
        </PetTarget>
      )}

      {/* Bowl + crumbs sit under his lowered face (off-centre in the crouch).
          The bowl is nudged a touch down-and-left of the nose so it reads as
          sitting on the floor in front of his mouth, not stuck to his chin. */}
      {eating && <FoodBowl color={bowlColor} left={`${EAT_NOSE_X[eatIdx] - 11}%`} bottom="-14%" width={34} />}
      {eating && <Crumbs color={bowlColor} left={noseLeft} bottom="2%" />}
      {eating && <SoundWord word="NOM NOM" color={WORD_COLOR.food} left={EAT_NOSE_X[eatIdx] + 8} top={12} />}
      {eating && <SoundWord word="NOM NOM" color={WORD_COLOR.food} left={EAT_NOSE_X[eatIdx] + 6} top={9} delayMs={1400} />}
      {/* SPECIAL EDITION payoff. Keyed on the phase so the burst REMOUNTS on
          the second chew beat — its keyframes run once and fill forwards, so a
          burst that merely stayed mounted would play only on the first can and
          then sit there spent. */}
      {fedItem && SPECIAL_CAN[fedItem.id] && (phase === 'eat' || phase === 'eat2') && (
        <CanFeedBurst key={phase} variant={SPECIAL_CAN[fedItem.id]}
          left={`${EAT_NOSE_X[eatIdx]}%`} bottom="34%" />
      )}
      {/* Happy finisher. */}
      {phase === 'finish' && <>
        <Hearts count={2} bottom="60%" />
        <SoundWord word="YUM!" color={WORD_COLOR.happy} left={50} top={6} />
      </>}
      {/* Tap-to-pet purr. */}
      {phase === PURR && <PurrFx bottom="60%" />}

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
    // Affordability was just checked locally, so the outcome is already
    // decided — toast NOW instead of after two sequential Supabase round-
    // trips (coins write, then fridge write) that used to pin the button at
    // "..." with zero feedback for seconds on a slow connection. The writes
    // settle behind the toast; `buying` stays held until they do so
    // purchases serialize and the coin math never sees a stale balance.
    showToast(`Bought ${item.name}! In your fridge`)
    // The two writes are INDEPENDENT — different tables (profiles.coins vs
    // eren_stats.food_by_user) with no ordering dependency — and each applies
    // its optimistic local update the moment it's called. Awaiting the coin
    // write first meant addToMyFood wasn't even CALLED until that round-trip
    // came back, so the fridge count sat unchanged behind a toast that already
    // said "In your fridge", and the button held at "..." for the SUM of two
    // round-trips. Firing them together: the fridge fills on tap, and the
    // button unpins after the slower single round-trip instead of both.
    const [ok] = await Promise.all([
      spendCoins(item.price),
      addToMyFood(user.id, item.id),
    ])
    if (!ok) {
      // Can't be insufficient funds here (pre-checked above) — false means the
      // coin write failed for real and spendCoins already rolled the balance
      // back. Take the food back too: a failed payment must not leave stock.
      await consumeMyFood(user.id, item.id)
      showToast('Connection hiccup — try again!', false)
    }
    setBuying(null)
  }

  async function handleFeed(item: typeof SHOP_ITEMS[number]) {
    if (!user?.id || feeding || isSleeping) return
    // Stock check is purely local — `inventory` derives from stats already
    // in memory, so the no-food case answers without touching the network.
    if ((inventory[item.id] ?? 0) <= 0) {
      showToast(`No ${item.name} in your fridge`, false)
      return
    }
    setFeeding(item.id)
    // Eren starts munching the moment the food lands — sound and reaction
    // fire BEFORE any network write. The fridge decrement used to be
    // awaited first, which held the whole choreography hostage to a
    // Supabase round-trip (seconds of dead air on a cold connection).
    // Drinks lap, solids chew — same choreography, different sample.
    const drinking = isDrink(item.id)
    playSound(drinking ? 'care_drink' : 'care_eat')
    setFedItem(item)
    // Random head-down pose for this meal.
    setEatIdx(pickEatPose())
    reaction.play([
      { name: 'bowl', ms: 150 },
      { name: 'eat',  ms: 1300 },
      // Second chew/lap sound lands mid-meal, not stacked on the first. The
      // drink path uses its OTHER take so the two beats aren't one clip twice.
      { name: 'eat2', ms: 1350, onEnter: () => playSound(drinking ? 'care_drink2' : 'care_eat') },
      ...happyFinisherBeats(),
    ])
    // Signal the food key for the Daily Wish system — useDailyWish picks
    // this up to match food-specific wishes like "i'm craving salmon".
    try {
      window.dispatchEvent(new CustomEvent('eren:fed-food', { detail: {
        food: item.id, user_id: user.id, household_id: profile?.household_id,
      } }))
    } catch { /* SSR/no-window */ }
    // Fridge decrement rides behind the animation. It reads the same stats
    // snapshot as the stock check above, so it can't disagree with it.
    void consumeMyFood(user.id, item.id)
    // A can refills the energy bar and lands its own perk on top of the food's
    // hunger/joy; a donut lands its perk WITHOUT the refuel (see MonstaBuff's
    // `energy` field). Coins are the one perk eren_stats can't hold, so they're
    // paid here — after the stat write, so a failed feed doesn't mint them.
    //
    // Taste scales the donut's OWN joy, never the perk: a donut he loves is
    // twice as nice to eat, but Gold Leaf still pays exactly 35 coins whether
    // he enjoyed it or not.
    const donut = getDonut(item.id)
    const buff = monstaBuff(item.id) ?? donut?.perk
    const joy = donut ? Math.round(item.happyD * TASTE_JOY[donut.taste]) : item.happyD
    const result = await feedWithFood(user.id, item.hungerD, joy, item.weightD, buff)
    if (result.success && buff?.coins) void addCoins(buff.coins)
    // He's tasted it now — that's what fills in the bakery's donut case.
    if (result.success && donut) void markDonutTasted(donut.id)
    // ...and it may have been one of the three he asked for today. Computed in
    // the handler rather than during render so the clock is never read while
    // hydrating; noteMenuFed ignores anything not on today's menu.
    if (result.success) {
      const day = todayKey(new Date())
      noteMenuFed(day, item.id, dailyMenu(day, profile?.household_id ?? null))
    }
    const headline = !result.success ? null
      : buff?.energy != null ? `ENERGY FULL · ${buff.label}`
      : donut ? [TASTE_LINE[donut.taste], buff?.label].filter(Boolean).join(' · ')
      : null
    showToast(headline || result.message, result.success)
    setFeeding(null)
    if (result.success) completeTask('daily_feed')

    // The FIRST pour of a SPECIAL EDITION can leaves its colours on him for
    // good. `grantDrinkSkin` answers 'new' only on the insert that actually
    // landed, so a second Gold Monsta — or the partner pouring one at the same
    // moment — celebrates exactly once. See lib/drinkUnlock.ts.
    const unlockSkinId = result.success ? DRINK_UNLOCK_SKINS[item.id] : undefined
    if (unlockSkinId) {
      const skin = getSkin(unlockSkinId)
      const granted = await grantDrinkSkin(user.id, unlockSkinId)
      if (skin && granted === 'new') {
        setPendingUnlock({ skin, variant: SPECIAL_CAN[item.id], drinkName: item.name })
      }
    }
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

      {toast && <CareToast msg={toast.msg} ok={toast.ok} tone="#F5C842" top={145} />}

      {/* ══ DRAG GHOST — just the food icon, no frame ══ */}
      {dragRef.current.item && dragRef.current.pos && dragRef.current.active && (
        <div ref={ghostRef} className="fixed pointer-events-none z-[60]" style={{
          left: dragRef.current.pos.x - DRAG_ICON / 2, top: dragRef.current.pos.y - DRAG_ICON / 2,
          filter: `drop-shadow(0 2px 6px ${dragRef.current.item.color}88)`,
          transform: 'scale(1.3)',
        }}>
          {/* Matches the tray tile's icon size so the food doesn't visibly
              shrink the moment you pick it up. */}
          <FoodIcon id={dragRef.current.item.id} color={dragRef.current.item.color} size={DRAG_ICON} />
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
                  {/* A special-edition can keeps its dress here too — the
                      fridge is where you pick it up, so it shouldn't go plain
                      the moment it leaves the shop. */}
                  <div className={cn('relative', SPECIAL_CAN[item.id] && `${SPECIAL_CAN[item.id]}-tile`)}
                    style={SPECIAL_CAN[item.id] ? {
                      width: 64, height: 64,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    } : {
                    width: 64, height: 64,
                    background: `radial-gradient(circle at 40% 35%, ${item.color}30, ${item.color}10)`,
                    borderRadius: 12,
                    border: `2px solid ${item.color}88`,
                    boxShadow: `2px 2px 0 ${item.color}44, 0 0 10px ${item.color}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {SPECIAL_CAN[item.id] && <CanAura variant={SPECIAL_CAN[item.id]} box={64} />}
                    <div className="relative" style={{
                      opacity: (dragRef.current.item?.id === item.id && dragRef.current.active) ? 0.15 : 1,
                      transition: 'opacity 0.15s ease',
                    }}>
                      <FoodIcon id={item.id} color={item.color} size={DRAG_ICON} />
                    </div>
                  </div>
                  {/* Qty badge */}
                  <span className="font-pixel absolute" style={{
                    top: -5, right: -5,
                    minWidth: 18, height: 18,
                    background: item.color, color: inkOn(item.color),
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

      {/* ══ FRIDGE — full screen overlay ══
          Two phases, same shape as the shop drawer: fridgeNav=null → the
          categories you own something in; fridgeNav=<id> → every food you own
          in it. Picking a FOOD is what commits — the category list used to
          commit on its own and drop you back at the first food in the row,
          which meant arrowing through six things to reach the one you wanted. */}
      {tab === 'fridge' && (() => {
        const navCat = fridgeNav ? FRIDGE_CATEGORIES.find(c => c.id === fridgeNav) ?? null : null
        const navItems = navCat ? ownedIn(navCat.id) : []
        const closeFridge = () => { playSound('ui_modal_close'); setFridgeNav(null); setTab(null) }
        return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', animation: 'scrimIn 200ms ease-out' }}>
          <div className="w-full max-w-xs px-6" style={{ animation: 'modalPop 280ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>

            {navCat ? (
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { playSound('ui_back'); setFridgeNav(null) }}
                  className="active:scale-90 transition-transform flex-shrink-0 flex items-center justify-center"
                  style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.12)', borderRadius: 8, border: '2px solid rgba(255,255,255,0.28)' }}
                  aria-label="Back to categories">
                  <IconChevronLeft size={14} tone="rgba(255,255,255,0.8)" />
                </button>
                <span className="font-pixel" style={{ fontSize: 10, color: navCat.color, letterSpacing: 2, textShadow: `0 0 8px ${navCat.color}66` }}>
                  {navCat.label}
                </span>
              </div>
            ) : (
              <p className="font-pixel text-center mb-6" style={{ fontSize: 10, color: '#A8D8F8', letterSpacing: 2, textShadow: '0 0 8px rgba(168,216,248,0.5)' }}>
                PICK A CATEGORY
              </p>
            )}

            {navCat ? (
              /* PHASE 2 — the foods you own here. Tap takes one to the tray;
                 hold reads its stats. */
              <div className="grid grid-cols-3 gap-2">
                {navItems.map(item => {
                  const qty = inventory[item.id] ?? 0
                  return (
                    <button key={item.id}
                      {...hold.bind(item)}
                      onClick={() => {
                        if (hold.consumed()) return
                        playSound('ui_tap')
                        setFridgeCat(navCat.id)
                        setFoodIdx(navItems.findIndex(i => i.id === item.id))
                        localStorage.setItem('eren_fridge_cat', navCat.id)
                        setFridgeNav(null)
                        setTab(null)
                      }}
                      className="relative flex flex-col items-center px-1 pt-2 pb-1.5 active:scale-95 transition-transform"
                      style={{
                        background: `linear-gradient(135deg, ${item.color}22, ${item.color}0A)`,
                        borderRadius: 8,
                        border: `2px solid ${item.color}77`,
                        boxShadow: `2px 2px 0 rgba(0,0,0,0.3)`,
                      }}>
                      <FoodIcon id={item.id} color={item.color} size={44} />
                      <span className="font-pixel text-center" style={{
                        fontSize: 5, lineHeight: 1.3, marginTop: 4,
                        color: 'rgba(255,255,255,0.72)', letterSpacing: 0.3,
                      }}>
                        {item.name.toUpperCase()}
                      </span>
                      <span className="font-pixel absolute flex items-center justify-center" style={{
                        top: -5, right: -5, minWidth: 17, height: 15, padding: '0 3px',
                        background: item.color, color: inkOn(item.color),
                        borderRadius: 8, fontSize: 6,
                        border: '1.5px solid rgba(0,0,0,0.25)',
                        boxShadow: '1px 1px 0 rgba(0,0,0,0.25)',
                      }}>{qty}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
            <div className="flex flex-col gap-3">
              {fridgeItems.length === 0 ? (
                <div className="text-center">
                  <p className="font-pixel mb-4" style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>FRIDGE IS EMPTY</p>
                  <div className="flex justify-center">
                    <KitchenNavButton
                      variant="shop"
                      label="GO SHOP"
                      onClick={() => { playSound('ui_tap'); setTab('shop') }}
                    />
                  </div>
                </div>
              ) : (
                FRIDGE_CATEGORIES.map(c => {
                  const catItems = ownedIn(c.id)
                  const catCount = catItems.reduce((s, i) => s + (inventory[i.id] ?? 0), 0)
                  if (catCount === 0) return null
                  return (
                    <button key={c.id}
                      onClick={() => { playSound('ui_select'); setFridgeNav(c.id) }}
                      className="flex items-center gap-3 px-3 py-2.5 active:scale-95 transition-transform w-full"
                      style={{
                        background: `linear-gradient(135deg, ${c.color}20, ${c.color}08)`,
                        borderRadius: 10,
                        border: `2px solid ${c.color}88`,
                        boxShadow: `3px 3px 0 rgba(0,0,0,0.3), 0 0 12px ${c.color}22`,
                      }}>
                      {/* Preview what's actually IN the fridge, at a size you can
                          read — three stocked foods from this category. */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {catItems.slice(0, 3).map(i => (
                          <FoodIcon key={i.id} id={i.id} color={i.color} size={40} />
                        ))}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <span className="font-pixel block" style={{ fontSize: 9, color: c.color, letterSpacing: 1.5 }}>{c.label}</span>
                        <span className="font-pixel block" style={{ fontSize: 6, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{catCount} ITEM{catCount !== 1 ? 'S' : ''}</span>
                      </div>
                      <IconChevronRight size={11} tone={c.color} />
                    </button>
                  )
                })
              )}
            </div>
            )}

            {/* Close — icon + label so it reads as a control, with a real tap
                target instead of a thin 7px text strip. */}
            <button onClick={closeFridge}
              className="mt-6 mx-auto flex items-center gap-2 px-5 py-2.5 active:scale-95 transition-transform"
              style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, border: '2px solid rgba(255,255,255,0.28)', boxShadow: '0 2px 0 rgba(0,0,0,0.35)' }}
              aria-label="Close the fridge">
              <IconClose size={13} tone="rgba(255,255,255,0.75)" />
              <span className="font-pixel" style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', letterSpacing: 1 }}>CLOSE</span>
            </button>
          </div>
        </div>
        )
      })()}

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

          {/* Drawer header. Back / close are matched 30px pixel-icon buttons —
              they used to be bare ◂ / ✕ font glyphs at mismatched paddings and
              radii, which read as leftover text and were a ~20px tap target. */}
          <div className="flex items-center justify-between px-3 pt-2.5 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {activeCat ? (
                <button onClick={() => { playSound('ui_back'); setShopCat(null) }}
                  className="active:scale-90 transition-transform flex-shrink-0"
                  style={SHOP_HDR_BTN}
                  aria-label="Back to categories">
                  <IconChevronLeft size={15} />
                </button>
              ) : (
                <span className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 30, height: 30, background: '#F7E9B8', borderRadius: 8, border: '2px solid #E8C870' }}>
                  <ShoppingCart size={14} color="#A07020" strokeWidth={2.5} />
                </span>
              )}
              <span className="font-pixel text-amber-700 truncate" style={{ fontSize: 9, letterSpacing: 1 }}>
                {activeCat ? activeCat.label : 'SHOP'}
              </span>
            </div>
            <button onClick={closeShop}
              className="active:scale-90 transition-transform flex-shrink-0"
              style={SHOP_HDR_BTN}
              aria-label="Close shop">
              <IconClose size={15} />
            </button>
          </div>
          <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #F5C842, transparent)', marginBottom: 4 }} />

          <div className="overflow-y-auto px-3 py-2 flex-1">
            {!activeCat ? (
              /* PHASE 1 — category picker. Mirrors the fridge category list:
                 colored row per category, two preview food icons + count. */
              <div className="flex flex-col gap-2">
                {FRIDGE_CATEGORIES.map(c => {
                  // SHELF_ITEMS, not SHOP_ITEMS: the DONUTS row must count and
                  // preview what's for sale, not the whole case.
                  const catItems = SHELF_ITEMS.filter(i => i.cat === c.id)
                  const previewIcons = catItems.slice(0, 3)
                  const cheapest = catItems.reduce((min, i) => i.price < min ? i.price : min, Infinity)
                  // The label prints in its own category colour, on a pale wash
                  // of that same colour — which left tan-on-cream around 2:1.
                  const ink = deepenOn(c.color, ROW_TINT_FLOOR)
                  return (
                    <button key={c.id}
                      onClick={() => { playSound('ui_select'); setShopCat(c.id) }}
                      className="flex items-center gap-2.5 px-2.5 py-2 w-full transition-transform active:translate-y-[2px]"
                      style={{
                        background: `linear-gradient(135deg, ${c.color}26 0%, ${c.color}0D 100%)`,
                        borderRadius: 6,
                        border: `2px solid ${c.color}99`,
                        boxShadow: `3px 3px 0 ${c.color}44`,
                      }}>
                      {/* Three tasters on a little inset shelf — the art is the
                          fastest way to recognise a cuisine, and the second
                          surface stops it floating loose on the tint. */}
                      <div className="flex items-center gap-0.5 flex-shrink-0 px-1 py-0.5"
                        style={{ background: 'rgba(255,255,255,0.55)', borderRadius: 4, border: `1px solid ${c.color}40` }}>
                        {previewIcons.map(i => (
                          <FoodIcon key={i.id} id={i.id} color={i.color} size={40} />
                        ))}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <span className="font-pixel block" style={{ fontSize: 9, color: ink, letterSpacing: 1.5 }}>{c.label}</span>
                        {/* Pixel font + a real coin pip, so the meta line stops
                            reading as leftover body copy with a stray "c". */}
                        <span className="font-pixel flex items-center gap-1" style={{ fontSize: 6, color: '#9A7C58', marginTop: 4 }}>
                          {catItems.length} ITEM{catItems.length !== 1 ? 'S' : ''}
                          <span style={{ opacity: 0.45 }}>·</span>
                          FROM
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'radial-gradient(circle at 38% 35%, #FFE878, #D4A818)', border: '1px solid #B08810' }} />
                          {cheapest}
                        </span>
                      </div>
                      <IconChevronRight size={11} tone={ink} />
                    </button>
                  )
                })}
              </div>
            ) : (
              /* PHASE 2 — items in the active category. Same card layout as
                 before; just filtered to one category. */
              <div className="grid grid-cols-2 gap-2">
                {SHELF_ITEMS.filter(i => i.cat === activeCat.id).map(item => {
                  const canAfford = coins >= item.price
                  const btnBg = canAfford ? item.color : '#cccccc'
                  const buff = monstaBuff(item.id)
                  const special = SPECIAL_CAN[item.id]
                  return (
                    <div key={item.id} {...hold.bind(item)}
                      className={cn('relative flex flex-col items-center px-2.5 pt-2.5 pb-2.5 transition-all', !canAfford && 'opacity-55', special && `${special}-card`)}
                      /* One flat wash instead of a gradient, and a lighter
                         border. The food colour used to appear five times on
                         one card — gradient, border, shadow, plate, button —
                         which is what made these read as busy.
                         A special-edition can dresses itself (.rainbow-card /
                         .gold-card), so it gets no inline surface at all — an
                         inline background would win over the animated one. */
                      style={special ? undefined : { background: `${item.color}14`, borderRadius: 8, border: `2px solid ${item.color}40`, boxShadow: `2px 2px 0 ${item.color}20` }}>
                      {/* Price rides the corner so the plate keeps the centre. */}
                      <div className="absolute flex items-center gap-0.5 px-1.5 py-0.5" style={{ top: 5, right: 5, background: '#FFF3C0', borderRadius: 999, border: '1px solid #F5C842', boxShadow: '1px 1px 0 rgba(0,0,0,0.10)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle at 38% 35%, #FFE878, #D4A818)', border: '1px solid #B08810' }} />
                        <span className="font-pixel text-amber-600" style={{ fontSize: 7 }}>{item.price}</span>
                      </div>
                      {/* The food is the hero, sitting straight on the card —
                          the tinted plate behind it was a second shape
                          competing with the art. The fixed height still gives
                          every card the same footprint whatever the aspect
                          ratio, so the grid stays even. */}
                      <div className={cn('relative flex items-center justify-center flex-shrink-0', special && `${special}-can`)}
                        style={{ height: 68, marginTop: 4, marginBottom: 5 }}>
                        {special && <CanAura variant={special} box={68} />}
                        <FoodIcon id={item.id} color={item.color} size={62} />
                      </div>
                      <p className="text-center font-bold text-gray-800 leading-tight" style={{ fontSize: 12 }}>{item.name}</p>
                      <p className="text-center text-gray-400 leading-tight" style={{ fontSize: 10, marginTop: 1 }}>{item.desc}</p>
                      {/* Stat chips — colour-coded so hunger vs joy reads at a
                          glance. A Monsta swaps them for what you actually buy
                          it for: the full energy bar and its own perk. */}
                      <div className="flex justify-center gap-1 flex-wrap" style={{ marginTop: 6, marginBottom: 7 }}>
                        {buff ? <>
                          <span className="font-pixel" style={{ fontSize: 6, padding: '3px 5px', borderRadius: 4, background: '#FFF0BC', color: '#9A6A08', border: '1px solid #F0CE68' }}>ENERGY MAX</span>
                          <span className={cn('font-pixel', special && `${special}-chip`)} style={special ? undefined : { fontSize: 6, padding: '3px 5px', borderRadius: 4, background: '#E4F5DC', color: '#3E7A33', border: '1px solid #A8D598' }}>{buff.label}</span>
                        </> : <>
                          <span className="font-pixel" style={{ fontSize: 6, padding: '3px 5px', borderRadius: 4, background: '#FFE3C4', color: '#B4622A', border: '1px solid #F0B884' }}>HGR+{item.hungerD}</span>
                          {/* Ordinary food is joyless by design, and a "JOY+0"
                              chip reads as a bug rather than as a rule. */}
                          {item.happyD > 0 && (
                            <span className="font-pixel" style={{ fontSize: 6, padding: '3px 5px', borderRadius: 4, background: '#FFDCE8', color: '#C0407A', border: '1px solid #F5A8C4' }}>JOY+{item.happyD}</span>
                          )}
                        </>}
                      </div>
                      {/* Label colour is derived, not fixed: most food colours
                          are pale tints that white text vanishes into. */}
                      <button onClick={() => { if (hold.consumed()) return; playSound('ui_tap'); handleBuy(item) }} disabled={!canAfford || buying === item.id}
                        className="w-full py-2 transition-all active:translate-y-[1px] disabled:opacity-40 mt-auto"
                        style={{ background: btnBg, color: inkOn(btnBg), borderRadius: 5, border: `1px solid ${canAfford ? 'rgba(0,0,0,0.15)' : '#bbb'}`, boxShadow: canAfford ? `0 2px 0 rgba(0,0,0,0.18)` : 'none', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
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

      {/* ══ FOOD STATS ══ what a held food actually does. Above both the fridge
          overlay (50) and the shop drawer (40) — you can open it from either. */}
      {statsFor && (
        <FoodStatsCard
          item={statsFor}
          owned={inventory[statsFor.id] ?? 0}
          onClose={() => setStatsFor(null)}
        />
      )}

      <style jsx>{`
        /* ── Rainbow Monsta ────────────────────────────────────────────────
           The gacha jackpot has to look like one sitting in a grid of eight
           flat-tinted flavour cards. Three layers do it, all on compositor-
           friendly properties: a spectrum running around the border, a violet
           glow breathing under the card, and a slow bob on the can.

           Border trick: the fill is painted to padding-box and the spectrum to
           border-box, so a TRANSPARENT border reveals the gradient underneath
           — a real rounded gradient border, which border-image can't do.

           REPEATING gradient, not a single stretched one. A 2px border only
           ever shows a sliver of the gradient, so one spectrum stretched over
           the card reads as "a colour that slowly changes" rather than as a
           rainbow. Repeating it every 84px puts the whole spectrum on screen
           at once, and running it at 135deg wraps it around all four edges —
           at 90deg the left and right borders each sit on one flat hue.

           The 118.79px numbers are that 84px period divided by sin(135deg):
           a shift along x moves a 135deg pattern along its own axis by
           x·sin(135deg), so 118.79px is exactly one period. It has to be BOTH
           the background-size and the travel — a gradient image tiles, and
           each tile re-anchors the gradient to its own box, so any other tile
           width puts a phase jump at every tile edge (measured: 947 seam
           pixels before the size was pinned).

           Kept in this scoped block rather than the contended globals.css. */
        .rainbow-card {
          border: 2px solid transparent;
          border-radius: 8px;
          background:
            linear-gradient(#FFFAFF, #FFF4FC) padding-box,
            repeating-linear-gradient(135deg, #FF4D6D 0px, #FF9A3D 14px, #FFE23D 28px, #4BE07A 42px, #35C7F5 56px, #A65CF6 70px, #FF4D6D 84px) border-box;
          background-size: auto, 118.79px 100%;
          animation: rainbowRun 2.6s linear infinite, rainbowGlow 2.8s ease-in-out infinite;
        }
        .rainbow-tile {
          border: 2px solid transparent;
          border-radius: 12px;
          background:
            radial-gradient(circle at 40% 35%, rgba(255,255,255,0.22), rgba(255,255,255,0.05)) padding-box,
            repeating-linear-gradient(135deg, #FF4D6D 0px, #FF9A3D 14px, #FFE23D 28px, #4BE07A 42px, #35C7F5 56px, #A65CF6 70px, #FF4D6D 84px) border-box;
          background-size: auto, 118.79px 100%;
          animation: rainbowRun 2.6s linear infinite, rainbowGlow 2.8s ease-in-out infinite;
        }
        /* Dark fill, not a rainbow one: 6px pixel type on a full spectrum is
           unreadable at any text colour. The spectrum goes on the border. */
        .rainbow-chip {
          font-size: 6px;
          padding: 3px 5px;
          border-radius: 4px;
          color: #FFFFFF;
          letter-spacing: 0.5px;
          border: 1px solid transparent;
          background:
            linear-gradient(#2E1F45, #2E1F45) padding-box,
            repeating-linear-gradient(135deg, #FF4D6D 0px, #FF9A3D 14px, #FFE23D 28px, #4BE07A 42px, #35C7F5 56px, #A65CF6 70px, #FF4D6D 84px) border-box;
          background-size: auto, 118.79px 100%;
          animation: rainbowRun 2.6s linear infinite;
        }
        .rainbow-can {
          animation: rainbowBob 3.2s ease-in-out infinite;
          /* It used to bob with no light on it, which read flatter than its
             own card. Matches the lift .gold-can gets below. */
          filter: drop-shadow(0 0 6px rgba(166,92,246,0.5));
        }
        @keyframes rainbowRun {
          from { background-position: 0 0, 0        0; }
          to   { background-position: 0 0, 118.79px 0; }
        }
        @keyframes rainbowGlow {
          0%, 100% { box-shadow: 0 0 5px 0 rgba(166,92,246,0.28); }
          50%      { box-shadow: 0 0 16px 4px rgba(166,92,246,0.62); }
        }
        @keyframes rainbowBob {
          0%, 100% { transform: translateY(0)    rotate(0deg);    }
          50%      { transform: translateY(-4px) rotate(-1.5deg); }
        }
        /* ── GOLD — the other SPECIAL EDITION. Same construction as the
           rainbow above (animated border-box gradient + padding-box fill), so
           the two read as a matched pair rather than two unrelated effects.
           The travel is the same 118.79px one-period figure the rainbow
           derives at length up there; a different width puts a phase jump at
           every tile edge. What differs is the palette — a narrow bullion
           ramp, dark-lit-dark, so it reads as METAL rather than as a yellow
           rainbow — and a brighter, slower glow. */
        .gold-card {
          border: 2px solid transparent;
          border-radius: 8px;
          background:
            linear-gradient(#FFFDF4, #FFF6E0) padding-box,
            repeating-linear-gradient(135deg, #8A6410 0px, #D4A818 14px, #FFF3C0 28px, #F5C842 42px, #A8760F 56px, #E8B923 70px, #8A6410 84px) border-box;
          background-size: auto, 118.79px 100%;
          animation: goldRun 3.4s linear infinite, goldGlow 2.8s ease-in-out infinite;
        }
        .gold-tile {
          border: 2px solid transparent;
          border-radius: 12px;
          background:
            radial-gradient(circle at 40% 35%, rgba(255,240,190,0.26), rgba(255,220,120,0.06)) padding-box,
            repeating-linear-gradient(135deg, #8A6410 0px, #D4A818 14px, #FFF3C0 28px, #F5C842 42px, #A8760F 56px, #E8B923 70px, #8A6410 84px) border-box;
          background-size: auto, 118.79px 100%;
          animation: goldRun 3.4s linear infinite, goldGlow 2.8s ease-in-out infinite;
        }
        /* Dark fill for the same reason as .rainbow-chip: 6px pixel type on a
           bright metal ramp is unreadable at any text colour. */
        .gold-chip {
          font-size: 6px;
          padding: 3px 5px;
          border-radius: 4px;
          color: #FFF3C0;
          letter-spacing: 0.5px;
          border: 1px solid transparent;
          background:
            linear-gradient(#3A2A08, #3A2A08) padding-box,
            repeating-linear-gradient(135deg, #8A6410 0px, #D4A818 14px, #FFF3C0 28px, #F5C842 42px, #A8760F 56px, #E8B923 70px, #8A6410 84px) border-box;
          background-size: auto, 118.79px 100%;
          animation: goldRun 3.4s linear infinite;
        }
        /* Heavier than the rainbow's bob — gold should feel like it weighs
           something. Its sheen sweep is the shine the rainbow gets from hue. */
        .gold-can {
          animation: goldBob 3.6s ease-in-out infinite;
          filter: drop-shadow(0 0 6px rgba(245,200,66,0.55));
        }
        @keyframes goldRun {
          from { background-position: 0 0, 0        0; }
          to   { background-position: 0 0, 118.79px 0; }
        }
        @keyframes goldGlow {
          0%, 100% { box-shadow: 0 0 6px 0 rgba(245,200,66,0.30); }
          50%      { box-shadow: 0 0 18px 5px rgba(245,200,66,0.66); }
        }
        @keyframes goldBob {
          0%, 100% { transform: translateY(0)    rotate(0deg);   }
          50%      { transform: translateY(-3px) rotate(1.2deg); }
        }

        /* Respect the OS setting: the spectrum stays, the motion stops. */
        @media (prefers-reduced-motion: reduce) {
          .rainbow-card, .rainbow-tile, .rainbow-chip, .rainbow-can,
          .gold-card, .gold-tile, .gold-chip, .gold-can { animation: none; }
        }

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

      {/* SPECIAL EDITION unlock — sits above everything, including the shop
          drawer, because it's the payoff for the can that just went down. */}
      {unlock && (
        <SkinUnlockCinematic
          skin={unlock.skin}
          variant={unlock.variant}
          drinkName={unlock.drinkName}
          onWear={() => {
            if (profile?.household_id) void wearSkinEverywhere(profile.household_id, unlock.skin.id)
            setUnlock(null)
            showToast(`Now wearing ${unlock.skin.name}!`)
          }}
          onClose={() => {
            setUnlock(null)
            showToast(`${unlock.skin.name} is in your closet`)
          }}
        />
      )}
    </div>
  )
}
