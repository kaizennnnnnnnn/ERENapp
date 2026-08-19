'use client'

// The payphone's moving parts, on the back wall.
//
// The housing is painted into the wall; the handset and its coiled cord are a
// sprite laid over it, so they can shake in the cradle when a call comes in
// and tip out of it while a message plays. The sprite was drawn on the wall
// art's own pixel grid, which is why it sits on the phone instead of on top
// of it.
//
// The pivot is up at the cradle, so the shake swings the cord far more than
// the earpiece — which is the half of it your eye actually reads as ringing.

import WallTarget from './WallTarget'
import { HANDSET, HANDSET_SPRITE, PHONE_HIT, PHONE_TAG } from './kioskShift'
import type { PhoneState } from './useKioskPhone'

interface Props {
  state: PhoneState
  /** Whether a hand lifted it, or the machine took the call. */
  lifted: boolean
  onAnswer: () => void
}

export default function KioskPhone({ state, lifted, onAnswer }: Props) {
  const ringing = state === 'ringing'
  // Only a person takes the handset out of the cradle. If the machine picked
  // up, it stays hung and the message plays past it.
  const offHook = state === 'playing' && lifted

  return (
    <>
      {/* Lamplight off the ringing bell — the wall itself reacting, so the
          call reads from across the room and not just up close. */}
      {ringing && (
        <span aria-hidden className="pointer-events-none" style={{
          position: 'absolute',
          left: `${PHONE_HIT.left - 6}%`, top: `${PHONE_HIT.top - 5}%`,
          width: `${PHONE_HIT.width + 12}%`, height: `${PHONE_HIT.height + 10}%`,
          background: 'radial-gradient(ellipse at center, rgba(245,156,69,0.55), transparent 68%)',
          animation: 'kioskRingGlow 1.6s ease-in-out infinite',
          zIndex: 3,
        }} />
      )}

      {/* The handset. Position on the outer element, motion on the inner one:
          a forwards-filling animation would otherwise wipe out the placement. */}
      <span aria-hidden className="pointer-events-none" style={{
        position: 'absolute',
        left: `${HANDSET.left}%`, top: `${HANDSET.top}%`, width: `${HANDSET.width}%`,
        zIndex: 4,
      }}>
        <span style={{
          display: 'block',
          transformOrigin: '50% 10%',
          animation: ringing ? 'kioskRingShake 1.6s ease-in-out infinite'
                   : offHook ? 'kioskHandsetOff 420ms cubic-bezier(0.32, 0.72, 0, 1) both'
                   : undefined,
        }}>
          <img src={HANDSET_SPRITE} alt="" draggable={false} style={{
            display: 'block', width: '100%', height: 'auto',
            filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.55))',
          }} />
        </span>
      </span>

      {/* Only tappable while it's actually ringing — an idle payphone does
          nothing, and a tag on it would be a promise the wall can't keep. */}
      {ringing && (
        <WallTarget
          hit={PHONE_HIT} tag={PHONE_TAG} label="PICK UP"
          aria-label="Answer the phone"
          urgent
          onClick={onAnswer}
        />
      )}
    </>
  )
}
