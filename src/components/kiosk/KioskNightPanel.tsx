'use client'

import { useEffect, useState } from 'react'
import { MeadowIcon, PrimaryButton } from '@/components/meadow'
import type { KioskRecord } from './useKioskRecord'
import { nightCountdown, nightRemaining } from '@/lib/kioskNights'
import { KIOSK as K, kioskPanel } from './kioskTheme'

export default function KioskNightPanel({ record, practiceReason }: { record: KioskRecord; practiceReason: string | null }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick(n => n + 1), 30_000)
    return () => clearInterval(timer)
  }, [])
  const night = record.night
  if (!night) return null
  const remaining = nightCountdown(nightRemaining(night))
  const city = night.time_zone.split('/').at(-1)?.replaceAll('_', ' ') ?? night.time_zone
  const bonus = night.bonus_due > 0 || record.bonusPending || record.bonusError
  return <section aria-label="Daily kiosk shift" style={{ ...kioskPanel, padding: '12px 14px' }}>
    {!bonus && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <MeadowIcon name="clock" size={21} mono color={K.leaf} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{night.worked ? 'Paid shift complete' : practiceReason ? 'Rest needed' : 'Paid shift ready'}</div>
        <div style={{ fontSize: 12, lineHeight: 1.4, color: K.muted, marginTop: 3, overflowWrap: 'anywhere' }}>
          {night.worked ? 'Next paid shift' : 'Resets'} in {remaining} / 04:00 {city}
        </div>
      </div>
    </div>}
    {!bonus && !night.worked && practiceReason && <p style={{ color: K.muted, fontSize: 13, lineHeight: 1.4, margin: '8px 0 0' }}>{practiceReason}</p>}
    {bonus && <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 7px', fontSize: 14, fontWeight: 800 }}>
            <span>Nightly bonus</span>{night.bonus_due > 0 && <span style={{ color: K.coin }}>+{night.bonus_due}</span>}
          </div>
          <div style={{ fontSize: 12, color: K.muted, lineHeight: 1.4, marginTop: 4 }}>{night.worked ? 'Next paid shift' : 'Resets'} in {remaining}</div>
          <div style={{ fontSize: 12, color: K.muted, lineHeight: 1.4, overflowWrap: 'anywhere' }}>04:00 {city}</div>
        </div>
        <PrimaryButton size="sm" busy={record.bonusBusy} ariaLabel={record.bonusError ? 'Retry nightly bonus' : 'Collect nightly bonus'}
          onClick={() => { void record.claimBonus() }} style={{ width: 104, flexShrink: 0, fontSize: 14 }}
          icon={<MeadowIcon name={record.bonusError ? 'replay' : 'coin'} size={16} mono color="#FFFFFF" />}>
          {record.bonusError ? 'Retry' : record.bonusPending ? 'Confirm' : 'Collect'}
        </PrimaryButton>
      </div>
      {record.bonusError && <p role="alert" style={{ fontSize: 13, lineHeight: 1.4, color: K.danger, margin: '8px 0 0' }}>{record.bonusError}</p>}
    </>}
    {record.bonusReceived > 0 && <div role="status" style={{ color: K.leaf, fontSize: 13, fontWeight: 700, marginTop: 9 }}>
      Nightly bonus received: +{record.bonusReceived} coins
    </div>}
  </section>
}
