'use client'

// ═══════════════════════════════════════════════════════════════════════════
// ROOM DECOR — the prop the household has hanging in this room.
//
// One layer, mounted once by CareSceneHost, that reads the active room out of
// the shared eren_stats map. Deliberately NOT four copies inside four scenes:
// the scenes are heavy and re-render on every drag frame, and decor has no
// business being reconciled at touch-move rate.
//
// Sits above the room art and below Eren, so a shelf is on the wall behind him
// rather than pasted over his face.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { withRetry } from '@/lib/supabaseRetry'
import { decorDef } from '@/lib/trophyShop'
import { LIFETIME_LOOKBACK_DAYS, type DailyBattleRow } from '@/lib/battleResults'
import type { TrophyTier } from '@/lib/dailyTwist'
import DecorArt, { type TrophyCounts } from './DecorArt'

/** Under Eren (rooms paint him around z-10) and over the background. */
const Z_DECOR = 3

export default function RoomDecor({ room }: { room: string }) {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { stats } = useErenStats(profile?.household_id ?? null)
  const [counts, setCounts] = useState<TrophyCounts | null>(null)

  const itemId = (stats?.room_decor as Record<string, string> | null | undefined)?.[room]
  const def = decorDef(itemId)
  const needsCounts = def?.art === 'trophy_shelf'

  // Only the shelf reads history, and only when it is actually hanging.
  useEffect(() => {
    if (!needsCounts || !user?.id) return
    let cancelled = false
    ;(async () => {
      const { data } = await withRetry(() => supabase
        .from('daily_battle_results')
        .select('trophy_tier')
        .eq('user_id', user.id)
        .not('trophy_tier', 'is', null)
        .order('date', { ascending: false })
        .limit(LIFETIME_LOOKBACK_DAYS * 6))
      if (cancelled) return
      const c: TrophyCounts = { bronze: 0, silver: 0, gold: 0 }
      for (const r of (data ?? []) as Pick<DailyBattleRow, 'trophy_tier'>[]) {
        const t = r.trophy_tier as TrophyTier | null
        if (t && t in c) c[t]++
      }
      setCounts(c)
    })()
    return () => { cancelled = true }
  }, [needsCounts, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!def) return null

  return (
    <div
      aria-hidden
      className="fixed pointer-events-none"
      style={{
        left: `${def.at.left}%`,
        top: `${def.at.top}%`,
        width: `${def.at.width}%`,
        zIndex: Z_DECOR,
      }}
    >
      <DecorArt art={def.art} counts={counts ?? undefined} />
    </div>
  )
}
