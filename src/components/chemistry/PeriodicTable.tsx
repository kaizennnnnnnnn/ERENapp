'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { elements, CATEGORY_LABELS, type Element, type ElementCategory } from '@/lib/chemistry/elements'
import {
  CATEGORY_COLORS, STATE_COLORS, STATE_LABELS,
  masteryColor, readableText, type ColorMode,
} from '@/lib/chemistry/colors'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { MASTERED_BOX } from '@/lib/chemistry/srs'
import { M, Segmented, SectionLabel } from '@/components/meadow'
import { playSound } from '@/lib/sounds'
import ElementDetail from './ElementDetail'

const TILE = 30
const GAP = 4
const MODES: { value: ColorMode; label: string }[] = [
  { value: 'category', label: 'Category' },
  { value: 'state', label: 'State' },
  { value: 'mastery', label: 'Mastery' },
]

/** Spatial navigation skips the gaps in the table, including the f-block gap. */
export function tableNeighbor(current: Element, key: string): Element | undefined {
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End'
  const vertical = key === 'ArrowUp' || key === 'ArrowDown'
  if (!horizontal && !vertical) return
  const line = elements.filter(el => horizontal ? el.ypos === current.ypos : el.xpos === current.xpos)
    .sort((a, b) => horizontal ? a.xpos - b.xpos : a.ypos - b.ypos)
  if (key === 'Home') return line[0]
  if (key === 'End') return line[line.length - 1]
  const index = line.findIndex(el => el.atomicNumber === current.atomicNumber)
  const delta = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1
  return line[index + delta]
}

export default function PeriodicTable() {
  const [mode, setMode] = useState<ColorMode>('category')
  const [selected, setSelected] = useState<Element | null>(null)
  const [activeNumber, setActiveNumber] = useState(1)
  const buttons = useRef(new Map<number, HTMLButtonElement>())
  const { state, hydrated } = useChemistryStore()
  const boxFor = (el: Element) => hydrated ? (state.cards[elementCardId(el.atomicNumber)]?.box ?? 0) : 0
  const fillFor = (el: Element) => mode === 'state' ? STATE_COLORS[el.state]
    : mode === 'mastery' ? masteryColor(boxFor(el)) : CATEGORY_COLORS[el.category]

  function navigate(e: KeyboardEvent<HTMLButtonElement>, el: Element) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const next = tableNeighbor(el, e.key)
    if (next) buttons.current.get(next.atomicNumber)?.focus()
  }

  return (
    <section className="meadow-root" aria-label="Periodic table" style={{ padding: '0 16px 18px', color: M.text }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 22, lineHeight: 1.2, fontWeight: 800 }}>Periodic table</h2>
      <Segmented options={MODES} value={mode} ariaLabel="Colour elements by"
        onChange={value => { playSound('ui_tap'); setMode(value) }} />

      <div className="chem-table-scroll" role="group" aria-label="Element grid"
        style={{ overflowX: 'auto', padding: '12px 0 8px', marginTop: 4, WebkitOverflowScrolling: 'touch' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(18, ${TILE}px)`,
          gridTemplateRows: `repeat(7, ${TILE}px) 8px repeat(2, ${TILE}px)`,
          gap: GAP, padding: 4, width: 'max-content',
        }}>
          <Marker row={6} text="57-71" />
          <Marker row={7} text="89-103" />
          {elements.map(el => {
            const fill = fillFor(el)
            const box = boxFor(el)
            const mastered = mode === 'mastery' && box >= MASTERED_BOX
            const description = mode === 'category' ? CATEGORY_LABELS[el.category]
              : mode === 'state' ? STATE_LABELS[el.state]
              : !hydrated ? 'Mastery loading' : box === 0 ? 'New' : `Mastery box ${box} of ${MASTERED_BOX}`
            return (
              <button key={el.atomicNumber} type="button" className="m-focus"
                ref={node => { if (node) buttons.current.set(el.atomicNumber, node); else buttons.current.delete(el.atomicNumber) }}
                tabIndex={activeNumber === el.atomicNumber ? 0 : -1}
                onFocus={() => setActiveNumber(el.atomicNumber)}
                onKeyDown={e => navigate(e, el)}
                onClick={() => { playSound('ui_modal_open'); setSelected(el) }}
                aria-label={`${el.name} (${el.symbol}), atomic number ${el.atomicNumber}, ${description}`}
                aria-haspopup="dialog" aria-expanded={selected?.atomicNumber === el.atomicNumber}
                title={`${el.name} (${el.symbol})`}
                style={{
                  position: 'relative', gridColumn: el.xpos, gridRow: el.ypos,
                  width: TILE, height: TILE, padding: 0, borderRadius: 6,
                  background: fill, color: readableText(fill),
                  border: `${mastered ? 2 : 1}px solid ${mastered ? M.leafInk : 'rgba(47,43,40,.14)'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <span aria-hidden style={{ position: 'absolute', top: 2, left: 3, fontSize: 7, lineHeight: 1, fontWeight: 700 }}>{el.atomicNumber}</span>
                <span aria-hidden style={{ fontSize: 12, lineHeight: 1, fontWeight: 800, marginTop: 4 }}>{el.symbol}</span>
              </button>
            )
          })}
        </div>
      </div>

      <SectionLabel>Key</SectionLabel>
      <Legend mode={mode} />
      {selected && <ElementDetail element={selected} onClose={() => setSelected(null)} />}
      <style>{`
        .chem-table-scroll { scrollbar-width: thin; scrollbar-color: #A7A29C transparent; }
        .chem-table-scroll::-webkit-scrollbar { height: 8px; }
        .chem-table-scroll::-webkit-scrollbar-thumb { background: #A7A29C; border-radius: 4px; }
      `}</style>
    </section>
  )
}

function Marker({ row, text }: { row: number; text: string }) {
  return <span aria-hidden style={{
    gridColumn: 3, gridRow: row, border: `1px dashed ${M.hairline}`, borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: M.text2,
    fontSize: 7, fontWeight: 700,
  }}>{text}</span>
}

function Legend({ mode }: { mode: ColorMode }) {
  const items = mode === 'category'
    ? (Object.keys(CATEGORY_COLORS) as ElementCategory[]).map(key => ({ color: CATEGORY_COLORS[key], label: CATEGORY_LABELS[key] }))
    : mode === 'state'
      ? (['solid', 'liquid', 'gas', 'unknown'] as const).map(key => ({ color: STATE_COLORS[key], label: STATE_LABELS[key] }))
      : [{ color: masteryColor(0), label: 'New' }, { color: masteryColor(2), label: 'Learning' },
        { color: masteryColor(4), label: 'Familiar' }, { color: masteryColor(MASTERED_BOX), label: 'Mastered' }]
  return <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 12px', margin: 0, padding: 0, listStyle: 'none' }}>
    {items.map(item => <li key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, fontSize: 13, lineHeight: 1.35, fontWeight: 700, color: M.text2 }}>
      <span aria-hidden style={{ background: item.color, width: 12, height: 12, marginTop: 3, borderRadius: 3, flexShrink: 0 }} />
      <span>{item.label}</span>
    </li>)}
  </ul>
}
