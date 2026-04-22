'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useGacha } from '@/hooks/useGacha'
import { useInventory } from '@/hooks/useInventory'
import { useCare } from '@/contexts/CareContext'
import { GACHA_BANNERS, PULL_COST_SINGLE, PULL_COST_TEN, PITY_EPIC, PITY_LEGENDARY, RARITY_COLORS } from '@/lib/gacha'
import type { GachaPullResult } from '@/types'
import PullAnimation from '@/components/gacha/PullAnimation'
import {
  IconSlots, IconCoin, IconSparkles, IconTicket, IconDress,
  IconHouse, IconBook, IconStar,
} from '@/components/PixelIcons'

const BANNER_ICONS: Record<string, React.FC<{ size?: number }>> = {
  standard: IconSlots,
  fashion:  IconDress,
  cozy_home: IconHouse,
}

export default function GachaPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { setHideStats } = useCare()
  const { coins, stardust, pityEpic, pityLegendary, pulling, pullSingle, pullTen, tickets } = useGacha()
  const { collectionPct, refetch: refetchInv } = useInventory()

  useEffect(() => { setHideStats(false) }, [setHideStats])

  const [selectedBanner, setSelectedBanner] = useState(GACHA_BANNERS[0].id)
  const [pullResults, setPullResults] = useState<GachaPullResult[] | null>(null)

  const banner = GACHA_BANNERS.find(b => b.id === selectedBanner) ?? GACHA_BANNERS[0]
  const SelectedIcon = BANNER_ICONS[banner.id] ?? IconSlots

  async function handleSingle() {
    const result = await pullSingle(selectedBanner)
    if (result) setPullResults([result])
  }

  async function handleTen() {
    const results = await pullTen(selectedBanner)
    if (results) setPullResults(results)
  }

  function handlePullDone() {
    setPullResults(null)
    refetchInv()
  }

  return (
    <div className="page-scroll">
      {pullResults && <PullAnimation results={pullResults} onDone={handlePullDone} />}

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => router.back()} className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #FFF8FF, #F0E8FF)', borderRadius: 8, border: '2px solid #D8C0F0', boxShadow: '0 2px 0 #C0A0E0' }}>
          <ChevronLeft size={16} className="text-purple-500" />
        </button>
        <span className="pixel-chip inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', paddingLeft: 6 }}>
          <IconSlots size={14} />
          <span>GACHA</span>
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">Eren&apos;s Capsule Machine</p>

      {/* Currency bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 px-3 py-2"
          style={{ background: 'linear-gradient(135deg, #FFF8E0, #FFF0C0)', borderRadius: 4, border: '2px solid #F5C842', boxShadow: '2px 2px 0 #C8A020' }}>
          <IconCoin size={18} />
          <span className="font-pixel text-amber-700" style={{ fontSize: 10 }}>{coins}</span>
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 py-2"
          style={{ background: 'linear-gradient(135deg, #F5F0FF, #EDE4FF)', borderRadius: 4, border: '2px solid #A78BFA', boxShadow: '2px 2px 0 #8060D0' }}>
          <IconSparkles size={18} />
          <span className="font-pixel text-purple-700" style={{ fontSize: 10 }}>{stardust}</span>
        </div>
        {tickets > 0 && (
          <div className="flex items-center gap-2 px-3 py-2"
            style={{ background: 'linear-gradient(135deg, #FFF0F5, #FFE0EB)', borderRadius: 4, border: '2px solid #FF6B9D', boxShadow: '2px 2px 0 #CC3366' }}>
            <IconTicket size={18} />
            <span className="font-pixel text-pink-700" style={{ fontSize: 10 }}>{tickets}</span>
          </div>
        )}
      </div>

      {/* Banner selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {GACHA_BANNERS.map(b => {
          const Icon = BANNER_ICONS[b.id] ?? IconSlots
          const active = selectedBanner === b.id
          return (
            <button key={b.id} onClick={() => setSelectedBanner(b.id)}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 active:scale-95 transition-all relative"
              style={{
                minWidth: 108,
                background: active
                  ? `linear-gradient(135deg, ${b.bgGradient[0]}, ${b.bgGradient[1]})`
                  : 'linear-gradient(135deg, #F8F4FF, #F0E8FF)',
                borderRadius: 4,
                border: `3px solid ${active ? b.bgGradient[0] : '#E0D0F0'}`,
                boxShadow: active ? `3px 3px 0 ${b.bgGradient[0]}66` : '2px 2px 0 #D0C0E8',
              }}>
              {active && (
                <>
                  <div style={{ position: 'absolute', top: 2, left: 2, width: 4, height: 4, background: 'rgba(255,255,255,0.7)' }} />
                  <div style={{ position: 'absolute', top: 2, right: 2, width: 4, height: 4, background: 'rgba(255,255,255,0.7)' }} />
                </>
              )}
              <div className="flex items-center justify-center"
                style={{ width: 40, height: 40, background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)', borderRadius: 3, border: active ? `2px solid rgba(255,255,255,0.4)` : '2px solid #E8DCF8' }}>
                <Icon size={26} />
              </div>
              <span className="font-pixel text-center" style={{ fontSize: 6, color: active ? 'white' : '#6B21A8', letterSpacing: 0.5, lineHeight: 1.4 }}>
                {b.name.toUpperCase()}
              </span>
            </button>
          )
        })}
      </div>

      {/* Selected banner info */}
      <div className="mb-4 p-4 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${banner.bgGradient[0]}18, ${banner.bgGradient[1]}12)`,
          borderRadius: 4, border: `3px solid ${banner.bgGradient[0]}55`,
          boxShadow: `3px 3px 0 ${banner.bgGradient[0]}33`,
        }}>
        {/* Decorative sparkles bg */}
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ backgroundImage: `radial-gradient(circle, ${banner.bgGradient[0]} 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center"
              style={{ width: 32, height: 32, background: 'white', borderRadius: 3, border: `2px solid ${banner.bgGradient[0]}`, boxShadow: `2px 2px 0 ${banner.bgGradient[0]}44` }}>
              <SelectedIcon size={22} />
            </div>
            <span className="font-pixel text-gray-800" style={{ fontSize: 9 }}>{banner.name}</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">{banner.description}</p>

          {/* Rarity rates */}
          <div className="flex gap-1.5 mb-3">
            {(['legendary', 'epic', 'rare', 'common'] as const).map(r => {
              const c = RARITY_COLORS[r]
              return (
                <div key={r} className="flex items-center gap-1 px-2 py-1"
                  style={{ background: c.bg, borderRadius: 3, border: `2px solid ${c.border}`, boxShadow: `1px 1px 0 ${c.border}` }}>
                  <span className="font-pixel" style={{ fontSize: 5, color: c.text }}>
                    {r === 'common' ? '60%' : r === 'rare' ? '25%' : r === 'epic' ? '12%' : '3%'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Pity counter */}
          <div className="flex gap-3 text-xs text-gray-400 mb-3">
            <span>Epic pity: <strong className="text-purple-500">{pityEpic}/{PITY_EPIC}</strong></span>
            <span>Legendary pity: <strong className="text-amber-500">{pityLegendary}/{PITY_LEGENDARY}</strong></span>
          </div>

          {/* Pull buttons */}
          <div className="flex gap-3">
            <button onClick={handleSingle} disabled={pulling || (coins < PULL_COST_SINGLE && tickets <= 0)}
              className="flex-1 py-3 text-white active:translate-y-[2px] transition-transform disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', borderRadius: 3, border: '2px solid #5B21B6', boxShadow: '0 3px 0 #4C1D95', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
              PULL x1
              <br />
              <span style={{ fontSize: 6, opacity: 0.7 }}>{PULL_COST_SINGLE} coins</span>
            </button>
            <button onClick={handleTen} disabled={pulling || coins < PULL_COST_TEN}
              className="flex-1 py-3 text-white active:translate-y-[2px] transition-transform disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)', borderRadius: 3, border: '2px solid #B45309', boxShadow: '0 3px 0 #92400E', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
              PULL x10
              <br />
              <span style={{ fontSize: 6, opacity: 0.7 }}>{PULL_COST_TEN} coins</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collection link */}
      <button onClick={() => router.push('/gacha/collection')}
        className="w-full flex items-center justify-between p-3 active:scale-[0.98] transition-transform mb-4"
        style={{ background: 'linear-gradient(135deg, #FFF8FF, #F5EEFF)', borderRadius: 4, border: '2px solid #D8C0F0', boxShadow: '3px 3px 0 #C8B0E8' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center"
            style={{ width: 36, height: 36, background: 'white', borderRadius: 3, border: '2px solid #C89060', boxShadow: '2px 2px 0 #A06030' }}>
            <IconBook size={24} />
          </div>
          <div className="text-left">
            <p className="font-pixel text-purple-700" style={{ fontSize: 8 }}>COLLECTION BOOK</p>
            <div className="flex items-center gap-2 mt-1">
              <div style={{ width: 60, height: 4, background: '#E0D0F0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${collectionPct}%`, background: 'linear-gradient(90deg, #A78BFA, #7C3AED)', borderRadius: 2 }} />
              </div>
              <span className="text-[10px] text-gray-400">{collectionPct}% complete</span>
            </div>
          </div>
        </div>
        <span className="font-pixel text-purple-400" style={{ fontSize: 9 }}>▶</span>
      </button>
    </div>
  )
}
