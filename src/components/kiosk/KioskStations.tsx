'use client'

import { Segmented, MeadowIcon } from '@/components/meadow'
import { KIOSK as K } from './kioskTheme'

const STATIONS = [
  { value: 'window', label: 'Window', icon: 'shawarma' },
  { value: 'meat', label: 'Grill', icon: 'flame' },
  { value: 'fridge', label: 'Fridge', icon: 'door' },
  { value: 'toppings', label: 'Prep', icon: 'leaf' },
] as const
export type KioskStation = typeof STATIONS[number]['value']

export default function KioskStations({ value, onChange, disabled }: { value: KioskStation; onChange: (value: KioskStation) => void; disabled?: boolean }) {
  return <nav className="kiosk-stations" aria-label="Kiosk stations" style={{ position: 'absolute', zIndex: 56, left: 12, right: 12,
    bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}>
    <Segmented value={value} onChange={onChange} disabled={disabled} ariaLabel="Kiosk station" style={{ height: 58,
      background: K.ground, border: `1px solid ${K.line}`, boxShadow: `0 3px 0 ${K.lip}` }} options={STATIONS.map(station => ({
      value: station.value, label: <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, fontSize: 12 }}>
        <MeadowIcon name={station.icon} size={19} mono color={value === station.value ? K.leaf : K.muted} />{station.label}
      </span>,
    }))} />
  </nav>
}
