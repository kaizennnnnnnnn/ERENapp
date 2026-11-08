'use client'

import { MeadowIcon } from '@/components/meadow'
import { TOPPING_BY_ID, SAUCE_BY_ID } from './kioskShift'
import type { NightlySpecial } from './kioskSpecials'
import { KIOSK as K, kioskLabel, kioskPanel } from './kioskTheme'

export default function KioskSpecialBoard({ special }: { special: NightlySpecial }) {
  const ingredients: Array<{ id: string; label: string; sprite: string }> = special.wrap.toppings.map(id => TOPPING_BY_ID[id])
  if (special.wrap.sauce) ingredients.push(SAUCE_BY_ID[special.wrap.sauce])
  return <details className="kiosk-special-board" style={{ ...kioskPanel, padding: '0 14px' }}>
    <summary className="m-focus" style={{ display: 'flex', alignItems: 'center', gap: 11, minHeight: 68, cursor: 'pointer', listStyle: 'none' }}>
      <img src="/wrap_rolled.webp" alt="" draggable={false} style={{ width: 32, height: 42, objectFit: 'contain', flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1, padding: '10px 0' }}>
        <div style={{ ...kioskLabel, color: K.leaf }}>Tonight's special</div>
        <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3, marginTop: 3 }}>{special.name}</div>
      </div>
      <span className="kiosk-special-chevron" style={{ display: 'flex', flexShrink: 0 }}><MeadowIcon name="chevronRight" size={17} mono color={K.muted} /></span>
    </summary>
    <div style={{ paddingBottom: 14, borderTop: `1px solid ${K.line}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginTop: 12 }}>
        {ingredients.map(item => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, color: K.text, fontSize: 13 }}>
          <img src={item.sprite} alt="" draggable={false} style={{ width: 24, height: 25, objectFit: 'contain' }} />{item.label}
        </div>)}
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: K.muted }}>With freshly carved meat</div>
    </div>
  </details>
}
