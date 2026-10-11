'use client'

// DailyBattleSheet — full detail panel for today's care battle.
// Slides up when the HUD bar is tapped. Shows the per-player score,
// the leader, time until reset, and the daily prize so the player
// has a concrete goal to push for before midnight.
//
// In the Meadow look, like the morning verdict it feeds: a white sheet, each
// person in their own household colour (profiles.heart), today's rule on its
// own icon and tint, and the prize as the catnip the lead is worth tonight.

import { useEffect, useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'
import type { DailyBattleState } from '@/hooks/useDailyBattle'
import { timeUntilMidnight } from '@/hooks/useDailyBattle'
import { trophyTier, TROPHY_VALUE, type TrophyTier } from '@/lib/dailyTwist'
import {
  Avatar, Card, IconTile, MeadowIcon, Sheet, Tag,
  M, PERSON, RADIUS, TYPE, personColor,
} from '@/components/meadow'
import { TWIST_LOOK, sentence } from './twistLook'
import CatnipPile from './CatnipPile'

type Heart = 'brown_heart' | 'pink_heart' | 'sparkle'

interface Props {
  battle: DailyBattleState
  /** Each side's household colour (profiles.heart). A household of one plays
   *  the cat, 'sparkle'. Missing on the partner: the other of the two. */
  myHeart?: Heart | null
  partnerHeart?: Heart | null
  onClose: () => void
}

/** The sheet's drop-away before the parent unmounts it (Sheet's EXIT_MS). */
const EXIT_MS = 180

const LADDER: { tier: TrophyTier; at: number }[] = [
  { tier: 'bronze', at: 1 },
  { tier: 'silver', at: 3 },
  { tier: 'gold',   at: 6 },
]

export default function DailyBattleSheet({ battle, myHeart, partnerHeart, onClose }: Props) {
  const [open, setOpen] = useState(true)
  const [reset, setReset] = useState(() => timeUntilMidnight())
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const t = setInterval(() => setReset(timeUntilMidnight()), 60 * 1000)
    return () => { clearInterval(t); clearTimeout(closeTimer.current) }
  }, [])

  // Close in two steps so the sheet can drop away before the parent
  // unmounts it.
  function close() {
    if (!open) return
    playSound('ui_modal_close')
    setOpen(false)
    closeTimer.current = setTimeout(onClose, EXIT_MS)
  }

  const myColor = personColor(myHeart)
  const partnerColor = partnerHeart
    ? personColor(partnerHeart)
    : myHeart === 'brown_heart' ? PERSON.pink : PERSON.brown

  const meLeading      = battle.leader === 'me'
  const partnerLeading = battle.leader === 'partner'
  const diff = Math.abs(battle.myScore - battle.partnerScore)
  const leaderName = meLeading ? battle.myName : partnerLeading ? battle.partnerName : null
  // The tier the CURRENT margin would strike.
  const liveTier = leaderName ? trophyTier(diff) : null
  const rule = TWIST_LOOK[battle.twist.id]

  return (
    <Sheet open={open} onClose={close} title="Today's battle">
      <div className="flex flex-col" style={{ gap: 12 }}>

        {/* ── Scoreboard ── */}
        <Card outlined padding="14px 16px 16px">
          <div className="flex items-center" style={{ gap: 8 }}>
            <Side name={battle.myName} score={battle.myScore} color={myColor} lead={meLeading} />
            <span aria-hidden className="flex items-center justify-center" style={{
              width: 36, height: 36, flexShrink: 0, borderRadius: 999, background: M.soft,
              fontSize: 13, fontWeight: 800, color: M.label,
            }}>vs</span>
            <Side name={battle.partnerName} score={battle.partnerScore} color={partnerColor} lead={partnerLeading} />
          </div>

          <SplitBar battle={battle} myColor={myColor} partnerColor={partnerColor} />

          <div className="flex justify-center" style={{ marginTop: 12 }}>
            {leaderName && diff > 0 ? (
              <Tag tone="amber" icon={<MeadowIcon name="crown" size={16} />}
                style={{ maxWidth: '100%', overflow: 'hidden' }}>
                {/* A long name gives way before the margin does. */}
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{leaderName}</span>
                <span style={{ flexShrink: 0 }}>leads by {diff}</span>
              </Tag>
            ) : battle.total > 0 ? (
              <Tag tone="soft">Tied at {battle.myScore}</Tag>
            ) : (
              <Tag tone="soft">No care yet today</Tag>
            )}
          </div>
        </Card>

        {/* ── Today's rule ── */}
        <Card outlined padding="14px 18px 16px">
          <div style={{ ...TYPE.label, color: M.label, marginBottom: 10 }}>Today&apos;s rule</div>
          <div className="flex items-center" style={{ gap: 14 }}>
            <IconTile icon={rule.icon} size={48} bg={rule.tint} iconSize={28} color={rule.color} />
            <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{sentence(battle.twist.name)}</span>
              <span style={{ fontSize: 14, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>{battle.twist.blurb}</span>
            </div>
          </div>
        </Card>

        {/* ── The prize ladder ──
            Three rungs, not one number. Seeing that a 2-point lead is one
            action away from a second catnip is what makes the last hour of a
            day worth playing; "30 coins at midnight" never did. */}
        <Card outlined padding="14px 16px 16px">
          <div className="flex items-baseline justify-between" style={{ gap: 12, marginBottom: 12 }}>
            <span style={{ ...TYPE.label, color: M.label }}>Tonight&apos;s prize</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: M.label, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              Resets in {reset.hours}h {reset.minutes}m
            </span>
          </div>

          <div className="flex items-stretch" style={{ gap: 8 }}>
            {LADDER.map(rung => (
              <Rung key={rung.tier} tier={rung.tier} at={rung.at}
                reached={leaderName !== null && diff >= rung.at}
                // Only the top reached rung is the one actually on offer; the
                // ones below it are history. Lighting all three equally made a
                // 10-point lead look the same as a 1-point one.
                current={rung.tier === liveTier} />
            ))}
          </div>

          <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.35, fontWeight: 500, color: M.text2, textAlign: 'center' }}>
            {liveTier
              ? `${leaderName} is on course for ${TROPHY_VALUE[liveTier]} catnip at midnight.`
              : 'Lead by 1 at midnight to win catnip.'}
          </p>
        </Card>

        <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: M.text2, textAlign: 'center' }}>
          {battle.totalActions} care action{battle.totalActions === 1 ? '' : 's'} logged today
        </p>
      </div>
    </Sheet>
  )
}

// ── One side of the scoreboard ───────────────────────────────────────────────

function Side({ name, score, color, lead }: { name: string; score: number; color: string; lead: boolean }) {
  return (
    <div className="flex flex-col items-center" style={{ flex: '1 1 0', minWidth: 0 }}>
      {/* Crown reserves its space whether or not it is used, so the two
          columns keep the same baseline. */}
      <div style={{ height: 24 }}>
        {lead && <MeadowIcon name="crown" size={22} />}
      </div>
      <Avatar name={name} color={color} size={40} />
      <span style={{
        marginTop: 6, fontSize: 15, fontWeight: 800, maxWidth: '100%',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{name}</span>
      <span style={{ fontSize: 40, lineHeight: 1.1, color: lead ? M.text : M.faint, ...TYPE.number }}>{score}</span>
    </div>
  )
}

// ── The split bar ────────────────────────────────────────────────────────────
// Each side in its own colour, meeting where the score splits. Empty until
// the day's first action: a 50/50 split of nothing would read as a tie.

const BAR_EASE = '700ms cubic-bezier(0.34,1.4,0.55,1)'

function SplitBar({ battle, myColor, partnerColor }: { battle: DailyBattleState; myColor: string; partnerColor: string }) {
  const started = battle.total > 0
  return (
    <div role="img"
      aria-label={`${battle.myName} ${battle.myScore}, ${battle.partnerName} ${battle.partnerScore}`}
      className="relative overflow-hidden"
      style={{ marginTop: 14, height: 12, borderRadius: 999, background: M.track }}>
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
          {/* A white seam where the two meet, so same-ish colours still split. */}
          {battle.myPct > 0 && battle.partnerPct > 0 && (
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: `${battle.myPct}%`, width: 2,
              transform: 'translateX(-1px)', background: '#FFFFFF', transition: `left ${BAR_EASE}`,
            }} />
          )}
        </>
      )}
    </div>
  )
}

// ── One rung of the prize ladder ─────────────────────────────────────────────

function Rung({ tier, at, reached, current }: { tier: TrophyTier; at: number; reached: boolean; current: boolean }) {
  const n = TROPHY_VALUE[tier]
  return (
    <div className="flex flex-col items-center justify-end" style={{
      flex: '1 1 0', minWidth: 0, boxSizing: 'border-box', gap: 4, padding: '10px 4px 10px',
      borderRadius: RADIUS.tile,
      background: current ? M.leafTint : M.soft,
      border: `2px solid ${current ? M.leaf : 'transparent'}`,
    }}>
      <span style={{
        // Unreached rungs are greyed, not hidden: the ladder is the goal.
        filter: reached ? undefined : 'grayscale(1)',
        opacity: reached ? 1 : 0.45,
      }}>
        <CatnipPile n={n} size={current ? 26 : 22} />
      </span>
      <span style={{ fontSize: 15, color: current ? M.leafInk : reached ? M.text : M.text2, ...TYPE.number }}>
        +{n}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: current ? M.leafInk : M.text2, whiteSpace: 'nowrap' }}>
        Lead by {at}
      </span>
    </div>
  )
}
