'use client'

// ─── KitchenSheet ────────────────────────────────────────────────────────────
// The white panel the kitchen's fridge and shop rise in: 28px top corners, a
// header of [back] Title ... [action] (x), and a scrolling body.
//
// Not the kit's <Sheet>, on purpose. That one portals into .app-container
// above the whole room, and the kitchen opens its hold-to-read FoodStatsCard
// from INSIDE the scene — the scene root is its own stacking context, so the
// card would land underneath a portalled sheet. This one renders in place,
// at whatever layer the scene gives it.

import type { ReactNode } from 'react'
import { M, MeadowIcon, RoundButton } from '@/components/meadow'

interface Props {
  title: ReactNode
  /** Shows the back circle (a category's foods back to the categories). */
  onBack?: () => void
  onClose: () => void
  closeLabel: string
  /** Right of the title, before the close circle: a coin chip. */
  action?: ReactNode
  /** Dim the room behind and close on a tap there. The shop leaves the room
   *  in view, the fridge does not. */
  scrim?: boolean
  /** A set height (the shop, so a category switch doesn't jump) or none,
   *  for content height up to `maxHeight`. */
  height?: string
  maxHeight?: string
  zIndex: number
  children: ReactNode
}

export default function KitchenSheet({
  title, onBack, onClose, closeLabel, action, scrim, height, maxHeight = '82%', zIndex, children,
}: Props) {
  return (
    <>
      {scrim && (
        <div aria-hidden className="meadow-root fixed inset-0" onClick={onClose}
          style={{ zIndex, background: 'rgba(47, 43, 40, 0.36)' }} />
      )}
      <div
        role="dialog"
        aria-modal={scrim || undefined}
        aria-label={typeof title === 'string' ? title : undefined}
        className="meadow-root m-sheet-in absolute left-0 right-0 bottom-0 flex flex-col"
        style={{
          zIndex, height, maxHeight,
          background: '#FFFFFF', borderRadius: '28px 28px 0 0',
          boxShadow: `0 -3px 0 ${M.overArtLip}`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center flex-shrink-0" style={{ gap: 10, padding: '14px 14px 10px 16px' }}>
          {onBack && (
            <RoundButton surface="white" size={40} ariaLabel="Back to the shelves" onClick={onBack}>
              <MeadowIcon name="chevronLeft" size={22} color={M.text} />
            </RoundButton>
          )}
          <h2 className="flex-1 min-w-0" style={{
            margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800, color: M.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            paddingLeft: onBack ? 0 : 4,
          }}>
            {title}
          </h2>
          {action}
          <RoundButton surface="white" size={40} ariaLabel={closeLabel} onClick={onClose}>
            <MeadowIcon name="close" size={20} color={M.text} />
          </RoundButton>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: '4px 16px 20px', overscrollBehavior: 'contain' }}>
          {children}
        </div>
      </div>
    </>
  )
}

// ─── ShelfRow ────────────────────────────────────────────────────────────────
// One food category in the fridge or the shop: three of its foods on a white
// tray (the art is the fastest way to recognise a cuisine), the shelf's name
// with its colour dot, one quiet line, and a chevron.

export function ShelfRow({ name, color, preview, sub, onClick }: {
  name: string
  color: string
  preview: ReactNode
  sub: ReactNode
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="m-press m-focus w-full flex items-center"
      style={{
        gap: 12, padding: '10px 12px 10px 10px', border: 0, borderRadius: 20, background: M.soft,
        fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer',
      }}>
      <span aria-hidden className="flex items-center flex-shrink-0" style={{
        height: 48, padding: '0 6px', borderRadius: 14, background: '#FFFFFF',
      }}>
        {preview}
      </span>
      <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 2 }}>
        <span className="flex items-center" style={{ gap: 7, fontSize: 16, fontWeight: 800, color: M.text }}>
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: color, flexShrink: 0 }} />
          {name}
        </span>
        <span className="flex items-center" style={{ gap: 4, fontSize: 13, fontWeight: 600, color: M.text2 }}>{sub}</span>
      </span>
      <MeadowIcon name="chevronRight" size={22} color={M.faint} />
    </button>
  )
}

/** 'SEAFOOD' -> 'Seafood': the shelves keep their stored ids and labels. */
export function shelfName(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase()
}
