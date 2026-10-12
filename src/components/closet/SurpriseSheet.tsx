'use client'

// ─── Surprise me ─────────────────────────────────────────────────────────────
// Let the closet pick: a random look you own for the room you're dressing, or
// a different one for every room. "From my favourites" narrows the draw once
// there are enough hearts to make it a draw. The page does the picking, the
// write and the Undo; this only asks which.

import { useState } from 'react'
import { MeadowIcon, Sheet, Toggle, M, TINT } from '@/components/meadow'
import { playSound } from '@/lib/sounds'

export type SurpriseScope = 'room' | 'all'

interface Props {
  open: boolean
  /** The room being dressed, e.g. "Kitchen". */
  roomLabel: string
  /** Enough favourites (2+) to draw from them alone. */
  canUseFavorites: boolean
  onPick: (scope: SurpriseScope, favoritesOnly: boolean) => void
  onClose: () => void
}

export default function SurpriseSheet({ open, roomLabel, canUseFavorites, onPick, onClose }: Props) {
  const [favOnly, setFavOnly] = useState(false)
  const fromFavs = canUseFavorites && favOnly
  return (
    <Sheet open={open} title="Surprise me" onClose={() => { playSound('ui_modal_close'); onClose() }}>
      <div className="flex flex-col" style={{ gap: 10 }}>
        <Choice icon="dice" tint={TINT.amber} title={`Just the ${roomLabel}`}
          note={fromFavs ? 'A favourite it isn’t wearing yet' : 'A look it isn’t wearing yet'}
          onClick={() => onPick('room', fromFavs)} />
        <Choice icon="home" tint={TINT.leaf} title="Every room"
          note="A different look in each one" onClick={() => onPick('all', fromFavs)} />
      </div>
      {canUseFavorites && (
        <div className="flex items-center justify-between" style={{ margin: '16px 4px 0', gap: 12 }}>
          <span className="inline-flex items-center" style={{ gap: 8, fontSize: 15, fontWeight: 700 }}>
            <MeadowIcon name="heart" size={18} color={M.love} />From my favourites
          </span>
          <Toggle checked={favOnly} onChange={v => { playSound('ui_tap'); setFavOnly(v) }} ariaLabel="From my favourites" />
        </div>
      )}
    </Sheet>
  )
}

function Choice({ icon, tint, title, note, onClick }: {
  icon: 'dice' | 'home'; tint: string; title: string; note: string; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="m-press m-focus flex items-center w-full"
      style={{
        minHeight: 72, boxSizing: 'border-box', padding: '10px 16px', gap: 14,
        border: `2px solid ${M.hairline}`, borderRadius: 20, background: '#FFFFFF',
        fontFamily: 'inherit', color: M.text, textAlign: 'left', cursor: 'pointer',
      }}>
      <span aria-hidden className="flex items-center justify-center flex-shrink-0"
        style={{ width: 44, height: 44, borderRadius: 14, background: tint }}>
        <MeadowIcon name={icon} size={26} />
      </span>
      <span className="flex flex-col" style={{ flex: '1 1 auto', minWidth: 0, gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{title}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: M.text2 }}>{note}</span>
      </span>
      <MeadowIcon name="chevronRight" size={20} color={M.faint} />
    </button>
  )
}
