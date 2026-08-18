'use client'

// Whoever's at the window, and what they want.
//
// They stand out in the street and pop up over the sill when they arrive —
// head and a little shoulder, the rest of them below the counter. Anything
// taller reads as a face pressed against the glass rather than someone
// waiting to be served, and anything higher up reads as standing in the road.
//
// They're rendered through BlinkingEren, the same sprite stack the rooms use,
// so a customer breathes and blinks while they wait. Every costume in the
// closet carries its own measured eye layout, which is what makes that
// possible without hand-placing eyelids for twenty-three animals.

import BlinkingEren from '@/components/BlinkingEren'
import {
  TOPPING_BY_ID, PEPSI_SPRITE, SILL_PCT, CUSTOMER_BOX, CUSTOMER_SHOW, BUBBLE_BOTTOM,
  type Order,
} from './kioskShift'
import type { Speech } from './useKioskShift'

interface Props {
  order: Order | null
  status: 'waiting' | 'paid' | 'refused'
  speech: Speech
  coins: number
}

export default function CustomerWindow({ order, status, speech, coins }: Props) {
  if (!order) return null

  const paid = status === 'paid'
  const who = order.customer

  return (
    <>
      {/* Cut off at the sill, so they're standing at the counter rather than
          floating in the window. */}
      <div className="absolute left-0 right-0 top-0 overflow-hidden pointer-events-none"
        style={{ height: `${SILL_PCT}%`, zIndex: 6 }}>
        <div className="absolute left-1/2" style={{
          bottom: `${-(1 - CUSTOMER_SHOW) * CUSTOMER_BOX}cqi`,
          transform: 'translateX(-50%)',
          // How far down they start: the whole visible part of them, plus a
          // little margin so no sliver of ear is left showing over the sill
          // before they pop. The keyframes read it, so one animation fits any
          // box size.
          ['--rise' as string]: `${(CUSTOMER_BOX * CUSTOMER_SHOW + 3).toFixed(2)}cqi`,
          animation: paid
            ? 'kioskCustomerDuck 760ms ease-in both'
            : 'kioskCustomerPop 620ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}>
          {/* The head-shake lives on its own layer: the wrapper above is
              already spending its transform on the pop. */}
          <div style={{ animation: status === 'refused' ? 'kioskRefuse 520ms ease-in-out' : undefined }}>
            <BlinkingEren
              key={who.id}
              size={`${CUSTOMER_BOX}cqi`}
              src={who.src}
              tailSrc={who.tailSrc}
              tailOrigin={who.tailOrigin}
              eyes={who.eyes}
              lidTone={who.lidTone}
              alt=""
              // Night lighting, and they're a step further out than Eren is.
              style={{ filter: 'brightness(0.72) saturate(0.85)' }}
            />
          </div>
        </div>
      </div>

      {/* What they said, and what they want. Icons for the order — you're
          reading it at a glance with your hands on the pans. */}
      <div className="absolute left-1/2 pointer-events-none" style={{
        bottom: `${BUBBLE_BOTTOM}%`, transform: 'translateX(-50%)', zIndex: 8,
        animation: paid ? 'kioskBubbleOut 420ms ease-in both' : 'kioskBubbleIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
          padding: '8px 11px',
          // Wide enough that a full-length line lands on one row; anything
          // longer wraps, which is fine.
          maxWidth: 216,
          background: 'rgba(14,10,8,0.85)',
          border: '2px solid rgba(245,156,69,0.55)',
          borderRadius: 10,
          boxShadow: '0 4px 0 rgba(0,0,0,0.5), 0 0 22px rgba(245,156,69,0.18)',
          backdropFilter: 'blur(3px)',
        }}>
          {speech && (
            <span key={speech.id} className="font-pixel" style={{
              fontSize: 6, lineHeight: 1.7, letterSpacing: 0.3,
              color: '#FFE7C4', textAlign: 'center',
              animation: 'kioskLineIn 320ms ease-out both',
            }}>
              {speech.text}
            </span>
          )}

          {paid ? (
            <span className="font-pixel" style={{ fontSize: 8, color: '#FFD98A', letterSpacing: 1 }}>
              +{coins}
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {order.toppings.map(t => (
                <img key={t} src={TOPPING_BY_ID[t].sprite} alt={TOPPING_BY_ID[t].label}
                  style={{ width: 24, height: 24, objectFit: 'contain' }} />
              ))}
              {order.pepsi && (
                <img src={PEPSI_SPRITE} alt="Pepsi"
                  style={{ width: 18, height: 24, objectFit: 'contain' }} />
              )}
            </div>
          )}
        </div>
        {/* Bubble tail, pointing down at whoever's talking. */}
        <div style={{
          position: 'absolute', left: '50%', bottom: -7, transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
          borderTop: '8px solid rgba(245,156,69,0.55)',
        }} />
      </div>
    </>
  )
}
