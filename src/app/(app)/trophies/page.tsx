'use client'

// ═══════════════════════════════════════════════════════════════════════════
// /trophies — the case, the loadout, and the shop, in that order.
//
// Reached from the morning verdict screen's SHOP button and from the home nav.
// The order is deliberate and it is the answer to three separate questions the
// screen kept failing:
//   the CASE      what have I won
//   the LOADOUT   where is the stuff I bought, and how do I put it on
//   the SHOP      what else is there
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCare } from '@/contexts/CareContext'
import { useTrophies } from '@/hooks/useTrophies'
import { useTrophyCosmetics } from '@/hooks/useTrophyCosmetics'
import { usePageReady } from '@/hooks/usePageReady'
import { withRetry } from '@/lib/supabaseRetry'
import { LIFETIME_LOOKBACK_DAYS, type DailyBattleRow } from '@/lib/battleResults'
import type { TrophyTier } from '@/lib/dailyTwist'
import type { AnyShopItem, PrivilegeItem, ShopKind } from '@/lib/trophyShop'
import TrophyShopView from '@/components/trophies/TrophyShopView'
import TrophyBuySheet from '@/components/trophies/TrophyBuySheet'
import UsePrivilegeSheet from '@/components/trophies/UsePrivilegeSheet'
import TrophyCase from '@/components/trophies/TrophyCase'
import EquippedBar from '@/components/trophies/EquippedBar'
import TrophyCup from '@/components/trophies/TrophyCup'
import { type TrophyCounts } from '@/components/trophies/DecorArt'
import PageLoader from '@/components/PageLoader'
import { IconDoor } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

export default function TrophiesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile, loading: authLoading } = useAuth()
  const { lifetimeWLT } = useCouple()
  const { setHideStats } = useCare()
  const trophies = useTrophies()
  const cos = useTrophyCosmetics()

  const [rows, setRows] = useState<DailyBattleRow[] | null>(null)
  const [buying, setBuying] = useState<AnyShopItem | null>(null)
  const [using, setUsing] = useState<PrivilegeItem | null>(null)
  const [tab, setTab] = useState<ShopKind>('decor')
  const shopRef = useRef<HTMLDivElement | null>(null)

  // The page wears its own header; the floating StatsHeader would fight it.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  // Every settled day, for the case. A trophy count is not stored anywhere as
  // a total — it is the history, so the shelf can never disagree with it.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { data } = await withRetry(() => supabase
        .from('daily_battle_results')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(LIFETIME_LOOKBACK_DAYS * 6))
      if (!cancelled) setRows((data as DailyBattleRow[] | null) ?? [])
    })()
    return () => { cancelled = true }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  usePageReady(!authLoading)

  const counts = useMemo<TrophyCounts>(() => {
    const c: TrophyCounts = { bronze: 0, silver: 0, gold: 0 }
    for (const r of rows ?? []) {
      const t = r.trophy_tier as TrophyTier | null | undefined
      if (t && t in c) c[t]++
    }
    return c
  }, [rows])

  /** A loadout slot was tapped: open its shelf and put it on screen. */
  function jumpTo(kind: ShopKind) {
    setTab(kind)
    shopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (authLoading) return <PageLoader label="OPENING THE CASE" />

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
          fontSize: 9, letterSpacing: 2.5, color: '#F5C842',
          textShadow: '0 0 7px rgba(245,200,66,0.5)',
        }}>TROPHY ROOM</span>
        <span className="flex items-center gap-1.5 px-2 py-1" style={{
          border: '1.5px solid rgba(245,200,66,0.55)',
          borderRadius: 3,
          background: 'rgba(245,200,66,0.10)',
        }}>
          <TrophyCup tier="gold" size={15} shine={false} />
          <span className="font-pixel" style={{ fontSize: 10, color: '#FDE68A' }}>
            {trophies.loaded ? trophies.balance : '—'}
          </span>
        </span>
      </div>

      <div className="relative flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4"
        style={{ paddingBottom: 40 }}>

        <TrophyCase
          counts={counts}
          loading={rows === null}
          streak={lifetimeWLT?.myStreak}
        />

        <EquippedBar
          cos={cos}
          name={profile?.name?.split(' ')[0] || 'YOU'}
          onJump={jumpTo}
        />

        <div ref={shopRef} style={{ scrollMarginTop: 8 }}>
          <TrophyShopView tab={tab} onTab={setTab} onBuy={setBuying} onUse={setUsing} />
        </div>
      </div>

      {buying && <TrophyBuySheet item={buying} onClose={() => setBuying(null)} />}
      {using && <UsePrivilegeSheet item={using} onClose={() => setUsing(null)} />}
    </div>
  )
}
