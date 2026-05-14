'use client'

// ─── LightSwitch ──────────────────────────────────────────────────────────
// A night-only wall switch in the corner of a room. Tapping it lights a
// ceiling lamp + a soft warm cone down to Eren so he stops fading into
// the dark backdrop. The lamp itself is visible (small glowing circle at
// the top of the scene) so the player can see where the light is coming
// from. Cone edges are blurred so the beam reads as directional but
// never harsh. Keyframes live in globals.css.

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
  switchTop    = '14%',
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
          {/* The ceiling lamp itself — a bright warm bulb so you can see
              where the light is coming from instead of just "Eren glows". */}
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

          {/* Soft directional cone from lamp down to Eren. Trapezoid clip
              gives the directional shape; filter: blur() softens the
              edges so it doesn't read as a hard spotlight. */}
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

          {/* Wide soft pool at Eren's feet. */}
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

      {/* ─── Wall switch button — bigger + stronger accent glow so it
          reads against any wall tone. ─── */}
      <button
        onClick={(e) => { e.stopPropagation(); setOn(o => !o); playSound('ui_modal_open') }}
        className="absolute"
        style={{
          top: switchTop,
          [side]: 12,
          zIndex: 28,
          width: 38, height: 52,
          padding: 0,
          background: 'linear-gradient(180deg, #2A201E 0%, #14100E 100%)',
          border: '2px solid rgba(var(--accent-rgb), 0.9)',
          borderRadius: 6,
          boxShadow: '0 4px 0 rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.6), 0 0 14px rgba(var(--accent-rgb), 0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
          cursor: 'pointer',
        }}
        aria-label={on ? 'Turn light off' : 'Turn light on'}
      >
        {/* Toggle lever */}
        <div style={{
          width: 16, height: 26,
          margin: '5px auto 0',
          background: on
            ? 'linear-gradient(180deg, #FFEAA0 0%, #C8A040 100%)'
            : 'linear-gradient(180deg, #4A4440 0%, #221E1A 100%)',
          borderRadius: 2,
          border: '1px solid #0A0608',
          boxShadow: on
            ? '0 0 12px rgba(255,232,160,0.85), inset 0 1px 0 rgba(255,255,255,0.45)'
            : 'inset 0 1px 0 rgba(255,255,255,0.08)',
          transform: on ? 'translateY(12px)' : 'translateY(0)',
          transition: 'transform 130ms ease, background 200ms ease, box-shadow 200ms ease',
        }} />
      </button>
    </>
  )
}
