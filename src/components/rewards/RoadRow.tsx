'use client'

// ─── One level on the road ───────────────────────────────────────────────────
// A rail down the left (leaf where you've been, track where you haven't) with
// a dot for each level, a star for a milestone, and the cat standing at the
// level you're heading for. Then the level's headline reward and whatever
// rides along with it. A level you've reached but not claimed is one big
// button: tapping it claims everything up to it.

import type { CSSProperties, ReactNode } from 'react'
import AnimatedEren from '@/components/AnimatedEren'
import { MeadowIcon, Meter, Tag, M, TYPE } from '@/components/meadow'
import type { LevelReward } from '@/lib/levelRewards'
import type { CatWords } from '@/lib/catWords'
import { ExtraTokens, RewardTile, fmt, itemNote, itemTitle } from './rewardDisplay'

export type RoadState = 'claimable' | 'next' | 'locked'

interface Props {
  reward: LevelReward
  state: RoadState
  /** No rail above the first row of a card, none below the last. */
  first: boolean
  last: boolean
  /** The rail above / below this level is road already travelled. */
  travelledAbove: boolean
  travelledBelow: boolean
  /** XP into the current level, for the row the cat stands on. */
  progress?: { into: number; needed: number }
  cat: CatWords
  busy?: boolean
  onClaim?: () => void
}

const RAIL = 44
const LINE = 4

export default function RoadRow({ reward, state, first, last, travelledAbove, travelledBelow, progress, cat, busy, onClaim }: Props) {
  const [headline, ...extras] = reward.items
  const title = itemTitle(headline)
  const note = itemNote(headline, cat)
  const locked = state === 'locked'
  const reached = state === 'claimable'
  const status = reached ? 'Ready to claim' : state === 'next' ? 'Up next' : 'Locked'
  const also = extras.length > 0 ? `Also ${extras.map(itemTitle).join(', ')}.` : ''
  // The button's name is everything on it, the note and the extras included
  // (the extras are drawn as icons, hidden from screen readers).
  const label = `Level ${reward.level}${reward.milestone ? ', milestone' : ''}: ${title}.`
    + `${note ? ` ${note}.` : ''}${also ? ` ${also}` : ''} ${status}`

  const rail = (
    <span aria-hidden style={{ position: 'relative', width: RAIL, flexShrink: 0 }}>
      {!first && <span style={line('top', travelledAbove)} />}
      {!last && <span style={line('bottom', travelledBelow)} />}
      <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center' }}>
        {state === 'next' ? <CatMarker /> : <Node milestone={reward.milestone} reached={reached} />}
      </span>
    </span>
  )

  const body: ReactNode = (
    <span style={{
      flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0 12px 10px', borderBottom: last ? 0 : `1px solid ${M.divider}`,
    }}>
      <RewardTile item={headline} size={reward.milestone ? 52 : 44} style={{ opacity: locked ? 0.55 : 1 }} />
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, opacity: locked ? 0.6 : 1 }}>
        <span style={{ ...TYPE.label, fontSize: 11, color: reached ? M.leafInk : M.label }}>
          Level {reward.level}{reward.milestone ? ' · Milestone' : ''}
        </span>
        <span style={{ fontSize: 16, fontWeight: 800, color: M.text, overflowWrap: 'anywhere' }}>{title}</span>
        {note && <span style={{ fontSize: 13, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>{note}</span>}
        {extras.length > 0 && <span style={{ marginTop: 2 }}><ExtraTokens items={extras} /></span>}
        {state === 'next' && progress && (
          <span style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Meter value={progress.into / progress.needed} height={6} style={{ flex: '1 1 auto' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: M.text2, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(Math.max(0, progress.needed - progress.into))} XP to go
            </span>
          </span>
        )}
      </span>
      {reached && <Tag tone="leaf" size="sm" style={{ opacity: busy ? 0.5 : 1 }}>Claim</Tag>}
      {locked && <MeadowIcon name="lock" size={18} color={M.faint} />}
    </span>
  )

  const row: CSSProperties = { display: 'flex', width: '100%', textAlign: 'left' }
  if (reached && onClaim) {
    return (
      <div role="listitem">
        <button type="button" onClick={onClaim} disabled={busy} aria-label={label}
          className="m-press m-focus"
          style={{ ...row, padding: 0, border: 0, background: 'transparent', fontFamily: 'inherit', color: 'inherit', cursor: busy ? 'default' : 'pointer' }}>
          {rail}{body}
        </button>
      </div>
    )
  }
  // A plain row reads its own text; the icon extras and the state get words.
  return (
    <div role="listitem" style={row}>
      {rail}{body}
      <span className="sr-only">{also} {status}</span>
    </div>
  )
}

function line(side: 'top' | 'bottom', travelled: boolean): CSSProperties {
  return {
    position: 'absolute', left: (RAIL - LINE) / 2, width: LINE,
    top: side === 'top' ? 0 : '50%', bottom: side === 'top' ? '50%' : 0,
    background: travelled ? M.leaf : M.track,
  }
}

/** A dot, or a star for a milestone, with a white collar so the rail runs
 *  behind it. */
function Node({ milestone, reached }: { milestone: boolean; reached: boolean }) {
  if (milestone) {
    return (
      <span style={{ width: 28, height: 28, borderRadius: 999, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MeadowIcon name="star" size={22} color={reached ? M.coin : M.faint} mono={!reached} />
      </span>
    )
  }
  return (
    <span style={{
      width: 14, height: 14, boxSizing: 'border-box', borderRadius: 999,
      background: reached ? M.leaf : '#FFFFFF', border: reached ? 0 : `3px solid ${M.track}`,
      boxShadow: '0 0 0 3px #FFFFFF',
    }} />
  )
}

/** The cat, standing on the rail at the next level. Pixel art, so crisp. The
 *  white behind it is the card's own, so the rail runs behind the cat. */
function CatMarker() {
  return (
    <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0', background: '#FFFFFF' }}>
      <AnimatedEren px={2} glow={false} />
      <span style={{ width: 30, height: 6, marginTop: -3, borderRadius: 999, background: M.floorShadow }} />
    </span>
  )
}
