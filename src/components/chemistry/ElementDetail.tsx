'use client'

import { CATEGORY_LABELS, type Element } from '@/lib/chemistry/elements'
import { CATEGORY_COLORS, STATE_LABELS, readableText } from '@/lib/chemistry/colors'
import { M, SectionLabel, Sheet, useSheetExit } from '@/components/meadow'
import { playSound } from '@/lib/sounds'

export default function ElementDetail({ element, onClose }: { element: Element; onClose: () => void }) {
  const [open, close] = useSheetExit(onClose)
  const fill = CATEGORY_COLORS[element.category]
  function dismiss() {
    if (!open) return
    playSound('ui_modal_close')
    close()
  }
  return (
    <Sheet open={open} onClose={dismiss} title={element.name} zIndex={90}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0 20px' }}>
        <div aria-hidden style={{
          position: 'relative', width: 80, height: 80, flexShrink: 0, borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: fill, color: readableText(fill),
        }}>
          <span style={{ position: 'absolute', top: 8, left: 10, fontSize: 12, fontWeight: 700 }}>{element.atomicNumber}</span>
          <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, marginTop: 10 }}>{element.symbol}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: M.text, fontSize: 17, lineHeight: 1.35, fontWeight: 800 }}>{CATEGORY_LABELS[element.category]}</p>
          <p style={{ margin: '6px 0 0', color: M.text2, fontSize: 14, lineHeight: 1.4, fontWeight: 500 }}>
            {element.symbol} / Atomic number {element.atomicNumber}
          </p>
        </div>
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0 20px', margin: 0 }}>
        <Stat label="State" value={STATE_LABELS[element.state]} />
        <Stat label="Period" value={String(element.period)} />
        <Stat label="Group" value={element.group == null ? 'Not assigned' : String(element.group)} />
        <Stat label="Mass" value={element.atomicMass.toString()} />
      </dl>
      {element.funFact && <Block heading="Fun fact" body={element.funFact} />}
      {element.nameOrigin && <Block heading="Name origin" body={element.nameOrigin} />}
      {element.mnemonic && <Block heading="Mnemonic" body={element.mnemonic} />}
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: '12px 0', borderTop: `1px solid ${M.hairline}`, minWidth: 0 }}>
    <dt style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>{label}</dt>
    <dd style={{ margin: '4px 0 0', fontSize: 17, lineHeight: 1.35, fontWeight: 800, color: M.text, fontVariantNumeric: 'tabular-nums' }}>{value}</dd>
  </div>
}

function Block({ heading, body }: { heading: string; body: string }) {
  return <section>
    <SectionLabel>{heading}</SectionLabel>
    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, fontWeight: 500, color: M.text2 }}>{body}</p>
  </section>
}
