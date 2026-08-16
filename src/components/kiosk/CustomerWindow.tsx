'use client'

// Whoever's at the window, and what they want. The customer stands in the
// street beyond the counter and is cut off by the sill — the same trick that
// puts Eren behind the rail out front — with their order in a bubble above.

import { TOPPING_BY_ID, PEPSI_SPRITE, SILL_PCT, CUSTOMER_W, CUSTOMER_SHOW, type Order } from './kioskShift'

interface Props {
  order: Order | null
  status: 'waiting' | 'paid' | 'refused'
  coins: number
}

export default function CustomerWindow({ order, status, coins }: Props) {
  if (!order) return null

  const paid = status === 'paid'

  return (
    <>
      {/* Cut off at the sill, so they're standing at the counter rather than
          floating in the window. */}
      <div className="absolute left-0 right-0 top-0 overflow-hidden pointer-events-none"
        style={{ height: `${SILL_PCT}%`, zIndex: 6 }}>
        <div className="absolute left-1/2" style={{
          bottom: `${-(1 - CUSTOMER_SHOW) * CUSTOMER_W}cqi`,
          width: `${CUSTOMER_W}cqi`,
          transform: 'translateX(-50%)',
          animation: paid
            ? 'kioskCustomerLeave 900ms ease-in both'
            : 'kioskCustomerArrive 620ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}>
          <img
            key={order.skin}
            src={order.skin}
            alt=""
            draggable={false}
            style={{
              width: '100%', display: 'block',
              // Night lighting, and they're a step further out than Eren is.
              filter: 'brightness(0.72) saturate(0.85)',
              animation: status === 'refused' ? 'kioskRefuse 520ms ease-in-out' : undefined,
            }}
          />
        </div>
      </div>

      {/* The ticket. Icons, not words — you're reading it at a glance while
          your hands are on the pans. */}
      <div className="absolute left-1/2 pointer-events-none" style={{
        top: '20%', transform: 'translateX(-50%)', zIndex: 8,
        animation: paid ? 'kioskBubbleOut 420ms ease-in both' : 'kioskBubbleIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 12px',
          background: 'rgba(14,10,8,0.82)',
          border: '2px solid rgba(245,156,69,0.55)',
          borderRadius: 10,
          boxShadow: '0 4px 0 rgba(0,0,0,0.5), 0 0 22px rgba(245,156,69,0.18)',
          backdropFilter: 'blur(3px)',
        }}>
          {paid ? (
            <span className="font-pixel" style={{ fontSize: 8, color: '#FFD98A', letterSpacing: 1 }}>
              +{coins}
            </span>
          ) : (
            <>
              {order.toppings.map(t => (
                <img key={t} src={TOPPING_BY_ID[t].sprite} alt={TOPPING_BY_ID[t].label}
                  style={{ width: 26, height: 26, objectFit: 'contain' }} />
              ))}
              {order.pepsi && (
                <img src={PEPSI_SPRITE} alt="Pepsi"
                  style={{ width: 20, height: 26, objectFit: 'contain' }} />
              )}
            </>
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
