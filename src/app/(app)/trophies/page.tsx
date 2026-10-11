'use client'

// ═══════════════════════════════════════════════════════════════════════════
// /trophies — the catnip shop.
//
// Reached from the morning verdict screen's SHOP button and from the home nav.
// The battle pays in catnip and this is where it is spent. It used to open on
// a trophy case (what have I won) above the shop; catnip is a currency, not a
// collection, so there is nothing to display — the balance is in the header
// and the shop is the page. Each shelf carries its own one-line "what you
// have on" strip; see ShelfSummary in TrophyShopView.
//
// The route, the hook and the tables keep their trophy names: they are stored
// and linked, and only what the player sees moved.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCare } from '@/contexts/CareContext'
import { useTrophies } from '@/hooks/useTrophies'
import { usePageReady } from '@/hooks/usePageReady'
import type { AnyShopItem, PrivilegeItem, ShopKind } from '@/lib/trophyShop'
import TrophyShopView from '@/components/trophies/TrophyShopView'
import TrophyBuySheet from '@/components/trophies/TrophyBuySheet'
import UsePrivilegeSheet from '@/components/trophies/UsePrivilegeSheet'
import PageLoader from '@/components/PageLoader'
import { IconDoor, MeadowIcon } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

export default function TrophiesPage() {
  const router = useRouter()
  const { loading: authLoading } = useAuth()
  const { setHideStats } = useCare()
  const trophies = useTrophies()

  const [buying, setBuying] = useState<AnyShopItem | null>(null)
  const [using, setUsing] = useState<PrivilegeItem | null>(null)
  const [tab, setTab] = useState<ShopKind>('machine')

  // The page wears its own header; the floating StatsHeader would fight it.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  usePageReady(!authLoading)

  if (authLoading) return <PageLoader label="OPENING THE SHOP" />

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{
      background: `
        radial-gradient(ellipse at 50% 0%, rgba(245,200,66,0.13) 0%, transparent 52%),
        linear-gradient(180deg, #1A0E24 0%, #100818 58%, #06030A 100%)`,
    }}>
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.20) 3px, rgba(0,0,0,0.20) 4px)',
      }} />

      {/* ── Top bar ── */}
      <div className="relative flex items-center gap-3 px-3 py-3 flex-shrink-0" style={{
        borderBottom: '2px solid rgba(245,200,66,0.4)',
        background: 'linear-gradient(180deg, rgba(40,26,10,0.55) 0%, rgba(16,10,6,0.4) 100%)',
      }}>
        <button
          onClick={() => { playSound('ui_swipe_room'); router.replace('/home') }}
          className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Back to home"
        >
          <IconDoor size={18} />
        </button>
        <span className="font-pixel flex-1" style={{
          fontSize: 9, letterSpacing: 2.5, color: '#A6D98A',
          textShadow: '0 0 7px rgba(166,217,138,0.5)',
        }}>CATNIP SHOP</span>
        <span className="flex items-center gap-1.5 px-2 py-1" style={{
          border: '1.5px solid rgba(166,217,138,0.55)',
          borderRadius: 3,
          background: 'rgba(166,217,138,0.10)',
        }}>
          <MeadowIcon name="catnip" size={16} />
          <span className="font-pixel" style={{ fontSize: 10, color: '#D6F2C4' }}>
            {trophies.loaded ? trophies.balance : '—'}
          </span>
        </span>
      </div>

      <div className="relative flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4"
        style={{ paddingBottom: 40 }}>

        <TrophyShopView tab={tab} onTab={setTab} onBuy={setBuying} onUse={setUsing} />
      </div>

      {buying && <TrophyBuySheet item={buying} onClose={() => setBuying(null)} />}
      {using && <UsePrivilegeSheet item={using} onClose={() => setUsing(null)} />}
    </div>
  )
}
