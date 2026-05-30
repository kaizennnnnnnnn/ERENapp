'use client'

// Small persistent daily-battle bar shown on the home screen. Sits
// above Eren so the player can see the day's race at a glance. Tap
// it to open the detail sheet with the daily prize info.

import { useState } from 'react'
import { useDailyBattle } from '@/hooks/useDailyBattle'
import { playSound } from '@/lib/sounds'
import { IconSwords } from '@/components/PixelIcons'
import DailyBattleSheet from './DailyBattleSheet'

const Z_HUD = 8

export default function DailyBattleHUD() {
  const battle = useDailyBattle()
  const [open, setOpen] = useState(false)

  // Hide the scoreboard entirely when the partner hasn't done anything in
  // 24h — a one-sided 100-0 bar reads as a lonely call-out rather than a
  // race. It comes back the moment the partner makes any action.
  if (battle.loading || !battle.hasPartner || battle.partnerDormant) return null

  // Tint stays consistent: viewer's side is always pink, partner is
  // always purple, regardless of who's "user1" in the DB.
  return (
    <>
      <button
        onClick={() => { playSound('ui_modal_open'); setOpen(true) }}
        className="fixed active:scale-95 transition-transform pointer-events-auto"
        style={{
          // Floats just above Eren's head as a status banner. A downward
          // tail ties it to him so it doesn't read as a stray bar. Lower
          // than before (was 46%) so it sits closer to the cat.
          bottom: '40%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: Z_HUD,
          background: 'transparent',
          border: 'none',
          padding: 0,
        }}
        aria-label="Today's care battle"
      >
        {/* Card container — gives the bar real presence and reads as a
            deliberate widget rather than a floating line. */}
        <div style={{
          position: 'relative',
          padding: '4px 8px 5px',
          background: 'linear-gradient(180deg, rgba(17,14,22,0.94) 0%, rgba(7,5,9,0.94) 100%)',
          border: '1.5px solid rgba(255,107,157,0.4)',
          borderRadius: 5,
          boxShadow:
            '0 4px 14px rgba(0,0,0,0.55), ' +
            '0 0 12px rgba(255,107,157,0.28), ' +
            'inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}>
          {/* Label row */}
          <div className="flex items-center justify-center gap-1" style={{ marginBottom: 2 }}>
            <IconSwords size={8} />
            <p className="font-pixel" style={{
              fontSize: 5, color: '#FF6B9D', letterSpacing: 1.5,
              textShadow: '0 0 4px rgba(255,107,157,0.5)',
            }}>TODAY</p>
          </div>

          <div style={{
            position: 'relative',
            width: 104,
            height: 12,
            border: '2px solid #1F1F2E',
            background: 'linear-gradient(180deg, #000 0%, #050507 100%)',
            boxShadow:
              'inset 0 1px 2px rgba(0,0,0,0.95), ' +
              '2px 2px 0 rgba(0,0,0,0.45)',
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

          {/* Downward tail — border layer then fill layer, points at Eren */}
          <div style={{
            position: 'absolute', left: '50%', bottom: -7, transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '7px solid rgba(255,107,157,0.4)',
          }} />
          <div style={{
            position: 'absolute', left: '50%', bottom: -4, transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(7,5,9,0.94)',
          }} />
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
