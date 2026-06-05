'use client'

// PeriodicTable — all 118 elements in a horizontal-scrollable pixel-art
// grid. Tap a tile → ElementDetail modal. Category / State color modes
// for phase 2; Mastery lands once SRS state is wired in phase 4.
//
// Mobile sizing:
//   • Tile = 26 × 26px, so the full 18-column grid is ~500px wide and
//     overflows horizontally on every phone smaller than an iPad. The
//     wrapper has overflow-x: auto and a faint scroll-shadow on the
//     right edge so the swipe affordance is obvious.
//   • Touch-action stays loose so native horizontal scroll works; the
//     overlay above us calls stopPropagation, so a wide swipe inside
//     the table never reaches CareSceneHost's room-nav gesture.

import { useState } from 'react'
import { elements, CATEGORY_LABELS, type Element, type ElementCategory } from '@/lib/chemistry/elements'
import {
  CATEGORY_COLORS, STATE_COLORS, STATE_LABELS,
  readableText, type ColorMode,
} from '@/lib/chemistry/colors'
import { playSound } from '@/lib/sounds'
import ElementDetail from './ElementDetail'

const TILE = 26       // px
const GAP  = 1.5      // px between tiles
const SPACER_PX = 6   // gap row between main table and f-block

const MAIN_ROWS = 7   // periods 1-7
const F_ROWS   = 2    // lanthanides + actinides

export default function PeriodicTable() {
  const [mode, setMode] = useState<ColorMode>('category')
  const [selected, setSelected] = useState<Element | null>(null)

  const fillFor = (el: Element): string =>
    mode === 'state' ? STATE_COLORS[el.state] : CATEGORY_COLORS[el.category]

  return (
    <div className="flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="flex items-center justify-center gap-2">
        {(['category', 'state'] as ColorMode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { playSound('ui_tap'); setMode(m) }}
            className="active:translate-y-[1px] transition-transform"
            style={{
              padding: '6px 12px',
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 7,
              letterSpacing: 1.5,
              color: mode === m ? '#0A140A' : '#BEF264',
              background: mode === m ? '#BEF264' : '#1A2E05',
              border: '2px solid #84CC16',
              borderRadius: 3,
              boxShadow: mode === m ? 'inset 1px 1px 0 rgba(0,0,0,0.18)' : '2px 2px 0 #050a02',
            }}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Scrollable table region */}
      <div className="relative">
        <div
          className="overflow-x-auto"
          style={{
            paddingBottom: 4,
            // Native momentum scroll on iOS Safari.
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(18, ${TILE}px)`,
              gridTemplateRows:    `repeat(${MAIN_ROWS}, ${TILE}px) ${SPACER_PX}px repeat(${F_ROWS}, ${TILE}px)`,
              gap: GAP,
              padding: 4,
              width: 'max-content',
            }}
          >
            {/* f-block pointer markers — point to the two rows below */}
            <Marker col={3} row={6} text="57–71" />
            <Marker col={3} row={7} text="89–103" />

            {elements.map(el => {
              const fill = fillFor(el)
              const text = readableText(fill)
              return (
                <button
                  key={el.atomicNumber}
                  type="button"
                  onClick={() => { playSound('ui_tap'); setSelected(el) }}
                  title={`${el.name} (${el.symbol})`}
                  className="relative flex flex-col items-center justify-center active:translate-y-[1px] transition-transform"
                  style={{
                    gridColumn: el.xpos,
                    // Account for the spacer row between main table and f-block:
                    // ypos 9 → actual row 10, ypos 10 → row 11 (after spacer at row 8).
                    gridRow: el.ypos <= 7 ? el.ypos : el.ypos + 1,
                    background: fill,
                    color: text,
                    border: '1px solid rgba(0,0,0,0.55)',
                    borderRadius: 2,
                    fontFamily: '"Press Start 2P", monospace',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 1, left: 2,
                    fontSize: 5, lineHeight: 1, opacity: 0.85,
                  }}>
                    {el.atomicNumber}
                  </span>
                  <span style={{ fontSize: 8, lineHeight: 1, fontWeight: 700 }}>
                    {el.symbol}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {/* Soft right-edge fade hint that there's more to scroll */}
        <div className="absolute top-0 right-0 bottom-1 pointer-events-none" style={{
          width: 24,
          background: 'linear-gradient(to right, transparent, rgba(10,20,10,0.85))',
        }} />
      </div>

      {/* Legend */}
      <Legend mode={mode} />

      {selected && (
        <ElementDetail element={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function Marker({ col, row, text }: { col: number; row: number; text: string }) {
  return (
    <div
      style={{
        gridColumn: col,
        gridRow: row,
        border: '1px dashed rgba(190,242,100,0.4)',
        borderRadius: 2,
        color: 'rgba(190,242,100,0.55)',
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 4,
        letterSpacing: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {text}
    </div>
  )
}

function Legend({ mode }: { mode: ColorMode }) {
  const items: { color: string; label: string }[] = mode === 'category'
    ? (Object.keys(CATEGORY_COLORS) as ElementCategory[]).map(k => ({
        color: CATEGORY_COLORS[k], label: CATEGORY_LABELS[k],
      }))
    : (['solid', 'liquid', 'gas', 'unknown'] as const).map(s => ({
        color: STATE_COLORS[s], label: STATE_LABELS[s],
      }))

  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 px-2">
      {items.map(it => (
        <span key={it.label} className="inline-flex items-center gap-1.5" style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 5,
          letterSpacing: 0.5,
          color: '#E8FAD0',
        }}>
          <span style={{
            width: 8, height: 8,
            background: it.color,
            border: '1px solid rgba(0,0,0,0.55)',
            borderRadius: 1,
          }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
