'use client'

// DailyBattleSheet — full detail panel for today's care battle.
// Slides up when the HUD bar is tapped. Shows the per-player score,
// the leader, time until reset, and the daily prize so the player
// has a concrete goal to push for before midnight.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '@/lib/sounds'
import type { DailyBattleState } from '@/hooks/useDailyBattle'
import { timeUntilMidnight } from '@/hooks/useDailyBattle'
import { trophyTier, TROPHY_TONE, TROPHY_LABEL, TROPHY_VALUE, type TrophyTier } from '@/lib/dailyTwist'
import {
  PINK, PINK_HI, PINK_LO,
  OBSIDIAN_FACE, OBSIDIAN_BTN, OBSIDIAN_ORB,
  pinkText, accentA,
} from '@/components/obsidian'
import { IconCrown, IconSwords, IconTrophyTier } from '@/components/PixelIcons'

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

  const LADDER: { tier: TrophyTier; at: number }[] = [
    { tier: 'bronze', at: 1 },
    { tier: 'silver', at: 3 },
    { tier: 'gold',   at: 6 },
  ]

  const meLeading      = battle.leader === 'me'
  const partnerLeading = battle.leader === 'partner'
  const diff = Math.abs(battle.myScore - battle.partnerScore)
  const leaderName = meLeading ? battle.myName : partnerLeading ? battle.partnerName : null
  // The tier the CURRENT margin would strike, and the colour the panel wears
  // because of it.
  const liveTier = leaderName ? trophyTier(diff) : null
  const liveTone = liveTier ? TROPHY_TONE[liveTier] : '#6E6080'

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

        {/* ── Today's rule ── */}
        <div className="px-3 py-2.5 relative" style={{
          ...OBSIDIAN_FACE,
          border: `1px solid ${battle.twist.tone}66`,
          boxShadow: `3px 3px 0 rgba(0,0,0,0.55), 0 0 14px ${battle.twist.tone}22`,
        }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-pixel" style={{
              fontSize: 8, letterSpacing: 2, color: battle.twist.tone,
              textShadow: `0 0 6px ${battle.twist.tone}66`,
            }}>{battle.twist.name}</span>
            <div style={{ flex: 1, height: 1, background: `${battle.twist.tone}33` }} />
          </div>
          <p className="text-[10px]" style={{ color: '#B4A8C4' }}>{battle.twist.blurb}</p>
        </div>

        {/* ── The trophy ladder ──
            Three rungs, not one number. Seeing that a 2-point lead is one
            action away from SILVER is what makes the last hour of a day worth
            playing; "30 coins at midnight" never did. */}
        <div className="px-3 py-3 relative overflow-hidden" style={{
          ...OBSIDIAN_FACE,
          border: `1px solid ${liveTone}66`,
          boxShadow: `3px 3px 0 rgba(0,0,0,0.55), 0 0 14px ${liveTone}2e`,
        }}>
          <p className="text-center font-pixel" style={{
            fontSize: 7, letterSpacing: 2, color: '#9A8AA8', marginBottom: 10,
          }}>TONIGHT&apos;S PRIZE</p>

          <div className="flex items-stretch gap-1.5">
            {LADDER.map(rung => {
              const reached = diff >= rung.at && leaderName !== null
              // Only the top reached rung is the one actually on offer; the
              // ones below it are history. Lighting all three equally made a
              // 10-point lead look the same as a 1-point one.
              const current = reached && rung.tier === liveTier
              return (
                <div key={rung.tier} className="flex-1 flex flex-col items-center gap-1 py-2 px-1 relative" style={{
                  border: `${current ? 2 : 1}px solid ${
                    current ? TROPHY_TONE[rung.tier]
                    : reached ? `${TROPHY_TONE[rung.tier]}55`
                    : 'rgba(255,255,255,0.07)'}`,
                  background: current
                    ? `linear-gradient(180deg, ${TROPHY_TONE[rung.tier]}2E 0%, #050507 100%)`
                    : reached
                      ? `linear-gradient(180deg, ${TROPHY_TONE[rung.tier]}12 0%, #050507 100%)`
                      : 'rgba(255,255,255,0.02)',
                  boxShadow: current
                    ? `0 0 14px ${TROPHY_TONE[rung.tier]}66, inset 0 1px 0 rgba(255,255,255,0.12)`
                    : undefined,
                  borderRadius: 3,
                  animation: current ? 'dbsRungPulse 2s ease-in-out infinite' : undefined,
                }}>
                  <span style={{
                    filter: current
                      ? `drop-shadow(0 0 7px ${TROPHY_TONE[rung.tier]})`
                      : reached
                        ? `drop-shadow(0 0 4px ${TROPHY_TONE[rung.tier]}66)`
                        : 'grayscale(1) brightness(0.42)',
                    opacity: reached ? 1 : 0.8,
                  }}>
                    <IconTrophyTier size={current ? 22 : 18} tier={rung.tier} />
                  </span>
                  <span className="font-pixel" style={{
                    fontSize: 5, letterSpacing: 1,
                    color: reached ? TROPHY_TONE[rung.tier] : '#5E5470',
                  }}>{TROPHY_LABEL[rung.tier]}</span>
                  <span className="font-pixel" style={{
                    fontSize: 5, color: reached ? '#C8BCD4' : '#4E4658',
                  }}>BY {rung.at}</span>
                </div>
              )
            })}
          </div>

          <p className="text-center text-[10px] mt-2.5" style={{ color: '#9A8C70' }}>
            {liveTier
              ? `${leaderName} is on ${TROPHY_LABEL[liveTier]} — ${TROPHY_VALUE[liveTier]} ${TROPHY_VALUE[liveTier] === 1 ? 'trophy' : 'trophies'} at midnight.`
              : 'Lead by 1 at midnight to strike a trophy.'}
          </p>
        </div>

        <p className="text-center text-[10px]" style={{ color: '#7a6a88' }}>
          {battle.totalActions} care action{battle.totalActions === 1 ? '' : 's'} logged today
        </p>
      </div>

      {/* Plain <style> so keyframe names stay un-hashed and the
          inline `animation: '...'` references actually resolve. */}
      <style>{`
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
        @keyframes dbsRungPulse {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.16); }
        }
      `}</style>
    </div>,
    document.body
  )
}
