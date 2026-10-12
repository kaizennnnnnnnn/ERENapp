'use client'

// ─── Room picker ─────────────────────────────────────────────────────────────
// "Wear Shark Eren in…": every room with a tick, so one look goes on as many
// rooms as you like in one tap, instead of switching rooms and tapping Wear in
// each. The ticks say which rooms will wear it once you're done: a room you
// tick puts it on, a room that had it on and you untick goes back to its own
// default look. Rooms already wearing it start ticked, and so does the room
// you're dressing.
//
// Presentational: the page owns the write (useCloset.dress) and the Undo.

import { useEffect, useState } from 'react'
import { CheckDisc, Divider, PrimaryButton, Sheet, M, RARITY_TAG } from '@/components/meadow'
import { resolveRoomSkin, type RoomDef, type SkinDef } from '@/lib/skins'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'
import { swapCatName } from '@/lib/catWords'

interface Props {
  /** The look being put on; null closes the sheet. */
  skin: SkinDef | null
  rooms: RoomDef[]
  roomSkins: Record<string, string>
  /** Starts ticked even when it isn't wearing the look yet. */
  activeRoom: string
  /** Room → new look (null = back to the room's default). Only rooms that change. */
  onApply: (changes: Record<string, string | null>) => void
  onClose: () => void
}

export default function RoomPickerSheet({ skin, rooms, roomSkins, activeRoom, onApply, onClose }: Props) {
  const cat = useCat()
  // Keep the last look while the sheet drops away.
  const [shown, setShown] = useState(skin)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!skin) return
    setShown(skin)
    setTicked(new Set(rooms.filter(r => r.id === activeRoom || roomSkins[r.id] === skin.id).map(r => r.id)))
  }, [skin]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null

  const wears = (id: string) => roomSkins[id] === shown.id
  const changes: Record<string, string | null> = {}
  for (const r of rooms) {
    if (ticked.has(r.id) && !wears(r.id)) changes[r.id] = shown.id
    if (!ticked.has(r.id) && wears(r.id)) changes[r.id] = null
  }
  const changed = Object.keys(changes).length
  const n = ticked.size
  const all = n === rooms.length

  function toggle(id: string) {
    playSound('ui_tap')
    setTicked(t => {
      const next = new Set(t)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const name = swapCatName(shown.name, cat)

  return (
    <Sheet open={!!skin} title={`Wear ${name} in...`}
      onClose={() => { playSound('ui_modal_close'); onClose() }}
      footer={
        <PrimaryButton full disabled={changed === 0} onClick={() => onApply(changes)}>
          {n === 0 ? 'Take it off' : all ? 'Wear in every room' : `Wear in ${n} ${n === 1 ? 'room' : 'rooms'}`}
        </PrimaryButton>
      }>
      <div role="group" aria-label="Rooms">
        <PickRow label="Every room" checked={all}
          onClick={() => { playSound('ui_tap'); setTicked(all ? new Set() : new Set(rooms.map(r => r.id))) }} />
        <Divider style={{ margin: '4px 0' }} />
        {rooms.map(r => {
          const now = resolveRoomSkin(roomSkins, r.id)
          return (
            <PickRow key={r.id} label={r.label} checked={ticked.has(r.id)} onClick={() => toggle(r.id)}
              sublabel={wears(r.id) ? 'Wearing it now' : now ? `Wearing ${swapCatName(now.name, cat)}` : 'Default look'}
              thumb={now?.thumb ?? r.defaultThumb} tint={now ? RARITY_TAG[now.rarity].bg : M.soft} />
          )
        })}
      </div>
    </Sheet>
  )
}

function PickRow({ label, sublabel, thumb, tint, checked, onClick }: {
  label: string; sublabel?: string; thumb?: string; tint?: string; checked: boolean; onClick: () => void
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onClick}
      className="m-focus flex items-center w-full"
      style={{
        minHeight: 60, gap: 12, padding: '6px 4px', border: 0, background: 'transparent',
        textAlign: 'left', fontFamily: 'inherit', color: M.text, cursor: 'pointer',
      }}>
      {thumb && (
        <span aria-hidden className="relative flex-shrink-0" style={{ width: 48, height: 48, borderRadius: 14, background: tint }}>
          <img src={thumb} alt="" draggable={false} style={{
            position: 'absolute', inset: '8%', width: '84%', height: '84%', objectFit: 'contain', imageRendering: 'auto',
          }} />
        </span>
      )}
      <span className="flex flex-col" style={{ flex: '1 1 auto', minWidth: 0, gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{label}</span>
        {sublabel && (
          <span style={{ fontSize: 13, fontWeight: 600, color: M.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sublabel}
          </span>
        )}
      </span>
      {checked ? <CheckDisc size={26} /> : (
        <span aria-hidden style={{ width: 26, height: 26, boxSizing: 'border-box', borderRadius: 999, border: `2px solid ${M.softLip}`, flexShrink: 0 }} />
      )}
    </button>
  )
}
