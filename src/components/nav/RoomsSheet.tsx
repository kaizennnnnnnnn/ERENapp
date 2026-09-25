'use client'

// ─── Rooms sheet ─────────────────────────────────────────────────────────────
// What the nav's Rooms tab opens: every room as a tile, in a Meadow bottom
// sheet. The rooms themselves are not redesigned (the owner: "dont change the
// rooms designs for now"), so the tiles keep each room's own icon from ROOMS.
// Presentational: the nav decides what a pick does.

import { ROOMS, type RoomDef } from '@/components/home/RoomsMenu'
import { Sheet } from '@/components/meadow/Sheet'
import { FONT_ROUNDED, M } from '@/components/meadow/tokens'
import { useCat } from '@/hooks/useCat'

export interface RoomsSheetProps {
  open: boolean
  onClose: () => void
  onPick: (room: RoomDef) => void
  rooms?: readonly RoomDef[]
}

export function RoomsSheet({ open, onClose, onPick, rooms = ROOMS }: RoomsSheetProps) {
  const cat = useCat()
  return (
    <Sheet open={open} onClose={onClose} title="Rooms">
      <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {rooms.map(room => (
          <button
            key={room.id}
            type="button"
            onClick={() => onPick(room)}
            className="m-press m-focus"
            style={{
              minHeight: 100, padding: '0 4px', border: 0, borderRadius: 18, background: M.soft,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: FONT_ROUNDED, cursor: 'pointer',
            }}
          >
            <span aria-hidden style={{ lineHeight: 0 }}>
              <room.Icon size={32} />
            </span>
            <span style={{
              minHeight: 30, maxWidth: '100%', display: 'flex', alignItems: 'center', textAlign: 'center',
              fontSize: 12, lineHeight: 1.25, fontWeight: 800, color: M.text, overflowWrap: 'anywhere',
            }}>
              {cat.t(room.label)}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
