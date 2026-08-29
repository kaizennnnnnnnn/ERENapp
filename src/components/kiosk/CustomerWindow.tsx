'use client'

// Whoever's at the window, what they want, and how long they'll wait for it.
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
//
// The ticket fades. You get a few seconds of a legible order and then it goes
// to ghosts, and asking them to say it again means coming back to this wall —
// which is the whole reason the window is a place rather than a readout.

import BlinkingEren from '@/components/BlinkingEren'
import {
  TOPPINGS, TOPPING_BY_ID, SAUCE_BY_ID, SIDE_BY_ID, SILL_PCT, CUSTOMER_BOX,
  CUSTOMER_SHOW, BUBBLE_BOTTOM, CHEER_MS, LINGER_MS, DUCK_MS, portionsOf,
  type Order, type Wrap,
} from './kioskShift'
import { PANIC_AT } from './kioskEconomy'
import type { ShiftStatus, Speech } from './useKioskShift'

interface Props {
  order: Order | null
  status: ShiftStatus
  speech: Speech
  /** 1 → just walked up, 0 → walking away. */
  patience: number
  /** Whether the ticket is still legible. */
  ticketOpen: boolean
  /** A missed "usual" gives up and shows the ticket. */
  revealed: boolean
  /** Base pay for the order, before tips. */
  value: number
  onRepeat: () => void
}

/** One thing on the ticket. A crossed one is a topping they DON'T want, which
 *  is a different job to read than a list of the ones they do. */
function Item({ src, label, size = 24, crossed = false, times = 1 }: {
  src: string; label: string; size?: number; crossed?: boolean; times?: number
}) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flex: '0 0 auto' }}>
      <img src={src} alt={label} draggable={false} style={{
        width: size, height: size, objectFit: 'contain',
        filter: crossed ? 'grayscale(0.7) brightness(0.72)' : undefined,
      }} />
      {/* A double is a NUMBER, not the sprite twice: two tomatoes at ticket
          size read as one tomato and a smudge. */}
      {times > 1 && (
        <span className="font-pixel" aria-label={`times ${times}`} style={{
          position: 'absolute', right: -5, bottom: -3,
          fontSize: 6.5, lineHeight: 1, letterSpacing: 0,
          color: '#3A1B08', background: '#FFD98A',
          padding: '2px 3px 1px', borderRadius: 3,
          border: '1px solid #8A5A18',
        }}>
          x{times}
        </span>
      )}
      {crossed && (
        <>
          <span aria-hidden style={{
            position: 'absolute', left: '50%', top: '50%', width: size + 4, height: 2.5,
            background: '#E4483C', borderRadius: 2,
            transform: 'translate(-50%, -50%) rotate(-38deg)',
            boxShadow: '0 0 4px rgba(228,72,60,0.6)',
          }} />
          <span aria-hidden style={{
            position: 'absolute', left: '50%', top: '50%', width: size + 4, height: 2.5,
            background: '#E4483C', borderRadius: 2,
            transform: 'translate(-50%, -50%) rotate(38deg)',
            boxShadow: '0 0 4px rgba(228,72,60,0.6)',
          }} />
        </>
      )}
    </span>
  )
}

/** One wrap's worth of ticket. A two-wrap order numbers its rows: at ticket
 *  size a little rolled-wrap sprite reads as a crumb, and a numeral doesn't. */
function WrapLine({ wrap, index, marked }: { wrap: Wrap; index: number; marked: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {marked && (
        <span className="font-pixel" aria-label={`Wrap ${index + 1}`} style={{
          flex: '0 0 auto',
          width: 15, height: 15, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 6, color: '#3A1B08', background: 'rgba(245,156,69,0.85)',
        }}>
          {index + 1}
        </span>
      )}
      {wrap.without
        ? <Item src={TOPPING_BY_ID[wrap.without].sprite}
            label={`No ${TOPPING_BY_ID[wrap.without].label}`} crossed />
        : TOPPINGS.filter(t => portionsOf(wrap.toppings, t.id) > 0).map(t => (
            <Item key={t.id} src={t.sprite} label={t.label}
              times={portionsOf(wrap.toppings, t.id)} />
          ))}
      {wrap.sauce && (
        <Item src={SAUCE_BY_ID[wrap.sauce].sprite} label={`${SAUCE_BY_ID[wrap.sauce].label} sauce`} size={20} />
      )}
    </div>
  )
}

export default function CustomerWindow({
  order, status, speech, patience, ticketOpen, revealed, value, onRepeat,
}: Props) {
  if (!order) return null

  const paid = status === 'paid'
  const left = status === 'left'
  const who = order.customer
  // Somebody who came to talk has no ticket, no meter and nothing to hand
  // over — the only thing on offer is whether you keep tapping.
  const chat = order.kind === 'chat'
  const rude = order.mood === 'rude'
  // A regular who asked for "the usual" tells you nothing — unless you've
  // already got it wrong once, at which point they give in.
  const hidden = order.usual && !revealed
  const faded = !ticketOpen && !paid && !left && !chat
  const multi = order.wraps.length > 1
  // The bubble takes its colour from who's talking: amber for anybody
  // ordinary, red for somebody in a mood, gold for the one who always comes
  // after closing.
  const tone = rude ? '228,72,60' : order.late ? '245,200,73' : '245,156,69'
  /** When a happy customer starts leaving. The hop, then a beat of standing
   *  there so the thank-you can actually be read. */
  const duckAt = CHEER_MS + LINGER_MS

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
          // The duck WAITS for the hop rather than running alongside it: a
          // `both`-filled animation applies its first frame from time zero, so
          // a second animation on this element would flatten the jump before
          // it ever left the ground.
          animation: paid
            ? `kioskCustomerDuck ${DUCK_MS}ms ease-in ${duckAt}ms both`
            : left
              ? `kioskCustomerWalk ${DUCK_MS}ms ease-in both`
              : 'kioskCustomerPop 620ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}>
          {/* The head-shake and the hop share a layer of their own: the
              wrapper above is already spending its transform on the pop and
              the duck. Squashing from the FEET — down past the sill, out of
              sight — is what keeps a landing from bobbing the whole head. */}
          <div style={{
            transformOrigin: '50% 100%',
            // The hop, and then a slow pleased sway for as long as they
            // stand there — a customer frozen mid-thank-you reads as the game
            // having hung, which is the opposite of the beat we bought.
            animation: status === 'refused' ? 'kioskRefuse 520ms ease-in-out'
                     : paid
                       ? `kioskCheer ${CHEER_MS}ms both,`
                         + ` kioskCustomerPleased ${(LINGER_MS / 2).toFixed(0)}ms ease-in-out ${CHEER_MS}ms 2`
                       : undefined,
          }}>
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

      {/* Tapping the customer asks them to say it again. Free, and the only
          way back once the ticket has gone to ghosts. */}
      {status === 'waiting' && (
        <button
          type="button"
          aria-label={chat ? 'Let them say the next bit' : 'Ask them to repeat the order'}
          onClick={onRepeat}
          style={{
            position: 'absolute', zIndex: 11,
            left: '50%', width: `${CUSTOMER_BOX}cqi`,
            top: `${SILL_PCT - CUSTOMER_BOX * CUSTOMER_SHOW}%`,
            height: `${CUSTOMER_BOX * CUSTOMER_SHOW}cqi`,
            transform: 'translateX(-50%)',
            background: 'none', border: 0, padding: 0,
          }}
        />
      )}

      {/* What they said, and what they want. Icons for the order — you're
          reading it at a glance with your hands on the pans. */}
      <div className="absolute left-1/2 pointer-events-none" style={{
        bottom: `${BUBBLE_BOTTOM}%`, transform: 'translateX(-50%)', zIndex: 10,
        // Held up through the hop before it goes. The thank-you and the coins
        // are the whole point of the beat, and both used to be gone in 420ms.
        animation: paid
          ? `kioskBubbleOut 420ms ease-in ${duckAt - 140}ms both`
          : left
            ? 'kioskBubbleOut 300ms ease-in both'
            : 'kioskBubbleIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
          padding: '8px 11px',
          // Wide enough that a full-length line lands on one row; anything
          // longer wraps, which is fine.
          maxWidth: 216,
          background: 'rgba(14,10,8,0.85)',
          border: `2px solid rgba(${tone},0.6)`,
          borderRadius: 10,
          boxShadow: `0 4px 0 rgba(0,0,0,0.5), 0 0 22px rgba(${tone},0.2)`,
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

          {paid || left || chat ? null : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              // Faded, not gone: you can see there IS an order, you just can't
              // read it any more.
              opacity: faded ? 0.17 : 1,
              filter: faded ? 'blur(0.6px)' : undefined,
              transition: 'opacity 420ms ease, filter 420ms ease',
            }}>
              {hidden ? (
                <span className="font-pixel" style={{
                  fontSize: 15, letterSpacing: 2, color: '#F59C45',
                  textShadow: '0 0 10px rgba(245,156,69,0.5)',
                }}>
                  ?
                </span>
              ) : (
                <>
                  {order.wraps.map((w, i) => <WrapLine key={i} wrap={w} index={i} marked={multi} />)}
                  {order.sides.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {order.sides.map(s => (
                        <img key={s} src={SIDE_BY_ID[s].sprite} alt={SIDE_BY_ID[s].label}
                          draggable={false}
                          style={{ width: s === 'cola' ? 18 : 24, height: 24, objectFit: 'contain' }} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* How long they'll give you, and what it's worth. Both gone the
              moment the order is settled — a meter on a customer who has
              already paid is just an animation. */}
          {!paid && !left && !chat && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <div style={{
                position: 'relative', flex: '1 1 auto', height: 5,
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(245,156,69,0.3)',
                borderRadius: 3, overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  transformOrigin: '0% 50%',
                  transform: `scaleX(${Math.max(0, Math.min(1, patience))})`,
                  background: patience < PANIC_AT ? '#E4483C' : '#F59C45',
                  boxShadow: patience < PANIC_AT ? '0 0 7px rgba(228,72,60,0.7)' : 'none',
                  transition: 'transform 120ms linear, background 300ms ease',
                }} />
              </div>
              <span className="font-pixel" style={{
                fontSize: 7, letterSpacing: 0.5, color: '#FFD98A', flex: '0 0 auto',
              }}>
                +{value}
              </span>
            </div>
          )}

          {faded && !paid && !left && (
            <span className="font-pixel" style={{
              fontSize: 5.5, letterSpacing: 1, color: 'rgba(255,231,196,0.55)',
            }}>
              TAP THEM TO ASK AGAIN
            </span>
          )}

          {/* The whole interface for somebody who came to talk. There is no
              cost to walking away and no reward for staying that you can see
              from here, which is the point of it. */}
          {chat && !paid && !left && (
            <span className="font-pixel" style={{
              fontSize: 5.5, letterSpacing: 1, color: 'rgba(255,231,196,0.55)',
            }}>
              TAP THEM TO LISTEN
            </span>
          )}
        </div>
        {/* Bubble tail, pointing down at whoever's talking. */}
        <div style={{
          position: 'absolute', left: '50%', bottom: -7, transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
          borderTop: `8px solid rgba(${tone},0.6)`,
        }} />
      </div>
    </>
  )
}
