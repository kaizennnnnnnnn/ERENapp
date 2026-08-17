'use client'

// The fridge, opened. Five shelves, four toppings and the Pepsi.
//
// You don't grab the food itself — each shelf has its own little REFILL button
// you press and hold, the way a restock is a thing you *do* rather than a
// thing that happens because you touched a tomato. The Pepsi is a single tap,
// since you're taking one can, not filling anything.

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { playSound } from '@/lib/sounds'
import HoldTarget from './HoldTarget'
import { useCoverBox } from './useCoverBox'
import {
  TOPPINGS, PEPSI_SPRITE, FRIDGE_SHELVES, FRIDGE_ITEM_X, FRIDGE_BTN_X,
  MAX_USES, type ToppingId,
} from './kioskShift'

interface Props {
  stock: Record<ToppingId, number>
  hasPepsi: boolean
  onRestock: (id: ToppingId) => void
  onTakePepsi: () => void
  onClose: () => void
}

/** Shared chrome for the two kinds of shelf button. */
function face(live: boolean): React.CSSProperties {
  return {
    display: 'block', whiteSpace: 'nowrap',
    fontSize: 6.5, letterSpacing: 1,
    color: live ? '#3A1B08' : 'rgba(255,231,196,0.4)',
    background: live ? '#F59C45' : 'rgba(28,20,16,0.85)',
    padding: '8px 7px 7px',
    border: `2px solid ${live ? '#5A2E12' : 'rgba(245,156,69,0.28)'}`,
    borderRadius: 6,
    boxShadow: live ? '0 3px 0 #DC772A' : '0 3px 0 rgba(0,0,0,0.5)',
  }
}

export default function FridgeOverlay({ stock, hasPepsi, onRestock, onTakePepsi, onClose }: Props) {
  const box = useCoverBox(768, 1376)

  useEffect(() => { playSound('ui_modal_open') }, [])

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden select-none"
      style={{ background: '#050408', animation: 'kioskFridgeIn 480ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
      // Same trap as the walls: the fridge picture is wider than the screen,
      // so focusing a shelf button scrolls this box sideways for good.
      onScroll={e => {
        const el = e.currentTarget
        if (el.scrollLeft || el.scrollTop) { el.scrollLeft = 0; el.scrollTop = 0 }
      }}>

      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height }}>
        <img src="/FridgeOpen.webp" alt="Open fridge" draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />

        {TOPPINGS.map((t, i) => {
          const shelf = FRIDGE_SHELVES[i]
          const full = stock[t.id] >= MAX_USES
          const top = shelf.base - shelf.gap * 0.82
          const height = shelf.gap * 0.82
          return (
            <div key={t.id}>
              {/* The stock itself — scenery, not a target. */}
              <img src={t.sprite} alt={t.label} draggable={false} style={{
                position: 'absolute',
                left: `${FRIDGE_ITEM_X}%`, top: `${top}%`,
                height: `${height}%`, width: 'auto',
                transform: 'translateX(-50%)',
                objectFit: 'contain',
                // A full pan needs nothing from this shelf — dim it so the ones
                // that DO need restocking are the ones your eye lands on.
                filter: full ? 'brightness(0.45) saturate(0.5)' : 'none',
                transition: 'filter 240ms ease',
                pointerEvents: 'none',
              }} />

              <HoldTarget
                aria-label={`Refill the ${t.label} pan`}
                duration={900}
                disabled={full}
                onComplete={() => onRestock(t.id)}
                size={50}
                style={{
                  left: `${FRIDGE_BTN_X}%`, top: `${shelf.base - shelf.gap * 0.42}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <span className="font-pixel" style={face(!full)}>REFILL</span>
                {/* Above the button, not below — the shelf in front eats
                    anything that hangs off the bottom. */}
                <span className="font-pixel" style={{
                  position: 'absolute', left: '50%', top: -12, transform: 'translateX(-50%)',
                  fontSize: 6, letterSpacing: 0.5, whiteSpace: 'nowrap',
                  color: full ? 'rgba(255,231,196,0.45)' : '#FFD2A8',
                }}>
                  {stock[t.id]}/{MAX_USES}
                </span>
              </HoldTarget>
            </div>
          )
        })}

        {/* Pepsi — one tap, one can. */}
        {(() => {
          const shelf = FRIDGE_SHELVES[4]
          const top = shelf.base - shelf.gap * 0.82
          const height = shelf.gap * 0.82
          return (
            <>
              <img src={PEPSI_SPRITE} alt="Pepsi" draggable={false} style={{
                position: 'absolute',
                left: `${FRIDGE_ITEM_X}%`, top: `${top}%`,
                height: `${height}%`, width: 'auto',
                transform: 'translateX(-50%)',
                objectFit: 'contain',
                filter: hasPepsi ? 'brightness(0.45) saturate(0.5)' : 'none',
                transition: 'filter 240ms ease',
                pointerEvents: 'none',
              }} />
              <button
                type="button"
                aria-label="Take a Pepsi"
                disabled={hasPepsi}
                onClick={onTakePepsi}
                className="active:translate-y-[2px] transition-transform"
                style={{
                  position: 'absolute',
                  left: `${FRIDGE_BTN_X}%`, top: `${shelf.base - shelf.gap * 0.42}%`,
                  transform: 'translate(-50%, -50%)',
                  background: 'none', border: 0, padding: 0,
                }}
              >
                <span className="font-pixel" style={face(!hasPepsi)}>TAKE</span>
              </button>
            </>
          )
        })()}
      </div>

      {/* Hint — the hold isn't discoverable on its own. */}
      <div className="absolute left-1/2 font-pixel pointer-events-none" style={{
        bottom: 'calc(22px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)',
        fontSize: 6.5, letterSpacing: 1, color: '#FFE7C4',
        background: 'rgba(0,0,0,0.5)', padding: '6px 10px', borderRadius: 9, whiteSpace: 'nowrap',
      }}>
        PRESS AND HOLD REFILL
      </div>

      <button
        type="button"
        onClick={() => { playSound('ui_modal_close'); onClose() }}
        aria-label="Close the fridge"
        className="absolute flex items-center justify-center active:scale-90 transition-transform"
        style={{
          top: 'calc(8px + env(safe-area-inset-top, 0px))', right: 12,
          width: 32, height: 32, borderRadius: 6,
          background: 'rgba(20,10,8,0.7)',
          border: '2px solid rgba(245,156,69,0.65)',
          boxShadow: '0 2px 0 rgba(0,0,0,0.45)',
        }}>
        <X size={16} className="text-orange-100" />
      </button>
    </div>
  )
}
