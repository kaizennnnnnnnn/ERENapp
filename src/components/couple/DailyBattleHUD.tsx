'use client'

// Small persistent daily-battle bar shown on the home screen. Sits
// above Eren so the player can see the day's race at a glance. Tap
// it to open the detail sheet with the daily prize info.

import { useState } from 'react'
import { useDailyBattle } from '@/hooks/useDailyBattle'
import { playSound } from '@/lib/sounds'
import DailyBattleSheet from './DailyBattleSheet'

const Z_HUD = 8

export default function DailyBattleHUD() {
  const battle = useDailyBattle()
  const [open, setOpen] = useState(false)

  if (battle.loading || !battle.hasPartner) return null

  // Tint stays consistent: viewer's side is always pink, partner is
  // always purple, regardless of who's "user1" in the DB.
  return (
    <>
      <button
        onClick={() => { playSound('ui_modal_open'); setOpen(true) }}
        className="fixed active:scale-95 transition-transform pointer-events-auto"
        style={{
          // Sits floating just above Eren's head — below the
          // ThoughtCloud (bottom: 30%) and the JealousEren bubble
          // (bottom: 38%) so the daily HUD is always the topmost
          // permanent element while the others are ephemeral.
          bottom: '46%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: Z_HUD,
          background: 'transparent',
          border: 'none',
          padding: 4,
        }}
        aria-label="Today's care battle"
      >
        {/* Tiny label */}
        <p className="font-pixel text-center mb-0.5" style={{
          fontSize: 5, color: '#FF6B9D', letterSpacing: 1.5,
          textShadow: '0 0 4px rgba(255,107,157,0.45)',
        }}>TODAY</p>

        <div style={{
          position: 'relative',
          width: 96,
          height: 11,
          border: '2px solid #1F1F2E',
          background: 'linear-gradient(180deg, #000 0%, #050507 100%)',
          boxShadow:
            'inset 0 1px 2px rgba(0,0,0,0.95), ' +
            '0 0 6px rgba(255,107,157,0.45), ' +
            '2px 2px 0 rgba(0,0,0,0.55)',
        }}>
          {/* Viewer (me) side — pink */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${battle.myPct}%`,
            background: 'linear-gradient(180deg, #FF8DB8 0%, #C8265F 100%)',
            transition: 'width 700ms cubic-bezier(0.34,1.4,0.55,1)',
            ...(battle.leader === 'me' ? { animation: 'dbHudPulse 1.5s ease-in-out infinite' } : {}),
          }} />
          {/* Partner side — purple */}
          <div style={{
            position: 'absolute', left: `${battle.myPct}%`, top: 0, bottom: 0,
            width: `${battle.partnerPct}%`,
            background: 'linear-gradient(180deg, #C9B4FF 0%, #5C2FE0 100%)',
            transition: 'left 700ms cubic-bezier(0.34,1.4,0.55,1), width 700ms cubic-bezier(0.34,1.4,0.55,1)',
            ...(battle.leader === 'partner' ? { animation: 'dbHudPulse 1.5s ease-in-out infinite' } : {}),
          }} />
          {/* Glowing split */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${battle.myPct}%`,
            width: 1,
            background: '#fff',
            boxShadow: '0 0 4px #fff',
            transform: 'translateX(-0.5px)',
            transition: 'left 700ms cubic-bezier(0.34,1.4,0.55,1)',
          }} />
          {/* Name initials on each side */}
          <span className="font-pixel" style={{
            position: 'absolute', left: 3, top: '50%', transform: 'translateY(-50%)',
            fontSize: 5, color: '#fff', lineHeight: 1,
            textShadow: '0 0 3px rgba(0,0,0,0.8)',
            zIndex: 1,
          }}>{battle.myName[0]}</span>
          <span className="font-pixel" style={{
            position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)',
            fontSize: 5, color: '#fff', lineHeight: 1,
            textShadow: '0 0 3px rgba(0,0,0,0.8)',
            zIndex: 1,
          }}>{battle.partnerName[0]}</span>
        </div>

        <style>{`
          @keyframes dbHudPulse {
            0%, 100% { filter: brightness(1); }
            50%      { filter: brightness(1.22); }
          }
        `}</style>
      </button>

      {open && <DailyBattleSheet battle={battle} onClose={() => setOpen(false)} />}
    </>
  )
}
