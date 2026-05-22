'use client'

// DailyBattleSheet — full detail panel for today's care battle.
// Slides up when the HUD bar is tapped. Shows the per-player score,
// the leader, time until reset, and the daily prize so the player
// has a concrete goal to push for before midnight.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '@/lib/sounds'
import type { DailyBattleState } from '@/hooks/useDailyBattle'
import { DAILY_PRIZE_COINS, timeUntilMidnight } from '@/hooks/useDailyBattle'
import {
  PINK, PINK_HI, PINK_LO,
  OBSIDIAN_FACE, OBSIDIAN_BTN, OBSIDIAN_ORB,
  pinkText, accentA,
} from '@/components/obsidian'
import { IconCrown, IconCoin, IconSwords } from '@/components/PixelIcons'

interface Props {
  battle: DailyBattleState
  onClose: () => void
}

export default function DailyBattleSheet({ battle, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [reset, setReset] = useState(() => timeUntilMidnight())

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setReset(timeUntilMidnight()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  if (!mounted) return null

  const meLeading      = battle.leader === 'me'
  const partnerLeading = battle.leader === 'partner'
  const diff = Math.abs(battle.myScore - battle.partnerScore)
  const leaderName = meLeading ? battle.myName : partnerLeading ? battle.partnerName : null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.65)' }}
        onClick={() => { playSound('ui_modal_close'); onClose() }} />

      <div className="relative max-w-md w-full mx-auto flex flex-col overflow-hidden p-4 gap-4"
        style={{
          ...OBSIDIAN_FACE,
          borderRadius: '6px 6px 0 0',
          borderBottom: 'none',
          animation: 'dbsSlide 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

        {/* Handle */}
        <div className="flex justify-center" style={{ marginTop: -4 }}>
          <div style={{ width: 36, height: 3, background: PINK, boxShadow: `0 0 4px ${accentA(0.5)}` }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconSwords size={14} />
            <span className="font-pixel" style={{ fontSize: 9, letterSpacing: 2, ...pinkText }}>
              TODAY&apos;S BATTLE
            </span>
          </div>
          <button onClick={() => { playSound('ui_modal_close'); onClose() }}
            className="w-7 h-7 flex items-center justify-center active:translate-y-[1px] transition-transform"
            style={{ ...OBSIDIAN_BTN, color: PINK_HI, fontFamily: '"Press Start 2P"', fontSize: 8 }}>
            ✕
          </button>
        </div>

        <p className="font-pixel text-center" style={{ fontSize: 6, color: '#9a8aa8', letterSpacing: 1.5 }}>
          RESETS IN {reset.hours}H {reset.minutes}M
        </p>

        {/* VS row */}
        <div className="flex items-center gap-3">
          <div className="flex-1 text-center">
            <p className="font-pixel mb-1" style={{ fontSize: 7, letterSpacing: 1.5, color: PINK_HI }}>
              {battle.myName.toUpperCase()}
            </p>
            <p className="font-pixel" style={{
              fontSize: 30, lineHeight: 1,
              ...(meLeading ? pinkText : { color: '#5A5A5A' }),
            }}>{battle.myScore}</p>
            {meLeading && (
              <div className="flex justify-center mt-1" style={{ animation: 'dbsCrownBob 1.8s ease-in-out infinite' }}>
                <IconCrown size={16} />
              </div>
            )}
          </div>
          <div style={{
            width: 38, height: 38, ...OBSIDIAN_ORB,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="font-pixel" style={{ fontSize: 9, ...pinkText }}>VS</span>
          </div>
          <div className="flex-1 text-center">
            <p className="font-pixel mb-1" style={{ fontSize: 7, letterSpacing: 1.5, color: PINK_HI }}>
              {battle.partnerName.toUpperCase()}
            </p>
            <p className="font-pixel" style={{
              fontSize: 30, lineHeight: 1,
              ...(partnerLeading ? pinkText : { color: '#5A5A5A' }),
            }}>{battle.partnerScore}</p>
            {partnerLeading && (
              <div className="flex justify-center mt-1" style={{ animation: 'dbsCrownBob 1.8s ease-in-out infinite' }}>
                <IconCrown size={16} />
              </div>
            )}
          </div>
        </div>

        {/* Full bar */}
        <div className="relative h-5 overflow-hidden" style={{
          border: `2px solid ${accentA(0.6)}`,
          background: 'linear-gradient(180deg, #000 0%, #050507 100%)',
          boxShadow: `inset 0 2px 4px rgba(0,0,0,0.95), 0 0 12px ${accentA(0.4)}`,
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${battle.myPct}%`,
            background: 'linear-gradient(180deg, #FF8DB8 0%, #C8265F 100%)',
            transition: 'width 700ms cubic-bezier(0.34,1.4,0.55,1)',
          }}>
            <div className="absolute inset-0" style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 5px, rgba(255,255,255,0.22) 5px 7px)',
              backgroundSize: '11px 11px',
              animation: 'dbsFlowR 1.1s linear infinite',
              mixBlendMode: 'screen',
            }} />
          </div>
          <div style={{
            position: 'absolute', left: `${battle.myPct}%`, top: 0, bottom: 0,
            width: `${battle.partnerPct}%`,
            background: 'linear-gradient(180deg, #C9B4FF 0%, #5C2FE0 100%)',
            transition: 'all 700ms cubic-bezier(0.34,1.4,0.55,1)',
          }}>
            <div className="absolute inset-0" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 5px, rgba(255,255,255,0.22) 5px 7px)',
              backgroundSize: '11px 11px',
              animation: 'dbsFlowL 1.1s linear infinite',
              mixBlendMode: 'screen',
            }} />
          </div>
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${battle.myPct}%`,
            width: 2, background: '#fff',
            boxShadow: '0 0 6px #fff',
            transform: 'translateX(-1px)',
            transition: 'left 700ms cubic-bezier(0.34,1.4,0.55,1)',
          }} />
        </div>

        {/* Verdict */}
        {leaderName && diff > 0 && (
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5" style={OBSIDIAN_BTN}>
              <IconCrown size={11} />
              <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1.5, ...pinkText }}>
                {leaderName.toUpperCase()} LEADS BY {diff}
              </span>
            </span>
          </div>
        )}
        {!leaderName && battle.total > 0 && (
          <p className="text-center font-pixel" style={{ fontSize: 7, color: PINK_LO, letterSpacing: 1.5 }}>TIED!</p>
        )}
        {battle.total === 0 && (
          <p className="text-center font-pixel" style={{ fontSize: 7, color: '#7a6a88' }}>
            NO ACTIONS YET TODAY
          </p>
        )}

        {/* Daily prize box — gives the bar a concrete goal. */}
        <div className="px-3 py-3 relative overflow-hidden" style={{
          ...OBSIDIAN_FACE,
          border: '1px solid rgba(245,200,66,0.5)',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.55), 0 0 14px rgba(245,200,66,0.18)',
        }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <IconCoin size={14} />
            <span className="font-pixel" style={{
              fontSize: 7, letterSpacing: 2, color: '#F5C842',
              textShadow: '0 0 5px rgba(245,200,66,0.45)',
            }}>TODAY&apos;S PRIZE</span>
            <IconCoin size={14} />
          </div>
          <p className="text-center font-pixel" style={{
            fontSize: 18, color: '#F5C842',
            textShadow: '0 0 6px rgba(245,200,66,0.55)',
          }}>{DAILY_PRIZE_COINS} COINS</p>
          <p className="text-center text-[10px] mt-2" style={{ color: '#9A8C70' }}>
            Whoever&apos;s ahead at midnight pockets the bonus.
          </p>
        </div>

        <p className="text-center text-[10px]" style={{ color: '#7a6a88' }}>
          {battle.totalActions} care action{battle.totalActions === 1 ? '' : 's'} logged today
        </p>
      </div>

      <style jsx>{`
        @keyframes dbsSlide {
          0%   { transform: translateY(60px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes dbsCrownBob {
          0%, 100% { transform: translateY(0)    rotate(-2deg); }
          50%      { transform: translateY(-2px) rotate(2deg); }
        }
        @keyframes dbsFlowR {
          from { background-position: 0 0; }
          to   { background-position: 11px 0; }
        }
        @keyframes dbsFlowL {
          from { background-position: 0 0; }
          to   { background-position: -11px 0; }
        }
      `}</style>
    </div>,
    document.body
  )
}
