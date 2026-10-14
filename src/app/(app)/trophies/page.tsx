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
// A Meadow page on the green section ground (catnip is a leaf), with the
// balance as a white pill where other pages put their coins.
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
import { playSound } from '@/lib/sounds'
import { M, MeadowIcon, MeadowPage, TYPE } from '@/components/meadow'

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

  return (
    <MeadowPage ground="play" title="Catnip shop" withNav={false}
      back={{ onClick: () => { playSound('ui_back'); router.replace('/home') }, label: 'Back to home' }}
      action={
        <span role="img" aria-label={trophies.loaded ? `${trophies.balance} catnip` : 'Catnip loading'} style={{
          height: 40, boxSizing: 'border-box', padding: '0 16px 0 9px', borderRadius: 999, background: '#FFFFFF',
          display: 'inline-flex', alignItems: 'center', gap: 7, color: M.text, fontSize: 17, ...TYPE.number,
        }}>
          <MeadowIcon name="catnip" size={24} />
          {trophies.loaded ? trophies.balance : '-'}
        </span>
      }>
      <div style={{ marginTop: 16 }}>
        {!authLoading && <TrophyShopView tab={tab} onTab={setTab} onBuy={setBuying} onUse={setUsing} />}
      </div>

      {buying && <TrophyBuySheet item={buying} onClose={() => setBuying(null)} />}
      {using && <UsePrivilegeSheet item={using} onClose={() => setUsing(null)} />}
    </MeadowPage>
  )
}
