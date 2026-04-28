'use client'

import { useState } from 'react'
import { ShoppingCart, Package } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'
import type { FoodInventory } from '@/types'
import { playSound } from '@/lib/sounds'
import AnalogClock from '@/components/AnalogClock'

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
  const { stats, feedWithFood, saveFoodInventory } = useErenStats(profile?.household_id ?? null)
  const { completeTask, coins, spendCoins } = useTasks()

  const [tab, setTab] = useState<'shop' | 'fridge' | null>(null)
  const [buying, setBuying] = useState<string | null>(null)
  const [feeding, setFeeding] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [eatAnim, setEatAnim] = useState(false)

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

      {/* ══ BACKGROUND IMAGE ══ */}
      <div className="absolute inset-0" style={{ backgroundImage: 'url(/kitchen.png)', backgroundSize: 'cover', backgroundPosition: 'center', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }} />

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
          <div className="absolute" style={{ left: '18.5%', top: 'calc(52.8% + 20px)' }}>
            <div className="kettle-puff kettle-puff-a" />
            <div className="kettle-puff kettle-puff-b" />
            <div className="kettle-puff kettle-puff-c" />
          </div>

          {/* Wall clock on the back wall — replaces the pixel clock baked into
            kitchen.png. Center at ~(49%, 23.4%) of the source, ~10% diameter. */}
          <div style={{ position: 'absolute', left: 'calc(51% - 1px)', top: '23.4%', width: '13%', aspectRatio: '1 / 1', transform: 'translate(-50%, -50%)' }}>
            <AnalogClock size="100%" mode="real" />
          </div>
        </div>
      </div>

      {/* ══ EREN ══ */}
      <div className={cn('absolute z-20 transition-all duration-300', eatAnim ? 'bottom-[14%]' : 'bottom-[10%]')}
        style={{ left: '50%', transform: 'translateX(-50%)' }}>
        <img src="/erenGood.png" alt="Eren" draggable={false} style={{ width: 210, height: 210, objectFit: 'contain', imageRendering: 'pixelated' }} />
      </div>

      {/* ══ UI ══ */}

      {toast && (
        <div className={cn('absolute left-1/2 -translate-x-1/2 z-50 text-white px-4 py-2 animate-float whitespace-nowrap', toast.ok ? '' : '')}
          style={{ top: 145, background: toast.ok ? '#1F1F2E' : '#CC2222', borderRadius: 3, border: `2px solid ${toast.ok ? '#3A3A5E' : '#AA1111'}`, boxShadow: `3px 3px 0 ${toast.ok ? 'rgba(0,0,0,0.4)' : '#880000'}`, fontFamily: '"Press Start 2P"', fontSize: 7 }}>
          {toast.msg}
        </div>
      )}

      {/* ══ FLOATING ACTION BUTTONS ══ */}
      <div className="absolute bottom-6 left-0 right-0 z-30 flex justify-center gap-4">
        {/* Shop button */}
        <button onClick={() => { playSound(tab === 'shop' ? 'ui_modal_close' : 'ui_modal_open'); setTab(tab === 'shop' ? null : 'shop') }}
          className="flex items-center gap-2 px-5 py-3 text-white active:scale-95 transition-transform"
          style={{ background: tab === 'shop' ? 'linear-gradient(135deg, #E8A020, #C07010)' : 'linear-gradient(135deg, #F5C842, #E8A020)', borderRadius: 14, border: '2px solid #C88018', boxShadow: tab === 'shop' ? '0 2px 0 #904800' : '0 4px 0 #A06010, inset 0 1px 0 rgba(255,255,255,0.3)', fontFamily: '"Press Start 2P"', fontSize: 8 }}>
          <ShoppingCart size={14} />
          SHOP
        </button>
        {/* Fridge button */}
        <button onClick={() => { playSound(tab === 'fridge' ? 'ui_modal_close' : 'ui_modal_open'); setTab(tab === 'fridge' ? null : 'fridge') }}
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
            <button onClick={() => { playSound('ui_modal_close'); setTab(null) }}
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
                  <button onClick={() => { playSound('ui_tap'); setTab('shop') }} className="px-4 py-2 text-white active:translate-y-[1px]"
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
                        <button onClick={() => { playSound('ui_tap'); handleFeed(item) }} disabled={!!feeding}
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
      `}</style>
    </div>
  )
}
