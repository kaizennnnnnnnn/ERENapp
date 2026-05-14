'use client'

// ─── LightSwitch ──────────────────────────────────────────────────────────
// A night-only wall switch in the top corner of a room. Tapping it flips a
// warm cone of light down onto Eren (and a soft halo at his feet) so it
// looks like you've turned on a directed lamp. Renders nothing during the
// day. Keyframes live in globals.css to avoid styled-jsx swc panics.

import { useState } from 'react'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'

interface Props {
  /** Which corner the switch sits in. Default: 'right'. */
  side?: 'left' | 'right'
  /** How far down from the top of the scene the switch hangs. */
  switchTop?: string
  /** Where the beam should land — defaults to Eren's usual standing spot. */
  targetLeft?: string
  targetBottom?: string
}

export default function LightSwitch({
  side         = 'right',
  switchTop    = '14%',
  targetLeft   = '50%',
  targetBottom = '14%',
}: Props) {
  const isDark = useIsDark()
  const [on, setOn] = useState(false)
  if (!isDark) return null

  return (
    <>
      {/* ─── Beam + halo (only while the light is on) ─── */}
      {on && (
        <>
          {/* Vertical cone shining straight down at Eren. */}
          <div className="absolute pointer-events-none" style={{
            left: targetLeft,
            bottom: targetBottom,
            transform: 'translateX(-50%)',
            width:  'min(58%, 300px)',
            height: '74%',
            background: 'linear-gradient(to bottom, rgba(255,232,160,0) 0%, rgba(255,232,160,0.38) 55%, rgba(255,232,160,0.62) 100%)',
            clipPath: 'polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%)',
            mixBlendMode: 'screen',
            zIndex: 11,
            animation: 'lsBeamFlicker 3s ease-in-out infinite',
          }} />
          {/* Halo / pool of light at Eren's feet. */}
          <div className="absolute pointer-events-none" style={{
            left: targetLeft,
            bottom: targetBottom,
            width: 260, height: 200,
            background: 'radial-gradient(ellipse at center, rgba(255,232,160,0.55) 0%, rgba(255,232,160,0.22) 40%, rgba(255,232,160,0) 75%)',
            mixBlendMode: 'screen',
            zIndex: 11,
            animation: 'lsHaloPulse 3s ease-in-out infinite',
          }} />
        </>
      )}

      {/* ─── Wall switch button ─── */}
      <button
        onClick={(e) => { e.stopPropagation(); setOn(o => !o); playSound('ui_modal_open') }}
        className="absolute"
        style={{
          top: switchTop,
          [side]: 14,
          zIndex: 28,
          width: 30, height: 40,
          padding: 0,
          background: 'linear-gradient(180deg, #1F1816 0%, #14100E 100%)',
          border: '2px solid #08060A',
          borderRadius: 4,
          boxShadow: '0 3px 0 rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          cursor: 'pointer',
        }}
        aria-label={on ? 'Turn light off' : 'Turn light on'}
      >
        {/* Toggle lever */}
        <div style={{
          width: 14, height: 20,
          margin: '4px auto 0',
          background: on
            ? 'linear-gradient(180deg, #FFEAA0 0%, #C8A040 100%)'
            : 'linear-gradient(180deg, #3A3530 0%, #1A1612 100%)',
          borderRadius: 2,
          border: '1px solid #0A0608',
          boxShadow: on ? '0 0 10px rgba(255,232,160,0.85), inset 0 1px 0 rgba(255,255,255,0.4)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
          transform: on ? 'translateY(10px)' : 'translateY(0)',
          transition: 'transform 130ms ease, background 200ms ease, box-shadow 200ms ease',
        }} />
      </button>
    </>
  )
}
