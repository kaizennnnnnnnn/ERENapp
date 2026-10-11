'use client'

// CoopGoalSheet — full detail panel for the "We Cared" weekly co-op goal.
// Slides up when the home strip is tapped. Shows combined progress, each
// partner's contribution, the reward, the time until the weekly reset, what
// counts, and the CLAIM button once the goal is met.
//
// In the Meadow look: a white sheet, one coin-gold meter (cooperative: one
// bar, both of you, no split), each person's share beside their own colour
// (profiles.heart), and Claim as the leaf button pinned to the bottom.

import { useEffect, useRef, useState } from 'react'
import { playSound } from '@/lib/sounds'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCat } from '@/hooks/useCat'
import { timeUntilWeekReset } from '@/lib/couple'
import type { CoopGoalState } from '@/lib/coopGoal'
import {
  Avatar, Card, IconTile, MeadowIcon, Meter, PrimaryButton, Sheet,
  M, PERSON, TINT, TYPE, personColor,
} from '@/components/meadow'

/** The sheet's drop-away before the parent unmounts it (Sheet's EXIT_MS). */
const EXIT_MS = 180

export default function CoopGoalSheet({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const { coopGoal, claimCoopGoal, partner } = useCouple()
  const cat = useCat()
  const [open, setOpen] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  // Close in two steps so the sheet can drop away before the parent unmounts it.
  function close() {
    if (!open) return
    setOpen(false)
    closeTimer.current = setTimeout(onClose, EXIT_MS)
  }

  async function claim() {
    if (claiming) return
    setClaiming(true)
    playSound('level_up')
    await claimCoopGoal()
    setClaiming(false)
    close()
  }

  const myColor = personColor(profile?.heart)
  const partnerColor = partner?.heart ? personColor(partner.heart) : myColor === PERSON.brown ? PERSON.pink : PERSON.brown

  return (
    <CoopGoalView
      open={open} goal={coopGoal} catName={cat.name}
      me={{ name: 'You', color: myColor }}
      partner={partner ? { name: (partner.name ?? 'Partner').split(' ')[0], color: partnerColor } : null}
      claiming={claiming}
      onClose={() => { playSound('ui_modal_close'); close() }}
      onClaim={claim}
    />
  )
}

export interface CoopGoalViewProps {
  open: boolean
  goal: CoopGoalState
  catName: string
  me: { name: string; color: string }
  /** null for a household of one. */
  partner: { name: string; color: string } | null
  claiming: boolean
  onClose: () => void
  onClaim: () => void
}

/** The sheet itself, from plain props (CoopGoalSheet gathers them). */
export function CoopGoalView({ open, goal, catName, me, partner, claiming, onClose, onClaim }: CoopGoalViewProps) {
  const [reset, setReset] = useState(() => timeUntilWeekReset())
  useEffect(() => {
    const t = setInterval(() => setReset(timeUntilWeekReset()), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  const { combined, mine, partner: partnerCount, target, reward, goalMet, claimed, loaded } = goal
  const remaining = Math.max(0, target - combined)
  const showClaim = goalMet && loaded && !claimed
  const resetText = reset.days > 0 ? `${reset.days}d ${reset.hours}h` : `${reset.hours}h ${reset.minutes}m`

  return (
    <Sheet open={open} onClose={onClose} title={partner ? 'We cared this week' : 'You cared this week'}
      footer={showClaim ? (
        <PrimaryButton full busy={claiming} onClick={onClaim} icon={<MeadowIcon name="coin" size={20} />}>
          Claim +{reward}{partner ? ' each' : ''}
        </PrimaryButton>
      ) : undefined}>
      <div className="flex flex-col" style={{ gap: 12 }}>
        <p style={{ margin: '0 4px', fontSize: 15, lineHeight: 1.4, fontWeight: 500, color: M.text2 }}>
          {partner
            ? `A goal you build together: every bit of care you both give ${catName} this week adds up.`
            : `A goal you build all week: every bit of care you give ${catName} adds up.`}
        </p>

        {/* ── Progress ── */}
        <Card outlined padding="16px 18px">
          <div className="flex items-baseline" style={{ gap: 4 }}>
            <span style={{ fontSize: 40, lineHeight: 1, ...TYPE.number }}>{combined}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: M.faint, fontVariantNumeric: 'tabular-nums' }}>/ {target}</span>
          </div>
          <div style={{ ...TYPE.label, color: M.label, marginTop: 4 }}>
            {partner ? 'Care actions together' : 'Care actions this week'}
          </div>
          <Meter value={combined / target} color={M.coin} height={12} label="Weekly care goal"
            style={{ marginTop: 12 }} />

          {/* Cooperative, not a VS: who put in what, adding up. Solo there is
              nothing to break down: a lone "You 41" next to nobody reads as a
              missing person. */}
          {partner && (
            <div className="flex items-center justify-center" style={{ gap: 10, marginTop: 14 }}>
              <Share name={me.name} color={me.color} n={mine} />
              <span aria-hidden style={{ fontSize: 16, fontWeight: 800, color: M.faint }}>+</span>
              <Share name={partner.name} color={partner.color} n={partnerCount} />
            </div>
          )}
        </Card>

        {/* ── Reward ── */}
        <Card outlined padding="14px 18px">
          <div className="flex items-center" style={{ gap: 14 }}>
            <IconTile icon="coin" size={48} bg={TINT.amber} iconSize={28} />
            <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>+{reward} coins{partner ? ' each' : ''}</span>
              <span style={{ fontSize: 14, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>
                {partner ? `You both get them when you reach ${target} together.` : `Yours when you reach ${target}.`}
              </span>
            </div>
          </div>
        </Card>

        {/* ── What counts ── */}
        <div className="flex items-start" style={{ gap: 10, margin: '0 4px' }}>
          <MeadowIcon name="paw" size={18} color={M.text2} mono style={{ marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, fontWeight: 600, color: M.text2 }}>
            Counts every feed, play, nap, wash and medicine, but only when {catName} actually needs it, so a
            maxed-out stat won&apos;t pad the bar.
          </p>
        </div>

        <div className="flex items-center justify-between" style={{ margin: '4px 4px 0', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: M.label, fontVariantNumeric: 'tabular-nums' }}>
            Resets in {resetText}
          </span>
          {claimed ? (
            <span style={{ fontSize: 13, fontWeight: 800, color: M.leafInk }}>Claimed this week</span>
          ) : !showClaim && (
            <span style={{ fontSize: 13, fontWeight: 800, color: M.text, fontVariantNumeric: 'tabular-nums' }}>
              {remaining} more to go
            </span>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function Share({ name, color, n }: { name: string; color: string; n: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 8, minWidth: 0 }}>
      <Avatar name={name} color={color} size={28} />
      <span style={{ fontSize: 15, fontWeight: 700, color: M.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {name} <span style={{ color: M.text, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      </span>
    </span>
  )
}
