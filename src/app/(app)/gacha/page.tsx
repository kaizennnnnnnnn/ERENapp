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
import { playSound } from '@/lib/sounds'
import {
  PINK, PINK_HI, PINK_LO,
  OBSIDIAN_FACE, OBSIDIAN_BTN,
  Rivets, ObsidianChip, pinkText, accentA,
} from '@/components/obsidian'

const BANNER_ICONS: Record<string, React.FC<{ size?: number }>> = {
  standard: IconSlots,
  fashion:  IconDress,
  cozy_home: IconHouse,
}

// Tiny IconStar import keeps the lint happy if banner code uses it later.
void IconStar

export default function GachaPage() {
  const router = useRouter()
  const { user } = useAuth()
  void user
  const { setHideStats } = useCare()
  const { coins, stardust, pityEpic, pityLegendary, pulling, pullSingle, pullTen, tickets } = useGacha()
  const { collectionPct, refetch: refetchInv } = useInventory()

  // Hide the persistent StatsHeader on this subpage; restore on unmount.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

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

  const pageStyle: React.CSSProperties = {
    background: 'radial-gradient(ellipse at top, #1f0f18 0%, #0a0a0c 60%, #050507 100%)',
    minHeight: '100vh',
    color: '#F0E0E8',
    paddingTop: 'calc(var(--safe-top) + 16px)',
  }

  return (
    <div className="page-scroll" style={pageStyle}>
      {pullResults && <PullAnimation results={pullResults} onDone={handlePullDone} />}

      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:translate-y-[1px] transition-transform relative"
          style={{ width: 32, height: 32, ...OBSIDIAN_BTN }}>
          <Rivets inset={2} size={2} />
          <ChevronLeft size={16} style={{ color: PINK_HI }} />
        </button>
        <ObsidianChip accentRgb="236,72,153">
          <IconSlots size={14} />
          <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, ...pinkText }}>GACHA</span>
        </ObsidianChip>
      </div>
      <p className="text-sm mb-4" style={{ color: '#9A8090' }}>Eren&apos;s Capsule Machine</p>

      {/* ── Currency bar ── */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 relative" style={OBSIDIAN_BTN}>
          <Rivets inset={2} size={2} />
          <IconCoin size={18} />
          <span className="font-pixel" style={{ fontSize: 10, color: '#F5C842', textShadow: '0 0 3px rgba(245,200,66,0.5)' }}>{coins}</span>
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 py-2 relative" style={OBSIDIAN_BTN}>
          <Rivets inset={2} size={2} />
          <IconSparkles size={18} />
          <span className="font-pixel" style={{ fontSize: 10, color: '#C4B5FD', textShadow: '0 0 3px rgba(167,139,250,0.5)' }}>{stardust}</span>
        </div>
        {tickets > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 relative" style={OBSIDIAN_BTN}>
            <Rivets inset={2} size={2} />
            <IconTicket size={18} />
            <span className="font-pixel" style={{ fontSize: 10, ...pinkText }}>{tickets}</span>
          </div>
        )}
      </div>

      {/* ── Banner selector ── */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {GACHA_BANNERS.map(b => {
          const Icon = BANNER_ICONS[b.id] ?? IconSlots
          const active = selectedBanner === b.id
          return (
            <button key={b.id} onClick={() => { playSound('ui_tap'); setSelectedBanner(b.id) }}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 active:translate-y-[1px] transition-all relative"
              style={{
                minWidth: 108,
                ...OBSIDIAN_BTN,
                border: `1px solid ${active ? `${accentA(0.8)}` : `${accentA(0.2)}`}`,
                boxShadow: active
                  ? `0 0 0 1px ${accentA(0.33)}, 0 4px 14px ${accentA(0.27)}, inset 0 1px 0 rgba(255,255,255,0.08)`
                  : OBSIDIAN_BTN.boxShadow as string,
              }}>
              {active && <Rivets inset={3} size={3} />}
              <div className="flex items-center justify-center"
                style={{
                  width: 40, height: 40,
                  background: active
                    ? `linear-gradient(135deg, ${b.bgGradient[0]}33, ${b.bgGradient[1]}22)`
                    : 'linear-gradient(180deg, #1a1a20, #0a0a0c)',
                  borderRadius: 3,
                  border: `1px solid ${active ? PINK + '88' : PINK + '33'}`,
                }}>
                <Icon size={26} />
              </div>
              <span className="font-pixel text-center" style={{
                fontSize: 6,
                letterSpacing: 0.5, lineHeight: 1.4,
                color: active ? PINK_HI : '#7A6A75',
                textShadow: active ? `0 0 3px ${accentA(0.4)}` : 'none',
              }}>
                {b.name.toUpperCase()}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Selected banner info ── */}
      <div className="mb-4 p-4 relative overflow-hidden" style={OBSIDIAN_FACE}>
        <Rivets inset={4} size={3} />
        {/* Decorative sparkles bg using the banner's hue */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ backgroundImage: `radial-gradient(circle, ${banner.bgGradient[0]} 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />

        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center"
              style={{
                width: 32, height: 32,
                background: 'linear-gradient(180deg, #1a1a20, #0a0a0c)',
                borderRadius: 3,
                border: `1px solid ${accentA(0.53)}`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 6px ${accentA(0.2)}`,
              }}>
              <SelectedIcon size={22} />
            </div>
            <span className="font-pixel" style={{ fontSize: 9, letterSpacing: 1, ...pinkText }}>{banner.name}</span>
          </div>
          <p className="text-xs mb-3" style={{ color: '#9A8090' }}>{banner.description}</p>

          {/* Rarity rates */}
          <div className="flex gap-1.5 mb-3">
            {(['legendary', 'epic', 'rare', 'common'] as const).map(r => {
              const c = RARITY_COLORS[r]
              return (
                <div key={r} className="flex items-center gap-1 px-2 py-1"
                  style={{
                    background: 'linear-gradient(180deg, #1a1a20, #0a0a0c)',
                    borderRadius: 3,
                    border: `1px solid ${c.border}88`,
                    boxShadow: `0 0 4px ${c.border}55`,
                  }}>
                  <span className="font-pixel" style={{ fontSize: 5, color: c.border, textShadow: `0 0 2px ${c.border}` }}>
                    {r === 'common' ? '60%' : r === 'rare' ? '25%' : r === 'epic' ? '12%' : '3%'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Pity counter */}
          <div className="flex gap-3 text-xs mb-3" style={{ color: '#7A6A75' }}>
            <span>Epic pity: <strong style={{ color: '#C4B5FD' }}>{pityEpic}/{PITY_EPIC}</strong></span>
            <span>Legendary pity: <strong style={{ color: '#F5C842' }}>{pityLegendary}/{PITY_LEGENDARY}</strong></span>
          </div>

          {/* Pull buttons */}
          <div className="flex gap-3">
            <button onClick={() => { playSound('ui_tap'); handleSingle() }} disabled={pulling || (coins < PULL_COST_SINGLE && tickets <= 0)}
              className="flex-1 py-3 active:translate-y-[1px] transition-transform disabled:opacity-40 relative"
              style={OBSIDIAN_BTN}>
              <Rivets inset={3} size={3} />
              <div className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, ...pinkText }}>PULL x1</div>
              <div className="font-pixel mt-1" style={{ fontSize: 6, color: '#9A8090' }}>{PULL_COST_SINGLE} coins</div>
            </button>
            <button onClick={() => { playSound('ui_tap'); handleTen() }} disabled={pulling || coins < PULL_COST_TEN}
              className="flex-1 py-3 active:translate-y-[1px] transition-transform disabled:opacity-40 relative"
              style={{
                ...OBSIDIAN_BTN,
                border: '1px solid rgba(245,200,66,0.7)',
                boxShadow: `0 3px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07), 0 0 12px rgba(245,200,66,0.25)`,
              }}>
              <Rivets inset={3} size={3} />
              <div className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: '#F5C842', textShadow: '0 0 4px rgba(245,200,66,0.6)' }}>PULL x10</div>
              <div className="font-pixel mt-1" style={{ fontSize: 6, color: '#9A8090' }}>{PULL_COST_TEN} coins</div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Collection link ── */}
      <button onClick={() => { playSound('ui_tap'); router.push('/gacha/collection') }}
        className="w-full flex items-center justify-between p-3 active:translate-y-[1px] transition-transform mb-4 relative"
        style={OBSIDIAN_BTN}>
        <Rivets inset={3} size={3} />
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center"
            style={{
              width: 36, height: 36,
              background: 'linear-gradient(180deg, #1a1a20, #0a0a0c)',
              borderRadius: 3,
              border: `1px solid ${accentA(0.33)}`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}>
            <IconBook size={24} />
          </div>
          <div className="text-left">
            <p className="font-pixel" style={{ fontSize: 8, letterSpacing: 1, ...pinkText }}>COLLECTION BOOK</p>
            <div className="flex items-center gap-2 mt-1">
              <div style={{
                width: 60, height: 4,
                background: '#0a0a0c',
                border: `1px solid ${accentA(0.2)}`,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${collectionPct}%`,
                  background: `linear-gradient(90deg, ${PINK_HI}, ${PINK}, ${PINK_LO})`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                }} />
              </div>
              <span className="text-[10px]" style={{ color: '#9A8090' }}>{collectionPct}% complete</span>
            </div>
          </div>
        </div>
        <span className="font-pixel" style={{ fontSize: 9, color: PINK_HI, opacity: 0.7 }}>▶</span>
      </button>
    </div>
  )
}
