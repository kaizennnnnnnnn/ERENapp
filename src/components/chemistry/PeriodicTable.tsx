'use client'

// PeriodicTable — all 118 elements laid out in the canonical 18×7 grid
// with the f-block underneath. Neo-brutalism skin: cream paper, ink
// outlines, hard offset shadows, rounded sans font. The whole thing
// scrolls horizontally on phones; a soft fade on the right edge hints
// there's more to swipe to.
//
// Behaviour preserved from the pixel-art version:
//   • Mode toggle (Category / State / Mastery)
//   • Mastery mode reads SRS box from useChemistryStore
//   • Tap a tile → ElementDetail modal
//   • playSound('ui_tap') on every tap

import { useState } from 'react'
import { elements, CATEGORY_LABELS, type Element, type ElementCategory } from '@/lib/chemistry/elements'
import {
  CATEGORY_COLORS, STATE_COLORS, STATE_LABELS,
  masteryColor, readableText, type ColorMode,
} from '@/lib/chemistry/colors'
import { useChemistryStore, elementCardId } from '@/lib/chemistry/store'
import { MASTERED_BOX } from '@/lib/chemistry/srs'
import { useChemistryTheme, neoShadow, CHEM_FONT } from '@/lib/chemistry/theme'
import { playSound } from '@/lib/sounds'
import ElementDetail from './ElementDetail'

const TILE = 30        // px — square tile edge
const GAP  = 4         // px — gap between tiles
const SPACER_PX = 8    // gap row between main table and f-block

const MAIN_ROWS = 7    // periods 1-7
const F_ROWS   = 2     // lanthanides + actinides

const MODES: { id: ColorMode; label: string }[] = [
  { id: 'category', label: 'Category' },
  { id: 'state',    label: 'State'    },
  { id: 'mastery',  label: 'Mastery'  },
]

export default function PeriodicTable() {
  const [mode, setMode] = useState<ColorMode>('category')
  const [selected, setSelected] = useState<Element | null>(null)
  const { state, hydrated } = useChemistryStore()
  const { palette } = useChemistryTheme()

  const boxFor = (el: Element): number =>
    hydrated ? (state.cards[elementCardId(el.atomicNumber)]?.box ?? 0) : 0

  const fillFor = (el: Element): string => {
    if (mode === 'state')   return STATE_COLORS[el.state]
    if (mode === 'mastery') return masteryColor(boxFor(el))
    return CATEGORY_COLORS[el.category]
  }

  return (
    <div className="flex flex-col gap-4" style={{ fontFamily: CHEM_FONT, color: palette.fg }}>
      {/* Mode toggle — pill segment inside ink-bordered container */}
      <div className="flex justify-center">
        <div
          className="inline-flex"
          style={{
            background: palette.cardMuted,
            border: `2px solid ${palette.ink}`,
            borderRadius: 999,
            padding: 4,
            boxShadow: neoShadow(palette.ink, 'sm'),
            gap: 2,
          }}
        >
          {MODES.map(m => {
            const active = mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { playSound('ui_tap'); setMode(m.id) }}
                style={{
                  fontFamily: CHEM_FONT,
                  fontSize: 12,
                  fontWeight: active ? 800 : 600,
                  letterSpacing: 0.2,
                  padding: '8px 16px',
                  minHeight: 36,
                  border: active ? `2px solid ${palette.ink}` : '2px solid transparent',
                  borderRadius: 999,
                  background: active ? palette.card : 'transparent',
                  color: active ? palette.ink : palette.fgMuted,
                  boxShadow: active ? neoShadow(palette.ink, 'sm') : 'none',
                  cursor: 'pointer',
                  transition: 'background 120ms ease, color 120ms ease',
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Scrollable table region */}
      <div className="relative">
        <div
          className="overflow-x-auto"
          style={{
            paddingBottom: 6,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(18, ${TILE}px)`,
              gridTemplateRows:    `repeat(${MAIN_ROWS}, ${TILE}px) ${SPACER_PX}px repeat(${F_ROWS}, ${TILE}px)`,
              gap: GAP,
              padding: 6,
              width: 'max-content',
            }}
          >
            {/* f-block pointer markers — point to the two rows below */}
            <Marker col={3} row={6} text="57–71" inkColor={palette.ink} mutedColor={palette.fgMuted} />
            <Marker col={3} row={7} text="89–103" inkColor={palette.ink} mutedColor={palette.fgMuted} />

            {elements.map(el => {
              const fill = fillFor(el)
              const text = readableText(fill)
              const mastered = mode === 'mastery' && boxFor(el) >= MASTERED_BOX
              return (
                <button
                  key={el.atomicNumber}
                  type="button"
                  onClick={() => { playSound('ui_tap'); setSelected(el) }}
                  title={`${el.name} (${el.symbol})`}
                  className="neo-tile relative flex flex-col items-center justify-center"
                  style={{
                    gridColumn: el.xpos,
                    // Account for the spacer row between main table and f-block:
                    // ypos 9 → actual row 10, ypos 10 → row 11 (after spacer at row 8).
                    gridRow: el.ypos <= 7 ? el.ypos : el.ypos + 1,
                    background: fill,
                    color: text,
                    border: `${mastered ? 2.5 : 1.5}px solid ${palette.ink}`,
                    borderRadius: 8,
                    boxShadow: neoShadow(palette.ink, 'sm'),
                    fontFamily: CHEM_FONT,
                    transform: mastered ? 'scale(1.04)' : undefined,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 1, left: 3,
                    fontSize: 7, lineHeight: 1, fontWeight: 700, opacity: 0.85,
                  }}>
                    {el.atomicNumber}
                  </span>
                  <span style={{ fontSize: 12, lineHeight: 1, fontWeight: 800 }}>
                    {el.symbol}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {/* Right-edge fade — uses palette.bg so it reads in both themes */}
        <div
          className="absolute top-0 right-0 bottom-1 pointer-events-none"
          style={{
            width: 28,
            background: `linear-gradient(to right, transparent, ${palette.bg})`,
          }}
        />
      </div>

      {/* Legend */}
      <Legend mode={mode} />

      {selected && (
        <ElementDetail element={selected} onClose={() => setSelected(null)} />
      )}

      {/* Tactile press feedback for tiles + mode buttons (neo-press) */}
      <style jsx>{`
        .neo-tile {
          transition: transform 120ms ease, box-shadow 120ms ease;
        }
        .neo-tile:hover {
          transform: translate(1px, 1px);
        }
        .neo-tile:active {
          transform: translate(2px, 2px);
          box-shadow: none !important;
        }
      `}</style>
    </div>
  )
}

function Marker({
  col, row, text, inkColor, mutedColor,
}: { col: number; row: number; text: string; inkColor: string; mutedColor: string }) {
  return (
    <div
      style={{
        gridColumn: col,
        gridRow: row,
        border: `1.5px dashed ${inkColor}`,
        borderRadius: 8,
        color: mutedColor,
        fontFamily: CHEM_FONT,
        fontSize: 7,
        fontWeight: 700,
        letterSpacing: 0.3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.7,
      }}
    >
      {text}
    </div>
  )
}

function Legend({ mode }: { mode: ColorMode }) {
  const { palette } = useChemistryTheme()

  let items: { color: string; label: string }[]
  if (mode === 'category') {
    items = (Object.keys(CATEGORY_COLORS) as ElementCategory[]).map(k => ({
      color: CATEGORY_COLORS[k], label: CATEGORY_LABELS[k],
    }))
  } else if (mode === 'state') {
    items = (['solid', 'liquid', 'gas', 'unknown'] as const).map(s => ({
      color: STATE_COLORS[s], label: STATE_LABELS[s],
    }))
  } else {
    items = [
      { color: masteryColor(0), label: 'New' },
      { color: masteryColor(2), label: 'Learning' },
      { color: masteryColor(4), label: 'Familiar' },
      { color: masteryColor(MASTERED_BOX), label: 'Mastered' },
    ]
  }

  return (
    <div className="flex flex-wrap justify-center gap-1.5 px-2">
      {items.map(it => (
        <span
          key={it.label}
          className="inline-flex items-center"
          style={{
            gap: 6,
            fontFamily: CHEM_FONT,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.1,
            color: palette.fg,
            background: palette.card,
            border: `2px solid ${palette.ink}`,
            borderRadius: 999,
            padding: '4px 10px',
            boxShadow: neoShadow(palette.ink, 'sm'),
          }}
        >
          <span style={{
            width: 12, height: 12,
            background: it.color,
            border: `1.5px solid ${palette.ink}`,
            borderRadius: 4,
            display: 'inline-block',
          }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}
