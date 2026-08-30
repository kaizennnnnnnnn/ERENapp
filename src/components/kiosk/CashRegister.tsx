'use client'

// The till doing its job.
//
// It has always been scenery: a beautifully drawn register that never rang.
// The money went straight from the customer into a number in the corner, so
// the one object on the counter whose entire purpose is to total up a sale sat
// there through every sale doing nothing.
//
// Now a sale runs through it. The screen lights with what they owe, the
// printer chatters a receipt up out of its slot, and the customer takes the
// receipt before they duck away. None of it changes the money — it is the same
// payout it always was. It just happens somewhere now.
//
// The order of the beats is the whole trick: the screen lights the instant the
// wrap crosses the counter, the paper takes half a second to print, and the
// hand only comes for it once it's finished printing. Fire them together and
// it reads as one flash of decoration rather than as a transaction.

import { useEffect, useState } from 'react'
import { TILL_SCREEN, TILL_SLOT, RECEIPT, CHEER_MS, LINGER_MS } from './kioskShift'
import { playSound } from '@/lib/sounds'

/** The screen lights as the wrap goes over. */
const SCREEN_MS = 420
/** Then the printer starts, and runs for this long. */
const PRINT_AT = 300
const PRINT_MS = 620
/** They reach for it once it has stopped printing, and it has to be gone
 *  before they duck: the duck begins at CHEER_MS + LINGER_MS. */
const TAKE_MS = 360
const TAKE_AT = CHEER_MS + LINGER_MS - TAKE_MS - 40
/** And the screen clears a beat after they've gone with it. */
const CLEAR_AT = CHEER_MS + LINGER_MS + 260

/** How long the till is busy, end to end. */
export const TILL_MS = CLEAR_AT + SCREEN_MS

interface Props {
  /** Bumped per sale, so React remounts the whole sequence. */
  id: number
  /** What they paid — base plus tip, the number the screen totals. */
  amount: number
  /** When the sale happened, as a clock reading. */
  startedAt: number
  /** Reduced motion: the screen still totals, the paper doesn't fly. */
  still?: boolean
}

export default function CashRegister({ id, amount, startedAt, still = false }: Props) {
  // How far into the sale we already are.
  //
  // Turning to another wall and back remounts this component, and a till that
  // restarts from zero every time you look at it would strike the screen again
  // and print a second receipt for a sale that has already been paid, rung up
  // and walked away from. Every delay below is shifted back by this, so a
  // remount RESUMES: a negative animation-delay starts an animation partway
  // through, which is exactly the behaviour wanted and costs nothing.
  const [elapsed] = useState(() => Math.max(0, Date.now() - startedAt))
  const from = (at: number) => at - elapsed

  useEffect(() => {
    if (still || elapsed > PRINT_AT) return
    const t = setTimeout(() => playSound('kiosk_print'), PRINT_AT - elapsed)
    return () => clearTimeout(t)
  }, [id, still, elapsed])

  return (
    <>
      {/* ── the screen ── what they owe, on the customer-facing display.
          Amber on near-black with a scanline over it: this is a till from
          about 1994 and it should look like one. */}
      <span aria-hidden className="pointer-events-none" style={{
        position: 'absolute',
        left: `${TILL_SCREEN.x}%`, top: `${TILL_SCREEN.top}%`,
        width: `${TILL_SCREEN.width}cqi`, height: `${TILL_SCREEN.height}cqi`,
        transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, #11100C 0%, #1B1810 100%)',
        boxShadow: 'inset 0 0 0.35cqi rgba(0,0,0,0.9), 0 0 0.9cqi rgba(245,180,73,0.32)',
        zIndex: 8,
        opacity: 0,
        // `forwards` on the clear, NOT `both`. Both animations drive opacity
        // and the later one wins whenever it is filling — so a backwards fill
        // would paint kioskTillOff's own 0% frame (opacity 1) across the whole
        // 2.6s delay and the strike would never be seen. As written, the
        // flicker owns the screen until the clear actually starts.
        animation: still
          ? `kioskTillGlow ${SCREEN_MS}ms ease-out ${from(0)}ms both`
          : `kioskTillOn ${SCREEN_MS}ms steps(1, end) ${from(0)}ms both,`
            + ` kioskTillOff ${SCREEN_MS}ms ease-in ${from(CLEAR_AT)}ms forwards`,
      }}>
        <span className="font-pixel" style={{
          fontSize: 6, lineHeight: 1, letterSpacing: 0.2,
          color: '#FFC24A',
          textShadow: '0 0 3px rgba(255,194,74,0.85)',
        }}>
          {amount}
        </span>
        {/* The scanline. One repeating gradient over the whole face, which at
            nine pixels tall is two dark rows — enough to say CRT. */}
        <span style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(180deg,'
            + ' rgba(0,0,0,0.32) 0px, rgba(0,0,0,0.32) 1px, transparent 1px, transparent 3px)',
        }} />
      </span>

      {/* ── the receipt ── position outside, motion inside: the outer span
          spends its transform standing the paper on the slot's mouth, so the
          inner one is free to be printed and then taken. */}
      {!still && (
        <span aria-hidden className="pointer-events-none" style={{
          position: 'absolute',
          left: `${TILL_SLOT.x}%`, top: `${TILL_SLOT.top}%`,
          width: `${RECEIPT.width}cqi`, height: `${RECEIPT.height}cqi`,
          transform: 'translate(-50%, -100%)',
          zIndex: 8,
        }}>
          <span style={{
            display: 'block', position: 'relative', width: '100%', height: '100%',
            // Printed, then taken. Two animations because they drive different
            // properties — the clip stays where the print left it while the
            // transform carries the paper away.
            animation: `kioskReceiptOut ${PRINT_MS}ms steps(11, end) ${from(PRINT_AT)}ms both,`
              + ` kioskReceiptTaken ${TAKE_MS}ms cubic-bezier(0.4, 0, 0.7, 1) ${from(TAKE_AT)}ms both`,
          }}>
            {/* Till roll: cream, a hard edge down each side, and the print on
                it as rules rather than as text. At twelve pixels tall a line
                of type is a smudge and a rule is a line of type. */}
            <span style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, #FFF8E8 0%, #F2E6CC 62%, #E2D3B4 100%)',
              boxShadow: 'inset 0 0 0 0.13cqi rgba(120,102,70,0.55), 0.1cqi 0.14cqi 0 rgba(0,0,0,0.4)',
            }} />
            <span style={{
              position: 'absolute', left: '17%', right: '17%', top: '22%', bottom: '20%',
              background: 'repeating-linear-gradient(180deg,'
                + ' rgba(74,60,38,0.75) 0px, rgba(74,60,38,0.75) 1px, transparent 1px, transparent 3px)',
            }} />
          </span>
        </span>
      )}
    </>
  )
}
