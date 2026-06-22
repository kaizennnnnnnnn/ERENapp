'use client'

// ═══════════════════════════════════════════════════════════════════════════
// "WE CARED" — the co-op goal strip. A slim, always-visible banner pinned at
// the top of HOME (just under the StatsHeader), where the care actions that
// fill it actually happen. ONE shared meter both partners fill together toward
// a weekly target; gold "together" trim sets it apart from the pink/purple
// rivalry bars. Hidden once claimed (keeps home clean) and for solo households.
// Claim is CAS-guarded in useCouple → coopGoal/claimCoopGoal.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { useCouple } from '@/hooks/useCouple'
import { playSound } from '@/lib/sounds'
import { IconHeartDuo, IconCoin } from '@/components/PixelIcons'

const GOLD    = '#FBBF24'
const GOLD_HI = '#FDE68A'
const GOLD_LO = '#B45309'
const Z_STRIP = 30 // above the home room scene (z-0), below StatsHeader (z-60) + modals

export default function CoopGoalBar() {
  const { coopGoal, claimCoopGoal, partner, loading } = useCouple()
  const [claiming, setClaiming] = useState(false)

  // Solo household / still loading → nothing. Once claimed this week, hide it
  // so home stays clean until next Monday's reset.
  if (loading || !partner) return null
  const { combined, target, reward, goalMet, claimed, loaded } = coopGoal
  if (claimed) return null

  const pct = Math.min(100, Math.round((combined / target) * 100))
  // Only offer the claim once the coop-row read has settled (loaded), so we
  // never flash CLAIM at someone who already pocketed it this week.
  const showClaim = goalMet && loaded && !claimed

  async function handleClaim() {
    if (claiming) return
    setClaiming(true)
    playSound('level_up')
    await claimCoopGoal()
    setClaiming(false)
  }

  return (
    <div style={{
      position: 'fixed',
      // Clear of the StatsHeader (z-60, ~safe-top+96px tall: two rows + pads).
      // At 70px the strip tucked BEHIND the header and was invisible.
      top: 'calc(var(--safe-top, 0px) + 104px)',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(92vw, 340px)',
      zIndex: Z_STRIP,
      pointerEvents: showClaim ? 'auto' : 'none',
    }}>
      <div className="flex items-center gap-2" style={{
        padding: '4px 8px',
        background: 'linear-gradient(180deg, rgba(26,21,16,0.94) 0%, rgba(7,6,10,0.94) 100%)',
        border: `1.5px solid ${GOLD}66`,
        borderRadius: 7,
        boxShadow: `0 3px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 14px ${GOLD}22`,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        ...(showClaim ? { animation: 'coopStripPulse 1.3s ease-in-out infinite' } : {}),
      }}>
        <IconHeartDuo size={12} />
        <span className="font-pixel" style={{
          fontSize: 6, letterSpacing: 1, color: GOLD_HI, whiteSpace: 'nowrap',
          textShadow: `0 0 6px ${GOLD}55`,
        }}>WE CARED</span>

        {/* Thin combined fill — one bar, both partners, no split */}
        <div style={{
          position: 'relative', flex: 1, height: 9,
          border: '1.5px solid #2a2113',
          background: 'linear-gradient(180deg, #000 0%, #0a0805 100%)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.9)',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: `linear-gradient(180deg, ${GOLD_HI} 0%, ${GOLD} 45%, ${GOLD_LO} 100%)`,
            transition: 'width 800ms cubic-bezier(0.34,1.3,0.55,1)',
            ...(goalMet ? { animation: 'coopStripGlow 1.6s ease-in-out infinite' } : {}),
          }} />
        </div>

        {showClaim ? (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="flex items-center gap-1 px-2 py-0.5 active:translate-y-[1px] transition-transform"
            style={{
              background: `linear-gradient(180deg, ${GOLD_HI} 0%, ${GOLD} 55%, ${GOLD_LO} 100%)`,
              border: '1px solid #7a4a08',
              borderRadius: 5,
              boxShadow: `0 1px 0 #5e3906, 0 0 10px ${GOLD}88`,
              whiteSpace: 'nowrap',
            }}>
            <IconCoin size={10} />
            <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 0.5, color: '#3a2400' }}>
              +{reward}
            </span>
          </button>
        ) : (
          <span className="font-pixel" style={{
            fontSize: 7, color: GOLD_HI, whiteSpace: 'nowrap', letterSpacing: 0.5,
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}>{combined}/{target}</span>
        )}
      </div>

      <style>{`
        @keyframes coopStripGlow {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.25); }
        }
        @keyframes coopStripPulse {
          0%, 100% { box-shadow: 0 3px 12px rgba(0,0,0,0.5), 0 0 14px ${GOLD}22; }
          50%      { box-shadow: 0 3px 12px rgba(0,0,0,0.5), 0 0 20px ${GOLD}66; }
        }
      `}</style>
    </div>
  )
}
