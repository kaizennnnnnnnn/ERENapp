'use client'

import { Card, M, MeadowIcon, Meter, PrimaryButton, Tag } from '@/components/meadow'
import SqueakyCleanBanner from './SqueakyCleanBanner'

export type WashPhase = 'soap' | 'rinse' | 'saving' | 'error' | 'done' | 'sleeping'

export default function WashProgress({ phase, value, onRetry }: {
  phase: WashPhase
  value: number
  onRetry: () => void
}) {
  if (phase === 'done') return <SqueakyCleanBanner />
  if (phase === 'error') return (
    <PrimaryButton full onClick={onRetry} icon={<MeadowIcon name="replay" size={22} mono color="#FFFFFF" />}>
      Try again
    </PrimaryButton>
  )
  const active = phase === 'soap' || phase === 'rinse'
  const label = phase === 'soap' ? 'Soap' : phase === 'rinse' ? 'Rinse' : phase === 'saving' ? 'Saving bath...' : 'Sleeping'
  const color = phase === 'soap' ? M.love : '#6FA3D2'
  const percent = Math.round(Math.max(0, Math.min(100, value)))
  return (
    <Card padding="14px 16px" style={{ width: '100%', boxShadow: `0 3px 0 ${M.overArtLip}` }}>
      <div role={active ? undefined : 'status'} aria-busy={phase === 'saving' || undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 28 }}>
        <MeadowIcon name={phase === 'soap' ? 'sparkle' : phase === 'sleeping' ? 'moon' : phase === 'saving' ? 'clock' : 'drop'}
          size={22} color={active ? color : M.leaf} />
        <span style={{ fontSize: 15, fontWeight: 800, color: M.text }}>{label}</span>
        {active && <>
          <Tag size="sm" tone="soft" style={{ fontSize: 12 }}>{phase === 'soap' ? '1 of 2' : '2 of 2'}</Tag>
          <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{percent}%</span>
        </>}
      </div>
      {active && <Meter label={phase === 'soap' ? 'Soap coverage' : 'Rinse progress'} value={percent / 100}
        color={color} height={8} style={{ marginTop: 10 }} />}
    </Card>
  )
}
