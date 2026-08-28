'use client'

// Two things on the back wall that are only there because somebody else works
// here too.
//
//   the note    what they wrote on their receipt at the end of their shift,
//               taped up where you'll walk past it. It was already on the
//               board out front, but the board is a scoreboard — a note on
//               the wall by the door is a note.
//   the apron   whoever is ahead on the week gets it on the hook. Brown is
//               his, pink is hers. It does nothing at all.

import { NOTE_BOARD, APRON_HOOK, APRON_BROWN, APRON_PINK } from './kioskShift'

/** Deliberately a hair off square. Something taped to a wall by a person at
 *  four in the morning is not straight. */
const TILT = -2.4

export function ShiftNote({ note, mine, when }: {
  note: string
  /** Whose handwriting. Yours reads back to you differently. */
  mine: boolean
  /** "last night", "tuesday" — however the page wants to say it. */
  when: string
}) {
  return (
    <div aria-label={`Note from ${mine ? 'your' : 'their'} last shift: ${note}`} style={{
      position: 'absolute',
      left: `${NOTE_BOARD.x}%`, top: `${NOTE_BOARD.y}%`, width: `${NOTE_BOARD.width}%`,
      transform: `translateX(-50%) rotate(${TILT}deg)`,
      zIndex: 4,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'relative',
        // Till paper, not a sticky note: it is literally torn off the roll
        // the receipt printed on.
        background: 'linear-gradient(180deg, #F4EBD8 0%, #E8DCC2 100%)',
        border: '1px solid rgba(90,70,44,0.5)',
        padding: '9px 8px 8px',
        boxShadow: '2px 3px 0 rgba(0,0,0,0.45)',
      }}>
        <div className="font-pixel" style={{
          fontSize: 5, letterSpacing: 1, color: 'rgba(74,58,38,0.7)',
          display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4,
        }}>
          <span aria-hidden style={{
            width: 5, height: 5, borderRadius: 1, flex: '0 0 auto',
            background: mine ? '#8B5E3C' : '#FF4D7D',
          }} />
          {when.toUpperCase()}
        </div>
        <div className="font-pixel" style={{
          fontSize: 5.5, lineHeight: 1.85, color: '#3A2A16',
          wordBreak: 'break-word',
        }}>
          {note}
        </div>

        {/* The tape. Two bits, because one is never enough at that hour. */}
        {[-1, 1].map(side => (
          <span key={side} aria-hidden style={{
            position: 'absolute', top: -6, left: side < 0 ? '12%' : undefined,
            right: side > 0 ? '12%' : undefined,
            width: 16, height: 11,
            background: 'rgba(232,238,236,0.5)',
            border: '1px solid rgba(255,255,255,0.28)',
            transform: `rotate(${side * 7}deg)`,
          }} />
        ))}
      </div>
    </div>
  )
}

export function ChampionApron({ mine }: { mine: boolean }) {
  return (
    <img
      src={mine ? APRON_BROWN : APRON_PINK}
      alt={mine ? 'Your apron, on the hook' : 'Their apron, on the hook'}
      draggable={false}
      style={{
        position: 'absolute',
        left: `${APRON_HOOK.x}%`, top: `${APRON_HOOK.y}%`, width: `${APRON_HOOK.width}%`,
        height: 'auto',
        transform: 'translateX(-50%)',
        transformOrigin: '50% 4%',
        // Hanging, so it sways — barely, and only because the door opens.
        animation: 'kioskApronSway 6.2s ease-in-out infinite',
        filter: 'brightness(0.82) saturate(0.92) drop-shadow(2px 4px 3px rgba(0,0,0,0.55))',
        imageRendering: 'pixelated',
        zIndex: 4,
        pointerEvents: 'none',
      }}
    />
  )
}
