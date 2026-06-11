'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withRetry } from '@/lib/supabaseRetry'
import { onForeground } from '@/lib/onForeground'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { LEVEL_REWARDS, MAX_LEVEL, type LevelReward } from '@/lib/levelRewards'
import { xpForNextLevel, totalXpForLevel } from '@/lib/tasks'
import {
  IconCoin, IconSparkles, IconTicket, IconStar, IconCrown,
} from '@/components/PixelIcons'
import PageLoader from '@/components/PageLoader'
import AnimatedEren from '@/components/AnimatedEren'
import { usePageReady } from '@/hooks/usePageReady'
import { playSound } from '@/lib/sounds'

// ── Food color map for reward icons ──────────────────────────────────────────
const FOOD_COLORS: Record<string, string> = {
  kibble: '#D4A44A', fish: '#5BA3D9', treat: '#FF6B9D', tuna: '#E8A020',
  steak: '#CC3333', cream: '#A78BFA', biscuit: '#C8956A', shrimp: '#F0836A',
  salmon: '#E8735A', chicken: '#E8B44A', sausage: '#A0522D', milk: '#E8E4E0',
  cheese: '#F5C842', yogurt: '#FFB6C1', cake: '#FF85A2', sushi: '#2D9B6A',
  sardine: '#7BAFC8', egg: '#F5E6C8',
}

function FoodRewardIcon({ food, size = 24 }: { food?: string; size?: number }) {
  const c = FOOD_COLORS[food ?? ''] ?? '#aaa'
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="2" y="3" width="8" height="6" fill={c} />
      <rect x="3" y="2" width="6" height="1" fill={c} opacity={0.7} />
      <rect x="3" y="9" width="6" height="1" fill={c} opacity={0.5} />
      <rect x="3" y="4" width="2" height="1" fill="rgba(255,255,255,0.4)" />
    </svg>
  )
}

// ── Reward icon dispatcher ───────────────────────────────────────────────────
function RewardIcon({ r, size = 28 }: { r: LevelReward; size?: number }) {
  if (r.kind === 'coins')    return <IconCoin size={size} />
  if (r.kind === 'stardust') return <IconSparkles size={size} />
  if (r.kind === 'tickets')  return <IconTicket size={size} />
  return <FoodRewardIcon food={r.food} size={size} />
}

// ── Node tint by reward kind ─────────────────────────────────────────────────
function tintFor(r: LevelReward): { bg: string; border: string; glow: string } {
  if (r.isMega)      return { bg: 'linear-gradient(135deg, #FFD700 0%, #F59E0B 100%)', border: '#B45309', glow: 'rgba(251,191,36,0.7)' }
  if (r.isMilestone) return { bg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', border: '#92400E', glow: 'rgba(245,158,11,0.55)' }
  if (r.kind === 'tickets')  return { bg: 'linear-gradient(135deg, #F472B6 0%, #DB2777 100%)', border: '#9D174D', glow: 'rgba(244,114,182,0.55)' }
  if (r.kind === 'stardust') return { bg: 'linear-gradient(135deg, #C084FC 0%, #7C3AED 100%)', border: '#4C1D95', glow: 'rgba(167,139,250,0.55)' }
  if (r.kind === 'food')     return { bg: 'linear-gradient(135deg, #86EFAC 0%, #16A34A 100%)', border: '#166534', glow: 'rgba(74,222,128,0.55)' }
  // coins
  return { bg: 'linear-gradient(135deg, #FDE68A 0%, #FBBF24 100%)', border: '#B45309', glow: 'rgba(251,191,36,0.45)' }
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function RewardsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { addCoins } = useTasks()
  const { setHideStats } = useCare()
  // The reward road has its own header — hide the persistent StatsHeader
  // while we're here and put it back on unmount.
  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  // Read level/xp directly from profile to avoid the TaskContext sync race
  // that was flashing "level 1" on every entry while profile loaded.
  const level = profile?.level ?? 1
  const xp    = profile?.xp ?? 0

  const [claimedLevel, setClaimedLevel] = useState<number>(0)
  // False until the claimed_level read succeeds. A transient Supabase 503
  // used to read as claimed_level=0, which put every level back into the
  // claimable state — CLAIM ALL would then re-grant (and double-pay) all
  // previously claimed rewards.
  const [claimedLoaded, setClaimedLoaded] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [toast, setToast] = useState<{ msg: string; reward: LevelReward } | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const currentNodeRef = useRef<HTMLDivElement>(null)
  const [fanfare, setFanfare] = useState(0) // bumps on claim for animation

  // XP progress inside current level for header bar
  const xpIntoLevel = xp - totalXpForLevel(level)
  const xpNeeded    = xpForNextLevel(level)
  const xpPct       = Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))

  // ── Load claimed_level ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    let loaded = false
    const load = () => {
      withRetry(() => supabase.from('profiles').select('claimed_level').eq('id', user.id).maybeSingle())
        .then(({ data, error }) => {
          if (error) return // outage — placeholders stay up; foreground return retries
          loaded = true
          setClaimedLevel(typeof data?.claimed_level === 'number' ? data.claimed_level : 0)
          setClaimedLoaded(true)
        })
    }
    load()
    // Self-heal: keep retrying on return to foreground until the first success.
    return onForeground(() => { if (!loaded) load() })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll to current level once profile is loaded ───────────────────
  useEffect(() => {
    if (!profile) return
    const t = setTimeout(() => {
      currentNodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 260)
    return () => clearTimeout(t)
  }, [profile])

  // ── Claim a contiguous run of rewards: from claimedLevel+1 up to `target` ─
  // Click on any claimable node calls claimUpTo(idx); Claim All calls
  // claimUpTo(level). Aggregates DB writes into one update per kind.
  const cap = Math.min(level, MAX_LEVEL)
  const claimableCount = claimedLoaded ? Math.max(0, cap - claimedLevel) : 0
  const canClaimAny    = claimableCount > 0

  async function claimUpTo(target: number) {
    if (!user?.id || !profile?.household_id || claiming || !claimedLoaded) return
    if (target <= claimedLevel || target > level || target > MAX_LEVEL) return

    setClaiming(true)
    try {
      // Aggregate every reward in [claimedLevel+1 .. target]
      let totalCoins = 0, totalStardust = 0, totalTickets = 0
      const foodToAdd: Record<string, number> = {}

      for (let lvl = claimedLevel + 1; lvl <= target; lvl++) {
        const reward = LEVEL_REWARDS[lvl - 1]
        if (!reward) continue
        if (reward.kind === 'coins')         totalCoins    += reward.amount
        else if (reward.kind === 'stardust') totalStardust += reward.amount
        else if (reward.kind === 'tickets')  totalTickets  += reward.amount
        else if (reward.kind === 'food' && reward.food) {
          foodToAdd[reward.food] = (foodToAdd[reward.food] ?? 0) + reward.amount
        }
      }

      // Read-before-write: fetch both balances up front and abort if either
      // read fails. A transient Supabase 503 here used to read as "0
      // stardust" / "empty fridge", and the read-modify-write below then
      // clobbered the real balances with just the claim amounts.
      let gacha: Record<string, number> | null = null
      if (totalStardust > 0 || totalTickets > 0) {
        const { data, error } = await withRetry(() => supabase
          .from('user_gacha_state').select('stardust, gacha_tickets').eq('user_id', user.id).maybeSingle())
        if (error) return // nothing written yet — the node stays claimable
        gacha = data as Record<string, number> | null
      }
      let foodInv: Record<string, number> | null = null
      if (Object.keys(foodToAdd).length > 0) {
        const { data: stats, error } = await withRetry(() => supabase
          .from('eren_stats').select('food_inventory').eq('household_id', profile.household_id).maybeSingle())
        if (error) return
        foodInv = (stats?.food_inventory ?? {}) as Record<string, number>
      }

      if (totalCoins > 0) await addCoins(totalCoins)

      if (totalStardust > 0 || totalTickets > 0) {
        if (gacha) {
          const updates: Record<string, number> = {}
          if (totalStardust > 0) updates.stardust       = (gacha.stardust ?? 0) + totalStardust
          if (totalTickets  > 0) updates.gacha_tickets  = (gacha.gacha_tickets ?? 0) + totalTickets
          await supabase.from('user_gacha_state').update(updates).eq('user_id', user.id)
        } else {
          // Genuinely no row yet (maybeSingle returned 0 rows, not an error).
          await supabase.from('user_gacha_state').insert({
            user_id: user.id,
            stardust: totalStardust,
            gacha_tickets: totalTickets,
            pulls_since_epic: 0, pulls_since_legendary: 0, total_pulls: 0,
          })
        }
      }

      if (foodInv) {
        for (const [f, n] of Object.entries(foodToAdd)) foodInv[f] = (foodInv[f] ?? 0) + n
        await supabase.from('eren_stats').update({ food_inventory: foodInv }).eq('household_id', profile.household_id)
      }

      const claimedCount = target - claimedLevel
      await supabase.from('profiles').update({ claimed_level: target }).eq('id', user.id)
      setClaimedLevel(target)
      // Tell the StatsHeader (and any other listener) the badge count changed.
      try { window.dispatchEvent(new Event('eren:rewards-claimed')) } catch { /* ignore */ }
      setFanfare(f => f + 1)
      setToast({
        msg: claimedCount === 1 ? `Level ${target} claimed!` : `Claimed ${claimedCount} rewards!`,
        reward: LEVEL_REWARDS[target - 1],
      })
      setTimeout(() => setToast(null), 2400)
    } finally {
      setClaiming(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const nodes = useMemo(() => LEVEL_REWARDS, [])

  // Don't render the road until the profile is loaded — otherwise the level
  // pill, "current node" anchor, and auto-scroll all snap to the default
  // level=1 for a moment before the real value lands.
  usePageReady(!!user && !!profile)

  if (!user || !profile) return <PageLoader label="LOADING REWARDS" />

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden" style={{
      background: 'radial-gradient(ellipse at top, #2D1659 0%, #1A0A33 55%, #0F0620 100%)',
    }}>
      {/* Star field — drifts via transform (composited) instead of
          background-position so the GPU moves a cached layer rather than
          repainting the full viewport every frame. The -140px left overhang
          plus +140px background offset keeps dot positions pixel-identical. */}
      <div className="absolute inset-0 pointer-events-none opacity-45" style={{
        left: -140,
        backgroundImage: 'radial-gradient(circle, #FFD700 1px, transparent 1px), radial-gradient(circle, #A78BFA 1px, transparent 1px)',
        backgroundSize: '34px 34px, 52px 52px',
        backgroundPosition: '140px 0, 158px 24px',
        animation: 'rewardsStarDrift 26s linear infinite',
        willChange: 'transform',
      }} />

      {/* Header */}
      <div className="relative z-20 flex items-center gap-2 px-3 pt-3 pb-2" style={{
        background: 'linear-gradient(180deg, rgba(12,6,26,0.95) 0%, rgba(12,6,26,0.6) 100%)',
        borderBottom: '2px solid rgba(167,139,250,0.3)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.08)', borderRadius: 6, border: '2px solid rgba(167,139,250,0.5)', boxShadow: '0 2px 0 rgba(0,0,0,0.3)' }}>
          <ChevronLeft size={18} className="text-purple-200" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="font-pixel text-white px-3 py-1.5 inline-flex items-center gap-1.5"
            style={{ background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,215,0,0.6)', borderRadius: 4, fontSize: 8, letterSpacing: 2, textShadow: '1px 1px 0 rgba(0,0,0,0.6)' }}>
            <IconCrown size={14} />
            REWARD ROAD
          </span>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* Sub-header — level + XP + claim CTA */}
      <div className="relative z-20 px-3 py-2.5" style={{
        background: 'linear-gradient(180deg, rgba(12,6,26,0.9) 0%, rgba(12,6,26,0.5) 100%)',
        borderBottom: '2px solid rgba(167,139,250,0.25)',
      }}>
        <div className="flex items-center gap-2 mb-2">
          {/* Level pill */}
          <div className="flex items-center gap-1.5 px-2 py-1" style={{
            background: 'linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%)',
            border: '2px solid #4C1D95',
            borderRadius: 4,
            boxShadow: '0 2px 0 #2E0F5C, inset 0 1px 0 rgba(255,255,255,0.3)',
          }}>
            <span className="font-pixel text-purple-100" style={{ fontSize: 6, letterSpacing: 1.5 }}>LVL</span>
            <span className="font-pixel text-white" style={{ fontSize: 12, letterSpacing: -0.5, textShadow: '1px 1px 0 #2E0F5C' }}>{level}</span>
          </div>

          {/* XP bar */}
          <div className="flex-1 relative overflow-hidden" style={{
            height: 10,
            background: '#0F0820',
            border: '2px solid rgba(167,139,250,0.45)',
            borderRadius: 2,
            boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.7)',
          }}>
            <div style={{
              height: '100%',
              width: `${xpPct}%`,
              background: 'linear-gradient(180deg, #E5C8FF 0%, #C084FC 25%, #7C3AED 100%)',
              transition: 'width 0.7s',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }} />
          </div>

          {/* Claim badge */}
          <div className="flex flex-col items-end">
            <span className="font-pixel text-amber-300" style={{ fontSize: 5, letterSpacing: 1 }}>CLAIMED</span>
            {/* Neutral placeholder until the read succeeds — "0/100" would be a lie. */}
            <span className="font-pixel text-white" style={{ fontSize: 8 }}>{claimedLoaded ? `${claimedLevel}/100` : '—/100'}</span>
          </div>
        </div>

        {canClaimAny ? (
          <button onClick={() => { playSound('gift_open'); claimUpTo(cap) }} disabled={claiming}
            className="w-full py-2 text-white active:translate-y-[2px] transition-transform disabled:opacity-60 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 55%, #92400E 100%)',
              border: '2px solid #B45309',
              borderRadius: 3,
              boxShadow: '0 4px 0 #78350F, inset 0 1px 0 rgba(255,255,255,0.35), 0 0 14px rgba(245,158,11,0.5)',
              fontFamily: '"Press Start 2P"',
              fontSize: 9,
              letterSpacing: 1.5,
            }}>
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
              animation: 'claimShine 2.2s ease-in-out infinite',
            }} />
            <span className="relative">
              {claiming ? 'CLAIMING…' : `CLAIM ALL (${claimableCount})`}
            </span>
          </button>
        ) : (
          <div className="w-full py-2 text-center"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '2px dashed rgba(167,139,250,0.35)',
              borderRadius: 3,
              fontFamily: '"Press Start 2P"', fontSize: 7, color: '#A78BFA',
            }}>
            {/* While claimed_level hasn't loaded, "REACH LVL 1" would be false. */}
            {!claimedLoaded
              ? 'LOADING…'
              : claimedLevel >= MAX_LEVEL
                ? 'ALL 100 REWARDS CLAIMED ★'
                : `REACH LVL ${claimedLevel + 1} TO UNLOCK NEXT REWARD`}
          </div>
        )}
      </div>

      {/* Road */}
      <div ref={scrollerRef} className="relative z-10 flex-1 overflow-y-auto pb-20">
        {/* SVG path line — rendered behind nodes */}
        <div className="relative">
          <div className="py-6 flex flex-col">
            {nodes.map((reward, i) => {
              const idx = i + 1
              const left = i % 2 === 0 // zigzag: even idx-1 left, odd right
              const claimed = idx <= claimedLevel
              const claimable = claimedLoaded && idx > claimedLevel && idx <= level
              const locked = idx > level
              const isCurrent = idx === level
              const tint = tintFor(reward)

              return (
                <div key={idx}
                  ref={isCurrent ? currentNodeRef : undefined}
                  className="relative flex items-center py-3 px-4"
                  style={{ justifyContent: left ? 'flex-start' : 'flex-end' }}>
                  {/* Connector line to next node */}
                  {idx < MAX_LEVEL && (
                    <div className="absolute pointer-events-none" style={{
                      left: '50%', top: '50%',
                      width: 3, height: 56,
                      background: claimed
                        ? 'linear-gradient(180deg, #FFD700, #F59E0B)'
                        : 'repeating-linear-gradient(180deg, rgba(167,139,250,0.35) 0 3px, transparent 3px 6px)',
                      transform: 'translateX(-50%)',
                      zIndex: 0,
                    }} />
                  )}

                  {/* Node card — claimable nodes are tap-to-claim */}
                  <div
                    role={claimable ? 'button' : undefined}
                    onClick={claimable && !claiming ? () => { playSound('gift_open'); claimUpTo(idx) } : undefined}
                    className="relative flex items-center gap-2.5 p-2.5 transition-transform"
                    style={{
                      background: locked ? 'rgba(255,255,255,0.06)' : tint.bg,
                      border: `3px solid ${locked ? 'rgba(167,139,250,0.3)' : tint.border}`,
                      borderRadius: 5,
                      boxShadow: locked
                        ? '0 3px 0 rgba(0,0,0,0.4)'
                        : claimed
                          ? `0 3px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.35), 0 0 10px ${tint.glow}`
                          : claimable
                            ? `0 3px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4), 0 0 16px ${tint.glow}`
                            : '0 3px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                      minWidth: 190, maxWidth: 220,
                      opacity: locked ? 0.62 : 1,
                      animation: claimable ? 'nodePulse 1.4s ease-in-out infinite' : 'none',
                      cursor: claimable && !claiming ? 'pointer' : 'default',
                    }}
                    onPointerDown={claimable && !claiming ? e => { e.currentTarget.style.transform = 'translateY(2px)' } : undefined}
                    onPointerUp={claimable && !claiming ? e => { e.currentTarget.style.transform = '' } : undefined}
                    onPointerLeave={claimable && !claiming ? e => { e.currentTarget.style.transform = '' } : undefined}
                  >
                    {/* Rivets */}
                    {!locked && (
                      <>
                        <div style={{ position: 'absolute', top: 2, left: 2, width: 3, height: 3, background: '#FFD700', opacity: 0.85 }} />
                        <div style={{ position: 'absolute', top: 2, right: 2, width: 3, height: 3, background: '#FFD700', opacity: 0.85 }} />
                        <div style={{ position: 'absolute', bottom: 2, left: 2, width: 3, height: 3, background: '#FFD700', opacity: 0.85 }} />
                        <div style={{ position: 'absolute', bottom: 2, right: 2, width: 3, height: 3, background: '#FFD700', opacity: 0.85 }} />
                      </>
                    )}

                    {/* Level badge */}
                    <div className="flex flex-col items-center justify-center flex-shrink-0"
                      style={{
                        width: 40, height: 40,
                        background: 'rgba(0,0,0,0.45)',
                        border: '2px solid rgba(255,255,255,0.35)',
                        borderRadius: 4,
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                      }}>
                      <span className="font-pixel" style={{ fontSize: 4, color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>LVL</span>
                      <span className="font-pixel text-white" style={{ fontSize: 13, lineHeight: 1, textShadow: '1px 1px 0 rgba(0,0,0,0.6)' }}>{idx}</span>
                    </div>

                    {/* Reward icon tile */}
                    <div className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 40, height: 40,
                        background: 'rgba(255,255,255,0.85)',
                        border: '2px solid rgba(0,0,0,0.25)',
                        borderRadius: 4,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
                      }}>
                      <RewardIcon r={reward} size={26} />
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className="font-pixel" style={{
                        fontSize: 6,
                        color: locked ? '#C4B5FD' : 'rgba(0,0,0,0.6)',
                        letterSpacing: 1,
                      }}>
                        {reward.isMega ? 'MEGA MILESTONE' : reward.isMilestone ? 'MILESTONE' : 'REWARD'}
                      </p>
                      <p className="font-pixel" style={{
                        fontSize: 7, lineHeight: 1.3,
                        color: locked ? '#E9D5FF' : '#1F1F2E',
                        textShadow: locked ? '0 1px 2px rgba(0,0,0,0.4)' : '0 1px 0 rgba(255,255,255,0.35)',
                        marginTop: 2,
                      }}>
                        {reward.label}
                      </p>
                    </div>

                    {/* Status marker */}
                    {claimed && (
                      <div className="flex-shrink-0 flex items-center justify-center"
                        style={{
                          width: 24, height: 24,
                          background: 'linear-gradient(135deg, #86EFAC, #15803D)',
                          border: '2px solid #166534',
                          borderRadius: 50,
                          boxShadow: '0 2px 0 #14532D, 0 0 6px rgba(134,239,172,0.65)',
                        }}>
                        <span className="font-pixel text-white" style={{ fontSize: 10, lineHeight: 1 }}>✓</span>
                      </div>
                    )}
                    {claimable && (
                      <div className="flex-shrink-0 flex items-center justify-center"
                        style={{
                          width: 24, height: 24,
                          background: 'linear-gradient(135deg, #FFD700, #D97706)',
                          border: '2px solid #92400E',
                          borderRadius: 50,
                          boxShadow: '0 2px 0 #78350F, 0 0 8px rgba(251,191,36,0.8)',
                          animation: 'claimPing 1s ease-in-out infinite',
                        }}>
                        <IconStar size={14} />
                      </div>
                    )}
                    {locked && (
                      <div className="flex-shrink-0 flex items-center justify-center relative"
                        style={{
                          width: 24, height: 24,
                          background: 'rgba(255,255,255,0.08)',
                          border: '2px solid rgba(167,139,250,0.5)',
                          borderRadius: 50,
                        }}>
                        {/* Pixel padlock */}
                        <svg width="12" height="13" viewBox="0 0 10 11" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
                          <rect x="3" y="0" width="4" height="1" fill="#C4B5FD" />
                          <rect x="2" y="1" width="1" height="3" fill="#C4B5FD" />
                          <rect x="7" y="1" width="1" height="3" fill="#C4B5FD" />
                          <rect x="1" y="4" width="8" height="6" fill="#A78BFA" />
                          <rect x="1" y="4" width="8" height="1" fill="#C4B5FD" />
                          <rect x="4" y="6" width="2" height="2" fill="#2E0F5C" />
                          <rect x="4" y="8" width="2" height="1" fill="#2E0F5C" />
                        </svg>
                      </div>
                    )}

                    {/* Eren sprite anchored to current level (always on open
                        side of row). Same AnimatedEren used on every loading
                        screen — its own idle/blink/look/paw/hop sequence runs
                        internally so the marker breathes the same as the
                        loader; the outer erenLand drop-in still replays on
                        claim because we key the wrapper on `fanfare`. The
                        sprite is 22×18 cells at px=3 → 66×54 CSS px (vs the
                        old chibi's 54×54), so the side offset bumps to -66 to
                        keep it flush against the row instead of overlapping. */}
                    {isCurrent && (
                      <div className="absolute pointer-events-none" style={{
                        [left ? 'right' : 'left']: -66,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 5,
                      }}>
                        <div key={fanfare} style={{ animation: 'erenLand 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
                          <AnimatedEren px={3} />
                        </div>
                        {/* Shadow under Eren */}
                        <div className="absolute left-1/2" style={{
                          bottom: -4,
                          width: 40, height: 6,
                          transform: 'translateX(-50%)',
                          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.45) 0%, transparent 70%)',
                        }} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Toast on claim */}
      {toast && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 flex items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #F59E0B 100%)',
            border: '3px solid #92400E',
            borderRadius: 5,
            boxShadow: '0 4px 0 #78350F, 0 0 18px rgba(251,191,36,0.8)',
            animation: 'toastPop 0.6s cubic-bezier(0.34,1.56,0.64,1), toastLinger 1s 1.4s forwards',
          }}>
          <RewardIcon r={toast.reward} size={22} />
          <span className="font-pixel text-amber-900" style={{ fontSize: 9, textShadow: '1px 1px 0 rgba(255,255,255,0.3)' }}>
            {toast.msg}
          </span>
        </div>
      )}

      {/* Keyframes */}
      <style jsx global>{`
        @keyframes rewardsStarDrift {
          from { transform: translateX(0); }
          to   { transform: translateX(140px); }
        }
        @keyframes nodePulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.035); }
        }
        @keyframes claimPing {
          0%, 100% { transform: scale(1); box-shadow: 0 2px 0 #78350F, 0 0 8px rgba(251,191,36,0.8); }
          50%      { transform: scale(1.18); box-shadow: 0 2px 0 #78350F, 0 0 14px rgba(251,191,36,1); }
        }
        @keyframes claimShine {
          0%, 30% { transform: translateX(-120%); }
          70%, 100% { transform: translateX(120%); }
        }
        @keyframes erenStand {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes erenHop {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-7px) rotate(2deg); }
        }
        @keyframes erenLand {
          0%   { transform: translateY(-32px) scale(0.9); opacity: 0.4; }
          60%  { transform: translateY(4px)   scale(1.05); opacity: 1; }
          100% { transform: translateY(0)     scale(1);    opacity: 1; }
        }
        @keyframes toastPop {
          0%   { transform: translate(-50%, -10px) scale(0.6); opacity: 0; }
          100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
        @keyframes toastLinger {
          0%   { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -10px) scale(0.9); }
        }
      `}</style>
    </div>
  )
}
