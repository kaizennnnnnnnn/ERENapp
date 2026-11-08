'use client'

import { MeadowIcon, TYPE } from '@/components/meadow'
import type { KioskWeek } from '@/lib/kioskWeek'
import { KIOSK as K } from './kioskTheme'

export default function KioskWeeklyStamps({ week }: { week: KioskWeek }) {
  return <section aria-label="Weekly kiosk stamps" style={{ borderTop: `1px solid ${K.line}`, paddingTop: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', marginBottom: 10 }}>
      <strong style={{ color: K.text, fontSize: 14 }}>This week's stamps</strong>
      <span style={{ fontSize: 12 }}>Paid nights</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '42px repeat(7, minmax(0, 1fr))', gap: '8px 4px', alignItems: 'center' }}>
      <span aria-hidden="true" />
      {week.days.map(day => <span key={day.date} title={day.label} aria-label={day.label}
        style={{ textAlign: 'center', color: day.today ? K.text : K.muted, fontSize: 11, fontWeight: day.today ? 800 : 500 }}>{day.label.slice(0, 1)}</span>)}
      {(['mine', 'theirs'] as const).map(person => <StampRow key={person} person={person} week={week} />)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 10, fontSize: 12 }}>
      <span>You <strong style={{ color: K.leaf, ...TYPE.number }}>{week.mine}/7</strong></span>
      <span>Them <strong style={{ color: K.coin, ...TYPE.number }}>{week.theirs}/7</strong></span>
    </div>
  </section>
}

function StampRow({ person, week }: { person: 'mine' | 'theirs'; week: KioskWeek }) {
  const label = person === 'mine' ? 'You' : 'Them', ink = person === 'mine' ? K.leaf : K.coin
  return <>
    <span style={{ fontSize: 12 }}>{label}</span>
    {week.days.map(day => <span key={day.date} role="img"
      aria-label={`${label}, ${day.label}: ${day[person] ? 'stamped' : day.future ? 'upcoming' : 'not stamped'}`}
      title={`${day.label}, ${day.date}`}
      style={{ aspectRatio: '1', maxWidth: 30, width: '100%', justifySelf: 'center', display: 'grid', placeItems: 'center',
        borderRadius: 6, background: day[person] ? K.raised : 'transparent',
        border: `1px ${day.future ? 'dashed' : 'solid'} ${day.today ? K.leaf : K.line}` }}>
      {day[person] ? <MeadowIcon name="shawarma" size={20} mono color={ink} />
        : <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: '50%', background: K.line }} />}
    </span>)}
  </>
}
