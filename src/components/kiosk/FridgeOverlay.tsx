'use client'

// The fridge, opened. Five shelves, four toppings and the Pepsi. Hold a
// topping until the ring closes and its pan out front goes back to full; the
// Pepsi is a tap, since you're grabbing one can, not restocking anything.

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { playSound } from '@/lib/sounds'
import HoldTarget from './HoldTarget'
import { useCoverBox } from './useCoverBox'
import { TOPPINGS, PEPSI_SPRITE, FRIDGE_SHELVES, MAX_USES, type ToppingId } from './kioskShift'

interface Props {
  stock: Record<ToppingId, number>
  hasPepsi: boolean
  onRestock: (id: ToppingId) => void
  onTakePepsi: () => void
  onClose: () => void
}

export default function FridgeOverlay({ stock, hasPepsi, onRestock, onTakePepsi, onClose }: Props) {
  const box = useCoverBox(768, 1376)

  useEffect(() => { playSound('ui_modal_open') }, [])

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden select-none"
      style={{ background: '#050408', animation: 'kioskFridgeIn 480ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>

      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height }}>
        <img src="/FridgeOpen.webp" alt="Open fridge" draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }} />

        {TOPPINGS.map((t, i) => {
          const shelf = FRIDGE_SHELVES[i]
          const full = stock[t.id] >= MAX_USES
          return (
            <HoldTarget
              key={t.id}
              aria-label={`Restock ${t.label}`}
              duration={900}
              disabled={full}
              onComplete={() => onRestock(t.id)}
              style={{
                left: '50.8%', top: `${shelf.base - shelf.gap * 0.82}%`,
                height: `${shelf.gap * 0.82}%`, width: '34%',
                transform: 'translateX(-50%)',
              }}
            >
              <img src={t.sprite} alt="" draggable={false} style={{
                height: '100%', width: 'auto', margin: '0 auto', display: 'block',
                objectFit: 'contain',
                // A full pan needs nothing from the fridge — dim it so the ones
                // that DO need restocking are the ones your eye lands on.
                filter: full ? 'brightness(0.45) saturate(0.5)' : 'none',
                transition: 'filter 240ms ease',
              }} />
              {!full && (
                <span aria-hidden style={{
                  position: 'absolute', left: '50%', bottom: -2, transform: 'translateX(-50%)',
                  fontSize: 0,
                }} />
              )}
            </HoldTarget>
          )
        })}

        {/* Pepsi — one tap, one can. */}
        <button
          type="button"
          aria-label="Take a Pepsi"
          onClick={() => { if (!hasPepsi) onTakePepsi() }}
          className="active:scale-95 transition-transform"
          style={{
            position: 'absolute',
            left: '50.8%', top: `${FRIDGE_SHELVES[4].base - FRIDGE_SHELVES[4].gap * 0.82}%`,
            height: `${FRIDGE_SHELVES[4].gap * 0.82}%`, width: '30%',
            transform: 'translateX(-50%)',
            background: 'none', border: 0, padding: 0,
          }}
        >
          <img src={PEPSI_SPRITE} alt="" draggable={false} style={{
            height: '100%', width: 'auto', margin: '0 auto', display: 'block',
            objectFit: 'contain',
            filter: hasPepsi ? 'brightness(0.45) saturate(0.5)' : 'none',
            transition: 'filter 240ms ease',
          }} />
        </button>
      </div>

      {/* Hint — the hold isn't discoverable on its own. */}
      <div className="absolute left-1/2 font-pixel pointer-events-none" style={{
        bottom: 'calc(22px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)',
        fontSize: 6.5, letterSpacing: 1, color: '#FFE7C4',
        background: 'rgba(0,0,0,0.5)', padding: '6px 10px', borderRadius: 9, whiteSpace: 'nowrap',
      }}>
        HOLD A TOPPING TO REFILL ITS PAN
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
