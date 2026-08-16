'use client'

// The rotisserie on the right wall. Tap it to carve a wrap's worth off the
// cone — five carves and the skewer is bare — then hold the empty machine to
// load a fresh one.

import HoldTarget from './HoldTarget'
import { MEAT_FRAMES, MAX_USES, SPIT_BOX, SPIT_HIT } from './kioskShift'

interface Props {
  meat: number
  onCarve: () => void
  onRestock: () => void
}

export default function MeatSpit({ meat, onCarve, onRestock }: Props) {
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

      {/* Carving is a tap; loading a new cone is a hold, so a swipe that
          happens to start on the machine can't reload it by accident. */}
      {meat > 0 ? (
        <button
          type="button"
          aria-label="Carve meat"
          onClick={onCarve}
          className="active:scale-95 transition-transform"
          style={{
            position: 'absolute',
            left: `${SPIT_HIT.left}%`, top: `${SPIT_HIT.top}%`,
            width: `${SPIT_HIT.width}%`, height: `${SPIT_HIT.height}%`,
            background: 'none', border: 0, padding: 0,
          }}
        />
      ) : (
        <HoldTarget
          aria-label="Load a fresh cone"
          duration={1100}
          onComplete={onRestock}
          size={62}
          style={{
            left: `${SPIT_HIT.left}%`, top: `${SPIT_HIT.top}%`,
            width: `${SPIT_HIT.width}%`, height: `${SPIT_HIT.height}%`,
          }}
        >
          <span className="font-pixel" style={{
            position: 'absolute', left: '50%', bottom: -26, transform: 'translateX(-50%)',
            whiteSpace: 'nowrap', fontSize: 6, letterSpacing: 1, color: '#FFE7C4',
            background: 'rgba(0,0,0,0.5)', padding: '4px 7px', borderRadius: 8,
            animation: 'kioskHint 1.8s ease-in-out infinite',
          }}>
            HOLD TO LOAD
          </span>
        </HoldTarget>
      )}
    </>
  )
}
