'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DAILY BATTLE HUD — the plate that floats above Eren's head.
//
// It used to be a bare split bar and the word TODAY, which told you who was
// ahead and nothing else: not by how much, not what today's rule was, and not
// what winning would actually pay. All three are now on it, in a plate small
// enough to still sit over a cat's head:
//
//   ┌ (drop) Bath day ──────── [catnip 2] ┐
//   │  (J) 12  ▓▓▓▓▓▓▓░░░  4 (M)           │
//   └──────────────────▼───────────────────┘
//
// The prize pip is the point. It shows the catnip the current margin is on
// course for, so a two-point lead visibly reads as "one more wash and this
// pays two" instead of as a slightly longer bar.
//
// In the Meadow look: a white plate over the room art with the over-art lip,
// the twist's own icon (as on the battle sheet), the two avatars and the
// split bar in each person's household colour.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { useDailyBattle, type DailyBattleState } from '@/hooks/useDailyBattle'
import { trophyTier, TROPHY_VALUE } from '@/lib/dailyTwist'
import { playSound } from '@/lib/sounds'
import { Avatar, M, MeadowIcon, PERSON, TYPE, FONT_ROUNDED, personColor } from '@/components/meadow'
import DailyBattleSheet from './DailyBattleSheet'
import { TWIST_LOOK, sentence } from './twistLook'

const Z_HUD = 8

type Heart = 'brown_heart' | 'pink_heart' | 'sparkle'

/** Each side's household colour, for the sheet (see DailyBattleSheet). */
export default function DailyBattleHUD({ myHeart, partnerHeart }: { myHeart?: Heart | null; partnerHeart?: Heart | null }) {
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
  // The same colours as the battle sheet: missing on the partner, the other
  // of the two.
  const myColor = personColor(myHeart)
  const partnerColor = partnerHeart
    ? personColor(partnerHeart)
    : myHeart === 'brown_heart' ? PERSON.pink : PERSON.brown

  return (
    <>
      <button
        onClick={() => { playSound('ui_modal_open'); setOpen(true) }}
        className="fixed m-focus pointer-events-auto"
        style={{
          // Above the wish bubble's band (bottom 38%, left), not in it: the
          // white plate is wider than the old dark one and would cover it.
          bottom: '46%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: Z_HUD,
          background: 'transparent',
          border: 'none',
          borderRadius: 16,
          padding: 0,
        }}
        aria-label={`Today's care battle — ${twist.name}. You ${myScore}, ${battle.partnerName} ${partnerScore}.`}
      >
        <BattlePlate battle={battle} myColor={myColor} partnerColor={partnerColor} />
      </button>

      {open && (
        <DailyBattleSheet battle={battle} myHeart={myHeart} partnerHeart={partnerHeart}
          onClose={() => setOpen(false)} />
      )}
    </>
  )
}

/**
 * The plate itself — pure, so it can be rendered and measured without the
 * DailyBattleProvider behind it.
 */
export function BattlePlate({ battle, myColor, partnerColor }: {
  battle: DailyBattleState
  myColor: string
  partnerColor: string
}) {
  const { twist, myScore, partnerScore, leader } = battle
  const margin = Math.abs(myScore - partnerScore)
  // The tier the CURRENT margin would strike. Null on a tie — nobody is on
  // course for anything yet, and a faded pip reads better than a lie.
  const tier = trophyTier(margin)
  const look = TWIST_LOOK[twist.id]
  const started = battle.total > 0

  return (
    <>
      <div className="meadow-root" style={{
        position: 'relative', boxSizing: 'border-box', minWidth: 176,
        padding: '6px 10px 8px', borderRadius: 16, background: '#FFFFFF',
        boxShadow: `0 3px 0 ${M.overArtLip}`, fontFamily: FONT_ROUNDED, color: M.text,
      }}>
        {/* ── Rule strip: today's twist with its icon, so Tuesday doesn't
              look like Monday, and the catnip the current margin would pay. ── */}
        <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 5 }}>
          <span className="flex items-center" style={{ gap: 4, minWidth: 0 }}>
            <MeadowIcon name={look.icon} size={14} color={look.color} />
            <span style={{ fontSize: 12, lineHeight: 1, fontWeight: 800, whiteSpace: 'nowrap' }}>
              {sentence(twist.name)}
            </span>
          </span>
          <span className="flex items-center" style={{ gap: 2, opacity: tier ? 1 : 0.4 }}>
            <MeadowIcon name="catnip" size={14} />
            {tier && (
              <span style={{ fontSize: 12, lineHeight: 1, fontWeight: 800, color: M.leafInk }}>
                {TROPHY_VALUE[tier]}
              </span>
            )}
          </span>
        </div>

        {/* ── Score row ── */}
        <div className="flex items-center" style={{ gap: 6 }}>
          <Side name={battle.myName} score={myScore} color={myColor} lead={leader === 'me'} />

          <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 48, height: 8, borderRadius: 999, background: M.track, overflow: 'hidden' }}>
            {started && (
              <>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: `${battle.myPct}%`,
                  background: myColor, transition: `width ${BAR_EASE}`,
                }} />
                <div style={{
                  position: 'absolute', left: `${battle.myPct}%`, top: 0, bottom: 0, width: `${battle.partnerPct}%`,
                  background: partnerColor, transition: `left ${BAR_EASE}, width ${BAR_EASE}`,
                }} />
                {/* A white seam where the two meet, as on the battle sheet. */}
                {battle.myPct > 0 && battle.partnerPct > 0 && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, left: `${battle.myPct}%`, width: 2,
                    transform: 'translateX(-1px)', background: '#FFFFFF', transition: `left ${BAR_EASE}`,
                  }} />
                )}
              </>
            )}
          </div>

          <Side name={battle.partnerName} score={partnerScore} color={partnerColor} lead={leader === 'partner'} flip />
        </div>

        {/* Tail pointing down at the cat. */}
        <span aria-hidden style={{
          position: 'absolute', left: 'calc(50% - 6px)', bottom: -5, width: 12, height: 12,
          background: '#FFFFFF', transform: 'rotate(45deg)',
        }} />
      </div>
    </>
  )
}

const BAR_EASE = '700ms cubic-bezier(0.34,1.4,0.55,1)'

/** Avatar + live score for one player; the leader's number is the dark one. */
function Side({ name, score, color, lead, flip }: {
  name: string
  score: number
  color: string
  lead: boolean
  flip?: boolean
}) {
  return (
    <span className="flex items-center" style={{ gap: 4, flexDirection: flip ? 'row-reverse' : 'row' }}>
      <Avatar name={name} color={color} size={20} fontSize={11} />
      <span style={{
        minWidth: 14, textAlign: flip ? 'left' : 'right',
        fontSize: 15, lineHeight: 1, ...TYPE.number, color: lead ? M.text : M.text2,
      }}>{score}</span>
    </span>
  )
}
