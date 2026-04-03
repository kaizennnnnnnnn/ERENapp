'use client'

import { useState } from 'react'
import { ChevronLeft, ShoppingCart, Package } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'
import type { FoodInventory } from '@/types'

interface Props { onClose: () => void }

const SHOP_ITEMS = [
  { id: 'kibble' as const, name: 'Kibble',    price: 5,  hungerD: 15, happyD: 3,  weightD: 0.03, desc: 'Daily dry food',    color: '#F5C842' },
  { id: 'fish'   as const, name: 'Fish',      price: 12, hungerD: 25, happyD: 12, weightD: 0.05, desc: "Eren's favourite!", color: '#6BAED6' },
  { id: 'treat'  as const, name: 'Cat Treat', price: 8,  hungerD: 8,  happyD: 20, weightD: 0.01, desc: 'Sweet & crunchy',   color: '#FF6B9D' },
  { id: 'tuna'   as const, name: 'Tuna Can',  price: 18, hungerD: 30, happyD: 15, weightD: 0.06, desc: 'Premium quality',   color: '#E8A020' },
  { id: 'steak'  as const, name: 'Steak',     price: 30, hungerD: 40, happyD: 25, weightD: 0.10, desc: 'Luxury cut',        color: '#CC3333' },
  { id: 'cream'  as const, name: 'Cream',     price: 10, hungerD: 10, happyD: 30, weightD: 0.02, desc: 'Sweet treat',       color: '#A78BFA' },
]

function FoodIcon({ id, color }: { id: string; color: string }) {
  if (id === 'kibble') return (
    <div style={{ width: 32, height: 32, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 14, borderRadius: '3px 3px 50% 50%', background: `linear-gradient(180deg, ${color}DD, ${color}88)`, border: `2px solid ${color}`, position: 'relative' }}>
        {[0,1,2,3].map(k => <div key={k} style={{ position: 'absolute', bottom: 2, left: 3 + k * 5, width: 3, height: 3, borderRadius: '50%', background: `${color}99` }} />)}
      </div>
    </div>
  )
  if (id === 'fish') return (
    <div style={{ width: 32, height: 32, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 20, height: 14, borderRadius: '50% 40% 40% 50%', background: `linear-gradient(135deg, ${color}EE, ${color}88)`, border: `1.5px solid ${color}` }} />
      <div style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: `10px solid ${color}BB` }} />
      <div style={{ position: 'absolute', left: 8, top: '35%', width: 3, height: 3, borderRadius: '50%', background: '#1A1A2A' }} />
    </div>
  )
  if (id === 'treat') return (
    <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 18, height: 18, borderRadius: '4px', background: `linear-gradient(135deg, ${color}EE, ${color}77)`, border: `1.5px solid ${color}`, transform: 'rotate(15deg)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderRadius: 2, border: `1px solid ${color}55` }} />
      </div>
    </div>
  )
  if (id === 'tuna') return (
    <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: 26, height: 18 }}>
        <div style={{ width: '100%', height: '80%', marginTop: 2, background: `linear-gradient(180deg, ${color}DD, ${color}88)`, borderRadius: 3, border: `1.5px solid ${color}`, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 1, left: 3, right: 3, height: 2, background: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
        </div>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 18, height: 4, background: `${color}CC`, borderRadius: '2px 2px 0 0', border: `1px solid ${color}` }} />
      </div>
    </div>
  )
  if (id === 'steak') return (
    <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 26, height: 18, background: `linear-gradient(135deg, ${color}EE, ${color}88)`, borderRadius: '40% 50% 45% 55%', border: `1.5px solid ${color}`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 4, left: 4, right: 4, height: 2, background: 'rgba(255,200,180,0.4)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: 8, left: 6, right: 6, height: 2, background: 'rgba(255,200,180,0.3)', borderRadius: 2 }} />
      </div>
    </div>
  )
  // cream
  return (
    <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: 20 }}>
        <div style={{ width: 20, height: 10, borderRadius: '50% 50% 0 0', background: `linear-gradient(180deg, white, ${color}55)`, border: `1.5px solid ${color}`, borderBottom: 'none' }} />
        <div style={{ width: 20, height: 12, background: `linear-gradient(180deg, ${color}CC, ${color}88)`, borderRadius: '2px 2px 4px 4px', border: `1.5px solid ${color}` }}>
          <div style={{ position: 'absolute', top: 1, left: 3, right: 3, height: 2, background: 'rgba(255,255,255,0.35)', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  )
}

export default function FeedScene({ onClose }: Props) {
  const { user, profile } = useAuth()
  const { stats, feedWithFood, spendCoins, saveFoodInventory } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()

  const [tab, setTab] = useState<'shop' | 'fridge' | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const [feeding, setFeeding] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [eatAnim, setEatAnim] = useState(false)

  const coins = stats?.coins ?? 0
  const inventory: FoodInventory = stats?.food_inventory ?? {}
  const fridgeItems = SHOP_ITEMS.filter(i => (inventory[i.id] ?? 0) > 0)
  const mood = eatAnim ? 'happy' : (stats?.hunger ?? 100) < 40 ? 'hungry' : 'idle'

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2200)
  }

  async function handleBuy(item: typeof SHOP_ITEMS[number]) {
    if (buying || coins < item.price) return
    setBuying(item.id)
    const ok = await spendCoins(item.price)
    if (ok) {
      const newInv = { ...inventory, [item.id]: (inventory[item.id] ?? 0) + 1 }
      await saveFoodInventory(newInv)
      showToast(`Bought ${item.name}! Check the fridge`)
    } else {
      showToast('Not enough coins!', false)
    }
    setBuying(null)
  }

  async function handleFeed(item: typeof SHOP_ITEMS[number]) {
    if (!user?.id || feeding) return
    setFeeding(item.id)
    const newInv = { ...inventory, [item.id]: Math.max(0, (inventory[item.id] ?? 0) - 1) }
    await saveFoodInventory(newInv)
    const result = await feedWithFood(user.id, item.hungerD, item.happyD, item.weightD)
    setEatAnim(true)
    setTimeout(() => setEatAnim(false), 2000)
    showToast(result.message, result.success)
    setFeeding(null)
    if (result.success) completeTask('daily_feed')
  }

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none">

      {/* ══ WALL — warm cream with subtle linen texture ══ */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #FDF5E0 0%, #F5E8C0 100%)' }} />
      {/* Subtle horizontal stripe wallpaper */}
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${i * 7}%`, height: 1, background: 'rgba(180,140,60,0.06)' }} />
      ))}

      {/* ══ WARM SUNLIGHT from window ══ */}
      <div className="absolute pointer-events-none" style={{ top: 0, left: '50%', transform: 'translateX(-50%)', width: 220, height: 260, background: 'radial-gradient(ellipse at 50% 0%, rgba(255,230,140,0.28) 0%, transparent 70%)' }} />

      {/* ══ CEILING TRIM ══ */}
      <div className="absolute top-0 left-0 right-0" style={{ height: 6, background: 'linear-gradient(180deg, #E8D098 0%, #D4BC78 100%)', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} />

      {/* ══ RECESSED CEILING LIGHTS ══ */}
      {[28, 50, 72].map(pct => (
        <div key={pct} className="absolute pointer-events-none" style={{ top: 6, left: `${pct}%`, transform: 'translateX(-50%)', width: 44, height: 10 }}>
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #D8CCA0, #C8B880)', borderRadius: '0 0 3px 3px', border: '1px solid #B8A868', borderTop: 'none', position: 'relative' }}>
            {/* Light panel inset */}
            <div style={{ position: 'absolute', inset: '2px 4px', background: 'linear-gradient(180deg, #FFF8E0, #FFE898)', borderRadius: 2, boxShadow: '0 4px 18px 6px rgba(255,230,120,0.28)' }}>
              <div style={{ position: 'absolute', inset: 1, background: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
            </div>
          </div>
          {/* Downward glow cone */}
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '28px solid transparent', borderRight: '28px solid transparent', borderTop: '30px solid rgba(255,230,120,0.07)' }} />
        </div>
      ))}

      {/* ══ FLOOR — warm checkerboard tiles ══ */}
      <div className="absolute left-0 right-0 bottom-0" style={{ height: '45%' }}>
        {Array.from({ length: 20 }).map((_, i) => {
          const col = i % 5, row = Math.floor(i / 4)
          return (
            <div key={i} className="absolute" style={{
              left: `${col * 20}%`, top: `${row * 25}%`, width: '20%', height: '28%',
              background: (col + row) % 2 === 0
                ? 'linear-gradient(135deg, #F0D898 0%, #E8C878 100%)'
                : 'linear-gradient(135deg, #D8B860 0%, #C8A848 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(160,120,40,0.2)',
            }} />
          )
        })}
        {/* Floor gloss reflection */}
        <div className="absolute top-0 left-0 right-0" style={{ height: 18, background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 100%)' }} />
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 30, background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.08) 100%)' }} />
      </div>

      {/* ══ BASEBOARD — dark wood ══ */}
      <div className="absolute left-0 right-0" style={{ bottom: '44%', height: 9 }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #9B6830 0%, #7A4A18 100%)', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
        <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: 'rgba(255,220,150,0.3)' }} />
      </div>

      {/* ══ LEFT UPPER CABINET ══ */}
      <div className="absolute left-0 top-0" style={{ width: '24%', height: '32%', background: 'linear-gradient(180deg, #C07828 0%, #9A5A18 100%)', borderRight: '5px solid #6B3A10', borderBottom: '6px solid #6B3A10', boxShadow: '3px 0 8px rgba(0,0,0,0.15)' }}>
        {/* Wood grain lines */}
        {[20,40,60,80].map(y => <div key={y} className="absolute left-0 right-0" style={{ top: `${y}%`, height: 1, background: 'rgba(0,0,0,0.06)' }} />)}
        <div className="absolute inset-2 flex gap-1.5">
          {[0, 1].map(d => (
            <div key={d} className="flex-1 h-full relative" style={{ background: 'linear-gradient(135deg, #C88030 0%, #A86020 100%)', border: '2px solid #6B3A10', borderRadius: 2 }}>
              <div className="absolute inset-2 border border-[#7A4A18] opacity-30 rounded-sm" />
              {/* Inner panel bevel */}
              <div className="absolute inset-x-2 top-2 h-px" style={{ background: 'rgba(255,200,100,0.3)' }} />
              <div className="absolute" style={{ [d === 0 ? 'right' : 'left']: 5, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #FFE878, #C09018)', border: '1px solid #906810', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
          ))}
        </div>
        {/* Under-cabinet shadow strip */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 6, background: 'linear-gradient(180deg, rgba(0,0,0,0.25), transparent)' }} />
      </div>

      {/* ══ RIGHT UPPER CABINET ══ */}
      <div className="absolute right-0 top-0" style={{ width: '24%', height: '32%', background: 'linear-gradient(180deg, #C07828 0%, #9A5A18 100%)', borderLeft: '5px solid #6B3A10', borderBottom: '6px solid #6B3A10', boxShadow: '-3px 0 8px rgba(0,0,0,0.15)' }}>
        {[20,40,60,80].map(y => <div key={y} className="absolute left-0 right-0" style={{ top: `${y}%`, height: 1, background: 'rgba(0,0,0,0.06)' }} />)}
        <div className="absolute inset-2 flex gap-1.5">
          {[0, 1].map(d => (
            <div key={d} className="flex-1 h-full relative" style={{ background: 'linear-gradient(135deg, #C88030 0%, #A86020 100%)', border: '2px solid #6B3A10', borderRadius: 2 }}>
              <div className="absolute inset-2 border border-[#7A4A18] opacity-30 rounded-sm" />
              <div className="absolute inset-x-2 top-2 h-px" style={{ background: 'rgba(255,200,100,0.3)' }} />
              <div className="absolute" style={{ [d === 0 ? 'right' : 'left']: 5, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #FFE878, #C09018)', border: '1px solid #906810', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 6, background: 'linear-gradient(180deg, rgba(0,0,0,0.25), transparent)' }} />
      </div>

      {/* ══ STOVE / RANGE — left of center ══ */}
      <div className="absolute" style={{ left: '2%', bottom: '44%', width: 58, height: 68 }}>
        {/* Stove body */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #E8E0D0 0%, #D4C8B0 100%)', border: '2px solid #B8A880', borderRadius: '4px 4px 0 0', boxShadow: '2px 0 6px rgba(0,0,0,0.12)' }}>
          {/* Burner grid */}
          {[[15,12],[40,12],[15,38],[40,38]].map(([cx,cy],i) => (
            <div key={i} className="absolute rounded-full" style={{ left: cx, top: cy, width: 16, height: 16, background: 'radial-gradient(circle, #8A7860 0%, #6A5840 100%)', border: '2px solid #584830', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}>
              <div className="absolute inset-2 rounded-full" style={{ background: '#4A3820', border: '1px solid #3A2810' }} />
            </div>
          ))}
          {/* Oven door */}
          <div className="absolute left-2 right-2" style={{ bottom: 4, height: 22, background: 'linear-gradient(180deg, #C8C0B0, #B8B0A0)', border: '1px solid #A09080', borderRadius: 2 }}>
            <div className="absolute inset-1 rounded-sm" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)', border: '1px solid #3A3A3A' }}>
              {/* Oven light */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div style={{ width: 12, height: 8, borderRadius: 3, background: 'rgba(255,180,60,0.15)', border: '1px solid rgba(255,150,30,0.3)' }} />
              </div>
            </div>
          </div>
          {/* Control panel strip */}
          <div className="absolute left-0 right-0" style={{ top: 0, height: 10, background: 'linear-gradient(180deg, #D4CCBC, #C4BCA8)', borderRadius: '3px 3px 0 0', borderBottom: '1px solid #A09880' }}>
            {[10,25,40].map(x => (
              <div key={x} className="absolute" style={{ top: 1, left: x, width: 8, height: 8, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #E0D8C8, #B0A888)', border: '1px solid #9A9070', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            ))}
          </div>
        </div>
        {/* Range hood */}
        <div className="absolute" style={{ bottom: '100%', left: -4, right: -4, height: 20, background: 'linear-gradient(180deg, #C8C0B0, #B0A890)', borderRadius: '4px 4px 0 0', border: '1px solid #A09080', boxShadow: '0 -2px 6px rgba(0,0,0,0.1)' }}>
          <div className="absolute bottom-0 left-0 right-0" style={{ height: 4, background: 'rgba(0,0,0,0.1)' }} />
          <div className="absolute" style={{ bottom: 6, left: '50%', transform: 'translateX(-50%)', width: 20, height: 3, background: 'rgba(255,180,60,0.6)', borderRadius: 2, boxShadow: '0 0 6px 2px rgba(255,160,40,0.4)' }} />
        </div>
      </div>

      {/* ══ COUNTER + BACKSPLASH ══ */}
      <div className="absolute left-0 right-0" style={{ bottom: '52%', height: '10%' }}>
        {/* Subway backsplash tiles */}
        {Array.from({ length: 22 }).map((_, i) => {
          const col = i % 11, row = Math.floor(i / 11)
          const offset = row % 2 === 0 ? 0 : (100 / 22)
          return (
            <div key={i} className="absolute" style={{
              left: `${col * (100 / 11) + offset}%`, top: `${row * 50}%`,
              width: `${100 / 11 - 0.4}%`, height: '50%',
              background: row === 0 ? 'linear-gradient(135deg, #F8F0D8 0%, #EEE4C8 100%)' : 'linear-gradient(135deg, #F5EDD0 0%, #EADED8 100%)',
              border: '1px solid #D8C890',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }} />
          )
        })}
        {/* Decorative tile accent strip */}
        <div className="absolute left-0 right-0 bottom-[40%]" style={{ height: 5, background: 'repeating-linear-gradient(90deg, #D4A040 0px, #D4A040 8px, #E8B850 8px, #E8B850 16px)', opacity: 0.7 }} />
        {/* Counter surface — marble effect */}
        <div className="absolute left-0 right-0 bottom-0" style={{ height: '42%', background: 'linear-gradient(180deg, #E8DEB8 0%, #D0C698 100%)', borderTop: '3px solid #EEE4C0', boxShadow: '0 4px 10px rgba(0,0,0,0.22)' }}>
          {/* Marble veins */}
          <div className="absolute" style={{ top: 2, left: '15%', width: '40%', height: 1, background: 'rgba(180,160,100,0.4)', transform: 'rotate(-2deg)' }} />
          <div className="absolute" style={{ top: 5, left: '55%', width: '30%', height: 1, background: 'rgba(180,160,100,0.3)', transform: 'rotate(1deg)' }} />
          {/* Counter edge highlight */}
          <div className="absolute top-0 left-0 right-0" style={{ height: 2, background: 'rgba(255,255,255,0.5)' }} />
        </div>
      </div>

      {/* ══ WINDOW — center top ══ */}
      <div className="absolute" style={{ top: '3%', left: '50%', transform: 'translateX(-50%)', width: 128, height: 98 }}>
        {/* Frame */}
        <div className="absolute inset-0" style={{ background: '#9A6020', padding: 7, borderRadius: 3, boxShadow: '0 4px 14px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,200,100,0.2)' }}>
          {/* Glass */}
          <div className="w-full h-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #C8E8FF 0%, #A8D8FF 55%, #5CAE5C 55%, #48984A 100%)' }}>
            {/* Sky gradient */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #B8E8FF 55%, transparent 55%)' }} />
            {/* Sun */}
            <div className="absolute" style={{ top: 7, right: 12, width: 24, height: 24, borderRadius: '50%', background: 'radial-gradient(circle at 40% 40%, #FFEE88, #F5C030)', boxShadow: '0 0 16px 6px rgba(255,220,50,0.5)' }} />
            {/* Clouds */}
            <div className="absolute" style={{ top: 10, left: 5, width: 30, height: 12, borderRadius: 8, background: 'rgba(255,255,255,0.92)' }} />
            <div className="absolute" style={{ top: 7, left: 12, width: 20, height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.92)' }} />
            {/* Grass */}
            <div className="absolute bottom-0 left-0 right-0" style={{ height: '45%', background: 'linear-gradient(180deg, #66BB66 0%, #4A9E4A 100%)' }} />
            {/* Tree */}
            <div className="absolute bottom-4 right-5" style={{ width: 4, height: 16, background: '#6B4020' }} />
            <div className="absolute" style={{ bottom: 14, right: 1, width: 20, height: 18, borderRadius: '50%', background: 'radial-gradient(circle, #5DBB5D, #3A8A3A)' }} />
          </div>
          {/* Window cross bars */}
          <div className="absolute inset-0 flex" style={{ padding: 7 }}><div className="flex-1 border-r-2 border-[#9A6020]" /></div>
          <div className="absolute inset-0 flex flex-col" style={{ padding: 7 }}><div className="flex-1 border-b-2 border-[#9A6020]" /></div>
        </div>
        {/* Sill */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 9, background: 'linear-gradient(180deg, #B07830, #8A5A18)', borderRadius: '0 0 3px 3px', boxShadow: '0 3px 6px rgba(0,0,0,0.2)' }} />
        {/* Curtain valance rod */}
        <div className="absolute" style={{ top: -5, left: -18, right: -18, height: 5, background: 'linear-gradient(180deg, #C09040, #9A7020)', borderRadius: 3, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
          {/* Rod end caps */}
          <div style={{ position: 'absolute', left: -3, top: -2, width: 6, height: 9, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #F0C840, #B09020)', border: '1px solid #907010' }} />
          <div style={{ position: 'absolute', right: -3, top: -2, width: 6, height: 9, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #F0C840, #B09020)', border: '1px solid #907010' }} />
        </div>
        {/* Valance fabric swag */}
        <div className="absolute pointer-events-none" style={{ top: 0, left: -16, right: -16, height: 18, overflow: 'visible' }}>
          <svg width="100%" height="18" viewBox="0 0 156 18" preserveAspectRatio="none">
            <path d="M0,2 Q20,14 40,6 Q60,0 78,10 Q96,18 116,6 Q136,0 156,4" stroke="none" fill="#D86030" opacity="0.88" />
            <path d="M0,2 Q20,14 40,6 Q60,0 78,10 Q96,18 116,6 Q136,0 156,4 L156,0 L0,0 Z" fill="#E87040" opacity="0.4" />
          </svg>
        </div>
        {/* Curtains */}
        <div className="absolute -left-5 top-0 bottom-0 w-7 rounded-r-xl" style={{ background: 'linear-gradient(160deg, #E87040 0%, #C85020 70%, #B04018 100%)', opacity: 0.9, boxShadow: '2px 0 6px rgba(0,0,0,0.15)' }}>
          {[0.2,0.45,0.7].map(y => <div key={y} className="absolute left-0 right-0" style={{ top: `${y*100}%`, height: 2, background: 'rgba(0,0,0,0.08)' }} />)}
        </div>
        <div className="absolute -right-5 top-0 bottom-0 w-7 rounded-l-xl" style={{ background: 'linear-gradient(200deg, #E87040 0%, #C85020 70%, #B04018 100%)', opacity: 0.9, boxShadow: '-2px 0 6px rgba(0,0,0,0.15)' }}>
          {[0.2,0.45,0.7].map(y => <div key={y} className="absolute left-0 right-0" style={{ top: `${y*100}%`, height: 2, background: 'rgba(0,0,0,0.08)' }} />)}
        </div>
        {/* Herb pots on sill — CSS */}
        <div className="absolute" style={{ bottom: 0, right: -16, width: 14 }}>
          <div style={{ width: 10, height: 9, background: 'linear-gradient(180deg, #C06040, #9A4020)', borderRadius: '2px 2px 4px 4px', border: '1px solid #803010', margin: '0 auto', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -2, left: -1, right: -1, height: 3, background: '#D07050', borderRadius: 1 }} />
          </div>
          {[[-2,-8,25],[0,-12,-15],[3,-7,10]].map(([lx,ly,rot], i) => (
            <div key={i} style={{ position: 'absolute', bottom: 9, left: 3 + lx, width: 8, height: 11, background: 'linear-gradient(180deg, #60D050, #42B030)', borderRadius: '50% 50% 30% 70%', border: '1px solid #30A020', transform: `rotate(${rot}deg)`, transformOrigin: 'bottom center' }} />
          ))}
        </div>
        <div className="absolute" style={{ bottom: 0, left: -16, width: 14 }}>
          <div style={{ width: 10, height: 8, background: 'linear-gradient(180deg, #C06040, #9A4020)', borderRadius: '2px 2px 4px 4px', border: '1px solid #803010', margin: '0 auto', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -2, left: -1, right: -1, height: 3, background: '#D07050', borderRadius: 1 }} />
          </div>
          {[[-2,-7,20],[1,-11,-10],[3,-6,12]].map(([lx,ly,rot], i) => (
            <div key={i} style={{ position: 'absolute', bottom: 8, left: 2 + lx, width: 7, height: 10, background: 'linear-gradient(180deg, #50C040, #38A028)', borderRadius: '50% 50% 30% 70%', border: '1px solid #28921A', transform: `rotate(${rot}deg)`, transformOrigin: 'bottom center' }} />
          ))}
        </div>
      </div>

      {/* ══ PENDANT LAMP ══ */}
      <div className="absolute pointer-events-none" style={{ top: 0, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5 }}>
        {/* Cord */}
        <div style={{ width: 2, height: 36, background: 'linear-gradient(180deg, #5A3808, #7A5020)' }} />
        {/* Shade */}
        <div style={{ width: 54, height: 34, borderRadius: '50% 50% 4px 4px', background: 'linear-gradient(180deg, #A85C08 0%, #C07010 30%, #E8A020 100%)', border: '2px solid #8B5010', boxShadow: '0 10px 32px 12px rgba(245,190,50,0.35), inset 0 2px 4px rgba(255,220,100,0.3)' }}>
          {/* Shade highlight */}
          <div style={{ position: 'absolute', top: 4, left: 8, width: 14, height: 4, borderRadius: 4, background: 'rgba(255,230,140,0.4)' }} />
        </div>
        {/* Light cone */}
        <div style={{ width: 0, height: 0, borderLeft: '40px solid transparent', borderRight: '40px solid transparent', borderTop: '28px solid rgba(255,220,100,0.10)' }} />
      </div>

      {/* ══ WALL CLOCK ══ */}
      <div className="absolute pointer-events-none" style={{ top: '34%', left: '26%' }}>
        <div className="relative" style={{ width: 32, height: 32 }}>
          <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 40% 35%, #FFF8F0, #E8D8C0)', border: '3px solid #8B6030', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} />
          {/* Clock hands */}
          <div className="absolute" style={{ top: '50%', left: '50%', width: 1.5, height: 9, background: '#4A3020', transformOrigin: 'bottom', transform: 'translate(-50%, -100%) rotate(15deg)' }} />
          <div className="absolute" style={{ top: '50%', left: '50%', width: 1, height: 7, background: '#6A4030', transformOrigin: 'bottom', transform: 'translate(-50%, -100%) rotate(110deg)' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#4A3020' }} />
          </div>
        </div>
      </div>

      {/* ══ HANGING UTENSILS ══ */}
      <div className="absolute pointer-events-none" style={{ left: '26%', top: '32%' }}>
        {[
          { w: 3, h: 22, bg: '#C0B090', top: 0, left: 0 },
          { w: 4, h: 18, bg: '#C8B898', top: 0, left: 8 },
          { w: 3, h: 24, bg: '#B8A880', top: 0, left: 16 },
        ].map((u, i) => (
          <div key={i} className="absolute" style={{ top: u.top, left: u.left, width: u.w, height: u.h, background: u.bg, borderRadius: `${u.w}px ${u.w}px 2px 2px`, boxShadow: '1px 1px 2px rgba(0,0,0,0.15)' }} />
        ))}
        {/* Rack rod */}
        <div style={{ position: 'absolute', top: -2, left: -2, right: -2, height: 3, background: '#9A8060', borderRadius: 2 }} />
      </div>

      {/* ══ FRIDGE ══ */}
      <div className="absolute right-2" style={{ top: '30%', width: 72, bottom: '45%', borderRadius: '6px 6px 0 0', background: 'linear-gradient(135deg, #F6F4F0 0%, #E8E4E0 50%, #F2F0EC 100%)', border: '3px solid #C8C4BC', boxShadow: '3px 0 12px rgba(0,0,0,0.15)' }}>
        {/* Freezer compartment */}
        <div className="absolute left-0 right-0 top-0" style={{ height: '36%', background: 'linear-gradient(180deg, #E4E0D8, #D8D4CC)', borderBottom: '2px solid #B8B4AC', borderRadius: '4px 4px 0 0' }}>
          <div className="absolute" style={{ top: 9, right: 8, width: 5, height: 20, background: 'linear-gradient(180deg, #C8C4BC, #A8A4A0)', borderRadius: 3, boxShadow: 'inset 1px 0 1px rgba(255,255,255,0.3)' }} />
          {/* CSS snowflake */}
          <div className="absolute" style={{ top: 8, left: '50%', transform: 'translateX(-50%)', width: 18, height: 18 }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)', background: '#88C4E8', borderRadius: 1 }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, transform: 'translateX(-50%)', background: '#88C4E8', borderRadius: 1 }} />
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%) rotate(45deg)', background: 'rgba(136,196,232,0.65)', borderRadius: 1 }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, transform: 'translateX(-50%) rotate(45deg)', background: 'rgba(136,196,232,0.65)', borderRadius: 1 }} />
          </div>
        </div>
        {/* Main fridge section */}
        <div className="absolute left-0 right-0" style={{ top: '36%', bottom: 0 }}>
          <div className="absolute" style={{ top: 9, right: 8, width: 5, height: 28, background: 'linear-gradient(180deg, #C8C4BC, #A8A4A0)', borderRadius: 3, boxShadow: 'inset 1px 0 1px rgba(255,255,255,0.3)' }} />
          {/* Shelves */}
          {[28, 52, 74].map(y => (
            <div key={y} className="absolute left-1 right-1" style={{ top: `${y}%`, height: 2, background: 'linear-gradient(180deg, #C0C0B8, #B0B0A8)', borderRadius: 1 }} />
          ))}
          {/* Door seal line */}
          <div className="absolute" style={{ top: '10%', left: 3, right: 3, bottom: '10%', border: '1px solid rgba(180,176,168,0.4)', borderRadius: 2 }} />
        </div>
        {/* Fridge door handle highlight */}
        <div className="absolute left-0 top-0 bottom-0" style={{ width: 4, background: 'linear-gradient(90deg, rgba(255,255,255,0.25), transparent)' }} />
      </div>

      {/* ══ KITCHEN SINK (right side of counter) ══ */}
      <div className="absolute pointer-events-none" style={{ bottom: '52%', right: '2%', width: 68 }}>
        {/* Sink counter extension */}
        <div style={{ height: 6, background: 'linear-gradient(180deg, #E8DEB8, #D0C698)', borderTop: '3px solid #EEE4C0', borderRadius: '2px 2px 0 0' }} />
        {/* Stainless steel basin */}
        <div style={{ height: 28, background: 'linear-gradient(135deg, #D8DCDC 0%, #B8C0C0 40%, #C8D0D0 100%)', border: '2px solid #A0ACAC', borderTop: 'none', borderRadius: '0 0 6px 6px', position: 'relative', boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.12)' }}>
          {/* Inner basin shadow */}
          <div style={{ position: 'absolute', inset: 4, borderRadius: '0 0 4px 4px', background: 'radial-gradient(ellipse at center bottom, rgba(80,100,100,0.1) 0%, transparent 60%)' }} />
          {/* Rim gloss */}
          <div style={{ position: 'absolute', top: 0, left: 4, right: 4, height: 2, background: 'rgba(255,255,255,0.55)', borderRadius: 2 }} />
          {/* Drain */}
          <div style={{ position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', width: 12, height: 6, borderRadius: '50%', background: '#909898', border: '1px solid #707878' }}>
            {[0,1,2].map(li => <div key={li} style={{ position: 'absolute', top: '40%', left: `${22 + li * 20}%`, width: 1.5, height: '20%', background: '#606868' }} />)}
          </div>
          {/* Chrome faucet */}
          <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', width: 20, height: 16 }}>
            {/* Base */}
            <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 14, height: 5, background: 'linear-gradient(180deg, #E0E0E0, #B8B8B8)', borderRadius: '3px 3px 2px 2px', border: '1px solid #A0A0A0' }} />
            {/* Neck */}
            <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 12, background: 'linear-gradient(90deg, #D0D0D0, #F0F0F0, #D0D0D0)', borderRadius: 2 }} />
            {/* Spout arc */}
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, height: 5, borderRadius: '4px 4px 0 0', borderTop: '3px solid #D0D0D0', borderLeft: '3px solid #D0D0D0', borderRight: 'none', borderBottom: 'none' }} />
          </div>
          {/* Soap dispenser */}
          <div style={{ position: 'absolute', top: -18, right: 6, width: 9, height: 18 }}>
            <div style={{ width: 9, height: 14, background: 'linear-gradient(180deg, #F0E0C8, #D8C0A0)', borderRadius: '3px 3px 2px 2px', border: '1px solid #C0A080' }} />
            <div style={{ width: 3, height: 5, background: '#C0A080', margin: '0 auto', borderRadius: '2px 2px 0 0', marginTop: -2 }} />
          </div>
          {/* Sponge */}
          <div style={{ position: 'absolute', top: 5, right: 6, width: 14, height: 9, background: 'linear-gradient(180deg, #90D860, #68B840)', borderRadius: 3, border: '1px solid #509028' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: '#F8E060', borderRadius: '0 0 3px 3px', border: '1px solid #D0B820', borderTop: 'none' }} />
          </div>
        </div>
      </div>

      {/* ══ ITEMS ON COUNTER ══ */}
      {/* Fruit bowl — CSS fruits */}
      <div className="absolute" style={{ bottom: '53.5%', left: '24%' }}>
        <div className="relative">
          {/* Bowl */}
          <div style={{ width: 40, height: 11, borderRadius: '0 0 50% 50%', background: 'linear-gradient(180deg, #E8C878, #C8A848)', border: '2px solid #A88838' }} />
          {/* CSS apple */}
          <div style={{ position: 'absolute', top: -13, left: 1 }}>
            <div style={{ width: 12, height: 11, borderRadius: '50% 50% 48% 48%', background: 'linear-gradient(135deg, #F05040, #C83020)', border: '1px solid #A82010' }} />
            <div style={{ position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)', width: 2, height: 4, background: '#5A3010', borderRadius: 1 }} />
          </div>
          {/* CSS orange */}
          <div style={{ position: 'absolute', top: -12, left: 13 }}>
            <div style={{ width: 12, height: 11, borderRadius: '50%', background: 'radial-gradient(circle at 38%, #FF9840, #E07020)', border: '1px solid #C05810' }} />
          </div>
          {/* CSS lemon */}
          <div style={{ position: 'absolute', top: -12, left: 26 }}>
            <div style={{ width: 12, height: 10, borderRadius: '50%', background: 'radial-gradient(circle at 38%, #FFF060, #E8D020)', border: '1px solid #C0A818', transform: 'scaleX(1.2)' }} />
          </div>
        </div>
      </div>
      {/* CSS Teapot */}
      <div className="absolute" style={{ bottom: '53.5%', left: '40%' }}>
        <div style={{ position: 'relative', width: 34, height: 28 }}>
          {/* Body */}
          <div style={{ position: 'absolute', bottom: 0, left: 4, width: 24, height: 20, background: 'linear-gradient(135deg, #C88060, #A05030)', borderRadius: '40% 40% 45% 45%', border: '1.5px solid #884020' }} />
          {/* Spout */}
          <div style={{ position: 'absolute', bottom: 10, right: 0, width: 10, height: 7, background: 'linear-gradient(135deg, #C88060, #A05030)', borderRadius: '3px 6px 3px 0', border: '1.5px solid #884020', transform: 'rotate(-10deg)', transformOrigin: 'left center' }} />
          {/* Handle */}
          <div style={{ position: 'absolute', bottom: 8, left: 0, width: 5, height: 14, borderRadius: '50%', border: '3px solid #A05030', borderRight: 'none', borderTop: 'none' }} />
          {/* Lid */}
          <div style={{ position: 'absolute', bottom: 18, left: 9, width: 16, height: 6, background: 'linear-gradient(135deg, #D89070, #B06040)', borderRadius: '4px 4px 0 0', border: '1.5px solid #884020' }}>
            <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, borderRadius: '50%', background: '#C07850', border: '1px solid #884020' }} />
          </div>
          {/* Steam */}
          {[0, 1].map(k => (
            <div key={k} style={{ position: 'absolute', bottom: 28, left: 12 + k * 6, width: 2, height: 8, background: 'linear-gradient(180deg, transparent, rgba(200,160,120,0.4), transparent)', borderRadius: 4 }} />
          ))}
        </div>
      </div>
      {/* Cutting board */}
      <div className="absolute" style={{ bottom: '52.8%', left: '54%', width: 32, height: 10, background: 'linear-gradient(180deg, #C89850, #A87830)', borderRadius: 2, border: '1px solid #906828' }} />

      {/* ══ CAT PLACEMAT ══ */}
      <div className="absolute pointer-events-none" style={{ bottom: '44.5%', left: '30%', transform: 'translateX(-50%)', width: 80, height: 8, borderRadius: '50%', background: 'linear-gradient(180deg, #F0C8E8, #E0A8D0)', border: '2px solid #D090C0', opacity: 0.85 }}>
        {/* Placemat pattern */}
        {[0.25,0.5,0.75].map(p => <div key={p} className="absolute top-1 bottom-1" style={{ left: `${p*100}%`, width: 1, background: 'rgba(180,100,160,0.3)' }} />)}
      </div>

      {/* ══ FOOD BOWL ══ */}
      <div className="absolute z-10" style={{ bottom: '46.5%', left: '36%' }}>
        {/* Bowl shadow */}
        <div style={{ position: 'absolute', bottom: -3, left: '10%', right: '10%', height: 4, borderRadius: '50%', background: 'rgba(0,0,0,0.12)' }} />
        <div style={{ width: 56, height: 22, borderRadius: '4px 4px 50% 50%', background: 'linear-gradient(180deg, #F5CC68 0%, #E49028 60%, #C87018 100%)', border: '3px solid #A85C10', boxShadow: '0 3px 8px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,220,100,0.3)' }}>
          {/* Bowl rim highlight */}
          <div style={{ position: 'absolute', top: 2, left: 8, right: 8, height: 3, borderRadius: 4, background: 'rgba(255,240,160,0.5)' }} />
          {eatAnim && (
            <div className="absolute inset-1 flex gap-0.5 items-end justify-center">
              {Array.from({ length: 6 }).map((_, k) => (
                <div key={k} style={{ width: 5, height: 4 + (k % 2) * 2, borderRadius: '50%', background: k % 2 === 0 ? '#8B4513' : '#A05A20' }} />
              ))}
            </div>
          )}
        </div>
        {/* Water bowl */}
        <div style={{ marginTop: 3, width: 34, height: 14, borderRadius: '3px 3px 50% 50%', background: 'linear-gradient(180deg, #A8D8F8 0%, #78B8E8 100%)', border: '2px solid #5898C8', boxShadow: '0 2px 5px rgba(0,0,0,0.15)' }}>
          <div style={{ position: 'absolute', top: 2, left: 5, width: 12, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
        </div>
      </div>

      {/* ══ EREN ══ */}
      <div className={cn('absolute z-20 transition-all duration-500', eatAnim ? 'bottom-[49%]' : 'bottom-[47%]')} style={{ left: '50%' }}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 130, height: 130, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ══ UI ══ */}
      <button onClick={onClose} className="absolute top-4 left-4 z-50 active:scale-95"
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderRadius: 3, border: '2px solid rgba(255,200,100,0.4)', boxShadow: '2px 2px 0 rgba(180,140,40,0.2)', padding: 8 }}>
        <ChevronLeft size={20} className="text-amber-800" />
      </button>

      <div className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5"
        style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: 3, border: '2px solid #F5C842', boxShadow: '2px 2px 0 #C8A020' }}>
        {/* CSS coin */}
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'radial-gradient(circle at 38% 35%, #FFE878, #D4A818)', border: '1.5px solid #B08810', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
        <span className="font-pixel text-amber-700" style={{ fontSize: 9 }}>{coins}</span>
      </div>

      {toast && (
        <div className={cn('absolute top-14 left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 animate-float whitespace-nowrap', toast.ok ? '' : '')}
          style={{ background: toast.ok ? '#1F1F2E' : '#CC2222', borderRadius: 3, border: `2px solid ${toast.ok ? '#3A3A5E' : '#AA1111'}`, boxShadow: `3px 3px 0 ${toast.ok ? 'rgba(0,0,0,0.4)' : '#880000'}`, fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast.msg}
        </div>
      )}

      {/* ══ FLOATING ACTION BUTTONS ══ */}
      <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center gap-4">
        {/* Shop button */}
        <button onClick={() => setTab(tab === 'shop' ? null : 'shop')}
          className="flex items-center gap-2 px-5 py-3 text-white active:scale-95 transition-transform"
          style={{ background: tab === 'shop' ? 'linear-gradient(135deg, #E8A020, #C07010)' : 'linear-gradient(135deg, #F5C842, #E8A020)', borderRadius: 14, border: '2px solid #C88018', boxShadow: tab === 'shop' ? '0 2px 0 #904800' : '0 4px 0 #A06010, inset 0 1px 0 rgba(255,255,255,0.3)', fontFamily: '"Press Start 2P"', fontSize: 8 }}>
          <ShoppingCart size={14} />
          SHOP
        </button>
        {/* Fridge button */}
        <button onClick={() => setTab(tab === 'fridge' ? null : 'fridge')}
          className="flex items-center gap-2 px-5 py-3 active:scale-95 transition-transform"
          style={{ background: tab === 'fridge' ? 'linear-gradient(135deg, #60A8D0, #3880B0)' : 'linear-gradient(135deg, #A8D8F8, #78B8E8)', borderRadius: 14, border: '2px solid #5898C8', boxShadow: tab === 'fridge' ? '0 2px 0 #205880' : '0 4px 0 #3870A8, inset 0 1px 0 rgba(255,255,255,0.4)', fontFamily: '"Press Start 2P"', fontSize: 8, color: tab === 'fridge' ? 'white' : '#1A5A8A' }}>
          <Package size={14} />
          FRIDGE{fridgeItems.length > 0 && ` (${fridgeItems.reduce((s, i) => s + (inventory[i.id] ?? 0), 0)})`}
        </button>
      </div>

      {/* ══ SLIDE-UP DRAWER ══ */}
      {tab !== null && (
        <div className="absolute bottom-0 left-0 right-0 z-40 flex flex-col"
          style={{ height: '52%', background: 'linear-gradient(180deg, #FFFBF0 0%, #FFF8E8 100%)', borderRadius: '16px 16px 0 0', borderTop: '3px solid #F5C842', boxShadow: '0 -4px 0 #E8A020' }}>

          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
            <span className="font-pixel text-amber-700 flex items-center gap-2" style={{ fontSize: 9 }}>
              {tab === 'shop' ? <><ShoppingCart size={12} /> SHOP</> : <><Package size={12} /> FRIDGE</>}
            </span>
            <button onClick={() => setTab(null)}
              className="active:scale-90 transition-transform"
              style={{ background: '#F5EDD0', borderRadius: 8, border: '2px solid #E8C870', padding: '3px 8px', fontFamily: '"Press Start 2P"', fontSize: 8, color: '#A07020' }}>
              ✕
            </button>
          </div>
          <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #F5C842, transparent)', marginBottom: 4 }} />

          {/* Shop content */}
          {tab === 'shop' && (
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
                      <button onClick={() => handleBuy(item)} disabled={!canAfford || buying === item.id}
                        className="w-full py-1.5 text-white transition-all active:translate-y-[1px] disabled:opacity-40"
                        style={{ background: canAfford ? item.color : '#ccc', borderRadius: 2, border: `1px solid ${canAfford ? 'rgba(0,0,0,0.15)' : '#bbb'}`, boxShadow: canAfford ? `0 2px 0 rgba(0,0,0,0.18)` : 'none', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                        {buying === item.id ? '...' : canAfford ? 'BUY' : 'BROKE'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Fridge content */}
          {tab === 'fridge' && (
            <div className="overflow-y-auto px-3 py-1 flex-1">
              {fridgeItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <div className="animate-float" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #D8F0FF, #A8D8F8)', borderRadius: 6, border: '2px solid #88C4E8', boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.6), 0 3px 8px rgba(100,180,230,0.3)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 5, left: 5, width: 10, height: 6, background: 'rgba(255,255,255,0.45)', borderRadius: '50%', transform: 'rotate(-20deg)' }} />
                  </div>
                  <p className="font-pixel text-gray-500" style={{ fontSize: 8 }}>FRIDGE EMPTY!</p>
                  <button onClick={() => setTab('shop')} className="px-4 py-2 text-white active:translate-y-[1px]"
                    style={{ background: '#F5C842', borderRadius: 3, border: '2px solid #C88018', boxShadow: '0 2px 0 #A06010', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                    GO SHOP →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {fridgeItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3"
                      style={{ background: `linear-gradient(135deg, ${item.color}22 0%, white 100%)`, borderRadius: 3, border: `2px solid ${item.color}44`, boxShadow: `2px 2px 0 ${item.color}22` }}>
                      <FoodIcon id={item.id} color={item.color} />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-800">{item.name}</p>
                        <div className="flex gap-2 text-[9px] text-gray-500 mt-0.5">
                          <span>HGR +{item.hungerD}</span><span>JOY +{item.happyD}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-pixel text-gray-500 w-6 h-6 flex items-center justify-center" style={{ fontSize: 8, background: '#F0F0F0', borderRadius: 2, border: '1px solid #DDD' }}>{inventory[item.id] ?? 0}</span>
                        <button onClick={() => handleFeed(item)} disabled={!!feeding}
                          className="px-3 py-1.5 text-white active:translate-y-[1px]"
                          style={{ background: item.color, borderRadius: 2, border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 2px 0 rgba(0,0,0,0.15)', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                          {feeding === item.id ? '...' : 'FEED'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
