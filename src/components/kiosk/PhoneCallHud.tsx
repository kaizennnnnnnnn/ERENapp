'use client'

// The call, from wherever you happen to be standing.
//
// The phone is on one wall out of four, so two things have to live outside
// the wall that holds it: something that tells you it's ringing while your
// back is turned — and turns you round when you tap it — and the message
// itself, which you should be able to hear out while you carry on working.

import { IconPhone } from '@/components/PixelIcons'
import type { KioskPhone } from './useKioskPhone'

interface Props {
  phone: KioskPhone
  /** True when the wall in front of you is the one with the phone on it. */
  facing: boolean
  /** Spin round to the back wall. */
  onTurn: () => void
}

export default function PhoneCallHud({ phone, facing, onTurn }: Props) {
  const { state, call, spoken } = phone

  return (
    <>
      {/* Ringing, and you're looking the other way. */}
      {state === 'ringing' && !facing && (
        <button
          type="button"
          aria-label="The phone is ringing — turn to it"
          onClick={onTurn}
          className="font-pixel active:translate-y-[2px] transition-transform"
          style={{
            position: 'absolute', zIndex: 57,
            top: 'calc(env(safe-area-inset-top, 0px) + 14px)', left: 12,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 10px 6px',
            fontSize: 7, letterSpacing: 1, color: '#3A1B08',
            background: '#F59C45',
            border: '2px solid #5A2E12', borderRadius: 9,
            boxShadow: '0 3px 0 #DC772A, 0 0 18px rgba(245,156,69,0.45)',
            animation: 'kioskRingChip 1.6s ease-in-out infinite',
          }}>
          <IconPhone size={12} />
          RINGING
        </button>
      )}

      {/* The message. Typed out a character at a time, because until there's a
          recording to play the typing IS the voice — and once there is one,
          this same line becomes its subtitle. */}
      {state === 'playing' && call && (
        <div className="absolute pointer-events-none" style={{
          zIndex: 57, left: 12, right: 12,
          top: 'calc(env(safe-area-inset-top, 0px) + 62px)',
          display: 'flex', justifyContent: 'center',
        }}>
          <div style={{
            maxWidth: 300,
            padding: '9px 12px 10px',
            background: 'rgba(12,9,8,0.88)',
            border: '2px solid rgba(245,156,69,0.55)',
            borderRadius: 10,
            boxShadow: '0 4px 0 rgba(0,0,0,0.5), 0 0 22px rgba(245,156,69,0.18)',
            backdropFilter: 'blur(3px)',
            // Its OWN entrance, not the customer bubble's: that one carries a
            // translateX(-50%) for an element pinned at left:50%, and borrowing
            // it here drags this flex-centred panel half its width off screen.
            animation: 'kioskCallIn 340ms cubic-bezier(0.16, 1, 0.3, 1) both',
          }}>
            {/* Caller ID: who's on the line, on its own strip. */}
            <div className="font-pixel" style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 6, letterSpacing: 1.4, color: '#F59C45',
              marginBottom: 6,
            }}>
              <IconPhone size={10} />
              {call.from}
            </div>
            <p className="font-pixel" style={{
              fontSize: 6.5, lineHeight: 1.9, letterSpacing: 0.3, color: '#FFE7C4',
            }}>
              {spoken}
              <span style={{ animation: 'kioskCaret 640ms steps(1, end) infinite' }}>_</span>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
