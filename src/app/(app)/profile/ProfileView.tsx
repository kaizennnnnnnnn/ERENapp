'use client'

// ─── Me (presentational) ─────────────────────────────────────────────────────
// The Meadow A2 board, fed plain props. page.tsx owns every read and write;
// this file owns only its two sheets' open state, so the preview route can
// render it with the board's example data and nothing else.
//
// Order, top to bottom (the board): the couple card, the 2x2 stats, your cat,
// the achievements shelf, time with Eren, this month's moods. A broken streak
// that can still be repaired slots in under the stats, where the streak lives.

import { useState, type ReactNode } from 'react'
import {
  Avatar, Card, Divider, MeadowIcon, MeadowPage, Meter, PrimaryButton, RoundButton, SecondaryButton,
  SectionLabel, Sheet, Stage, StatTile, StatUnit, Tag, IconTile,
  M, TINT, TYPE, type MeadowIconName,
} from '@/components/meadow'
import CatPortrait from '@/components/cat/CatPortrait'
import MoodCalendar, { type MoodCalendarDay } from '@/components/MoodCalendar'
import { MOOD_STYLE } from '@/components/meadow'
import type { CatLook } from '@/lib/catIdentity'
import type { UserMood } from '@/types'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface AchievementItem {
  id: string
  title: string
  description: string
  rarity: Rarity
  coins: number
  icon: MeadowIconName
  iconColor?: string
  unlocked: boolean
}

export interface Person {
  name: string
  color: string
  /** Time spent with the cat, in seconds; null while it loads or if the read failed. */
  seconds: number | null
}

export interface ProfileViewProps {
  me: Person
  /** The other seat: the partner, or the cat itself in a household of one. */
  other: Person | null
  /** True when `other` is the cat (solo): its time is not tracked. */
  otherIsCat: boolean
  streak: { current: number | null; best: number | null; freezes: number }
  /** Whole days since the household began; null while loading. */
  togetherDays: number | null
  level: { level: number; xpIn: number; xpNeeded: number } | null
  /** "31 Mar": the first day this person's time was tracked. */
  timeSince: string | null
  achievements: { unlocked: number; total: number; shelf: AchievementItem[]; all: AchievementItem[] }
  /**
   * null until the household's cat has been read: the card stays blank
   * rather than show the default cat as if it were theirs.
   */
  cat: { name: string; sexLabel: string; coatLabel: string; look: CatLook | null } | null
  /** This month, resolved after mount. null until then. */
  month: {
    label: string
    year: number
    month: number
    daysInMonth: number
    today: number
    mine: Array<UserMood | null>
    calendar: Record<number, MoodCalendarDay>
    /** The mood read failed: say so instead of showing an empty month. */
    failed: boolean
  } | null
  /** A broken streak that the repair can still bring back. */
  streakBreak: { prior: number; cost: number; available: boolean; coinsShort: number } | null
  onRepairStreak: () => Promise<boolean>
}

const MOOD_ORDER: UserMood[] = ['good', 'mid', 'tired', 'sad', 'angry']

// ─── Small pieces ────────────────────────────────────────────────────────────

/** 11<h>55<m>, or 55<m> under an hour, or 123<h> once the minutes won't fit. */
function Duration({ seconds, unit = 20, gap = 6 }: { seconds: number | null; unit?: number; gap?: number }) {
  if (seconds === null) return <>–</>
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const u = (s: string, last?: boolean) => (
    <span style={{ fontSize: unit, margin: last ? '0 0 0 2px' : `0 ${gap}px 0 2px` }}>{s}</span>
  )
  if (h >= 100) return <>{h}{u('h', true)}</>
  if (h === 0) return <>{m}{u('m', true)}</>
  return <>{h}{u('h')}{m}{u('m', true)}</>
}

function shortDuration(seconds: number | null): string {
  if (seconds === null) return '–'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function Seat({ person }: { person: Person | null }) {
  const first = person?.name.split(' ')[0] ?? ''
  return (
    <div style={{ flex: '0 0 auto', width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {person
        ? <Avatar name={person.name} color={person.color} size={60} fontSize={24} />
        : <span aria-hidden style={{ width: 60, height: 60, borderRadius: 999, background: M.soft }} />}
      <span style={{
        maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: 13, fontWeight: 700, color: M.text2, minHeight: 16,
      }}>
        {first}
      </span>
    </div>
  )
}

/** A title of two or more words sets on two lines, as the board breaks them. */
function twoLines(title: string): ReactNode {
  const i = title.indexOf(' ')
  if (i < 0) return title
  return <>{title.slice(0, i)}<br />{title.slice(i + 1)}</>
}

function ShelfBadge({ a }: { a: AchievementItem }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 0 }}>
      <span style={{
        width: 60, height: 60, borderRadius: 18, background: M.soft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {a.unlocked
          ? <MeadowIcon name={a.icon} size={36} color={a.iconColor} />
          : <MeadowIcon name="lock" size={28} color={M.faint} />}
      </span>
      <span style={{
        marginTop: 8, minHeight: 30, fontSize: 12, lineHeight: 1.25, fontWeight: 800,
        color: a.unlocked ? M.text : M.text2,
      }}>
        {twoLines(a.title)}
      </span>
      <Tag tone={a.rarity} size="sm" caps style={{ marginTop: 6, opacity: a.unlocked ? 1 : 0.6 }}>{a.rarity}</Tag>
    </div>
  )
}

function AchievementRow({ a }: { a: AchievementItem }) {
  return (
    <div role="listitem" aria-label={`${a.title}, ${a.unlocked ? 'unlocked' : 'locked'}. ${a.description}.`}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
      {a.unlocked
        ? <IconTile icon={a.icon} size={48} color={a.iconColor} iconSize={28} />
        : <IconTile icon="lock" size={48} color={M.faint} iconSize={22} />}
      <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: a.unlocked ? M.text : M.text2 }}>{a.title}</span>
        <span style={{ fontSize: 13, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>{a.description}</span>
      </span>
      <span aria-hidden style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <Tag tone={a.rarity} size="sm" caps style={{ opacity: a.unlocked ? 1 : 0.6 }}>{a.rarity}</Tag>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, ...TYPE.number,
          color: a.unlocked ? M.text : M.faint,
        }}>
          <MeadowIcon name="coin" size={14} style={{ opacity: a.unlocked ? 1 : 0.5 }} />
          {a.unlocked ? `+${a.coins}` : a.coins}
        </span>
      </span>
    </div>
  )
}

// ─── The page ────────────────────────────────────────────────────────────────

export default function ProfileView(props: ProfileViewProps) {
  const { me, other, otherIsCat, streak, togetherDays, level, timeSince, achievements, cat, month, streakBreak, onRepairStreak } = props
  const [allOpen, setAllOpen] = useState(false)
  const [monthOpen, setMonthOpen] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [repairFailed, setRepairFailed] = useState(false)

  const dash = '–'
  const current = streak.current
  const streakText = current === null ? dash : current > 0 ? `${current} day streak` : 'No streak yet'
  const left = achievements.total - achievements.unlocked

  // Household time: the other seat only counts when it is a person.
  const people = [me, ...(other && !otherIsCat ? [other] : [])]
  const known = people.every(p => p.seconds !== null)
  const total = known ? people.reduce((s, p) => s + (p.seconds ?? 0), 0) : null

  const repair = async () => {
    if (repairing || !streakBreak?.available) return
    setRepairing(true)
    setRepairFailed(false)
    const ok = await onRepairStreak()
    setRepairing(false)
    if (!ok) setRepairFailed(true)
  }

  return (
    <MeadowPage
      ground="me"
      title="Me"
      action={
        <RoundButton ariaLabel="Settings" href="/settings">
          <MeadowIcon name="gear" color={M.text} />
        </RoundButton>
      }
    >
      {/* ── Couple card ── */}
      <Card padding="20px 18px 16px" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <Seat person={me} />
          <div style={{ flex: '1 1 auto', position: 'relative', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span aria-hidden style={{ position: 'absolute', left: 2, right: 2, top: 29, borderTop: `2px dashed ${M.toggleOff}` }} />
            <span style={{
              position: 'relative', height: 36, boxSizing: 'border-box', padding: '0 13px 0 9px', borderRadius: 999,
              background: '#FFFFFF', border: `2px solid ${M.hairline}`, display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
            }}>
              <MeadowIcon name="flame" size={20} />
              {streakText}
            </span>
          </div>
          <Seat person={other} />
        </div>
        <Divider style={{ margin: '16px 0 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: M.text2 }}>
          <MeadowIcon name="heart" size={20} />
          <span>
            Together{' '}
            <span style={{ fontWeight: 800, color: M.text, fontVariantNumeric: 'tabular-nums' }}>
              {togetherDays === null ? dash : `${togetherDays} ${togetherDays === 1 ? 'day' : 'days'}`}
            </span>
          </span>
        </div>
      </Card>

      {/* ── Stats 2x2 ── */}
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatTile
          label="Level"
          value={level ? level.level : dash}
          meter={{ value: level ? level.xpIn / level.xpNeeded : 0, color: M.leaf, label: 'Progress to the next level' }}
          footer={level ? `${level.xpIn} / ${level.xpNeeded} XP` : dash}
        />
        <StatTile
          label="Best streak"
          value={<>{streak.best ?? dash}<MeadowIcon name="flame" style={{ alignSelf: 'center', marginLeft: 8 }} /></>}
          footer={streak.freezes > 0
            ? `${streak.freezes} ${streak.freezes === 1 ? 'freeze' : 'freezes'} saved`
            : 'days in a row'}
        />
        <StatTile
          label={cat && cat.name.length <= 6 ? `Time with ${cat.name}` : 'Time spent'}
          value={<Duration seconds={me.seconds} />}
          footer={<><MeadowIcon name="clock" size={16} />{timeSince ? `since ${timeSince}` : dash}</>}
        />
        <StatTile
          label="Achievements"
          value={<>{achievements.unlocked}<span style={{ fontSize: 20, color: M.text2, marginLeft: 4 }}>/ {achievements.total}</span></>}
          meter={{ value: achievements.total ? achievements.unlocked / achievements.total : 0, color: M.coin, label: 'Achievements found' }}
          footer={left > 0 ? `${left} still to find` : 'All found'}
        />
      </div>

      {/* ── Streak repair ── A break the coins can still undo. */}
      {streakBreak && (
        <Card style={{ marginTop: 12 }} padding="16px 18px 18px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <IconTile icon="flame" size={44} bg={TINT.orange} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Your {streakBreak.prior} day streak broke</div>
              <div style={{ fontSize: 13, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>
                {streakBreak.available ? 'You can still bring it back.' : 'The repair window has closed.'}
              </div>
            </div>
          </div>
          {streakBreak.available && (
            <PrimaryButton
              size="md"
              full
              busy={repairing}
              disabled={streakBreak.coinsShort > 0}
              onClick={repair}
              icon={<MeadowIcon name="coin" size={20} />}
              style={{ marginTop: 14 }}
            >
              {repairing ? 'Repairing...' : `Repair for ${streakBreak.cost}`}
            </PrimaryButton>
          )}
          {streakBreak.available && streakBreak.coinsShort > 0 && (
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: M.text2, textAlign: 'center' }}>
              You need {streakBreak.coinsShort} more coins
            </div>
          )}
          {repairFailed && (
            <div role="alert" style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: M.danger, textAlign: 'center' }}>
              Could not repair it just now. Try again in a moment.
            </div>
          )}
        </Card>
      )}

      {/* ── Your cat ── */}
      <SectionLabel>Your cat</SectionLabel>
      {!cat ? (
        // The loaded card's height (the 148 stage plus padding), so nothing jumps when it lands.
        <Card padding={14} style={{ minHeight: 176 }}><span /></Card>
      ) : (
        <Card padding={14} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Stage width={128} height={148} variant="portrait">
            <CatPortrait
              look={cat.look}
              width={92}
              height={124}
              alt={`${cat.name}, ${cat.coatLabel}`}
              style={{ position: 'absolute', left: 25, top: 12 }}
            />
          </Stage>
          <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ ...TYPE.heading, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cat.name}
            </span>
            <span style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Tag>{cat.sexLabel}</Tag>
              <Tag>{cat.coatLabel}</Tag>
            </span>
            <SecondaryButton
              size="sm"
              href="/settings"
              icon={<MeadowIcon name="brush" size={20} />}
              ariaLabel={`Edit ${cat.name}`}
              style={{ marginTop: 16, padding: '0 18px 0 14px' }}
            >
              Edit
            </SecondaryButton>
          </div>
        </Card>
      )}

      {/* ── Achievements shelf ── */}
      <SectionLabel action={{ label: `See all ${achievements.total}`, onClick: () => setAllOpen(true) }}>
        Achievements
      </SectionLabel>
      <Card padding="18px 10px 18px" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {achievements.shelf.map(a => <ShelfBadge key={a.id} a={a} />)}
      </Card>

      {/* ── Time with the cat ── */}
      <SectionLabel>{cat ? `Time with ${cat.name}` : 'Time spent'}</SectionLabel>
      <Card padding={18}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', fontSize: 32, lineHeight: 1.1, ...TYPE.number }}>
            <Duration seconds={total} unit={18} gap={5} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>
            {people.length > 1 ? 'household total' : 'just you so far'}
          </span>
        </div>
        <span aria-hidden style={{
          marginTop: 14, display: 'flex', height: 10, borderRadius: 999, background: M.track, overflow: 'hidden',
        }}>
          {total !== null && total > 0 && people.map((p, i) => (
            <span key={i} style={{ display: 'block', height: 10, width: `${((p.seconds ?? 0) / total) * 100}%`, background: p.color, borderRadius: 999 }} />
          ))}
        </span>
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', columnGap: 24, rowGap: 8 }}>
          {people.map((p, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: M.text2 }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: p.color }} />
              {p.name.split(' ')[0]}{' '}
              <span style={{ fontWeight: 800, color: M.text, fontVariantNumeric: 'tabular-nums' }}>{shortDuration(p.seconds)}</span>
            </span>
          ))}
        </div>
      </Card>

      {/* ── This month's moods ──
          No "See month" after a failed read: the calendar can't tell that
          from a quiet month and would say no moods were logged. */}
      <SectionLabel action={month && !month.failed ? { label: 'See month', onClick: () => setMonthOpen(true) } : undefined}>
        This month&apos;s moods
      </SectionLabel>
      <MonthCard month={month} />

      <Sheet open={allOpen} onClose={() => setAllOpen(false)} title="Achievements">
        <div style={{ padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: M.text2 }}>
              <span style={{ fontWeight: 800, color: M.text, fontVariantNumeric: 'tabular-nums' }}>{achievements.unlocked}</span>
              {' '}of {achievements.total} found
            </span>
          </div>
          <Meter value={achievements.total ? achievements.unlocked / achievements.total : 0} color={M.coin} />
          <div role="list" style={{ marginTop: 6 }}>
            {achievements.all.map((a, i) => (
              <div key={a.id}>
                {i > 0 && <Divider inset={62} />}
                <AchievementRow a={a} />
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      {month && !month.failed && (
        <Sheet open={monthOpen} onClose={() => setMonthOpen(false)} title={month.label}>
          <div style={{ padding: '0 4px' }}>
            <MoodCalendar
              year={month.year}
              month={month.month}
              today={month.today}
              days={month.calendar}
              partnerName={other && !otherIsCat ? other.name.split(' ')[0] : null}
            />
          </div>
        </Sheet>
      )}
    </MeadowPage>
  )
}

// ─── The month strip ─────────────────────────────────────────────────────────

function MonthCard({ month }: { month: ProfileViewProps['month'] }) {
  if (!month) {
    return <Card padding="16px 18px 18px" style={{ minHeight: 150 }}><span /></Card>
  }
  const { daysInMonth, today, mine } = month
  const logged = mine.filter(Boolean).length
  const used = new Set(mine.filter((m): m is UserMood => !!m))
  const legend = MOOD_ORDER.filter(m => m !== 'angry' || used.has('angry'))
  // "Today" sits under today's bar; the 1 and the last day step aside when
  // it would land on them.
  const pct = ((today - 0.5) / daysInMonth) * 100
  return (
    <Card padding="16px 18px 18px">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{month.label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: M.text2, fontVariantNumeric: 'tabular-nums' }}>
          {month.failed ? 'Could not load' : `${logged} ${logged === 1 ? 'day' : 'days'} logged`}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${logged} of ${today} days logged so far this month`}
        style={{
          position: 'relative', marginTop: 16, height: 26, display: 'grid',
          gridTemplateColumns: `repeat(${daysInMonth}, 1fr)`, alignItems: 'center', justifyItems: 'center',
        }}
      >
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const m = mine[i]
          return (
            <span key={i} style={{
              display: 'block', width: 6, height: m ? 26 : 6, borderRadius: 999,
              background: m ? MOOD_STYLE[m].dot : M.track,
            }} />
          )
        })}
      </div>
      <div aria-hidden style={{ position: 'relative', marginTop: 8, height: 16, fontSize: 11, fontWeight: 700, color: M.text2 }}>
        {today > 3 && <span style={{ position: 'absolute', left: 0 }}>1</span>}
        <span style={{
          position: 'absolute', width: 40, textAlign: 'center', fontWeight: 800, color: M.text,
          left: `max(0px, min(calc(100% - 40px), calc(${pct.toFixed(3)}% - 20px)))`,
        }}>
          Today
        </span>
        {today < daysInMonth - 2 && <span style={{ position: 'absolute', right: 0 }}>{daysInMonth}</span>}
      </div>
      <div style={{
        marginTop: 14, paddingTop: 14, borderTop: `1px solid ${M.divider}`,
        display: 'flex', justifyContent: 'space-between',
      }}>
        {legend.map(m => (
          <span key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: M.text2 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: MOOD_STYLE[m].dot }} />
            {MOOD_STYLE[m].label}
          </span>
        ))}
      </div>
    </Card>
  )
}
