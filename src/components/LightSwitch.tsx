'use client'

// ─── LightSwitch ──────────────────────────────────────────────────────────
// A night-only wall switch in the corner of a room. Looks like a classic
// pixel-art wall toggle: cream faceplate, two screws, dark recessed slot,
// gold lever that snaps between up (off) and down (on). Tapping it lights
// a visible ceiling lamp + a soft warm cone down onto Eren so the source
// of the light is obvious and never reads as just "Eren glows".

import { useState } from 'react'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'

interface Props {
  /** Which corner the wall switch sits in. Default: 'right'. */
  side?: 'left' | 'right'
  /** How far down from the top of the scene the switch hangs. */
  switchTop?: string
  /** Where the visible ceiling lamp hangs. */
  lampTop?: string
  /** Where the light should pool — defaults to Eren's usual standing spot. */
  targetLeft?: string
  targetBottom?: string
}

export default function LightSwitch({
  side         = 'right',
  switchTop    = '22%',
  lampTop      = '7%',
  targetLeft   = '50%',
  targetBottom = '14%',
}: Props) {
  const isDark = useIsDark()
  const [on, setOn] = useState(false)
  if (!isDark) return null

  return (
    <>
      {/* ─── Visible light source + cone (only while on) ─── */}
      {on && (
        <>
          {/* Ceiling lamp — bright warm bulb so the player can see where
              the light is coming from. */}
          <div className="absolute pointer-events-none" style={{
            top: lampTop,
            left: targetLeft,
            transform: 'translate(-50%, -50%)',
            width: 14, height: 14,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #FFFBE0 0%, #FFE38A 40%, #D89030 85%, transparent 100%)',
            boxShadow: '0 0 14px rgba(255,232,160,0.9), 0 0 32px rgba(255,210,120,0.55), 0 0 60px rgba(255,200,100,0.3)',
            zIndex: 12,
            animation: 'lsHaloPulse 4s ease-in-out infinite',
          }} />

          {/* Soft directional cone — trapezoid shape blurred to avoid the
              hard spotlight look. */}
          <div className="absolute pointer-events-none" style={{
            top: lampTop,
            bottom: targetBottom,
            left: targetLeft,
            transform: 'translateX(-50%)',
            width: 'min(62%, 320px)',
            background: 'linear-gradient(to bottom, rgba(255,236,180,0.18) 0%, rgba(255,236,180,0.22) 60%, rgba(255,236,180,0.26) 100%)',
            clipPath: 'polygon(46% 0%, 54% 0%, 100% 100%, 0% 100%)',
            filter: 'blur(9px)',
            mixBlendMode: 'screen',
            zIndex: 11,
            animation: 'lsHaloPulse 4s ease-in-out infinite',
          }} />

          {/* Soft pool at Eren's feet. */}
          <div className="absolute pointer-events-none" style={{
            left: targetLeft,
            bottom: targetBottom,
            width: 320, height: 220,
            transform: 'translate(-50%, 32%)',
            background: 'radial-gradient(ellipse at center, rgba(255,236,180,0.22) 0%, rgba(255,236,180,0.10) 38%, rgba(255,236,180,0.02) 68%, rgba(255,236,180,0) 90%)',
            mixBlendMode: 'screen',
            filter: 'blur(8px)',
            zIndex: 11,
          }} />
        </>
      )}

      {/* ─── Wall switch ─── */}
      <button
        onClick={(e) => { e.stopPropagation(); setOn(o => !o); playSound('ui_modal_open') }}
        className="absolute"
        style={{
          top: switchTop,
          [side]: 12,
          zIndex: 28,
          width: 38, height: 58,
          padding: 0,
          // Cream wall plate — reads as a clearly visible faceplate against
          // any room's wall tone.
          background: 'linear-gradient(180deg, #F0E6D0 0%, #D6C6A2 100%)',
          border: '2px solid #2A1810',
          borderRadius: 4,
          boxShadow: '0 4px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.6), 0 0 14px rgba(var(--accent-rgb), 0.55), inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.18)',
          cursor: 'pointer',
        }}
        aria-label={on ? 'Turn light off' : 'Turn light on'}
      >
        {/* Top mounting screw */}
        <div style={{
          position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)',
          width: 5, height: 5, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #999 0%, #555 55%, #222 100%)',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.5)',
        }}>
          {/* Slot line on the screw */}
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, transform: 'translateY(-50%) rotate(35deg)', background: 'rgba(0,0,0,0.6)' }} />
        </div>

        {/* Recessed dark slot the lever rides in */}
        <div style={{
          position: 'absolute', top: 12, bottom: 12, left: 9, right: 9,
          background: 'linear-gradient(180deg, #1A0F0A 0%, #08040A 100%)',
          borderRadius: 3,
          border: '1px solid #050204',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.7)',
        }}>
          {/* Toggle lever */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, ${on ? '8px' : '-8px'})`,
            width: 12, height: 16,
            background: on
              ? 'linear-gradient(180deg, #FFEAA0 0%, #E0B850 50%, #B88830 100%)'
              : 'linear-gradient(180deg, #6E6258 0%, #322820 100%)',
            borderRadius: 2,
            border: '1px solid #0A0608',
            boxShadow: on
              ? '0 0 10px rgba(255,232,160,0.85), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.4)'
              : 'inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.4)',
            transition: 'transform 130ms ease, background 200ms ease, box-shadow 200ms ease',
          }} />
        </div>

        {/* Bottom mounting screw */}
        <div style={{
          position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
          width: 5, height: 5, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #999 0%, #555 55%, #222 100%)',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.5)',
        }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, transform: 'translateY(-50%) rotate(-25deg)', background: 'rgba(0,0,0,0.6)' }} />
        </div>
      </button>
    </>
  )
}
