'use client'

// ComebackBadge — floating "Comeback! +10" bubble over the cat that fires when
// the user pulls ahead of their partner today AFTER losing yesterday.
// The DB CAS update in useDailyBattle.attemptComeback guarantees exactly
// one bubble per comeback per household; this component just listens.

import { useEffect, useState } from 'react'
import { COMEBACK_BONUS_COINS } from '@/lib/battleResults'
import { M, MeadowIcon } from '@/components/meadow'
import HomeBubble from '@/components/wish/HomeBubble'
import { playSound } from '@/lib/sounds'

const VISIBLE_MS = 4200
const Z_INDEX    = 60  // above HUD (8), below modal popups (70+)

export default function ComebackBadge() {
  const [show, setShow] = useState(false)
  const [coins, setCoins] = useState(COMEBACK_BONUS_COINS)

  useEffect(() => {
    const onComeback = (e: Event) => {
      const detail = (e as CustomEvent<{ coins?: number }>).detail
      setCoins(detail?.coins ?? COMEBACK_BONUS_COINS)
      setShow(true)
      playSound('ui_modal_open')
      const t = setTimeout(() => setShow(false), VISIBLE_MS)
      return () => clearTimeout(t)
    }
    window.addEventListener('eren:comeback', onComeback)
    return () => window.removeEventListener('eren:comeback', onComeback)
  }, [])

  if (!show) return null

  return (
    <div
      className="meadow-root fixed pointer-events-auto"
      style={{
        // Sits a little above the daily-battle HUD so they don't fight
        // for the same airspace.
        bottom: '56%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: Z_INDEX,
        animation: `cbIn 0.42s cubic-bezier(0.34,1.56,0.64,1), cbOut 0.4s ease-in ${(VISIBLE_MS - 400) / 1000}s forwards`,
      }}
      onClick={() => { playSound('ui_modal_close'); setShow(false) }}
    >
      <HomeBubble tail="centre" style={{ maxWidth: 'none', minWidth: 0, padding: '8px 10px 8px 12px' }}>
        <span role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <MeadowIcon name="crown" size={20} />
          <span style={{ fontSize: 15, fontWeight: 800 }}>Comeback!</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 4px', borderRadius: 999,
            background: M.energyTint, fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
          }}>
            <MeadowIcon name="coin" size={16} />+{coins}
          </span>
        </span>
      </HomeBubble>

      {/* A plain <style>: inline styles only reach global keyframes (these
          sat in a scoped styled-jsx block and never ran). */}
      <style>{`
        @keyframes cbIn {
          0%   { transform: translate(-50%, 16px) scale(0.55); opacity: 0; }
          60%  { transform: translate(-50%, -4px) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
        @keyframes cbOut {
          0%   { transform: translate(-50%, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -10px) scale(0.92); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

