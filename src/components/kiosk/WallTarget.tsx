'use client'

// A thing on a wall you can tap, with a label that says so.
//
// Everything else in the kiosk is either obviously food or obviously a button.
// The fridge and the door are neither — they're painted into the background,
// and without a tag on them there is nothing to tell you the wall is
// interactive at all. The tag pulses, sits on the object, and points at it.

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
      <span className="font-pixel" style={{
        position: 'absolute',
        left: `${(tag.x - hit.left) / hit.width * 100}%`,
        top: `${(tag.y - hit.top) / hit.height * 100}%`,
        transform: 'translate(-50%, -50%)',
        whiteSpace: 'nowrap',
        fontSize: 7, letterSpacing: 1,
        color: urgent ? '#3A1B08' : '#FFE7C4',
        background: urgent ? '#F59C45' : 'rgba(12,9,7,0.82)',
        padding: '7px 9px 6px',
        border: `2px solid ${urgent ? '#5A2E12' : 'rgba(245,156,69,0.7)'}`,
        borderRadius: 7,
        boxShadow: urgent
          ? '0 3px 0 #DC772A, 0 0 16px rgba(245,156,69,0.4)'
          : '0 3px 0 rgba(0,0,0,0.5), 0 0 14px rgba(245,156,69,0.22)',
        animation: 'kioskHint 2.2s ease-in-out infinite',
      }}>
        {label}
      </span>
    </button>
  )
}
