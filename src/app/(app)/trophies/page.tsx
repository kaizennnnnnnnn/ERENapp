'use client'

// ═══════════════════════════════════════════════════════════════════════════
// /trophies — the case and the shop.
//
// Reached from the morning verdict screen's SHOP button and from the home nav.
// The case is above the shop on purpose: you should see what you have won
// before you see what it buys.
// ═══════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCare } from '@/contexts/CareContext'
import { useTrophies } from '@/hooks/useTrophies'
import { usePageReady } from '@/hooks/usePageReady'
import { withRetry } from '@/lib/supabaseRetry'
import { LIFETIME_LOOKBACK_DAYS, type DailyBattleRow } from '@/lib/battleResults'
import { TROPHY_TONE, type TrophyTier } from '@/lib/dailyTwist'
import type { AnyShopItem, PrivilegeItem } from '@/lib/trophyShop'
import TrophyShopView from '@/components/trophies/TrophyShopView'
import TrophyBuySheet from '@/components/trophies/TrophyBuySheet'
import UsePrivilegeSheet from '@/components/trophies/UsePrivilegeSheet'
import DecorArt, { type TrophyCounts } from '@/components/trophies/DecorArt'
import PageLoader from '@/components/PageLoader'
import { OBSIDIAN_FACE, Rivets } from '@/components/obsidian'
import { IconTrophyTier, IconDoor, IconFire } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

export default function TrophiesPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()
  const { lifetimeWLT } = useCouple()
  const { setHideStats } = useCare()
  const trophies = useTrophies()

  const [rows, setRows] = useState<DailyBattleRow[] | null>(null)
  const [buying, setBuying] = useState<AnyShopItem | null>(null)
  const [using, setUsing] = useState<PrivilegeItem | null>(null)

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

  const totalWon = counts.bronze + counts.silver + counts.gold

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
          <IconTrophyTier size={13} tier="gold" />
          <span className="font-pixel" style={{ fontSize: 10, color: '#FDE68A' }}>
            {trophies.loaded ? trophies.balance : '—'}
          </span>
        </span>
      </div>

      <div className="relative flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4"
        style={{ paddingBottom: 40 }}>

        {/* ── The case ── */}
        <div className="relative px-3 pt-3 pb-3" style={{
          ...OBSIDIAN_FACE,
          border: '1.5px solid rgba(245,200,66,0.45)',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.55), 0 0 18px rgba(245,200,66,0.16)',
        }}>
          <Rivets inset={4} size={3} />

          <p className="font-pixel text-center" style={{
            fontSize: 7, letterSpacing: 2, color: '#9A8AA8', marginBottom: 10,
          }}>YOUR CASE</p>

          <div className="mx-auto" style={{ maxWidth: 260 }}>
            <DecorArt art="trophy_shelf" counts={counts} />
          </div>

          <div className="flex justify-center gap-2 mt-3">
            {(['gold', 'silver', 'bronze'] as TrophyTier[]).map(t => (
              <div key={t} className="flex items-center gap-1 px-2 py-1" style={{
                border: `1px solid ${TROPHY_TONE[t]}55`,
                background: `${TROPHY_TONE[t]}10`,
                borderRadius: 3,
              }}>
                <IconTrophyTier size={11} tier={t} />
                <span className="font-pixel" style={{ fontSize: 7, color: TROPHY_TONE[t] }}>
                  {counts[t]}
                </span>
              </div>
            ))}
          </div>

          <p className="text-center text-[10px] mt-2.5" style={{ color: '#8B7F9B' }}>
            {rows === null
              ? 'Counting…'
              : totalWon === 0
                ? 'Nothing on the shelf yet. Win a day.'
                : `${totalWon} day${totalWon === 1 ? '' : 's'} won.`}
          </p>

          {lifetimeWLT && lifetimeWLT.myStreak > 1 && (
            <div className="flex justify-center mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1" style={{
                border: '1px solid rgba(255,107,61,0.5)',
                background: 'rgba(255,107,61,0.10)',
                borderRadius: 3,
              }}>
                <IconFire size={11} />
                <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1, color: '#FF9A6B' }}>
                  {lifetimeWLT.myStreak} IN A ROW
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ── The shop ── */}
        <TrophyShopView onBuy={setBuying} onUse={setUsing} />
      </div>

      {buying && <TrophyBuySheet item={buying} onClose={() => setBuying(null)} />}
      {using && <UsePrivilegeSheet item={using} onClose={() => setUsing(null)} />}
    </div>
  )
}
