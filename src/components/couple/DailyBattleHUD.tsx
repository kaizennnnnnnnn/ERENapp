'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DAILY BATTLE HUD — the plate that floats above Eren's head.
//
// It used to be a bare split bar and the word TODAY, which told you who was
// ahead and nothing else: not by how much, not what today's rule was, and not
// what winning would actually pay. All three are now on it, in a plate small
// enough to still sit over a cat's head:
//
//   ┌ BATH DAY ─────────────── [tier pip] ┐
//   │  J  12  ▓▓▓▓▓▓▓░░░  4  M            │
//   └──────────────────▼──────────────────┘
//
// The tier pip is the point. It shows the trophy the current margin is on
// course for, so a two-point lead visibly reads as "one more wash and this
// goes silver" instead of as a slightly longer pink bar.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { useDailyBattle, type DailyBattleState } from '@/hooks/useDailyBattle'
import { trophyTier, TROPHY_TONE } from '@/lib/dailyTwist'
import { playSound } from '@/lib/sounds'
import { IconTrophyTier } from '@/components/PixelIcons'
import DailyBattleSheet from './DailyBattleSheet'

const Z_HUD = 8

const ME = { hi: '#FF8DB8', lo: '#C8265F', rgb: '255,107,157' }
const THEM = { hi: '#C9B4FF', lo: '#5C2FE0', rgb: '167,139,250' }

export default function DailyBattleHUD() {
  const battle = useDailyBattle()
  const [open, setOpen] = useState(false)

  // Keep the scoreboard visible whenever there is a race on — even a one-sided
  // bar is information you want at a glance. A household of one HAS a race:
  // Eren already holds the other seat, `partnerScore` is his, the day settles
  // against him overnight and it is the only place trophies are minted
  // anywhere in the app. Hiding this was the last piece of that battle a solo
  // player could not see — they got the morning verdict without ever watching
  // the day it came from. Still loading is the one hard gate left; it would
  // flicker 0/0.
  if (battle.loading || !(battle.hasPartner || battle.isSolo)) return null

  const { twist, myScore, partnerScore } = battle

  return (
    <>
      <button
        onClick={() => { playSound('ui_modal_open'); setOpen(true) }}
        className="fixed active:scale-95 transition-transform pointer-events-auto"
        style={{
          bottom: '40%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: Z_HUD,
          background: 'transparent',
          border: 'none',
          padding: 0,
        }}
        aria-label={`Today's care battle — ${twist.name}. You ${myScore}, ${battle.partnerName} ${partnerScore}.`}
      >
        <BattlePlate battle={battle} />
      </button>

      {open && <DailyBattleSheet battle={battle} onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * The plate itself — pure, so it can be rendered and measured without the
 * DailyBattleProvider behind it.
 */
export function BattlePlate({ battle }: { battle: DailyBattleState }) {
  const { twist, myScore, partnerScore, leader } = battle
  const margin = Math.abs(myScore - partnerScore)
  // The tier the CURRENT margin would strike. Null on a tie — nobody is on
  // course for anything yet, and a greyed-out pip reads better than a lie.
  const tier = trophyTier(margin)
  const tierTone = tier ? TROPHY_TONE[tier] : '#5A5268'

  return (
    <>
      <div style={{
          position: 'relative',
          padding: '3px 6px 5px',
          background: 'linear-gradient(180deg, rgba(19,15,25,0.95) 0%, rgba(6,4,9,0.95) 100%)',
          border: `1.5px solid ${twist.tone}66`,
          borderRadius: 5,
          boxShadow:
            '0 4px 14px rgba(0,0,0,0.6), ' +
            `0 0 12px ${twist.tone}33, ` +
            'inset 0 1px 0 rgba(255,255,255,0.07)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
        }}>
          {/* ── Rule strip. Tinted to the twist so the plate itself changes
                colour day to day — the cheapest possible way to make Tuesday
                not look like Monday. ── */}
          <div className="flex items-center justify-between" style={{ gap: 6, marginBottom: 3 }}>
            <span className="font-pixel" style={{
              fontSize: 5, letterSpacing: 1.2, color: twist.tone,
              textShadow: `0 0 5px ${twist.tone}77`,
              whiteSpace: 'nowrap',
            }}>{twist.name}</span>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 2,
              opacity: tier ? 1 : 0.35,
              filter: tier ? `drop-shadow(0 0 4px ${tierTone}88)` : 'grayscale(1)',
            }}>
              <IconTrophyTier size={9} tier={tier ?? 'bronze'} />
            </span>
          </div>

          {/* ── Score row ── */}
          <div className="flex items-center" style={{ gap: 4 }}>
            <Side initial={battle.myName[0]} score={myScore} tone={ME} lead={leader === 'me'} />

            <div style={{
              position: 'relative',
              width: 62,
              height: 9,
              border: '1.5px solid #17141F',
              background: 'linear-gradient(180deg, #000 0%, #050507 100%)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.95), 1px 1px 0 rgba(0,0,0,0.45)',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${battle.myPct}%`,
                background: `linear-gradient(180deg, ${ME.hi} 0%, ${ME.lo} 100%)`,
                transition: 'width 700ms cubic-bezier(0.34,1.4,0.55,1)',
                ...(leader === 'me' ? { animation: 'dbHudPulse 1.5s ease-in-out infinite' } : {}),
              }} />
              <div style={{
                position: 'absolute', left: `${battle.myPct}%`, top: 0, bottom: 0,
                width: `${battle.partnerPct}%`,
                background: `linear-gradient(180deg, ${THEM.hi} 0%, ${THEM.lo} 100%)`,
                transition: 'left 700ms cubic-bezier(0.34,1.4,0.55,1), width 700ms cubic-bezier(0.34,1.4,0.55,1)',
                ...(leader === 'partner' ? { animation: 'dbHudPulse 1.5s ease-in-out infinite' } : {}),
              }} />
              <div style={{
                position: 'absolute', top: -1, bottom: -1,
                left: `${battle.myPct}%`,
                width: 1,
                background: '#fff',
                boxShadow: '0 0 4px #fff',
                transform: 'translateX(-0.5px)',
                transition: 'left 700ms cubic-bezier(0.34,1.4,0.55,1)',
              }} />
            </div>

            <Side initial={battle.partnerName[0]} score={partnerScore} tone={THEM} lead={leader === 'partner'} flip />
          </div>

          {/* Downward tail — border layer then fill layer, points at Eren */}
          <div style={{
            position: 'absolute', left: '50%', bottom: -7, transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `7px solid ${twist.tone}66`,
          }} />
          <div style={{
            position: 'absolute', left: '50%', bottom: -4, transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(6,4,9,0.95)',
          }} />
      </div>

      <style>{`
        @keyframes dbHudPulse {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.22); }
        }
      `}</style>
    </>
  )
}

/** Initial + live score for one player. */
function Side({
  initial, score, tone, lead, flip,
}: {
  initial: string
  score: number
  tone: { hi: string; lo: string; rgb: string }
  lead: boolean
  flip?: boolean
}) {
  return (
    <span className="flex items-center" style={{
      gap: 2.5,
      flexDirection: flip ? 'row-reverse' : 'row',
    }}>
      <span className="font-pixel" style={{
        fontSize: 5, lineHeight: 1, color: tone.hi, opacity: 0.85,
      }}>{initial}</span>
      <span className="font-pixel" style={{
        fontSize: 9, lineHeight: 1, minWidth: 12,
        textAlign: flip ? 'left' : 'right',
        color: lead ? tone.hi : '#6E6478',
        textShadow: lead ? `0 0 6px rgba(${tone.rgb},0.55)` : undefined,
      }}>{score}</span>
    </span>
  )
}
