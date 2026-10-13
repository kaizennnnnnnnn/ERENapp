'use client'

// ─── ParlourCase ────────────────────────────────────────────────────────────
// Today's tray of five, as a white Meadow card.
//
// An empty slot keeps its jelly, faded: each flavour stays recognisable at a
// fraction of its colour, so the tray reads as five jellies still to win
// rather than as five holes — you can see which flavour is missing, which is
// the thing the player actually wants to know. Winning one lights its tile in
// the flavour's own tint and sets it jiggling; lit against faded is the whole
// readout.

import { memo } from 'react'
import type { JellyDef } from '@/lib/jellies'
import { Card, M, MeadowIcon, Tag, TYPE } from '@/components/meadow'

interface Props {
  tray: { jelly: JellyDef; filled: boolean }[]
  count: number
  size: number
  /** Ownership is still being confirmed — draw the tray, not a wrong answer. */
  loading?: boolean
}

const ParlourCase = memo(function ParlourCase({ tray, count, size, loading = false }: Props) {
  const full = count >= size

  return (
    <Card padding="14px 14px 16px">
      <div className="flex items-center justify-between" style={{ marginBottom: 12, gap: 8 }}>
        <h2 style={{ margin: 0, ...TYPE.label, color: M.label }}>{full ? 'Tray complete' : "Today's tray"}</h2>
        <Tag size="sm" tone={full ? 'leaf' : 'soft'} style={{ fontVariantNumeric: 'tabular-nums' }}
          icon={full ? <MeadowIcon name="check" size={14} color={M.leaf} /> : undefined}>
          {count}/{size}
        </Tag>
      </div>

      <ul className="flex justify-between" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 6 }}>
        {tray.map(({ jelly, filled }) => (
          <Slot key={jelly.id} jelly={jelly} filled={filled && !loading} />
        ))}
      </ul>
    </Card>
  )
})

export default ParlourCase

// ─── One slot ────────────────────────────────────────────────────────────────
function Slot({ jelly, filled }: { jelly: JellyDef; filled: boolean }) {
  const first = jelly.name.split(' ')[0]
  return (
    <li className="flex-1 flex flex-col items-center" style={{ minWidth: 0 }}>
      <span className="relative flex items-end justify-center w-full" style={{
        aspectRatio: '0.86', borderRadius: 16, overflow: 'hidden',
        // The flavour's own colour, softly, once it's won.
        background: filled ? `${jelly.colour}2E` : M.soft,
      }}>
        <img src={jelly.art} alt="" draggable={false} style={{
          width: '86%', height: '86%', marginBottom: 3, objectFit: 'contain', imageRendering: 'auto',
          // Not won yet: the same jelly, faded. It keeps its hue, so the tray
          // reads as five flavours waiting instead of five blanks.
          filter: filled ? undefined : 'saturate(0.35)',
          opacity: filled ? 1 : 0.32,
          animation: filled ? 'parlourJiggle 2.6s ease-in-out infinite' : undefined,
        }} />
        {filled && (
          <span style={{
            position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 999,
            background: M.leaf, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MeadowIcon name="check" size={11} color="#FFFFFF" mono />
          </span>
        )}
      </span>
      <span aria-hidden style={{
        marginTop: 5, maxWidth: '100%', fontSize: 11, lineHeight: 1.2, fontWeight: 700, textAlign: 'center',
        color: filled ? M.text : M.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {filled ? first : '?'}
      </span>
      <span className="sr-only">{filled ? `${jelly.name}, won` : 'Not won yet'}</span>
    </li>
  )
}
