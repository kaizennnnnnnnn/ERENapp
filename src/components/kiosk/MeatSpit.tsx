'use client'

// The rotisserie on the right wall. Saw a wrap's worth off the cone with the
// knife — five slices and the skewer is bare — and hold the LOAD button bolted
// to the wall beside it to hang a fresh one.
//
// The smoke is the only thing in the kiosk that moves on its own. It's what
// makes the wall read as a machine that's switched on rather than a painting,
// so it comes off the whole cone rather than out of the top of its head.

import HoldTarget from './HoldTarget'
import CarveKnife from './CarveKnife'
import { MEAT_FRAMES, MAX_USES, SPIT_BOX, MEAT_BTN, smokeVents } from './kioskShift'

interface Props {
  meat: number
  /** Whether a slice would actually land on the wrap in your hands. */
  canCarve: boolean
  onCarve: () => void
  onRestock: () => void
}

export default function MeatSpit({ meat, canCarve, onCarve, onRestock }: Props) {
  // meat 5 → the fattest cone, 1 → the last sliver, 0 → bare skewer.
  const frame = meat > 0 ? MEAT_FRAMES[MAX_USES - meat] : null

  return (
    <>
      {frame && (
        <img
          key={frame}
          src={frame}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: 'absolute',
            left: `${SPIT_BOX.left}%`,
            top: `${SPIT_BOX.top}%`,
            height: `${SPIT_BOX.height}%`,
            width: 'auto',
            transform: 'translateX(-50%)',
            filter: 'brightness(0.9) saturate(0.95)',
            pointerEvents: 'none',
            animation: 'kioskCarve 260ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        />
      )}

      {/* Heat coming off the cone — crown, shoulders and flanks. Dies with the
          meat: a bare skewer doesn't steam. */}
      {meat > 0 && smokeVents(meat).map(v => (
        <span key={v.key} aria-hidden className="pointer-events-none" style={{
          position: 'absolute', left: `${v.x}%`, top: `${v.y}%`, zIndex: 3,
          width: `${v.size}cqi`, height: `${v.size}cqi`,
          marginLeft: `${-v.size / 2}cqi`, marginTop: `${-v.size / 2}cqi`,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,243,226,1), rgba(255,228,194,0.48) 52%, transparent 74%)',
          filter: 'blur(4px)',
          // Custom properties the one shared keyframe reads, so nine wisps can
          // each rise their own distance, at their own strength, off one
          // animation instead of nine.
          ['--drift' as string]: `${v.drift}cqi`,
          ['--lift' as string]: `${v.lift}cqi`,
          ['--puff' as string]: `${v.puff}`,
          animation: `kioskSmoke ${v.dur}s ease-out ${v.delay}s infinite`,
        }} />
      ))}

      {/* Carving is the knife, held against the cone and worked up and down. */}
      <CarveKnife canCarve={canCarve} onCarve={onCarve} />

      {/* Loading a new cone is a hold on a real button bolted to the wall, not
          a hold on the meat — you can see it's a control, and a swipe that
          happens to start on the machine can't reload anything. */}
      {/* Long on purpose. A cone is a thing you heave onto a spit, and with
          somebody's patience running down at the window it has to be a real
          decision to run out of meat. */}
      <HoldTarget
        aria-label="Load a fresh cone"
        duration={2600}
        disabled={meat > 0}
        onComplete={onRestock}
        size={54}
        style={{
          left: `${MEAT_BTN.x}%`, top: `${MEAT_BTN.y}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: 5,
        }}
      >
        <span className="font-pixel" style={{
          display: 'block', whiteSpace: 'nowrap',
          fontSize: 7, letterSpacing: 1,
          color: meat > 0 ? 'rgba(255,231,196,0.4)' : '#3A1B08',
          background: meat > 0 ? 'rgba(28,20,16,0.85)' : '#F59C45',
          padding: '9px 8px 8px',
          border: `2px solid ${meat > 0 ? 'rgba(245,156,69,0.28)' : '#5A2E12'}`,
          borderRadius: 7,
          boxShadow: meat > 0 ? '0 3px 0 rgba(0,0,0,0.5)' : '0 3px 0 #DC772A, 0 0 14px rgba(245,156,69,0.35)',
          animation: meat > 0 ? undefined : 'kioskHint 1.8s ease-in-out infinite',
        }}>
          LOAD
        </span>
      </HoldTarget>
    </>
  )
}
