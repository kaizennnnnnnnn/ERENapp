'use client'

import { Card, Divider, M, MeadowIcon, Tag } from '@/components/meadow'
import { useCat } from '@/hooks/useCat'

export default function HealthReport({ issues, weight, energy }: {
  issues: string[]
  weight: number
  energy: number
}) {
  const cat = useCat()
  const healthy = issues.length === 0
  return (
    <section aria-label="Health report" className="meadow-root" style={{ width: '100%', maxWidth: 340, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Card padding={16} style={{ boxShadow: `0 3px 0 ${M.overArtLip}`, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, lineHeight: 1.3, fontWeight: 800 }}>
            <MeadowIcon name="stethoscope" size={22} />Health report
          </h2>
          <Tag tone={healthy ? 'leaf' : 'amber'}>{healthy ? 'Healthy' : 'Needs care'}</Tag>
        </div>
        {healthy ? (
          <p style={{ margin: '12px 0', fontSize: 15, fontWeight: 500, lineHeight: 1.45, color: M.text2, overflowWrap: 'anywhere' }}>
            {cat.t('{name} is in great shape!')}
          </p>
        ) : (
          <ul tabIndex={0} aria-label="Care notes" className="m-focus" style={{
            margin: '12px 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8,
            minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
            scrollbarWidth: 'thin', scrollbarColor: `${M.hairline} transparent`,
          }}>
            {issues.map(issue => <li key={issue} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>
              <MeadowIcon name="plus" size={14} color={M.energy} />{issue}
            </li>)}
          </ul>
        )}
        <Divider style={{ flexShrink: 0 }} />
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, margin: '12px 0 0', flexShrink: 0 }}>
          {[{ label: 'Weight', value: `${weight.toFixed(1)} kg` }, { label: 'Energy', value: `${Math.round(energy)}%` }].map(stat => (
            <div key={stat.label}>
              <dt style={{ fontSize: 12, fontWeight: 700, color: M.text2 }}>{stat.label}</dt>
              <dd style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </section>
  )
}
