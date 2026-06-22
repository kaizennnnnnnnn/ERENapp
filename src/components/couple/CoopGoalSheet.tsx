'use client'

// CoopGoalSheet — full detail panel for the "We Cared" weekly co-op goal.
// Slides up when the home strip is tapped. Shows combined progress, each
// partner's contribution, the reward, the time until the weekly reset, what
// counts, and the CLAIM button once the goal is met.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '@/lib/sounds'
import { useCouple } from '@/hooks/useCouple'
import { timeUntilWeekReset } from '@/lib/couple'
import { OBSIDIAN_FACE, OBSIDIAN_BTN } from '@/components/obsidian'
import { IconHeartDuo, IconCoin, IconPaw } from '@/components/PixelIcons'

const GOLD    = '#FBBF24'
const GOLD_HI = '#FDE68A'
const GOLD_LO = '#B45309'
const goldText = { color: GOLD_HI, textShadow: `0 0 6px ${GOLD}55` }

export default function CoopGoalSheet({ onClose }: { onClose: () => void }) {
  const { coopGoal, claimCoopGoal, partner } = useCouple()
  const [mounted, setMounted] = useState(false)
  const [reset, setReset] = useState(() => timeUntilWeekReset())
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setReset(timeUntilWeekReset()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  if (!mounted) return null

  const { combined, mine, partner: partnerCount, target, reward, goalMet, claimed, loaded } = coopGoal
  const pct = Math.min(100, Math.round((combined / target) * 100))
  const remaining = Math.max(0, target - combined)
  const partnerName = (partner?.name ?? 'Partner').split(' ')[0]
  const showClaim = goalMet && loaded && !claimed

  async function handleClaim() {
    if (claiming) return
    setClaiming(true)
    playSound('level_up')
    await claimCoopGoal()
    setClaiming(false)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)' }}
        onClick={() => { playSound('ui_modal_close'); onClose() }} />

      <div className="relative max-w-md w-full mx-auto flex flex-col overflow-hidden p-4 gap-3.5"
        style={{
          ...OBSIDIAN_FACE,
          border: `1px solid ${GOLD}55`,
          borderRadius: '6px 6px 0 0',
          borderBottom: 'none',
          animation: 'cgsSlide 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

        {/* Handle */}
        <div className="flex justify-center" style={{ marginTop: -4 }}>
          <div style={{ width: 36, height: 3, background: GOLD, boxShadow: `0 0 4px ${GOLD}88` }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconHeartDuo size={14} />
            <span className="font-pixel" style={{ fontSize: 9, letterSpacing: 2, ...goldText }}>
              WE CARED
            </span>
          </div>
          <button onClick={() => { playSound('ui_modal_close'); onClose() }}
            className="w-7 h-7 flex items-center justify-center active:translate-y-[1px] transition-transform"
            style={{ ...OBSIDIAN_BTN, color: GOLD_HI, fontFamily: '"Press Start 2P"', fontSize: 8 }}>
            ✕
          </button>
        </div>

        <p className="text-center text-[11px]" style={{ color: '#C9BBA0', lineHeight: 1.5 }}>
          A goal you build <span style={{ color: GOLD_HI }}>together</span> — every bit of care you
          {' '}both give Eren this week adds up.
        </p>

        {/* Big combined progress */}
        <div className="text-center">
          <p className="font-pixel" style={{ fontSize: 34, lineHeight: 1, ...goldText }}>
            {combined}<span style={{ fontSize: 16, color: '#8A7A50' }}> / {target}</span>
          </p>
          <p className="font-pixel mt-1" style={{ fontSize: 6, letterSpacing: 1.5, color: '#8A7A50' }}>
            CARE ACTIONS TOGETHER
          </p>
        </div>

        {/* Full progress bar */}
        <div className="relative h-5 overflow-hidden" style={{
          border: `2px solid ${GOLD}66`,
          background: 'linear-gradient(180deg, #000 0%, #0a0805 100%)',
          boxShadow: `inset 0 2px 4px rgba(0,0,0,0.95), 0 0 12px ${GOLD}33`,
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: `linear-gradient(180deg, ${GOLD_HI} 0%, ${GOLD} 45%, ${GOLD_LO} 100%)`,
            transition: 'width 700ms cubic-bezier(0.34,1.4,0.55,1)',
          }}>
            <div className="absolute inset-0" style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 5px, rgba(255,255,255,0.22) 5px 7px)',
              backgroundSize: '11px 11px',
              animation: 'cgsFlow 1.1s linear infinite',
              mixBlendMode: 'screen',
            }} />
          </div>
        </div>

        {/* Per-partner breakdown — cooperative, not a VS */}
        <div className="flex items-center justify-center gap-2 font-pixel" style={{ fontSize: 7, letterSpacing: 1 }}>
          <span style={{ color: GOLD_HI }}>YOU {mine}</span>
          <span style={{ color: '#6A5C3E' }}>+</span>
          <span style={{ color: GOLD_HI }}>{partnerName.toUpperCase()} {partnerCount}</span>
        </div>

        {/* Reward box */}
        <div className="px-3 py-3 relative overflow-hidden" style={{
          ...OBSIDIAN_FACE,
          border: `1px solid ${GOLD}80`,
          boxShadow: `3px 3px 0 rgba(0,0,0,0.55), 0 0 14px ${GOLD}2e`,
        }}>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <IconCoin size={14} />
            <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 2, ...goldText }}>REWARD</span>
            <IconCoin size={14} />
          </div>
          <p className="text-center font-pixel" style={{ fontSize: 18, ...goldText }}>
            +{reward} COINS EACH
          </p>
          <p className="text-center text-[10px] mt-2" style={{ color: '#9A8C70' }}>
            You <span style={{ color: GOLD_HI }}>both</span> get the coins when you reach {target} together.
          </p>
        </div>

        {/* What counts */}
        <div className="flex items-start gap-2 px-1">
          <div className="mt-0.5"><IconPaw size={11} /></div>
          <p className="text-[10px]" style={{ color: '#9A8C70', lineHeight: 1.5 }}>
            Counts every feed, play, nap, wash &amp; medicine — but only when Eren actually
            {' '}needs it, so a maxed-out stat won&apos;t pad the bar.
          </p>
        </div>

        {/* Time + action */}
        <p className="text-center font-pixel" style={{ fontSize: 6, color: '#8A7A50', letterSpacing: 1.5 }}>
          RESETS IN {reset.days > 0 ? `${reset.days}D ${reset.hours}H` : `${reset.hours}H ${reset.minutes}M`}
        </p>

        {showClaim ? (
          <button onClick={handleClaim} disabled={claiming}
            className="w-full flex items-center justify-center gap-2 py-2.5 active:translate-y-[1px] transition-transform"
            style={{
              background: `linear-gradient(180deg, ${GOLD_HI} 0%, ${GOLD} 55%, ${GOLD_LO} 100%)`,
              border: '1.5px solid #7a4a08',
              borderRadius: 6,
              boxShadow: `0 2px 0 #5e3906, 0 0 16px ${GOLD}88`,
              animation: 'cgsClaimPulse 1.3s ease-in-out infinite',
            }}>
            <IconCoin size={14} />
            <span className="font-pixel" style={{ fontSize: 9, letterSpacing: 1, color: '#3a2400' }}>
              CLAIM +{reward} EACH
            </span>
          </button>
        ) : (
          <p className="text-center font-pixel" style={{ fontSize: 7, color: GOLD_HI, letterSpacing: 1 }}>
            {remaining} MORE TO GO THIS WEEK
          </p>
        )}
      </div>

      <style>{`
        @keyframes cgsSlide {
          0%   { transform: translateY(60px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes cgsFlow {
          from { background-position: 0 0; }
          to   { background-position: 11px 0; }
        }
        @keyframes cgsClaimPulse {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.12); }
        }
      `}</style>
    </div>,
    document.body
  )
}
