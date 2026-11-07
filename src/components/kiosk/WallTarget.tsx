'use client'

// A thing on a wall you can tap, with a label that says so.
//
// Everything else in the kiosk is either obviously food or obviously a button.
// The fridge and the door are neither — they're painted into the background,
// and without a tag on them there is nothing to tell you the wall is
// interactive at all. The tag pulses, sits on the object, and points at it.

import { KIOSK as K, kioskPanel } from './kioskTheme'

interface Props {
  /** Hit area, in % of the picture. */
  hit: { left: number; top: number; width: number; height: number }
  /** Where the tag sits, in % of the picture. */
  tag: { x: number; y: number }
  label: string
  'aria-label': string
  onClick: () => void
  /** Brighten the tag when this is the thing you most need right now. */
  urgent?: boolean
}

export default function WallTarget({ hit, tag, label, onClick, urgent, 'aria-label': ariaLabel }: Props) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="active:scale-[0.98] transition-transform"
      style={{
        position: 'absolute',
        left: `${hit.left}%`, top: `${hit.top}%`,
        width: `${hit.width}%`, height: `${hit.height}%`,
        background: 'none', border: 0, padding: 0,
        zIndex: 5,
      }}
    >
      <span style={{
        ...kioskPanel,
        position: 'absolute',
        left: `${(tag.x - hit.left) / hit.width * 100}%`,
        top: `${(tag.y - hit.top) / hit.height * 100}%`,
        transform: 'translate(-50%, -50%)',
        whiteSpace: 'nowrap',
        fontSize: 13, fontWeight: 800, letterSpacing: 0,
        color: urgent ? K.ground : K.text,
        background: urgent ? K.leaf : K.surface,
        padding: '11px 13px',
      }}>
        {label}
      </span>
    </button>
  )
}
