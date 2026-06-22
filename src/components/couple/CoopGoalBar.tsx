'use client'

// ═══════════════════════════════════════════════════════════════════════════
// "WE CARED" — the co-op goal strip. Rendered IN-FLOW inside the home HUD
// overlay, directly under the nav-button row. Tap it to open CoopGoalSheet
// with the full details (progress, each partner's share, reward, time left,
// what counts) and the CLAIM button. ONE shared meter both partners fill
// together toward a weekly target; gold "together" trim sets it apart from the
// pink/purple rivalry bars. Hidden once claimed / for solo households.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { useCouple } from '@/hooks/useCouple'
import { playSound } from '@/lib/sounds'
import { IconHeartDuo, IconCoin } from '@/components/PixelIcons'
import CoopGoalSheet from './CoopGoalSheet'

const GOLD    = '#FBBF24'
const GOLD_HI = '#FDE68A'
const GOLD_LO = '#B45309'

export default function CoopGoalBar() {
  const { coopGoal, partner, loading } = useCouple()
  const [open, setOpen] = useState(false)

  // Solo household / still loading → nothing. Once claimed this week, hide it
  // so home stays clean until next Monday's reset.
  if (loading || !partner) return null
  const { combined, target, goalMet, claimed, loaded } = coopGoal
  if (claimed) return null

  const pct = Math.min(100, Math.round((combined / target) * 100))
  // Reward ready to claim — pulse the strip + show the CLAIM cue.
  const ready = goalMet && loaded && !claimed

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => { playSound('ui_modal_open'); setOpen(true) }}
        className="w-full flex items-center gap-2 active:translate-y-[1px] transition-transform"
        style={{
          padding: '4px 8px',
          background: 'linear-gradient(180deg, rgba(26,21,16,0.94) 0%, rgba(7,6,10,0.94) 100%)',
          border: `1.5px solid ${GOLD}66`,
          borderRadius: 7,
          boxShadow: `0 3px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 14px ${GOLD}22`,
          ...(ready ? { animation: 'coopStripPulse 1.3s ease-in-out infinite' } : {}),
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

        {ready ? (
          <span className="font-pixel inline-flex items-center gap-1" style={{
            fontSize: 7, color: GOLD_HI, whiteSpace: 'nowrap', letterSpacing: 0.5,
            textShadow: `0 0 6px ${GOLD}77`,
          }}>
            <IconCoin size={9} />CLAIM
          </span>
        ) : (
          <span className="font-pixel" style={{
            fontSize: 7, color: GOLD_HI, whiteSpace: 'nowrap', letterSpacing: 0.5,
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}>{combined}/{target}</span>
        )}
      </button>

      {open && <CoopGoalSheet onClose={() => setOpen(false)} />}

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
