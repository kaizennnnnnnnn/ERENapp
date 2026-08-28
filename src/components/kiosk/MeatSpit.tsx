'use client'

// The rotisserie on the right wall. Saw a wrap's worth off the cone with the
// knife — five slices and the skewer is bare — and hold the LOAD button bolted
// to the wall beside it to hang a fresh one.
//
// The smoke is the only thing in the kiosk that moves on its own. It's what
// makes the wall read as a machine that's switched on rather than a painting,
// so it comes off the whole cone rather than out of the top of its head.
//
// A cone also COOKS. It's raw for a moment after you hang it, right for most
// of a shift, and then it goes over — and the gauge on the wall is the only
// place you can see how far along it is. Past the line the cone darkens and
// the smoke turns from steam to soot, so a burnt one is obvious from the door.

import HoldTarget from './HoldTarget'
import CarveKnife from './CarveKnife'
import {
  MEAT_FRAMES, MAX_USES, SPIT_BOX, MEAT_BTN, smokeVents,
  MEAT_RAW_MS, MEAT_GOOD_MS, meatHeat01, type MeatState,
} from './kioskShift'

interface Props {
  meat: number
  /** How long the cone has been hanging, and what that's done to it. */
  meatOn: number
  cooked: MeatState
  /** Whether a slice would actually land on the wrap in your hands. */
  canCarve: boolean
  onCarve: () => void
  onRestock: () => void
}

/** Where the gauge hangs: on the wall beside the spit, directly ABOVE the
 *  LOAD button, so the state of the cone and the thing you do about it read
 *  as one panel. Under the button is where the knife puts its own hint, and
 *  two labels in the same place is neither. */
const GAUGE = { x: 80, y: 28, width: 19 }

const HEAT_WORD: Record<MeatState, string> = {
  raw: 'NOT READY', good: 'READY', charred: 'BURNING',
}
const HEAT_COLOR: Record<MeatState, string> = {
  raw: '#7FA8D8', good: '#7ED678', charred: '#E4483C',
}

export default function MeatSpit({ meat, meatOn, cooked, canCarve, onCarve, onRestock }: Props) {
  // meat 5 → the fattest cone, 1 → the last sliver, 0 → bare skewer.
  const frame = meat > 0 ? MEAT_FRAMES[MAX_USES - meat] : null
  const burnt = meat > 0 && cooked === 'charred'
  // A cone can be swapped out early — that's the only way back from a burnt
  // one, and the reason it costs a two-and-a-half second hold.
  const canLoad = meat <= 0 || burnt

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
            // Gone over: darker, redder, drier. The picture is the warning —
            // the gauge only tells you how long you have left.
            filter: burnt
              ? 'brightness(0.6) saturate(0.75) contrast(1.15) sepia(0.28)'
              : cooked === 'raw'
                ? 'brightness(0.98) saturate(1.08)'
                : 'brightness(0.9) saturate(0.95)',
            transition: 'filter 900ms ease',
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
          // Steam while it's cooking; soot once it's caught.
          background: burnt
            ? 'radial-gradient(circle, rgba(74,66,62,1), rgba(52,46,44,0.5) 52%, transparent 74%)'
            : 'radial-gradient(circle, rgba(255,243,226,1), rgba(255,228,194,0.48) 52%, transparent 74%)',
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

      {/* GAUGE — how far through its life this cone is. The band at the left
          is the raw stretch and the far end is where it goes over, so the
          right time to carve is a PLACE on the gauge rather than a number to
          learn. Only there when there's a cone to talk about. */}
      {meat > 0 && (
        <div aria-hidden className="pointer-events-none" style={{
          position: 'absolute',
          left: GAUGE.x + '%', top: GAUGE.y + '%', width: GAUGE.width + '%',
          transform: 'translateX(-50%)', zIndex: 5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <div style={{
            position: 'relative', width: '100%', height: 8,
            background: 'rgba(8,6,5,0.82)',
            border: '2px solid rgba(245,156,69,0.4)',
            borderRadius: 5, overflow: 'hidden',
            boxShadow: '0 2px 0 rgba(0,0,0,0.5)',
          }}>
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: 0,
              width: ((MEAT_RAW_MS / MEAT_GOOD_MS) * 100).toFixed(1) + '%',
              background: 'rgba(127,168,216,0.3)',
            }} />
            <div style={{
              position: 'absolute', inset: 0, transformOrigin: '0% 50%',
              transform: 'scaleX(' + meatHeat01(meatOn).toFixed(3) + ')',
              background: HEAT_COLOR[cooked],
              boxShadow: burnt ? '0 0 8px rgba(228,72,60,0.8)' : 'none',
              transition: 'transform 200ms linear, background 600ms ease',
            }} />
          </div>
          <span className="font-pixel" style={{
            fontSize: 5.5, letterSpacing: 1, color: HEAT_COLOR[cooked],
            textShadow: '0 1px 0 rgba(0,0,0,0.8)',
            animation: burnt ? 'kioskHint 1.1s ease-in-out infinite' : undefined,
          }}>
            {HEAT_WORD[cooked]}
          </span>
        </div>
      )}

      {/* Loading a new cone is a hold on a real button bolted to the wall, not
          a hold on the meat — you can see it's a control, and a swipe that
          happens to start on the machine can't reload anything. */}
      {/* Long on purpose. A cone is a thing you heave onto a spit, and with
          somebody's patience running down at the window it has to be a real
          decision to run out of meat. */}
      <HoldTarget
        aria-label="Load a fresh cone"
        duration={2600}
        disabled={!canLoad}
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
          color: canLoad ? '#3A1B08' : 'rgba(255,231,196,0.4)',
          background: canLoad ? '#F59C45' : 'rgba(28,20,16,0.85)',
          padding: '9px 8px 8px',
          border: `2px solid ${canLoad ? '#5A2E12' : 'rgba(245,156,69,0.28)'}`,
          borderRadius: 7,
          boxShadow: canLoad ? '0 3px 0 #DC772A, 0 0 14px rgba(245,156,69,0.35)' : '0 3px 0 rgba(0,0,0,0.5)',
          animation: canLoad ? 'kioskHint 1.8s ease-in-out infinite' : undefined,
        }}>
          LOAD
        </span>
      </HoldTarget>
    </>
  )
}
