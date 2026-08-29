'use client'

// The strip along the bottom of every wall: the tortilla you're building on,
// what's already finished beside it, the bin, and the button that moves the
// wrap along. It has to be readable from any wall, because you build the wrap
// by walking between three of them.
//
// The tortilla is the whole point — every ingredient you pick up lands on it
// where you can see it, so the wrap is a thing you assembled rather than a
// list you accumulated. Rolling it shut is deliberate and one-way: it goes on
// the tray, and what's inside is now a decision you've made.
//
// An order for two gets TWO boards, side by side and smaller. Tap the other
// one to move your hands to it. Before, the second wrap was just the first one
// again — the same three walls in the same order — and a pair of orders was
// twice the work rather than a different job.
//
// And rolling is a HOLD. The meter runs while you hold and the band in the
// middle is a tidy wrap: let go early and it's loose, hold on and the tortilla
// splits. It's a flourish worth a few coins, not a gate — the worst you can
// do is lose the bonus.

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconTrash } from '@/components/PixelIcons'
import {
  TOPPING_BY_ID, SAUCE_BY_ID, SIDE_BY_ID, TORTILLA_SPOTS, MEAT_ON_TORTILLA,
  SAUCE_ON_TORTILLA, SHAVED_MEAT, ROLL_MS, ROLL_BAND, tidinessFor,
  type Build, type Tidiness, type Tray,
} from './kioskShift'
import type { Nudge } from './useKioskShift'

interface Props {
  /** One per wrap they asked for. */
  boards: Build[]
  /** Which one your hands are on. */
  active: number
  tray: Tray
  /** How many wraps this order wants. */
  wrapsWanted: number
  nudge: Nudge
  canRoll: boolean
  canServe: boolean
  onTrash: () => void
  onPick: (i: number) => void
  onRoll: (tidy: Tidiness) => void
  onServe: () => void
}

/** Diameter of the tortilla on screen. Everything on it is sized off this.
 *  Two boards have to share the same strip, so they each get less of it. */
const DISC_ONE = 86
const DISC_TWO = 58

/**
 * One ingredient sitting on the bread. Three nested elements on purpose:
 * the outer one places it, the middle one gives it its hand-dropped tilt, and
 * only the image animates — a forwards-filling animation on the image itself
 * would otherwise wipe out the tilt the moment it landed.
 */
function Laid({ src, label, spot }: {
  src: string
  label: string
  spot: { x: number; y: number; size: number; rot: number }
}) {
  return (
    <span style={{
      position: 'absolute',
      left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.size}%`,
      transform: 'translate(-50%, -50%)',
    }}>
      <span style={{ display: 'block', transform: `rotate(${spot.rot}deg)` }}>
        <img src={src} alt={label} draggable={false} style={{
          width: '100%', height: 'auto', display: 'block',
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))',
          animation: 'kioskDropOn 320ms cubic-bezier(0.32, 0.72, 0, 1) both',
        }} />
      </span>
    </span>
  )
}

/** The bread and everything on it. A second helping of the same topping is
 *  laid beside the first rather than on top of it — two tomatoes have to LOOK
 *  like two tomatoes, or the double you asked for and the double you did by
 *  accident are the same picture. */
function Tortilla({ build, size }: { build: Build; size: number }) {
  const busy = build.meat || build.toppings.length > 0 || build.sauce !== null
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      <img
        src="/tortilla.webp"
        alt="Tortilla"
        draggable={false}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%', objectFit: 'contain',
          filter: 'brightness(0.94) saturate(0.96) drop-shadow(0 2px 3px rgba(0,0,0,0.55))',
          opacity: busy ? 1 : 0.72,
        }}
      />
      {build.meat && <Laid src={SHAVED_MEAT} label="Meat" spot={MEAT_ON_TORTILLA} />}
      {build.toppings.map((t, i) => {
        const second = build.toppings.indexOf(t) !== i
        const spot = TORTILLA_SPOTS[t]
        return (
          <Laid
            key={`${t}-${i}`}
            src={TOPPING_BY_ID[t].sprite}
            label={second ? `Extra ${TOPPING_BY_ID[t].label}` : TOPPING_BY_ID[t].label}
            spot={second
              ? { ...spot, x: spot.x + 8, y: spot.y - 7, rot: spot.rot + 26 }
              : spot}
          />
        )
      })}
      {/* Sauce goes on last and sits over everything, because it does. */}
      {build.sauce && (
        <Laid src={SAUCE_BY_ID[build.sauce].drizzle}
          label={`${SAUCE_BY_ID[build.sauce].label} sauce`}
          spot={SAUCE_ON_TORTILLA} />
      )}
    </div>
  )
}

export default function ServiceHud({
  boards, active, tray, wrapsWanted, nudge, canRoll, canServe,
  onTrash, onPick, onRoll, onServe,
}: Props) {
  const busy = (b: Build) => b.meat || b.toppings.length > 0 || b.sauce !== null
  const boardBusy = boards.some(busy)
  const empty = !boardBusy && tray.wraps.length === 0 && tray.sides.length === 0
  // Once everything they asked for is on the tray there is nothing left to
  // roll, so the button stops offering.
  const done = tray.wraps.length >= wrapsWanted
  const two = boards.length > 1

  // ── the roll ────────────────────────────────────────────────────────────
  // Held rather than tapped. The meter is driven off a real timestamp, not a
  // frame count, so a browser that drops frames still measures the same hold.
  const [roll, setRoll] = useState<number | null>(null)
  const held = useRef<number | null>(null)
  const frame = useRef(0)

  const endRoll = useCallback(() => {
    const at = held.current
    held.current = null
    cancelAnimationFrame(frame.current)
    setRoll(null)
    if (at === null) return
    onRoll(tidinessFor(Math.min(1, (performance.now() - at) / ROLL_MS)))
  }, [onRoll])

  const startRoll = useCallback(() => {
    if (held.current !== null) return
    held.current = performance.now()
    const step = () => {
      const at = held.current
      if (at === null) return
      const p = (performance.now() - at) / ROLL_MS
      // Held past the end: it's already split, so let go for them rather than
      // leaving a button stuck down.
      if (p >= 1.14) { endRoll(); return }
      setRoll(Math.min(1, p))
      frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }, [endRoll])

  // A roll left mid-hold when the order settles under you would otherwise
  // keep a dead animation frame running for the rest of the night.
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  useEffect(() => {
    if (!canRoll && held.current !== null) {
      held.current = null
      cancelAnimationFrame(frame.current)
      setRoll(null)
    }
  }, [canRoll])

  const rolling = roll !== null
  const tidy = rolling ? tidinessFor(roll) : null

  return (
    <div className="absolute left-0 right-0 pointer-events-none" style={{
      bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
      zIndex: 56,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      padding: '0 12px', gap: 8,
    }}>
      {/* Bin — the only way out of a wrap you've built wrong. Clears the tray
          too: a bad first wrap of a pair is not something you can pick back
          out of the bag. */}
      <button
        type="button"
        aria-label="Scrap this order and start again"
        onClick={onTrash}
        disabled={empty}
        className="flex items-center justify-center active:scale-90 transition-transform pointer-events-auto"
        style={{
          width: 40, height: 40, borderRadius: 8, flex: '0 0 auto',
          background: 'rgba(16,12,10,0.78)',
          border: '2px solid rgba(200,190,205,0.35)',
          boxShadow: '0 3px 0 rgba(0,0,0,0.5)',
          opacity: empty ? 0.35 : 1,
        }}>
        <IconTrash size={18} />
      </button>

      {/* The prep board. */}
      <div style={{
        flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        {nudge && (
          <div key={nudge.id} className="font-pixel" style={{
            fontSize: 6.5, letterSpacing: 0.5, color: '#FFD2A8',
            background: 'rgba(0,0,0,0.6)', padding: '5px 9px', borderRadius: 8,
            whiteSpace: 'nowrap',
            animation: 'kioskNudge 2.4s ease-out both',
          }}>
            {nudge.text}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: two ? 5 : 8,
          padding: two ? '6px 8px' : '6px 12px',
          background: 'rgba(14,10,8,0.72)',
          border: '2px solid rgba(245,156,69,0.4)',
          borderRadius: 12,
          boxShadow: '0 3px 0 rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
        }}>
          {/* ══ THE BOARDS ══ one for a single order, two for a pair. Tapping
              the one you're not on moves your hands to it — the only tap in
              the kiosk that doesn't put anything anywhere. */}
          {boards.map((b, i) => {
            const on = i === active
            return (
              <button
                key={i}
                type="button"
                aria-label={two ? `Work on wrap ${i + 1}${on ? ' (current)' : ''}` : 'The wrap in your hands'}
                aria-pressed={two ? on : undefined}
                onClick={two ? () => onPick(i) : undefined}
                disabled={!two}
                className={two ? 'pointer-events-auto active:scale-95 transition-transform' : undefined}
                style={{
                  position: 'relative', display: 'block', padding: two ? 3 : 0,
                  background: two && on ? 'rgba(245,156,69,0.16)' : 'none',
                  border: two
                    ? `2px solid ${on ? 'rgba(245,156,69,0.75)' : 'rgba(245,156,69,0.16)'}`
                    : 0,
                  borderRadius: 10,
                  // The board you're NOT on stays legible — you have to be
                  // able to check it without switching to it.
                  opacity: two && !on ? 0.62 : 1,
                  transition: 'opacity 180ms ease, border-color 180ms ease, background 180ms ease',
                }}>
                <Tortilla build={b} size={two ? DISC_TWO : DISC_ONE} />
                {two && (
                  <span className="font-pixel" aria-hidden style={{
                    position: 'absolute', left: 3, top: 2,
                    fontSize: 6, letterSpacing: 0.5,
                    color: on ? '#FFD98A' : 'rgba(255,231,196,0.5)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.8)',
                  }}>
                    {i + 1}
                  </span>
                )}
              </button>
            )
          })}

          {/* ══ THE TRAY ══ what's finished, and the sides that ride along.
              Two dashed slots when they asked for two, so an order for a pair
              looks like one before you've built either. */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            minWidth: 30,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {Array.from({ length: Math.max(1, wrapsWanted) }, (_, i) => {
                const filled = i < tray.wraps.length
                const split = filled && tray.wraps[i].tidy === 'split'
                return (
                  <div key={i} style={{
                    position: 'relative',
                    width: 26, height: 26,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 6,
                    border: filled ? '2px solid transparent' : '2px dashed rgba(245,156,69,0.22)',
                  }}>
                    {filled && (
                      <img src="/wrap_rolled.webp" alt="Rolled wrap" draggable={false} style={{
                        width: '100%', height: '100%', objectFit: 'contain',
                        // A wrap that came apart looks like one. It's already
                        // on the tray and it's already costing you.
                        transform: split ? 'rotate(-9deg) scale(0.94)' : undefined,
                        filter: split
                          ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.5)) brightness(0.86) saturate(0.8)'
                          : 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                        animation: 'kioskRollShut 420ms cubic-bezier(0.32, 0.72, 0, 1) both',
                      }} />
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 3, minHeight: 26 }}>
              {tray.sides.map(s => (
                <img key={s} src={SIDE_BY_ID[s].sprite} alt={SIDE_BY_ID[s].label} draggable={false}
                  style={{
                    width: s === 'cola' ? 15 : 22, height: 24, objectFit: 'contain',
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                    animation: 'kioskDropOn 320ms cubic-bezier(0.32, 0.72, 0, 1) both',
                  }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Roll it, then hand it over. Same corner, two jobs — there's only ever
          one thing the order is waiting for. */}
      <div style={{ flex: '0 0 auto', position: 'relative' }}>
        {/* The meter, floating ABOVE the button rather than stacked over it in
            the flow. In the flow it pushed the button down eleven pixels the
            instant you pressed it — out from under your own thumb, mid-hold,
            which is a way to lose a roll you were doing correctly.
            Shown only while you're holding: a permanent gauge over a button
            you press fifty times a night is furniture. */}
        {rolling && (
          <div aria-hidden style={{
            position: 'absolute', left: 0, right: 0, bottom: 'calc(100% + 5px)',
            height: 7,
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(245,156,69,0.35)',
            borderRadius: 4, overflow: 'hidden',
          }}>
            {/* The band you're aiming for, painted under the fill so you can
                see where you are relative to it. */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${ROLL_BAND[0] * 100}%`, width: `${(ROLL_BAND[1] - ROLL_BAND[0]) * 100}%`,
              background: 'rgba(126,214,120,0.32)',
            }} />
            <div style={{
              position: 'absolute', inset: 0, transformOrigin: '0% 50%',
              transform: `scaleX(${roll})`,
              background: tidy === 'neat' ? '#7ED678' : tidy === 'split' ? '#E4483C' : '#F5C049',
            }} />
          </div>
        )}

        <button
          type="button"
          aria-label={done ? 'Hand the order over' : 'Hold to roll the wrap up'}
          // GIVE is a tap; ROLL is a hold. Both live on the same button
          // because the order is only ever waiting for one of them.
          onClick={done ? onServe : undefined}
          onPointerDown={done || !canRoll ? undefined : startRoll}
          onPointerUp={done ? undefined : endRoll}
          onPointerLeave={done ? undefined : endRoll}
          onPointerCancel={done ? undefined : endRoll}
          onContextMenu={e => e.preventDefault()}
          disabled={done ? !canServe : !canRoll}
          className="font-pixel active:translate-y-[2px] transition-transform pointer-events-auto"
          style={{
            fontSize: 7.5, letterSpacing: 1,
            // No text selection or callout on a button you hold down.
            WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
            touchAction: 'none',
            color: (done ? canServe : canRoll) ? '#3A1B08' : 'rgba(255,231,196,0.45)',
            background: (done ? canServe : canRoll) ? '#F59C45' : 'rgba(30,22,18,0.8)',
            padding: '11px 12px 10px',
            border: `2px solid ${(done ? canServe : canRoll) ? '#5A2E12' : 'rgba(245,156,69,0.25)'}`,
            borderRadius: 8,
            boxShadow: (done ? canServe : canRoll)
              ? '0 3px 0 #DC772A, 0 0 16px rgba(245,156,69,0.28)'
              : '0 3px 0 rgba(0,0,0,0.5)',
          }}>
          {done ? 'GIVE' : 'ROLL'}
        </button>
      </div>
    </div>
  )
}
