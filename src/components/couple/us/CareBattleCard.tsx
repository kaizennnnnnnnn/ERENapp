'use client'

// ─── Care battle this week ───────────────────────────────────────────────────
// The weekly race, kept friendly (board A3): two scores, one split bar in the
// household's colours, a one-line verdict, and underneath it, small, the
// season so far (daily record and both care streaks). Solo, the cat holds the
// other seat with the pace-setter score useCouple gives it.

import type { ReactNode } from 'react'
import { Avatar, Card, M, MeadowIcon, SectionLabel, TYPE, type MeadowIconName } from '@/components/meadow'
import type { BattleInfo, BattleSide, SeasonInfo } from './usModel'

interface Props {
  battle: BattleInfo
  /** Time to Monday 00:00. Null until resolved after mount (it is clock-derived). */
  reset: { days: number; hours: number } | null
}

export default function CareBattleCard({ battle, reset }: Props) {
  const { me, them, total, season } = battle
  const diff = Math.abs(me.score - them.score)
  const leader = me.score > them.score ? me : them.score > me.score ? them : null
  const verdict: ReactNode = total === 0
    ? 'No care yet this week'
    : !leader
      ? 'All square this week'
      : <>{leader === me ? 'You lead' : `${them.name} leads`} by <b style={{ fontWeight: 800, color: M.text }}>{diff}</b></>

  return (
    <>
      {/* A non-empty placeholder keeps the 44px row layout until the clock resolves. */}
      <SectionLabel trailing={reset ? `Resets in ${reset.days}d ${reset.hours}h` : ' '}>
        Care battle this week
      </SectionLabel>
      <Card padding={18}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Score side={me} label="You" />
          <Score side={them} label={them.name} mirrored />
        </div>

        <div role="img" aria-label={`You ${me.pct}%, ${them.name} ${them.pct}%`}
          style={{ marginTop: 16, display: 'flex', gap: 4, height: 14 }}>
          {total === 0 ? (
            <span style={{ flex: '1 1 0', borderRadius: 999, background: M.track }} />
          ) : (
            <>
              {me.pct > 0 && <Segment side={me} />}
              {them.pct > 0 && <Segment side={them} />}
            </>
          )}
        </div>
        <div aria-hidden style={{
          marginTop: 8, display: 'flex', justifyContent: 'space-between',
          fontSize: 12, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums',
        }}>
          <span>{me.pct}%</span>
          <span>{them.pct}%</span>
        </div>

        <div style={{
          marginTop: 12, paddingTop: 14, borderTop: `1px solid ${M.divider}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 15, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums',
        }}>
          <MeadowIcon name="paw" size={18} color={leader ? leader.color : M.faint} />
          <span>{verdict}</span>
        </div>

        {season && <SeasonStrip season={season} theirName={them.name} />}
      </Card>
    </>
  )
}

function Score({ side, label, mirrored }: { side: BattleSide; label: string; mirrored?: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: mirrored ? 'row-reverse' : 'row', minWidth: 0 }}>
      <Avatar name={side.name} color={side.color} size={44} fontSize={17} />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: mirrored ? 'flex-end' : 'flex-start', minWidth: 0 }}>
        <span style={{
          fontSize: 13, lineHeight: 1.2, fontWeight: 700, color: M.text2,
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</span>
        <span style={{ fontSize: 32, lineHeight: 1.1, ...TYPE.number }}>{side.score}</span>
      </span>
    </span>
  )
}

function Segment({ side }: { side: BattleSide }) {
  return (
    <span style={{
      flex: `${side.pct} 1 0`, borderRadius: 999, background: side.color,
      transition: 'flex-grow 600ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    }} />
  )
}

// ─── The season strip ────────────────────────────────────────────────────────
// Lifetime W-T-L and both current care streaks, folded into the battle card
// rather than two more cards: it is the same contest, seen over a longer time.

function SeasonStrip({ season, theirName }: { season: SeasonInfo; theirName: string }) {
  const { record, streak } = season
  if (!record && !streak) return null
  const n = (v: number) => <b style={{ fontWeight: 800, color: M.text }}>{v}</b>
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${M.divider}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {record && (
        <SeasonRow icon="trophy" label="Record">
          You {n(record.mine)} · {n(record.ties)} {record.ties === 1 ? 'tie' : 'ties'} · {theirName} {n(record.theirs)}
        </SeasonRow>
      )}
      {streak && (
        <SeasonRow icon="flame" label="Streak">
          You {n(streak.mine)}
          {streak.theirs !== null && <> · {theirName} {n(streak.theirs)}</>}
        </SeasonRow>
      )}
      {streak && (
        <SeasonRow icon="star" label="Best streak">
          You {n(streak.myBest)}
          {streak.theirBest !== null && <> · {theirName} {n(streak.theirBest)}</>}
        </SeasonRow>
      )}
    </div>
  )
}

function SeasonRow({ icon, label, children }: { icon: MeadowIconName; label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: M.text2 }}>
      <MeadowIcon name={icon} size={18} />
      <span style={{ ...TYPE.label, color: M.label }}>{label}</span>
      <span style={{ marginLeft: 'auto', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{children}</span>
    </div>
  )
}
