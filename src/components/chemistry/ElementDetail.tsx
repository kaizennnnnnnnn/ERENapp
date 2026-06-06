'use client'

// ElementDetail — modal sheet shown when a tile in the PeriodicTable is
// tapped. Neo-brutalism card with ink borders, hard offset shadows, and a
// category-coloured top slab. Tap backdrop or close button to dismiss.

import { X as XIcon } from 'lucide-react'
import { CATEGORY_LABELS, type Element } from '@/lib/chemistry/elements'
import { CATEGORY_COLORS, STATE_LABELS, readableText } from '@/lib/chemistry/colors'
import { playSound } from '@/lib/sounds'
import { useChemistryTheme, neoShadow, CHEM_FONT } from '@/lib/chemistry/theme'

interface Props {
  element: Element
  onClose: () => void
}

export default function ElementDetail({ element, onClose }: Props) {
  const { palette } = useChemistryTheme()
  const fill = CATEGORY_COLORS[element.category]
  const text = readableText(fill)

  function dismiss() {
    playSound('ui_tap')
    onClose()
  }

  return (
    <div
      // z-[90] keeps the detail card above the overlay it was opened from.
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{
        // Ink at 60% opacity for the backdrop — works in both themes.
        background: hexToRgba(palette.ink, 0.6),
        animation: 'elDetailFade 0.18s ease both',
        paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        fontFamily: CHEM_FONT,
      }}
      onClick={dismiss}
    >
      <div
        // Stop click propagation so taps INSIDE the card don't close it.
        onClick={e => e.stopPropagation()}
        className="relative w-full overflow-y-auto"
        style={{
          maxWidth: 340,
          maxHeight: '100%',
          background: palette.card,
          border: `2px solid ${palette.ink}`,
          borderRadius: 16,
          boxShadow: neoShadow(palette.ink, 'lg'),
          animation: 'elDetailPop 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Close — top-right, 44 × 44 hit target via padding wrapper */}
        <button
          type="button"
          aria-label="Close element detail"
          onClick={dismiss}
          className="absolute neo-press"
          style={{
            top: 10,
            right: 10,
            width: 36,
            height: 36,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: palette.card,
            border: `2px solid ${palette.ink}`,
            borderRadius: 999,
            boxShadow: neoShadow(palette.ink, 'sm'),
            color: palette.ink,
            fontFamily: CHEM_FONT,
            lineHeight: 1,
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          <XIcon size={18} strokeWidth={2.6} />
        </button>

        {/* Symbol slab — category-coloured, big symbol + atomic number */}
        <div
          style={{
            background: fill,
            color: text,
            padding: '20px 18px 18px',
            borderBottom: `2px solid ${palette.ink}`,
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
          }}
        >
          <div className="flex items-baseline gap-3">
            <span style={{
              fontFamily: CHEM_FONT,
              fontSize: 40,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: -0.5,
            }}>
              {element.symbol}
            </span>
            <span style={{
              fontFamily: CHEM_FONT,
              fontSize: 14,
              fontWeight: 700,
              opacity: 0.85,
            }}>
              #{element.atomicNumber}
            </span>
          </div>
          <div style={{
            marginTop: 8,
            fontFamily: CHEM_FONT,
            fontSize: 22,
            fontWeight: 800,
            lineHeight: 1.1,
          }}>
            {element.name}
          </div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 10,
              padding: '4px 10px',
              fontFamily: CHEM_FONT,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              background: palette.card,
              color: palette.ink,
              border: `2px solid ${palette.ink}`,
              borderRadius: 999,
              boxShadow: neoShadow(palette.ink, 'sm'),
            }}
          >
            {CATEGORY_LABELS[element.category]}
          </div>
        </div>

        {/* 2x2 vitals grid */}
        <div
          className="grid grid-cols-2 gap-3 px-4 py-4"
          style={{ background: palette.cardMuted }}
        >
          <Stat label="State"  value={STATE_LABELS[element.state]} palette={palette} />
          <Stat label="Period" value={String(element.period)} palette={palette} />
          <Stat label="Group"  value={element.group != null ? String(element.group) : '—'} palette={palette} />
          <Stat label="Mass"   value={element.atomicMass.toString()} palette={palette} />
        </div>

        {/* Lore blocks */}
        {(element.funFact || element.nameOrigin || element.mnemonic) && (
          <div
            className="px-4 py-4 space-y-3"
            style={{
              borderTop: `2px solid ${palette.ink}`,
              background: palette.card,
              borderBottomLeftRadius: 14,
              borderBottomRightRadius: 14,
            }}
          >
            {element.funFact && (
              <Block heading="Fun fact" body={element.funFact} accent={palette.sun} palette={palette} />
            )}
            {element.nameOrigin && (
              <Block heading="Name origin" body={element.nameOrigin} accent={palette.sky} palette={palette} />
            )}
            {element.mnemonic && (
              <Block heading="Mnemonic" body={element.mnemonic} accent={palette.grape} palette={palette} />
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes elDetailFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes elDetailPop {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1);    }
        }
        .neo-press {
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .neo-press:hover {
          transform: translate(1px, 1px);
        }
        .neo-press:active {
          transform: translate(2px, 2px);
          box-shadow: 0 0 0 0 transparent !important;
        }
      `}</style>
    </div>
  )
}

function Stat({
  label,
  value,
  palette,
}: {
  label: string
  value: string
  palette: ReturnType<typeof useChemistryTheme>['palette']
}) {
  return (
    <div
      style={{
        background: palette.card,
        border: `2px solid ${palette.ink}`,
        borderRadius: 12,
        boxShadow: neoShadow(palette.ink, 'sm'),
        padding: '10px 12px',
      }}
    >
      <div style={{
        fontFamily: CHEM_FONT,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: palette.fgMuted,
      }}>
        {label}
      </div>
      <div style={{
        marginTop: 4,
        fontFamily: CHEM_FONT,
        fontSize: 18,
        fontWeight: 800,
        color: palette.fg,
        lineHeight: 1.1,
      }}>
        {value}
      </div>
    </div>
  )
}

function Block({
  heading,
  body,
  accent,
  palette,
}: {
  heading: string
  body: string
  accent: string
  palette: ReturnType<typeof useChemistryTheme>['palette']
}) {
  return (
    <div
      style={{
        background: palette.cardMuted,
        border: `2px solid ${palette.ink}`,
        borderRadius: 12,
        boxShadow: neoShadow(palette.ink, 'sm'),
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          fontFamily: CHEM_FONT,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: palette.ink,
          background: accent,
          border: `2px solid ${palette.ink}`,
          borderRadius: 999,
          padding: '2px 10px',
          marginBottom: 8,
        }}
      >
        {heading}
      </div>
      <p style={{
        fontFamily: CHEM_FONT,
        fontSize: 14,
        lineHeight: 1.5,
        fontWeight: 600,
        color: palette.fg,
        margin: 0,
      }}>
        {body}
      </p>
    </div>
  )
}

/** Convert #RRGGBB to an rgba() string with the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '')
  const full = m.length === 3
    ? m.split('').map(c => c + c).join('')
    : m
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
