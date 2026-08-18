'use client'

// The rotisserie on the right wall. Saw a wrap's worth off the cone with the
// knife — five slices and the skewer is bare — and hold the LOAD button bolted
// to the wall beside it to hang a fresh one.
//
// The smoke is the only thing in the kiosk that moves on its own. It's what
// makes the wall read as a machine that's switched on rather than a painting.

import HoldTarget from './HoldTarget'
import CarveKnife from './CarveKnife'
import { MEAT_FRAMES, MAX_USES, SPIT_BOX, SPIT_SMOKE, MEAT_BTN } from './kioskShift'

interface Props {
  meat: number
  /** Whether a slice would actually land on the wrap in your hands. */
  canCarve: boolean
  onCarve: () => void
  onRestock: () => void
}

/** Wisps, each with its own drift, size and phase so they never pulse in step. */
const WISPS = [
  { dx: '-3.5cqi', size: 9,  delay: 0,    dur: 5.2 },
  { dx: '2.8cqi',  size: 7,  delay: 1.7,  dur: 6.1 },
  { dx: '0.6cqi',  size: 11, delay: 3.4,  dur: 5.6 },
  { dx: '-1.4cqi', size: 6,  delay: 2.5,  dur: 4.6 },
]

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

      {/* Heat coming off the cone. Dies with the meat — a bare skewer doesn't
          steam. */}
      {meat > 0 && (
        <div aria-hidden className="pointer-events-none" style={{
          position: 'absolute', left: `${SPIT_SMOKE.x}%`, top: `${SPIT_SMOKE.y}%`,
          width: 0, height: 0, zIndex: 3,
        }}>
          {WISPS.map((w, i) => (
            <span key={i} style={{
              position: 'absolute', left: 0, top: 0,
              width: `${w.size}cqi`, height: `${w.size}cqi`,
              marginLeft: `${-w.size / 2}cqi`, marginTop: `${-w.size / 2}cqi`,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,238,214,0.5), rgba(255,226,190,0.16) 55%, transparent 72%)',
              filter: 'blur(3px)',
              // Custom property the keyframe reads, so each wisp drifts its
              // own way off one shared animation.
              ['--drift' as string]: w.dx,
              animation: `kioskSmoke ${w.dur}s ease-out ${w.delay}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Carving is the knife, held against the cone and worked up and down. */}
      <CarveKnife canCarve={canCarve} onCarve={onCarve} />

      {/* Loading a new cone is a hold on a real button bolted to the wall, not
          a hold on the meat — you can see it's a control, and a swipe that
          happens to start on the machine can't reload anything. */}
      <HoldTarget
        aria-label="Load a fresh cone"
        duration={1100}
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
