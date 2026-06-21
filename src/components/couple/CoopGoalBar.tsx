'use client'

// ═══════════════════════════════════════════════════════════════════════════
// "WE CARED" — the co-op goal bar. The cooperative counterweight to the Care
// Battle's VS panels: ONE shared meter that both partners fill TOGETHER toward
// a weekly target. Gold "together" trim sets it apart from the pink/purple
// rivalry bars. When the household hits the goal, each partner claims a coin
// reward once (CAS-guarded in useCouple → coopGoal/claimCoopGoal).
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { useCouple } from '@/hooks/useCouple'
import { timeUntilWeekReset } from '@/lib/couple'
import { playSound } from '@/lib/sounds'
import { IconHeartDuo, IconPaw, IconCoin } from '@/components/PixelIcons'

const GOLD    = '#FBBF24'
const GOLD_HI = '#FDE68A'
const GOLD_LO = '#B45309'

function GoldRivets() {
  const dot = (pos: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', width: 3, height: 3, background: GOLD,
    boxShadow: `0 0 3px ${GOLD}`, pointerEvents: 'none', ...pos,
  })
  return (
    <>
      <span style={dot({ top: 4, left: 4 })} />
      <span style={dot({ top: 4, right: 4 })} />
      <span style={dot({ bottom: 4, left: 4 })} />
      <span style={dot({ bottom: 4, right: 4 })} />
    </>
  )
}

export default function CoopGoalBar() {
  const { coopGoal, claimCoopGoal, partner, loading } = useCouple()
  const [claiming, setClaiming] = useState(false)
  const [reset, setReset] = useState(() => timeUntilWeekReset())

  useEffect(() => {
    const t = setInterval(() => setReset(timeUntilWeekReset()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // Need a partner to care "together" — solo households see nothing.
  if (loading || !partner) return null

  const { combined, target, reward, goalMet, claimed } = coopGoal
  const pct = Math.min(100, Math.round((combined / target) * 100))
  const showClaim = goalMet && !claimed

  async function handleClaim() {
    if (claiming) return
    setClaiming(true)
    playSound('level_up')
    await claimCoopGoal()
    setClaiming(false)
  }

  return (
    <div className="mb-4 p-3.5 relative overflow-hidden" style={{
      background: 'linear-gradient(180deg, #1a1510 0%, #07060a 100%)',
      border: `1.5px solid ${GOLD}66`,
      borderRadius: 6,
      boxShadow: `0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 18px ${GOLD}22`,
    }}>
      <GoldRivets />

      {/* Header: title + weekly reset countdown */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <IconHeartDuo size={14} />
          <span className="font-pixel" style={{
            fontSize: 8, letterSpacing: 1.5, color: GOLD_HI,
            textShadow: `0 1px 0 rgba(0,0,0,0.6), 0 0 8px ${GOLD}55`,
          }}>WE CARED</span>
        </div>
        <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1, color: '#8A7A50' }}>
          {reset.days > 0 ? `RESETS ${reset.days}d ${reset.hours}h` : `RESETS ${reset.hours}h ${reset.minutes}m`}
        </span>
      </div>

      {/* Combined fill meter — one bar, both partners, no split */}
      <div style={{
        position: 'relative', width: '100%', height: 16,
        border: '2px solid #2a2113',
        background: 'linear-gradient(180deg, #000 0%, #0a0805 100%)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.95), 2px 2px 0 rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: `linear-gradient(180deg, ${GOLD_HI} 0%, ${GOLD} 45%, ${GOLD_LO} 100%)`,
          transition: 'width 800ms cubic-bezier(0.34,1.3,0.55,1)',
          ...(goalMet ? { animation: 'coopGlow 1.6s ease-in-out infinite' } : {}),
        }} />
        {/* Combined count, centred over the track */}
        <span className="font-pixel" style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 7, color: '#fff', letterSpacing: 1,
          textShadow: '0 1px 2px rgba(0,0,0,0.9)', zIndex: 1,
        }}>{combined} / {target}</span>
      </div>

      {/* Footer: state-dependent line */}
      <div className="mt-2.5 flex items-center justify-center" style={{ minHeight: 26 }}>
        {showClaim ? (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="flex items-center gap-1.5 px-4 py-1.5 active:translate-y-[1px] transition-transform"
            style={{
              background: `linear-gradient(180deg, ${GOLD_HI} 0%, ${GOLD} 55%, ${GOLD_LO} 100%)`,
              border: '1.5px solid #7a4a08',
              borderRadius: 6,
              boxShadow: `0 2px 0 #5e3906, 0 0 14px ${GOLD}88, inset 0 1px 0 rgba(255,255,255,0.5)`,
              animation: 'coopClaimPulse 1.3s ease-in-out infinite',
            }}>
            <IconCoin size={13} />
            <span className="font-pixel" style={{
              fontSize: 8, letterSpacing: 1, color: '#3a2400',
              textShadow: '0 1px 0 rgba(255,255,255,0.35)',
            }}>CLAIM +{reward} EACH</span>
          </button>
        ) : claimed ? (
          <div className="flex items-center gap-1.5">
            <IconPaw size={11} />
            <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1, color: GOLD_HI }}>
              DONE — YOU BOTH EARNED {reward}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 10, color: '#9A8C70', letterSpacing: 0.2 }}>
            Care for Eren together to fill the meter.
          </span>
        )}
      </div>

      <style>{`
        @keyframes coopGlow {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.25); }
        }
        @keyframes coopClaimPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.045); }
        }
      `}</style>
    </div>
  )
}
