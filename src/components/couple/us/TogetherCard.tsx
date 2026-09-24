'use client'

// ─── "Together for N days" ───────────────────────────────────────────────────
// The Us page hero (board A3): the big day count, a postmark stamp with the
// day the household began, and the cat walking a love-pink bar from the last
// milestone toward the next one.

import { format } from 'date-fns'
import CatPortrait from '@/components/cat/CatPortrait'
import { Card, Divider, M, MeadowIcon, Meter, Tag, TYPE } from '@/components/meadow'
import type { TogetherInfo, UsCat } from './usModel'

// The walking cat: 74x100 (W = H x 0.742), head centre at 43% of its width,
// so it stands over the end of the fill.
const CAT_W = 74
const CAT_H = 100
const HEAD_X = Math.round(CAT_W * 0.43)

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

interface Props {
  together: TogetherInfo
  cat: UsCat
  /** Solo, the household's story is the cat's: "With Eren for". */
  isSolo: boolean
}

export default function TogetherCard({ together, cat, isSolo }: Props) {
  const { days, since, milestoneToday, walk } = together
  const progress = walk ? (days - walk.from) / Math.max(1, walk.to - walk.from) : 0
  const pct = Math.max(0, Math.min(100, progress * 100))

  return (
    <Card padding="20px 20px 18px" style={{ position: 'relative', marginTop: 18 }}>
      <h2 style={{ ...TYPE.label, margin: 0, color: M.label }}>
        {isSolo ? `With ${cat.name} for` : 'Together for'}
      </h2>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {/* Four digits at 64px would run under the postmark; a step down keeps
            "1000 days" clear of it. */}
        <span style={{ fontSize: days >= 1000 ? 52 : 64, lineHeight: 1, letterSpacing: '-0.02em', ...TYPE.number }}>{days}</span>
        <span style={{ fontSize: 24, lineHeight: 1, fontWeight: 800, color: M.text2 }}>{plural(days, 'day', 'days')}</span>
      </div>

      {since && <SinceStamp date={since} />}

      {milestoneToday && (
        <Tag tone="amber" icon={<MeadowIcon name="star" size={14} />} style={{ marginTop: 12 }}>
          {milestoneToday} today
        </Tag>
      )}

      {walk && (
        <>
          <div style={{ position: 'relative', marginTop: 16, height: CAT_H + 10 }}>
            <CatPortrait
              look={cat.look}
              width={CAT_W}
              height={CAT_H}
              quality="thumb"
              alt={`${cat.name}, walking toward ${walk.to} days`}
              style={{
                position: 'absolute', top: 0,
                // Head over the end of the fill, never past either end of the bar.
                left: `clamp(0px, calc(${pct.toFixed(2)}% - ${HEAD_X}px), calc(100% - ${CAT_W}px))`,
              }}
            />
            <Meter
              value={progress}
              color={M.love}
              height={10}
              label={`${days - walk.from} of ${walk.to - walk.from} days to ${walk.to}`}
              style={{ position: 'absolute', left: 0, top: CAT_H }}
            />
            <span style={{ position: 'absolute', right: -2, top: 76 }}>
              <MeadowIcon name="flag" />
            </span>
          </div>
          <div style={{
            marginTop: 8, display: 'flex', justifyContent: 'space-between',
            fontSize: 12, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums',
          }}>
            <span>{walk.from}</span>
            <span>{walk.to}</span>
          </div>
          <Divider style={{ margin: '14px 0' }} />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            fontSize: 15, fontWeight: 700, color: M.text2,
          }}>
            <span>Next milestone</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              <span style={{ fontWeight: 800, color: M.text }}>{walk.to} days</span>
              {' '}in {walk.daysLeft} {plural(walk.daysLeft, 'day', 'days')}
            </span>
          </div>
        </>
      )}
    </Card>
  )
}

/** A tilted postmark: SINCE / 31 MAR / 2026. */
function SinceStamp({ date }: { date: Date }) {
  const small = { fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' } as const
  return (
    <div role="img" aria-label={`Since ${format(date, 'd MMMM yyyy')}`} style={{
      position: 'absolute', right: 18, top: 16, width: 88, height: 88, boxSizing: 'border-box',
      borderRadius: 999, border: `2px solid ${M.love}`, transform: 'rotate(-10deg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span aria-hidden style={{
        position: 'absolute', left: 5, top: 5, right: 5, bottom: 5,
        borderRadius: 999, border: `2px dotted ${M.loveLight}`,
      }} />
      <span aria-hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, color: '#D0668B' }}>
        <span style={small}>SINCE</span>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{format(date, 'd MMM').toUpperCase()}</span>
        <span style={small}>{format(date, 'yyyy')}</span>
      </span>
    </div>
  )
}
