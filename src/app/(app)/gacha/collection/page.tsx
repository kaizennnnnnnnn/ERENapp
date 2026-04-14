'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useInventory } from '@/hooks/useInventory'
import { useCare } from '@/contexts/CareContext'
import { GACHA_ITEMS, RARITY_COLORS, getCategoryLabel, CATEGORY_ICONS, getItemsByCategory } from '@/lib/gacha'
import { FORTUNE_GIFTS } from '@/lib/fortune'
import type { GachaCategory, GachaItemDef } from '@/types'

const CATEGORIES: GachaCategory[] = ['outfit', 'decoration', 'background', 'recipe', 'emote', 'frame']

export default function CollectionPage() {
  const router = useRouter()
  const { setHideStats } = useCare()
  const { inventory, ownsItem, getEquipped, equipItem, unequipItem, collectionPct, ownedCount, totalItems } = useInventory()
  useEffect(() => { setHideStats(false) }, [setHideStats])

  const [tab, setTab] = useState<GachaCategory>('outfit')
  const [selected, setSelected] = useState<GachaItemDef | null>(null)

  const items = getItemsByCategory(tab)
  const equippedItem = getEquipped(tab)

  // Fortune keepsakes
  const fortuneItems = FORTUNE_GIFTS.filter(g => !g.coinValue && !g.stardustValue && !g.gachaTickets)

  return (
    <div className="page-scroll">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => router.back()} className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
          <ChevronLeft size={16} className="text-purple-500" />
        </button>
        <span className="pixel-chip" style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)' }}>📖 COLLECTION</span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: '#E8E0F8' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${collectionPct}%`, background: 'linear-gradient(90deg, #7C3AED, #A78BFA)' }} />
        </div>
        <span className="font-pixel text-purple-600" style={{ fontSize: 8 }}>{ownedCount}/{totalItems}</span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => { setTab(cat); setSelected(null) }}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 transition-all"
            style={{
              background: tab === cat ? 'linear-gradient(135deg, #7C3AED, #A78BFA)' : 'white',
              color: tab === cat ? 'white' : '#6B21A8',
              borderRadius: 3,
              border: `2px solid ${tab === cat ? '#5B21B6' : '#E0D0F0'}`,
              boxShadow: tab === cat ? '0 2px 0 #4C1D95' : '1px 1px 0 #D0C0E0',
              fontFamily: '"Press Start 2P"', fontSize: 6,
            }}>
            {CATEGORY_ICONS[cat]} {getCategoryLabel(cat).toUpperCase()}
          </button>
        ))}
      </div>

      {/* Item grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {items.map(item => {
          const owned = ownsItem(item.id)
          const colors = RARITY_COLORS[item.rarity]
          const isEquipped = equippedItem?.id === item.id
          return (
            <button key={item.id} onClick={() => owned ? setSelected(item) : undefined}
              className="flex flex-col items-center gap-1 p-2 transition-all active:scale-95"
              style={{
                background: owned ? colors.bg : '#F0F0F0',
                borderRadius: 4,
                border: `2px solid ${owned ? colors.border : '#E0E0E0'}`,
                boxShadow: owned ? `2px 2px 0 ${colors.border}44` : 'none',
                opacity: owned ? 1 : 0.4,
              }}>
              <span style={{ fontSize: 24, filter: owned ? 'none' : 'grayscale(1)' }}>{item.icon}</span>
              <span className="font-pixel text-center leading-tight" style={{ fontSize: 5, color: owned ? colors.text : '#AAA' }}>
                {item.name.toUpperCase()}
              </span>
              {isEquipped && (
                <span className="font-pixel text-green-600" style={{ fontSize: 5 }}>EQUIPPED</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected item detail */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="mx-6 w-full max-w-xs p-5 flex flex-col items-center gap-3"
            style={{ background: 'white', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '4px 4px 0 #C0A0E0' }}>
            <div className="rounded-xl flex items-center justify-center"
              style={{ width: 70, height: 70, background: RARITY_COLORS[selected.rarity].bg, border: `2px solid ${RARITY_COLORS[selected.rarity].border}` }}>
              <span style={{ fontSize: 36 }}>{selected.icon}</span>
            </div>
            <p className="font-pixel text-gray-800" style={{ fontSize: 9 }}>{selected.name}</p>
            <p className="font-pixel" style={{ fontSize: 6, color: RARITY_COLORS[selected.rarity].text }}>{selected.rarity.toUpperCase()}</p>
            <p className="text-xs text-gray-500 text-center">{selected.description}</p>

            {/* Equip/unequip for outfit, background, frame */}
            {['outfit', 'background', 'frame'].includes(selected.category) && (
              equippedItem?.id === selected.id ? (
                <button onClick={() => { unequipItem(selected.id); setSelected(null) }}
                  className="w-full py-2 text-white active:translate-y-[1px]"
                  style={{ background: '#6B7280', borderRadius: 3, border: '2px solid #4B5563', boxShadow: '0 2px 0 #374151', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                  UNEQUIP
                </button>
              ) : (
                <button onClick={() => { equipItem(selected.id); setSelected(null) }}
                  className="w-full py-2 text-white active:translate-y-[1px]"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', borderRadius: 3, border: '2px solid #5B21B6', boxShadow: '0 2px 0 #4C1D95', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                  EQUIP
                </button>
              )
            )}

            <button onClick={() => setSelected(null)} className="font-pixel text-gray-400" style={{ fontSize: 6 }}>CLOSE</button>
          </div>
        </div>
      )}
    </div>
  )
}
