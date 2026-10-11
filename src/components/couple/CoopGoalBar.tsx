'use client'

// ═══════════════════════════════════════════════════════════════════════════
// "WE CARED" — the co-op goal strip. Rendered IN-FLOW inside the home HUD
// overlay, directly under the nav-button row. Tap it to open CoopGoalSheet
// with the full details (progress, each partner's share, reward, time left,
// what counts) and the CLAIM button. ONE shared meter both partners fill
// together toward a weekly target. Hidden once claimed.
//
// In the Meadow look: a white pill over the room art (the over-art lip, no
// border, no glow), the two hearts, one coin-gold meter, and the count — or
// a Claim tag once the goal is met.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { useCouple } from '@/hooks/useCouple'
import { playSound } from '@/lib/sounds'
import { FONT_ROUNDED, M, MeadowIcon, Meter, Tag } from '@/components/meadow'
import CoopGoalSheet from './CoopGoalSheet'

export default function CoopGoalBar() {
  const { coopGoal, partner, loading } = useCouple()
  const [open, setOpen] = useState(false)

  // Once claimed this week, hide it so home stays clean until Monday's reset.
  // A solo household still gets the strip — the target is scaled to one share
  // (coopTargetFor), so the bar fills at the same effort a couple spends.
  if (loading) return null
  const { combined, target, goalMet, claimed, loaded } = coopGoal
  if (claimed) return null

  return (
    <>
      <CoopStrip
        together={!!partner} combined={combined} target={target}
        ready={goalMet && loaded && !claimed}
        onOpen={() => { playSound('ui_modal_open'); setOpen(true) }}
      />
      {open && <CoopGoalSheet onClose={() => setOpen(false)} />}
    </>
  )
}

/** The strip itself, from plain props. */
export function CoopStrip({ together, combined, target, ready, onOpen }: {
  together: boolean
  combined: number
  target: number
  /** Goal met and not yet claimed. */
  ready: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ready
        ? 'Weekly care goal reached. Claim your coins'
        : `Weekly care goal: ${combined} of ${target}`}
      className="m-press m-focus w-full flex items-center"
      style={{
        marginTop: 8, height: 40, boxSizing: 'border-box', gap: 10, padding: '0 14px 0 10px',
        borderRadius: 999, background: '#FFFFFF', border: 0,
        boxShadow: `0 3px 0 ${M.overArtLip}`,
        fontFamily: FONT_ROUNDED, color: M.text, cursor: 'pointer',
      }}>
      <MeadowIcon name="hearts" size={20} color={M.love} />
      <span style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' }}>
        {together ? 'We cared' : 'You cared'}
      </span>
      <Meter value={combined / target} color={M.coin} height={10} style={{ flex: '1 1 auto', width: 'auto', minWidth: 40 }} />
      {ready ? (
        <Tag tone="amber" icon={<MeadowIcon name="coin" size={16} />} style={{ height: 26 }}>Claim</Tag>
      ) : (
        <span style={{ fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {combined}<span style={{ color: M.faint }}>/{target}</span>
        </span>
      )}
    </button>
  )
}
