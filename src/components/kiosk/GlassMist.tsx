'use client'

// The hatch misting up.
//
// A hot kiosk against a cold street fogs its own glass, slowly, all night, and
// there is nothing in the game that stops it — the street just gets harder to
// see and the person at the window turns into a shape. Wiping it with your
// sleeve is one tap, and it starts again the moment you let it.
//
// It costs you nothing and pays you nothing on purpose. It's the one control
// in the kiosk that exists only because you'd want to.

import { GLASS } from './kioskShift'

interface Props {
  /** 0 clear, 1 completely gone. */
  mist: number
  /** Bumped on every wipe, to restart the streak. */
  wipe: number
  onWipe: () => void
  /** Reduced motion: the pane still fogs, the sleeve just doesn't streak. */
  still?: boolean
}

/** How opaque a fully-misted pane gets. Short of hiding the customer: you have
 *  to still be able to serve somebody through it. */
const MAX_VEIL = 0.46
const MAX_BLUR = 2.4

export default function GlassMist({ mist, wipe, onWipe, still = false }: Props) {
  const m = Math.max(0, Math.min(1, mist))
  const box: React.CSSProperties = {
    position: 'absolute',
    left: `${GLASS.left}%`, top: `${GLASS.top}%`,
    width: `${GLASS.width}%`, height: `${GLASS.height}%`,
  }

  return (
    <>
      {/* The tap target, UNDER the customer — tapping them still asks them to
          say it again, and everywhere else on the glass is a sleeve. */}
      <button
        type="button"
        aria-label="Wipe the window"
        onClick={onWipe}
        style={{
          ...box, zIndex: 4,
          background: 'none', border: 0, padding: 0,
          // Nothing to press when there's nothing on it.
          pointerEvents: m > 0.08 ? 'auto' : 'none',
        }}
      />

      {/* The mist itself, in FRONT of whoever's at the window: the glass is
          between you and them, so they go soft before the street does. */}
      <div aria-hidden className="pointer-events-none overflow-hidden" style={{
        ...box, zIndex: 7,
        opacity: m,
        transition: 'opacity 600ms ease',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(180deg, rgba(226,234,244,0.5) 0%, rgba(214,224,238,0.34) 46%, rgba(226,234,244,0.55) 100%)',
          opacity: MAX_VEIL,
          backdropFilter: `blur(${(MAX_BLUR * m).toFixed(2)}px)`,
          WebkitBackdropFilter: `blur(${(MAX_BLUR * m).toFixed(2)}px)`,
        }} />
        {/* Condensation gathers at the edges first, where the frame is cold. */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(78% 62% at 50% 46%, transparent 34%, rgba(232,240,250,0.5) 100%)',
        }} />

        {/* The sleeve going across. One pass, on the wipe. */}
        {!still && wipe > 0 && (
          <div key={wipe} style={{
            position: 'absolute', top: '-20%', bottom: '-20%', width: '46%',
            background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.5) 45%, transparent)',
            animation: 'kioskWipe 620ms cubic-bezier(0.32, 0.72, 0, 1) both',
          }} />
        )}
      </div>
    </>
  )
}
