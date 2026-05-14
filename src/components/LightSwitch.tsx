'use client'

// ─── LightSwitch ──────────────────────────────────────────────────────────
// A night-only wall switch in the top corner of a room. Tapping it lights
// a soft warm pool around Eren so he stops fading into the dark backdrop.
// No hard triangular clip — two stacked, blurred radial gradients give a
// gentle "lamp on" feel rather than a flashlight beam. Keyframes live in
// globals.css to avoid styled-jsx swc panics.

import { useState } from 'react'
import { useIsDark } from '@/hooks/useIsDark'
import { playSound } from '@/lib/sounds'

interface Props {
  /** Which corner the switch sits in. Default: 'right'. */
  side?: 'left' | 'right'
  /** How far down from the top of the scene the switch hangs. */
  switchTop?: string
  /** Where the light should pool — defaults to Eren's usual standing spot. */
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
      {/* ─── Soft glow (only while the light is on) ─── */}
      {on && (
        <>
          {/* Tall, narrow vertical halo — gives a sense of the light
              coming from above without the hard polygon edges of a true
              spotlight beam. */}
          <div className="absolute pointer-events-none" style={{
            left: targetLeft,
            bottom: targetBottom,
            width: 240, height: '78%',
            transform: 'translate(-50%, 18%)',
            background: 'radial-gradient(ellipse 55% 55% at 50% 100%, rgba(255,236,180,0.22) 0%, rgba(255,236,180,0.11) 40%, rgba(255,236,180,0.03) 70%, rgba(255,236,180,0) 92%)',
            mixBlendMode: 'screen',
            filter: 'blur(6px)',
            zIndex: 11,
            animation: 'lsHaloPulse 4s ease-in-out infinite',
          }} />
          {/* Wide soft pool at Eren's feet. */}
          <div className="absolute pointer-events-none" style={{
            left: targetLeft,
            bottom: targetBottom,
            width: 340, height: 240,
            transform: 'translate(-50%, 32%)',
            background: 'radial-gradient(ellipse at center, rgba(255,236,180,0.26) 0%, rgba(255,236,180,0.12) 38%, rgba(255,236,180,0.04) 68%, rgba(255,236,180,0) 90%)',
            mixBlendMode: 'screen',
            filter: 'blur(8px)',
            zIndex: 11,
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
          width: 32, height: 44,
          padding: 0,
          background: 'linear-gradient(180deg, #221A18 0%, #16100E 100%)',
          // Accent-coloured outer ring so the switch reads against any
          // wall tone in any room, not just dark obsidian.
          border: '2px solid rgba(var(--accent-rgb), 0.55)',
          borderRadius: 5,
          boxShadow: '0 3px 0 rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.6), 0 0 10px rgba(var(--accent-rgb), 0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
          cursor: 'pointer',
        }}
        aria-label={on ? 'Turn light off' : 'Turn light on'}
      >
        {/* Toggle lever */}
        <div style={{
          width: 14, height: 22,
          margin: '4px auto 0',
          background: on
            ? 'linear-gradient(180deg, #FFEAA0 0%, #C8A040 100%)'
            : 'linear-gradient(180deg, #3A3530 0%, #1A1612 100%)',
          borderRadius: 2,
          border: '1px solid #0A0608',
          boxShadow: on ? '0 0 10px rgba(255,232,160,0.8), inset 0 1px 0 rgba(255,255,255,0.4)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
          transform: on ? 'translateY(10px)' : 'translateY(0)',
          transition: 'transform 130ms ease, background 200ms ease, box-shadow 200ms ease',
        }} />
      </button>
    </>
  )
}
