'use client'

import { MeadowIcon, TYPE } from '@/components/meadow'
import { SHIFT_MS } from './kioskEconomy'
import { WEATHER_BY_ID, type WeatherId } from './kioskShift'
import { KIOSK as K, kioskPanel } from './kioskTheme'

export default function KioskClock({ clock, elapsed, lastCall, weather }: { clock: string; elapsed: number; lastCall: boolean; weather: WeatherId }) {
  return <div style={{ position: 'absolute', zIndex: 57, left: 12, top: 'calc(14px + env(safe-area-inset-top, 0px))', width: 120, pointerEvents: 'none' }}>
    <div style={{ ...kioskPanel, padding: '9px 11px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 20, lineHeight: 1.2, color: lastCall ? K.danger : K.text, ...TYPE.number }}>
        <MeadowIcon name="clock" size={18} mono color={lastCall ? K.danger : K.leaf} />{clock}
      </div>
      <div style={{ height: 4, marginTop: 8, borderRadius: 3, background: K.raised, overflow: 'hidden' }}>
        <div style={{ height: '100%', transformOrigin: '0% 50%', transform: `scaleX(${Math.max(0, 1 - elapsed / SHIFT_MS)})`,
          background: lastCall ? K.danger : K.leaf, transition: 'transform 200ms linear' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, fontSize: 12, lineHeight: 1.2, color: lastCall ? K.danger : K.muted }}>
        {lastCall ? 'Last call' : WEATHER_BY_ID[weather].note ? WEATHER_BY_ID[weather].label.toLowerCase() : 'Open tonight'}
      </div>
    </div>
  </div>
}
