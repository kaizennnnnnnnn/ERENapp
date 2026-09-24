'use client'

// ─── MoodCalendar ────────────────────────────────────────────────────────────
// The month of moods in the Meadow look: the "See month" sheet on the Me page.
// One cell per day, Monday first. Your mood is a filled dot, your partner's a
// ring of the same colours, so the two read apart without a second colour key.
//
// Purely presentational: the page fetches the month and resolves "today" after
// mount (a clock read during render would differ between server and client).

import { MOOD_STYLE, M, TYPE } from '@/components/meadow'
import type { UserMood } from '@/types'

export interface MoodCalendarDay {
  mine?: UserMood | null
  partner?: UserMood | null
}

interface Props {
  year: number
  /** 0-based, like Date#getMonth. */
  month: number
  /** Day of the month that is today, or null for a month that isn't this one. */
  today: number | null
  /** Keyed by day of the month (1..31). */
  days: Record<number, MoodCalendarDay>
  /** Omit for a household of one: the rings and their key drop out. */
  partnerName?: string | null
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MOOD_ORDER: UserMood[] = ['good', 'mid', 'tired', 'sad', 'angry']

function Dot({ mood, hollow }: { mood: UserMood | null | undefined; hollow?: boolean }) {
  if (!mood) return <span aria-hidden style={{ width: 10, height: 10 }} />
  const c = MOOD_STYLE[mood].dot
  return (
    <span aria-hidden style={{
      width: 10, height: 10, boxSizing: 'border-box', borderRadius: 999,
      background: hollow ? 'transparent' : c, border: hollow ? `2px solid ${c}` : 0,
    }} />
  )
}

export default function MoodCalendar({ year, month, today, days, partnerName }: Props) {
  const count = new Date(year, month + 1, 0).getDate()
  // getDay() is 0 for Sunday; shift so Monday is column one.
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const logged = Object.values(days).some(d => d.mine || d.partner)
  const used = new Set<UserMood>()
  Object.values(days).forEach(d => {
    if (d.mine) used.add(d.mine)
    if (partnerName && d.partner) used.add(d.partner)
  })
  const legend = MOOD_ORDER.filter(m => m !== 'angry' || used.has('angry'))

  return (
    <div>
      <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
        {WEEKDAYS.map((d, i) => (
          <span key={i} style={{ ...TYPE.label, color: M.label, textAlign: 'center' }}>{d}</span>
        ))}
      </div>

      <div role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {Array.from({ length: lead }).map((_, i) => <span key={`pad-${i}`} aria-hidden />)}
        {Array.from({ length: count }).map((_, i) => {
          const day = i + 1
          const entry = days[day]
          const isToday = day === today
          const parts = [
            entry?.mine ? `you: ${MOOD_STYLE[entry.mine].label}` : null,
            partnerName && entry?.partner ? `${partnerName}: ${MOOD_STYLE[entry.partner].label}` : null,
          ].filter(Boolean)
          return (
            <div
              key={day}
              role="listitem"
              aria-label={`${day}${isToday ? ', today' : ''}${parts.length ? `, ${parts.join(', ')}` : ''}`}
              style={{
                height: 48, borderRadius: 12, background: isToday ? M.leafTint : M.soft,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <span aria-hidden style={{
                fontSize: 13, lineHeight: 1, fontWeight: isToday ? 800 : 700,
                color: isToday ? M.leafInk : M.text2, fontVariantNumeric: 'tabular-nums',
              }}>
                {day}
              </span>
              <span aria-hidden style={{ display: 'flex', gap: 3, height: 10 }}>
                <Dot mood={entry?.mine} />
                {partnerName && <Dot mood={entry?.partner} hollow />}
              </span>
            </div>
          )
        })}
      </div>

      {!logged && (
        <p style={{ margin: '14px 4px 0', fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
          No moods logged yet this month.
        </p>
      )}

      <div style={{
        marginTop: 16, paddingTop: 14, borderTop: `1px solid ${M.divider}`,
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10,
      }}>
        {legend.map(m => (
          <span key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: M.text2 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: MOOD_STYLE[m].dot }} />
            {MOOD_STYLE[m].label}
          </span>
        ))}
      </div>
      {partnerName && (
        <div style={{ marginTop: 12, display: 'flex', gap: 18, fontSize: 13, fontWeight: 700, color: M.text2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: M.text2 }} />
            You
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden style={{ width: 10, height: 10, boxSizing: 'border-box', borderRadius: 999, border: `2px solid ${M.text2}` }} />
            {partnerName}
          </span>
        </div>
      )}
    </div>
  )
}
