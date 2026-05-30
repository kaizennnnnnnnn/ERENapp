'use client'

// ComebackBadge — floating "COMEBACK +10" pixel bubble that fires when
// the user pulls ahead of their partner today AFTER losing yesterday.
// The DB CAS update in useDailyBattle.attemptComeback guarantees exactly
// one bubble per comeback per household; this component just listens.

import { useEffect, useState } from 'react'
import { COMEBACK_BONUS_COINS } from '@/lib/battleResults'
import { IconCrown, IconCoin } from '@/components/PixelIcons'
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
      className="fixed flex flex-col items-center pointer-events-auto"
      style={{
        // Sits a little above the daily-battle HUD so they don't fight
        // for the same airspace.
        bottom: '46%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: Z_INDEX,
        animation: `cbIn 0.42s cubic-bezier(0.34,1.56,0.64,1), cbOut 0.4s ease-in ${(VISIBLE_MS - 400) / 1000}s forwards`,
        maxWidth: '70vw',
      }}
      onClick={() => { playSound('ui_modal_close'); setShow(false) }}
    >
      <div style={{
        position: 'relative',
        padding: '8px 12px 9px',
        background: 'linear-gradient(180deg, #2A1A0A 0%, #050402 100%)',
        border: '2px solid #FBBF24',
        boxShadow:
          '4px 4px 0 rgba(0,0,0,0.55), ' +
          '0 0 14px rgba(251,191,36,0.55), ' +
          'inset 0 1px 0 rgba(255,255,255,0.1)',
      }}>
        {/* CRT scanlines for that arcade comeback feel */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.08]" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 1px, rgba(255,255,255,0.4) 1px 2px)',
        }} />

        <div className="relative flex items-center gap-2 mb-1">
          <IconCrown size={12} />
          <p className="font-pixel" style={{
            fontSize: 7, color: '#FDE68A', letterSpacing: 2,
            textShadow: '0 0 4px rgba(251,191,36,0.5)',
          }}>COMEBACK!</p>
        </div>
        <div className="relative flex items-center justify-center gap-1.5">
          <IconCoin size={10} />
          <span className="font-pixel" style={{
            fontSize: 10, color: '#FDE68A', letterSpacing: 1.5,
            textShadow: '0 0 6px rgba(251,191,36,0.45)',
          }}>+{coins}</span>
        </div>
      </div>

      {/* Pixel tail pointing down to Eren */}
      <div style={{
        marginTop: -2,
        width: 0, height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '10px solid #FBBF24',
      }} />
      <div style={{
        marginTop: -12,
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '6px solid #050402',
      }} />

      <style jsx>{`
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
