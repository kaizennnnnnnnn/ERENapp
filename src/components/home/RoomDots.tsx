'use client'

// ─── Room dots ───────────────────────────────────────────────────────────────
// The page indicator that surfaces while you swipe between the living room
// and the care rooms: the living room (the long leaf pill, you are here), then
// one dot per swipe room, each a shortcut into it. Hidden the rest of the time.
//
// Meadow piece over room art: white, the over-art lip, no border, no blur. It
// sits `bottom` px above the stage floor (the bottom nav's top edge), which
// home sets to clear the dock standing on that floor.
//
// Presentational: the page decides when it shows and what a tap opens.

import { ROOMS, type RoomDef } from './RoomsMenu'
import { M } from '@/components/meadow/tokens'
import { useCat } from '@/hooks/useCat'

/** The rooms in swipe order (the Attic closes the loop from the other side and has no dot). */
export const SWIPE_ROOM_IDS = ['feed', 'play', 'sleep', 'wash', 'chemistry', 'vet'] as const
export type SwipeRoomId = typeof SWIPE_ROOM_IDS[number]

const LABEL: Record<string, string> = Object.fromEntries(ROOMS.map((r: RoomDef) => [r.id, r.label]))

export interface RoomDotsProps {
  visible: boolean
  /** Distance above the stage floor, in px. */
  bottom?: number
  onOpen: (room: SwipeRoomId) => void
}

export default function RoomDots({ visible, bottom = 12, onOpen }: RoomDotsProps) {
  const cat = useCat()
  return (
    <div className="absolute left-1/2 z-10 flex items-center"
      aria-hidden={!visible}
      style={{
        bottom, transform: 'translateX(-50%)', padding: '0 6px',
        background: '#FFFFFF', borderRadius: 999, boxShadow: `0 3px 0 ${M.overArtLip}`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}>
      {/* The living room — you are here */}
      <span style={{ padding: '8px 4px', lineHeight: 0 }}>
        <span style={{ display: 'block', width: 18, height: 8, borderRadius: 999, background: M.leaf }} />
      </span>
      {SWIPE_ROOM_IDS.map(id => (
        <button key={id} type="button" onClick={() => onOpen(id)} tabIndex={visible ? 0 : -1}
          aria-label={`Open the ${cat.t(LABEL[id] ?? id)}`}
          className="relative active:scale-90 transition-transform"
          style={{ padding: '8px 4px', lineHeight: 0, background: 'transparent', border: 0 }}>
          <span style={{ display: 'block', width: 8, height: 8, borderRadius: 999, background: M.softLip }} />
          {/* The pill stays slim; the tap target reaches 44px tall past it. */}
          <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: -10, bottom: -10 }} />
        </button>
      ))}
    </div>
  )
}
