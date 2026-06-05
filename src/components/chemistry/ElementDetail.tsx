'use client'

// ElementDetail — modal sheet shown when a tile in the PeriodicTable is
// tapped. Pixel-art card with the element's vitals, fun fact, and name
// origin. Tap the backdrop or the close button to dismiss.

import { CATEGORY_LABELS, type Element } from '@/lib/chemistry/elements'
import { CATEGORY_COLORS, STATE_LABELS, readableText } from '@/lib/chemistry/colors'
import { playSound } from '@/lib/sounds'

interface Props {
  element: Element
  onClose: () => void
}

export default function ElementDetail({ element, onClose }: Props) {
  const fill = CATEGORY_COLORS[element.category]
  const text = readableText(fill)

  function dismiss() {
    playSound('ui_tap')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{
        background: 'rgba(5, 12, 5, 0.78)',
        animation: 'elDetailFade 0.18s ease both',
        paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={dismiss}
    >
      <div
        // Stop click propagation so taps INSIDE the card don't close it.
        onClick={e => e.stopPropagation()}
        className="relative w-full overflow-y-auto"
        style={{
          maxWidth: 320,
          maxHeight: '100%',
          background: '#10200F',
          border: '2px solid #84CC16',
          borderRadius: 4,
          boxShadow: '4px 4px 0 #050a02',
          animation: 'elDetailPop 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* Close — top-right, 44 × 44 hit target */}
        <button
          type="button"
          aria-label="Close element detail"
          onClick={dismiss}
          className="absolute active:translate-y-[1px] transition-transform"
          style={{
            top: 8, right: 8,
            minWidth: 32, minHeight: 32,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: '#1A2E05',
            border: '2px solid #84CC16',
            borderRadius: 3,
            boxShadow: '2px 2px 0 #050a02',
            color: '#BEF264',
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 8,
          }}
        >
          ✕
        </button>

        {/* Symbol slab — category-colored, big symbol + atomic number */}
        <div
          style={{
            background: fill, color: text,
            padding: '18px 14px 14px',
            borderBottom: '2px solid #3F6212',
          }}
        >
          <div className="flex items-baseline gap-3">
            <span style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 24, lineHeight: 1, fontWeight: 700,
            }}>
              {element.symbol}
            </span>
            <span style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 7, opacity: 0.75, letterSpacing: 1,
            }}>
              #{element.atomicNumber}
            </span>
          </div>
          <div style={{
            marginTop: 6,
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 10, letterSpacing: 1,
          }}>
            {element.name}
          </div>
          <div style={{
            marginTop: 4,
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 6, letterSpacing: 1, opacity: 0.78,
          }}>
            {CATEGORY_LABELS[element.category]}
          </div>
        </div>

        {/* Vitals grid */}
        <div className="grid grid-cols-2 gap-2 px-4 py-3" style={{
          borderBottom: '1px dashed rgba(190,242,100,0.25)',
        }}>
          <Stat label="State"  value={STATE_LABELS[element.state]} />
          <Stat label="Period" value={String(element.period)} />
          <Stat label="Group"  value={element.group != null ? String(element.group) : '—'} />
          <Stat label="Mass"   value={element.atomicMass.toString()} />
        </div>

        {/* Lore */}
        <div className="px-4 py-3 space-y-3">
          {element.funFact && (
            <Block heading="FUN FACT" body={element.funFact} />
          )}
          {element.nameOrigin && (
            <Block heading="NAME ORIGIN" body={element.nameOrigin} />
          )}
          {element.mnemonic && (
            <Block heading="MNEMONIC" body={element.mnemonic} />
          )}
        </div>
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
      `}</style>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#1A2E05',
      border: '1px solid #3F6212',
      borderRadius: 3,
      padding: '6px 8px',
    }}>
      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 5, letterSpacing: 1, color: '#84CC16', opacity: 0.85,
      }}>
        {label}
      </div>
      <div style={{
        marginTop: 3,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 8, color: '#E8FAD0',
      }}>
        {value}
      </div>
    </div>
  )
}

function Block({ heading, body }: { heading: string; body: string }) {
  return (
    <div>
      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 5.5, letterSpacing: 1.5, color: '#BEF264', marginBottom: 4,
      }}>
        {heading}
      </div>
      <p style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 6.5, lineHeight: 1.7, color: '#E8FAD0', letterSpacing: 0.3,
      }}>
        {body}
      </p>
    </div>
  )
}
