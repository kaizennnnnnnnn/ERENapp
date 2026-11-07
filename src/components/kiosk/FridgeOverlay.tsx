'use client'

// The fridge, opened. Five shelves, four toppings and the cola.
//
// You don't grab the food itself — each shelf has its own little REFILL button
// you press and hold, the way a restock is a thing you *do* rather than a
// thing that happens because you touched a tomato. The cola is a single tap,
// since you're taking one can, not filling anything.

import { useEffect, useRef } from 'react'
import { RoundButton, MeadowIcon } from '@/components/meadow'
import { KIOSK as K, kioskPanel, kioskRound, KIOSK_CSS } from './kioskTheme'
import { playSound } from '@/lib/sounds'
import HoldTarget from './HoldTarget'
import { useCoverBox } from './useCoverBox'
import {
  TOPPINGS, COLA_SPRITE, FRIDGE_SHELVES, FRIDGE_ITEM_X, FRIDGE_BTN_X,
  MAX_USES, type ToppingId,
} from './kioskShift'

interface Props {
  stock: Record<ToppingId, number>
  hasCola: boolean
  onRestock: (id: ToppingId) => void
  onTakeCola: () => void
  onClose: () => void
}

/** Shared chrome for the two kinds of shelf button. */
function face(live: boolean): React.CSSProperties {
  return {
    ...kioskPanel, display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
    fontSize: 13, fontWeight: 800, letterSpacing: 0, minHeight: 44, minWidth: 72,
    color: live ? K.ground : K.faint,
    background: live ? K.leaf : K.surface, padding: '10px 12px',
  }
}

export default function FridgeOverlay({ stock, hasCola, onRestock, onTakeCola, onClose }: Props) {
  const dialog = useRef<HTMLDivElement>(null)
  const box = useCoverBox(768, 1376, dialog)

  useEffect(() => { playSound('ui_modal_open') }, [])
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    dialog.current?.focus({ preventScroll: true })
    return () => before?.focus({ preventScroll: true })
  }, [])

  return (
    <div ref={dialog} tabIndex={-1} className="meadow-root kiosk-theme fixed inset-0 z-[70] overflow-hidden select-none"
      role="dialog" aria-modal="true" aria-label="Fridge"
      style={{ background: '#050408', outline: 'none', animation: 'kioskFridgeIn 480ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); playSound('ui_modal_close'); onClose(); return }
        if (event.key !== 'Tab') return
        const targets = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
        if (!targets?.length) return
        const first = targets[0], last = targets[targets.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus() }
      }}
      // Same trap as the walls: the fridge picture is wider than the screen,
      // so focusing a shelf button scrolls this box sideways for good.
      onScroll={e => {
        const el = e.currentTarget
        if (el.scrollLeft || el.scrollTop) { el.scrollLeft = 0; el.scrollTop = 0 }
      }}>
      <style dangerouslySetInnerHTML={{ __html: KIOSK_CSS }} />
      <div style={{ ...kioskPanel, position: 'absolute', zIndex: 1, left: 12, top: 'calc(14px + env(safe-area-inset-top, 0px))', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
        <MeadowIcon name="door" size={20} mono color={K.leaf} />Fridge
      </div>

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
                duration={2200}
                disabled={full}
                onComplete={() => onRestock(t.id)}
                size={50}
                style={{
                  left: `${FRIDGE_BTN_X}%`, top: `${shelf.base - shelf.gap * 0.42}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <span style={face(!full)}>{full ? 'Full' : 'Refill'}</span>
                {/* Above the button, not below — the shelf in front eats
                    anything that hangs off the bottom. */}
                <span style={{
                  position: 'absolute', left: '50%', top: -12, transform: 'translateX(-50%)',
                  fontSize: 12, fontWeight: 800, letterSpacing: 0, whiteSpace: 'nowrap',
                  color: K.text, background: K.ground, borderRadius: 4, padding: '1px 6px',
                }}>
                  {stock[t.id]}/{MAX_USES}
                </span>
              </HoldTarget>
            </div>
          )
        })}

        {/* Cola — one tap, one can. */}
        {(() => {
          const shelf = FRIDGE_SHELVES[4]
          const top = shelf.base - shelf.gap * 0.82
          const height = shelf.gap * 0.82
          return (
            <>
              <img src={COLA_SPRITE} alt="Cola" draggable={false} style={{
                position: 'absolute',
                left: `${FRIDGE_ITEM_X}%`, top: `${top}%`,
                height: `${height}%`, width: 'auto',
                transform: 'translateX(-50%)',
                objectFit: 'contain',
                filter: hasCola ? 'brightness(0.45) saturate(0.5)' : 'none',
                transition: 'filter 240ms ease',
                pointerEvents: 'none',
              }} />
              <button
                type="button"
                aria-label="Take a cola"
                disabled={hasCola}
                onClick={onTakeCola}
                className="active:translate-y-[2px] transition-transform"
                style={{
                  position: 'absolute',
                  left: `${FRIDGE_BTN_X}%`, top: `${shelf.base - shelf.gap * 0.42}%`,
                  transform: 'translate(-50%, -50%)',
                  background: 'none', border: 0, padding: 0,
                }}
              >
                <span style={face(!hasCola)}>{hasCola ? 'Taken' : 'Take'}</span>
              </button>
            </>
          )
        })()}
      </div>

      <RoundButton
        onClick={() => { playSound('ui_modal_close'); onClose() }}
        ariaLabel="Close the fridge"
        style={{
          ...kioskRound, position: 'absolute', zIndex: 1,
          top: 'calc(14px + env(safe-area-inset-top, 0px))', right: 12,
        }}>
        <MeadowIcon name="close" size={20} mono color={K.text} />
      </RoundButton>
    </div>
  )
}
