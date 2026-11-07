'use client'

import { SecondaryButton, MeadowIcon } from '@/components/meadow'
import type { KioskPhone } from './useKioskPhone'
import { KIOSK as K, kioskPanel, kioskSecondary } from './kioskTheme'

interface Props { phone: KioskPhone; facing: boolean; blackout?: boolean; onTurn: () => void }

export default function PhoneCallHud({ phone, facing, blackout, onTurn }: Props) {
  const { state, call, spoken } = phone
  return <div style={{ position: 'absolute', zIndex: 59, left: 12, right: 12, top: 'calc(108px + env(safe-area-inset-top, 0px))', display: 'grid', justifyItems: 'start', gap: 8, pointerEvents: 'none' }}>
    {state === 'ringing' && !facing && <div style={{ pointerEvents: 'auto' }}>
      <SecondaryButton size="sm" onClick={onTurn} ariaLabel="The phone is ringing, turn to it" style={{ ...kioskSecondary, color: K.coin }}
        icon={<MeadowIcon name="speech" size={18} mono color={K.coin} />}>Phone ringing</SecondaryButton>
    </div>}
    {state === 'playing' && call && <div style={{ width: '100%' }}>
      <div style={{ ...kioskPanel, padding: '11px 14px', animation: 'kioskCallIn 340ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, fontSize: 12, fontWeight: 800, color: K.leaf }}>
          <MeadowIcon name="speech" size={15} mono color={K.leaf} />{call.from}
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: K.text }}>{spoken}<span aria-hidden style={{ animation: 'kioskCaret 640ms steps(1, end) infinite' }}>_</span></p>
      </div>
    </div>}
    {blackout && <div role="status" style={{ ...kioskPanel, padding: '8px 12px', fontSize: 13, fontWeight: 700, color: K.danger,
      animation: 'kioskLineIn 400ms ease-out both' }}>The street has gone dark</div>}
  </div>
}
