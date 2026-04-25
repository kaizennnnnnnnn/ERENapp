'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { LEVEL_REWARDS, MAX_LEVEL, type LevelReward, type FoodKind } from '@/lib/levelRewards'
import { xpForNextLevel, totalXpForLevel } from '@/lib/tasks'
import {
  IconCoin, IconSparkles, IconTicket, IconMeat, IconFish, IconStar, IconCrown,
} from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'

// ── Reward icon dispatcher ───────────────────────────────────────────────────
function RewardIcon({ r, size = 28 }: { r: LevelReward; size?: number }) {
  if (r.kind === 'coins')    return <IconCoin size={size} />
  if (r.kind === 'stardust') return <IconSparkles size={size} />
  if (r.kind === 'tickets')  return <IconTicket size={size} />
  // food — render per-kind pixel
  switch (r.food) {
    case 'kibble': return <Kibble size={size} />
    case 'fish':   return <IconFish size={size} />
    case 'treat':  return <Treat size={size} />
    case 'tuna':   return <Tuna size={size} />
    case 'steak':  return <IconMeat size={size} />
    case 'cream':  return <Cream size={size} />
    default:       return <IconCoin size={size} />
  }
}

// ── Tiny SVG food icons (local — don't leak into global icons) ───────────────
function Kibble({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="3" width="6" height="6" fill="#D4892A" />
      <rect x="4" y="4" width="4" height="4" fill="#F5C842" />
      <rect x="4" y="4" width="1" height="1" fill="#FFF4A3" />
    </svg>
  )
}
function Treat({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="3" width="6" height="6" fill="#FF6B9D" transform="rotate(20 6 6)" />
      <rect x="4" y="4" width="4" height="4" fill="#FFB0C8" transform="rotate(20 6 6)" />
    </svg>
  )
}
function Tuna({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="1" y="3" width="10" height="7" fill="#4A8BC8" />
      <rect x="1" y="3" width="10" height="1" fill="#FFFFFF" />
      <rect x="1" y="9" width="10" height="1" fill="#2A5A88" />
      <rect x="4" y="1" width="4" height="2" fill="#6BA0D8" />
    </svg>
  )
}
function Cream({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="2" width="6" height="2" fill="#FFFFFF" />
      <rect x="2" y="4" width="8" height="6" fill="#E9D5FF" />
      <rect x="3" y="10" width="6" height="1" fill="#A78BFA" />
    </svg>
  )
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

// ── Eren sprite — standing/idle pose (compact) ───────────────────────────────
function ErenChibi({ size = 56, hop = false }: { size?: number; hop?: boolean }) {
  return (
    <div style={{ animation: hop ? 'erenHop 0.9s ease-in-out infinite' : 'erenStand 1.6s ease-in-out infinite' }}>
      <svg width={size} height={size} viewBox="0 0 22 22" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
        {/* ears */}
        <rect x="3" y="2" width="3" height="1" fill="#4A2E1A" />
        <rect x="16" y="2" width="3" height="1" fill="#4A2E1A" />
        <rect x="3" y="3" width="3" height="2" fill="#9B7A5C" />
        <rect x="16" y="3" width="3" height="2" fill="#9B7A5C" />
        <rect x="4" y="4" width="1" height="1" fill="#F4B0B8" />
        <rect x="17" y="4" width="1" height="1" fill="#F4B0B8" />
        {/* head */}
        <rect x="5" y="3" width="12" height="1" fill="#4A2E1A" />
        <rect x="4" y="4" width="14" height="1" fill="#4A2E1A" />
        <rect x="3" y="5" width="16" height="1" fill="#4A2E1A" />
        <rect x="4" y="5" width="14" height="1" fill="#F9EDD5" />
        <rect x="3" y="6" width="1" height="6" fill="#4A2E1A" />
        <rect x="18" y="6" width="1" height="6" fill="#4A2E1A" />
        <rect x="4" y="6" width="14" height="6" fill="#F9EDD5" />
        {/* Ragdoll brown mask */}
        <rect x="5" y="6" width="3" height="2" fill="#D4B896" />
        <rect x="14" y="6" width="3" height="2" fill="#D4B896" />
        {/* eyes */}
        <rect x="6" y="7" width="2" height="2" fill="#6BAED6" />
        <rect x="7" y="7" width="1" height="1" fill="#FFFFFF" />
        <rect x="6" y="8" width="1" height="1" fill="#1A1A2E" />
        <rect x="14" y="7" width="2" height="2" fill="#6BAED6" />
        <rect x="14" y="7" width="1" height="1" fill="#FFFFFF" />
        <rect x="15" y="8" width="1" height="1" fill="#1A1A2E" />
        {/* nose */}
        <rect x="10" y="9" width="2" height="1" fill="#F48B9B" />
        <rect x="10" y="10" width="2" height="1" fill="#4A2E1A" />
        {/* mouth */}
        <rect x="9" y="11" width="1" height="1" fill="#4A2E1A" />
        <rect x="12" y="11" width="1" height="1" fill="#4A2E1A" />
        <rect x="10" y="11" width="2" height="1" fill="#F9EDD5" />
        {/* chin */}
        <rect x="4" y="12" width="14" height="1" fill="#4A2E1A" />
        <rect x="5" y="12" width="12" height="1" fill="#F9EDD5" />
        {/* body */}
        <rect x="4" y="13" width="14" height="1" fill="#4A2E1A" />
        <rect x="3" y="14" width="1" height="5" fill="#4A2E1A" />
        <rect x="18" y="14" width="1" height="5" fill="#4A2E1A" />
        <rect x="4" y="14" width="14" height="5" fill="#F9EDD5" />
        <rect x="4" y="19" width="14" height="1" fill="#4A2E1A" />
        {/* paws */}
        <rect x="5" y="19" width="2" height="1" fill="#D4B896" />
        <rect x="15" y="19" width="2" height="1" fill="#D4B896" />
        <rect x="5" y="20" width="3" height="1" fill="#4A2E1A" />
        <rect x="14" y="20" width="3" height="1" fill="#4A2E1A" />
        {/* whiskers */}
        <rect x="1" y="9" width="3" height="1" fill="rgba(255,255,255,0.6)" />
        <rect x="18" y="9" width="3" height="1" fill="rgba(255,255,255,0.6)" />
        <rect x="1" y="11" width="3" height="1" fill="rgba(255,255,255,0.6)" />
        <rect x="18" y="11" width="3" height="1" fill="rgba(255,255,255,0.6)" />
      </svg>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function RewardsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, profile } = useAuth()
  const { xp, level, addCoins } = useTasks()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(false) }, [setHideStats])

  const [claimedLevel, setClaimedLevel] = useState<number>(0)
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
    supabase.from('profiles').select('claimed_level').eq('id', user.id).single()
      .then(({ data }) => {
        if (data && typeof data.claimed_level === 'number') {
          setClaimedLevel(data.claimed_level)
        } else {
          setClaimedLevel(0)
        }
      })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll to current level on first load ────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      currentNodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 260)
    return () => clearTimeout(t)
  }, [])

  // ── Claim next level reward ────────────────────────────────────────────────
  const nextClaimable = claimedLevel + 1
  const canClaim = nextClaimable <= level && nextClaimable <= MAX_LEVEL

  async function claimNext() {
    if (!user?.id || !profile?.household_id || !canClaim || claiming) return
    const reward = LEVEL_REWARDS[nextClaimable - 1]
    if (!reward) return

    setClaiming(true)
    try {
      // Grant the reward
      if (reward.kind === 'coins') {
        await addCoins(reward.amount)
      } else if (reward.kind === 'stardust') {
        // Fetch current stardust and update
        const { data } = await supabase.from('user_gacha_state').select('stardust').eq('user_id', user.id).single()
        const cur = data?.stardust ?? 0
        // Try to update; insert if missing
        const { error } = await supabase.from('user_gacha_state').update({ stardust: cur + reward.amount }).eq('user_id', user.id)
        if (error) {
          await supabase.from('user_gacha_state').insert({ user_id: user.id, stardust: reward.amount, pulls_since_epic: 0, pulls_since_legendary: 0, total_pulls: 0 })
        }
      } else if (reward.kind === 'tickets') {
        const { data } = await supabase.from('user_gacha_state').select('gacha_tickets').eq('user_id', user.id).single()
        const cur = (data as Record<string, number> | null)?.gacha_tickets ?? 0
        const { error } = await supabase.from('user_gacha_state').update({ gacha_tickets: cur + reward.amount }).eq('user_id', user.id)
        if (error) {
          await supabase.from('user_gacha_state').insert({ user_id: user.id, stardust: 0, gacha_tickets: reward.amount, pulls_since_epic: 0, pulls_since_legendary: 0, total_pulls: 0 })
        }
      } else if (reward.kind === 'food' && reward.food) {
        // Update eren_stats.food_inventory
        const { data: stats } = await supabase.from('eren_stats').select('food_inventory').eq('household_id', profile.household_id).single()
        const inv = (stats?.food_inventory ?? {}) as Record<string, number>
        inv[reward.food] = (inv[reward.food] ?? 0) + reward.amount
        await supabase.from('eren_stats').update({ food_inventory: inv }).eq('household_id', profile.household_id)
      }

      // Bump claimed_level
      await supabase.from('profiles').update({ claimed_level: nextClaimable }).eq('id', user.id)
      setClaimedLevel(nextClaimable)
      setFanfare(f => f + 1)
      setToast({ msg: `Level ${nextClaimable} claimed!`, reward })
      setTimeout(() => setToast(null), 2400)
    } finally {
      setClaiming(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const nodes = useMemo(() => LEVEL_REWARDS, [])

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden" style={{
      background: 'radial-gradient(ellipse at top, #2D1659 0%, #1A0A33 55%, #0F0620 100%)',
    }}>
      {/* Star field */}
      <div className="absolute inset-0 pointer-events-none opacity-45" style={{
        backgroundImage: 'radial-gradient(circle, #FFD700 1px, transparent 1px), radial-gradient(circle, #A78BFA 1px, transparent 1px)',
        backgroundSize: '34px 34px, 52px 52px',
        backgroundPosition: '0 0, 18px 24px',
        animation: 'starDrift 26s linear infinite',
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
            <span className="font-pixel text-white" style={{ fontSize: 8 }}>{claimedLevel}/100</span>
          </div>
        </div>

        {canClaim ? (
          <button onClick={() => { playSound('ui_tap'); claimNext() }} disabled={claiming}
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
            <span className="relative">{claiming ? 'CLAIMING…' : `CLAIM LVL ${nextClaimable}`}</span>
          </button>
        ) : (
          <div className="w-full py-2 text-center"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '2px dashed rgba(167,139,250,0.35)',
              borderRadius: 3,
              fontFamily: '"Press Start 2P"', fontSize: 7, color: '#A78BFA',
            }}>
            {claimedLevel >= MAX_LEVEL
              ? 'ALL 100 REWARDS CLAIMED ★'
              : `REACH LVL ${nextClaimable} TO UNLOCK NEXT REWARD`}
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
              const claimable = idx > claimedLevel && idx <= level
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

                  {/* Node card */}
                  <div className="relative flex items-center gap-2.5 p-2.5"
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
                    }}>
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

                    {/* Eren sprite anchored to current level (always on open side of row) */}
                    {isCurrent && (
                      <div className="absolute pointer-events-none" style={{
                        [left ? 'right' : 'left']: -54,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 5,
                      }}>
                        <div key={fanfare} style={{ animation: 'erenLand 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
                          <ErenChibi size={54} hop />
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
        @keyframes starDrift {
          from { background-position: 0 0, 18px 24px; }
          to   { background-position: 140px 0, 158px 24px; }
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
