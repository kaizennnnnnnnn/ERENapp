'use client'

// The radio on the prep counter. Tap it to tune: off, then three stations,
// then off again — the way you'd actually use one.
//
// The sound lives in lib/kioskRadio; this is the thing you press, the light
// on the dial, and the name of the station on a strip above it for a moment
// after you change it.

import { useEffect, useState } from 'react'
import { RADIO_BOX, RADIO_SPRITE } from './kioskShift'
import { STATIONS } from '@/lib/kioskRadio'

interface Props {
  /** 0 is off; 1–3 are the stations. */
  station: number
  onCycle: () => void
}

/** How long the station name stays up after you tune to it. */
const NAME_MS = 1900

export default function KioskRadio({ station, onCycle }: Props) {
  const on = station > 0
  const name = on ? STATIONS[station - 1]?.name ?? '' : 'OFF'
  const [showName, setShowName] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!touched) return
    setShowName(true)
    const t = setTimeout(() => setShowName(false), NAME_MS)
    return () => clearTimeout(t)
  }, [station, touched])

  return (
    <>
      {/* What you just tuned to. Above the set, on the shadowed wall, so it
          reads against something dark. */}
      {showName && (
        <span className="font-pixel pointer-events-none" style={{
          position: 'absolute',
          left: `${RADIO_BOX.x}%`, top: `${RADIO_BOX.top - 5.4}%`,
          transform: 'translateX(-50%)', whiteSpace: 'nowrap',
          zIndex: 5,
          fontSize: 6, letterSpacing: 1.2,
          color: on ? '#FFE7C4' : 'rgba(255,231,196,0.55)',
          background: 'rgba(10,7,6,0.75)',
          border: `2px solid ${on ? 'rgba(245,156,69,0.5)' : 'rgba(200,190,205,0.25)'}`,
          borderRadius: 6, padding: '5px 7px 4px',
          animation: 'kioskLineIn 260ms ease-out both',
        }}>
          {name}
        </span>
      )}

      <button
        type="button"
        aria-label={on ? `Radio: ${name}. Tap to change station` : 'Turn the radio on'}
        onClick={() => { setTouched(true); onCycle() }}
        className="active:scale-95 transition-transform"
        style={{
          position: 'absolute',
          left: `${RADIO_BOX.x}%`, top: `${RADIO_BOX.top}%`, width: `${RADIO_BOX.width}%`,
          transform: 'translateX(-50%)',
          background: 'none', border: 0, padding: 0,
          zIndex: 4,
        }}
      >
        <span style={{ display: 'block', position: 'relative' }}>
          <img src={RADIO_SPRITE} alt="" draggable={false} style={{
            display: 'block', width: '100%', height: 'auto',
            filter: on
              ? 'brightness(1.02) drop-shadow(0 0 6px rgba(245,156,69,0.45)) drop-shadow(2px 3px 2px rgba(0,0,0,0.6))'
              : 'brightness(0.78) saturate(0.85) drop-shadow(2px 3px 2px rgba(0,0,0,0.6))',
            transition: 'filter 260ms ease',
          }} />

          {/* Three bars jumping behind the grille. The only way to tell from
              across the room that it's playing. */}
          {on && (
            <span aria-hidden style={{
              position: 'absolute',
              // Inside the grille (which runs 12%–59% of the sprite), sitting
              // on its floor.
              // The container needs a WIDTH of its own: percentage widths on
              // flex children resolve against their container, and an
              // absolutely-positioned box that sizes to its content has none
              // to give — which collapsed three bars into one block.
              left: '20%', bottom: '30%', width: '30%', height: '34%',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  flex: '1 1 0', minWidth: 1, height: '100%',
                  margin: '0 6%',
                  background: 'rgba(245,192,73,0.9)',
                  transformOrigin: '50% 100%',
                  boxShadow: '0 0 3px rgba(245,192,73,0.6)',
                  animation: `kioskRadioEq ${420 + i * 130}ms ease-in-out ${i * 90}ms infinite alternate`,
                }} />
              ))}
            </span>
          )}
        </span>
      </button>
    </>
  )
}
