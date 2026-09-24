'use client'

// ─── "{Partner} today" ───────────────────────────────────────────────────────
// Their mood today, the last seven days as dots (today ringed), and the one
// action that answers the mood: "Send {partner} some love" (board A3). The
// button sends the "I love you" nudge straight away; the tray below has the
// other three.

import { format } from 'date-fns'
import {
  Avatar, Card, CheckDisc, M, MeadowIcon, MOOD_STYLE, PrimaryButton, SectionLabel,
} from '@/components/meadow'
import type { UserMood } from '@/types'
import type { LoveTrayState, MoodDay, UsPerson } from './usModel'

const dayLetter = (date: string) => format(new Date(`${date}T12:00:00`), 'EEEEE')
const dayName = (date: string) => format(new Date(`${date}T12:00:00`), 'EEEE')
const moodWord = (m: UserMood) => MOOD_STYLE[m].label.toLowerCase()

interface Props {
  partner: UsPerson
  mood: UserMood | null
  week: MoodDay[]
  tray: LoveTrayState
  onSendLove: () => void
}

export default function PartnerTodayCard({ partner, mood, week, tray, onSendLove }: Props) {
  const style = mood ? MOOD_STYLE[mood] : null
  const sent = !!tray.sent.loveyou
  const weekLabel = week
    .map(d => `${dayName(d.date)} ${d.mood ? moodWord(d.mood) : 'no check-in'}`)
    .join(', ')

  return (
    <>
      <SectionLabel>{partner.name} today</SectionLabel>
      <Card padding={18}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            position: 'relative', flex: '0 0 auto', width: 68, height: 68, borderRadius: 20,
            background: style ? style.tint : M.soft, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {style
              ? <MeadowIcon name={style.icon} color={style.iconColor} size={36} />
              : <MeadowIcon name="thought" mono color={M.faint} size={36} />}
            <Avatar name={partner.name} color={partner.color} size={28} ring="#FFFFFF" fontSize={12}
              style={{ position: 'absolute', right: -5, bottom: -5 }} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, lineHeight: 1.3, fontWeight: 700, color: M.text2 }}>
              {mood ? `${partner.name} is feeling` : `${partner.name} hasn't checked in`}
            </span>
            <span style={{ fontSize: 24, lineHeight: 1.2, fontWeight: 800 }}>
              {mood ? `${moodWord(mood)} today` : 'yet today'}
            </span>
          </span>
        </div>

        {week.length > 0 && (
          <div role="img" aria-label={`The last 7 days: ${weekLabel}`} style={{
            marginTop: 18, display: 'grid', gridTemplateColumns: `repeat(${week.length}, 1fr)`,
            justifyItems: 'center', rowGap: 8,
          }}>
            {week.map((d, i) => {
              const today = i === week.length - 1
              const dot = d.mood ? MOOD_STYLE[d.mood].dot : M.track
              return (
                <span key={d.date} aria-hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, lineHeight: 1, fontWeight: today ? 800 : 700, color: today ? M.text : M.text2 }}>
                    {dayLetter(d.date)}
                  </span>
                  <span style={{
                    width: 26, height: 26, borderRadius: 999, background: dot,
                    boxShadow: today ? `0 0 0 3px #FFFFFF, 0 0 0 5px ${d.mood ? dot : M.softLip}` : 'none',
                  }} />
                </span>
              )
            })}
          </div>
        )}

        {sent ? (
          <div role="status" style={{
            marginTop: 20, height: 54, borderRadius: 16, background: M.leafTint, color: M.leafInk,
            fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <CheckDisc />
            Love sent to {partner.name}
          </div>
        ) : (
          <PrimaryButton
            onClick={onSendLove}
            busy={tray.busy === 'loveyou'}
            icon={<MeadowIcon name="heart" mono color="#FFFFFF" />}
            style={{ marginTop: 20 }}
          >
            Send {partner.name} some love
          </PrimaryButton>
        )}
        {tray.error?.from === 'cta' && (
          <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 700, color: M.danger, textAlign: 'center' }}>
            {tray.error.message}
          </p>
        )}
      </Card>
    </>
  )
}
