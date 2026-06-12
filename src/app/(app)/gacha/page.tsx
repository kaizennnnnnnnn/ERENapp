'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useGacha } from '@/hooks/useGacha'
import { useInventory } from '@/hooks/useInventory'
import { useCare } from '@/contexts/CareContext'
import { PULL_COST_SINGLE, PULL_COST_TEN, PITY_EPIC, PITY_LEGENDARY } from '@/lib/gacha'
import type { GachaPullResult } from '@/types'
import PullAnimation from '@/components/gacha/PullAnimation'
import { IconCoin, IconSparkles, IconTicket, IconBook } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { requestCloudNav } from '@/components/CloudTransition'
import { PINK_HI, OBSIDIAN_BTN, Rivets, pinkText } from '@/components/obsidian'

// Two machines, one swipe apart. Page order matches the banner ids in
// GACHA_BANNERS — food first (what the gacha button lands on), animal right.
const PAGES = [
  { id: 'food', bg: '/gacha_food.png' },
  { id: 'animal', bg: '/gacha_animal.png' },
] as const

export default function GachaPage() {
  const router = useRouter()
  const { setHideStats } = useCare()
  const { coins, stardust, pityEpic, pityLegendary, pulling, pullSingle, pullTen, tickets } = useGacha()
  const { refetch: refetchInv } = useInventory()

  // Hide the persistent StatsHeader on this subpage; restore on unmount.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [pageIdx, setPageIdx] = useState(0)
  const [pullResults, setPullResults] = useState<GachaPullResult[] | null>(null)
  const [opening, setOpening] = useState(false) // rainbow video before food reveals

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.min(PAGES.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)))
    if (idx !== pageIdx) {
      playSound('ui_swipe_room')
      setPageIdx(idx)
    }
  }

  function goTo(idx: number) {
    const el = scrollRef.current
    if (!el) return
    playSound('ui_select')
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
  }

  async function handlePull(count: 1 | 10) {
    if (pulling || opening || pullResults) return
    const bannerId = PAGES[pageIdx].id
    playSound('ui_tap')
    if (bannerId === 'food') {
      playSound('gift_open')
      setOpening(true)
    }
    const results = count === 1
      ? await pullSingle(bannerId).then(r => (r ? [r] : null))
      : await pullTen(bannerId)
    if (!results) {
      setOpening(false)
      return
    }
    setPullResults(results)
  }

  function handlePullDone() {
    setPullResults(null)
    refetchInv()
  }

  return (
    <div className="fixed inset-0" style={{ background: '#050507' }}>

      {/* ── Swipeable machine pages ── */}
      <div ref={scrollRef} onScroll={onScroll}
        className="h-full w-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}>
        {PAGES.map(p => (
          <section key={p.id} className="relative h-full w-full flex-shrink-0 snap-center overflow-hidden">
            <div className="absolute inset-0" style={{
              backgroundImage: `url(${p.bg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }} />

            {/* Bottom shade so the controls read over the machine base */}
            <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{
              height: 190,
              background: 'linear-gradient(180deg, rgba(5,5,7,0) 0%, rgba(5,5,7,0.78) 70%)',
            }} />

            {/* Pull controls */}
            <div className="absolute inset-x-0 bottom-0 px-4" style={{ paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}>
              <div className="flex justify-center gap-4 mb-2">
                <span className="font-pixel" style={{ fontSize: 6, color: '#C4B5FD', textShadow: '0 0 3px rgba(167,139,250,0.5)' }}>EPIC {pityEpic}/{PITY_EPIC}</span>
                <span className="font-pixel" style={{ fontSize: 6, color: '#F5C842', textShadow: '0 0 3px rgba(245,200,66,0.5)' }}>LEGENDARY {pityLegendary}/{PITY_LEGENDARY}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handlePull(1)} disabled={pulling || (coins < PULL_COST_SINGLE && tickets <= 0)}
                  className="flex-1 py-3 active:translate-y-[1px] transition-transform disabled:opacity-40 relative"
                  style={OBSIDIAN_BTN}>
                  <Rivets inset={3} size={3} />
                  <div className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, ...pinkText }}>PULL x1</div>
                  <div className="font-pixel mt-1" style={{ fontSize: 6, color: '#9A8090' }}>{PULL_COST_SINGLE} coins</div>
                </button>
                <button onClick={() => handlePull(10)} disabled={pulling || coins < PULL_COST_TEN}
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
          </section>
        ))}
      </div>

      {/* ── Header overlay ── */}
      <div className="absolute inset-x-0 top-0 px-3" style={{ paddingTop: 'calc(var(--safe-top) + 10px)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => { playSound('ui_back'); requestCloudNav('/home', 'rainbow') }}
            className="flex items-center justify-center active:translate-y-[1px] transition-transform relative"
            style={{ width: 32, height: 32, ...OBSIDIAN_BTN }}>
            <Rivets inset={2} size={2} />
            <ChevronLeft size={16} style={{ color: PINK_HI }} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 px-2 py-1.5 relative" style={OBSIDIAN_BTN}>
            <Rivets inset={2} size={2} />
            <IconCoin size={14} />
            <span className="font-pixel" style={{ fontSize: 8, color: '#F5C842', textShadow: '0 0 3px rgba(245,200,66,0.5)' }}>{coins}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1.5 relative" style={OBSIDIAN_BTN}>
            <Rivets inset={2} size={2} />
            <IconSparkles size={14} />
            <span className="font-pixel" style={{ fontSize: 8, color: '#C4B5FD', textShadow: '0 0 3px rgba(167,139,250,0.5)' }}>{stardust}</span>
          </div>
          {tickets > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 relative" style={OBSIDIAN_BTN}>
              <Rivets inset={2} size={2} />
              <IconTicket size={14} />
              <span className="font-pixel" style={{ fontSize: 8, ...pinkText }}>{tickets}</span>
            </div>
          )}
          <button onClick={() => { playSound('ui_tap'); router.push('/gacha/collection') }}
            className="flex items-center justify-center active:translate-y-[1px] transition-transform relative"
            style={{ width: 32, height: 32, ...OBSIDIAN_BTN }}>
            <Rivets inset={2} size={2} />
            <IconBook size={18} />
          </button>
        </div>

        {/* Page dots */}
        <div className="flex flex-col items-center gap-1 mt-2">
          <div className="flex justify-center gap-2">
            {PAGES.map((p, i) => (
              <button key={p.id} onClick={() => goTo(i)} aria-label={p.id}
                style={{
                  width: 10, height: 10,
                  background: i === pageIdx ? PINK_HI : 'rgba(255,255,255,0.35)',
                  border: '1px solid rgba(5,5,7,0.8)',
                  boxShadow: '1px 1px 0 rgba(5,5,7,0.6)',
                }} />
            ))}
          </div>
          <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: 'rgba(255,255,255,0.55)', textShadow: '1px 1px 0 rgba(5,5,7,0.8)' }}>SWIPE</span>
        </div>
      </div>

      {/* ── Rainbow opening (food pulls) ── */}
      {opening && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: '#000' }}
          onClick={() => setOpening(false)}>
          <video src="/rainbow_opening.mp4" autoPlay muted playsInline
            className="h-full w-full object-cover"
            onEnded={() => setOpening(false)}
            onError={() => setOpening(false)} />
          <span className="absolute font-pixel" style={{ fontSize: 6, color: 'rgba(255,255,255,0.45)', bottom: 'calc(var(--safe-bottom) + 18px)' }}>TAP TO SKIP</span>
        </div>
      )}

      {/* ── Reveal ── */}
      {pullResults && !opening && <PullAnimation results={pullResults} onDone={handlePullDone} />}
    </div>
  )
}
