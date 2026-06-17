'use client'

// ─── HOME ROOMS MENU ─────────────────────────────────────────────────────────
// The door button's dropdown of care rooms, rebuilt as a little gallery card
// that grows out of the door button instead of blinking into place. Borrows
// the Hallway's aesthetic — gold ceiling glow, gold title + hairline ribbon,
// CRT scanlines, gold corner pixels — so the two "where to?" surfaces feel
// like the same game.
//
// Motion: the panel scales + fades out of its top-right corner (a springy
// open, a quick clean close) and the room options cascade up one after another.
// `mounted`/`shown` keep the card alive through its exit transition before
// unmounting so the close animation is never cut off.

import { useEffect, useRef, useState } from 'react'
import {
  IconDrumstick, IconYarn, IconMoonZ, IconBath,
  IconFlask, IconPill, IconBook, IconCake, IconDoor,
} from '@/components/PixelIcons'

export interface RoomDef {
  id: 'feed' | 'play' | 'sleep' | 'wash' | 'chemistry' | 'vet' | 'school' | 'bakery'
  label: string
  Icon: React.ComponentType<{ size?: number }>
  color: string
  rgb: string
  /** Top-level route (bakery) — navigated via the cloud transition rather
   *  than opened as a swipe-room care scene. */
  href?: string
}

export const ROOMS: RoomDef[] = [
  { id: 'feed',      label: 'Kitchen',       Icon: IconDrumstick, color: '#F5C842', rgb: '245,200,66'  },
  { id: 'play',      label: 'Playroom',      Icon: IconYarn,      color: '#FF6B9D', rgb: '255,107,157' },
  { id: 'sleep',     label: 'Bedroom',       Icon: IconMoonZ,     color: '#818CF8', rgb: '129,140,248' },
  { id: 'wash',      label: 'Bathroom',      Icon: IconBath,      color: '#38BDF8', rgb: '56,189,248'  },
  { id: 'chemistry', label: 'Chem Lab',      Icon: IconFlask,     color: '#84CC16', rgb: '132,204,22'  },
  { id: 'vet',       label: 'Vet Office',    Icon: IconPill,      color: '#34D399', rgb: '52,211,153'  },
  { id: 'school',    label: 'Serbian Class', Icon: IconBook,      color: '#F59E0B', rgb: '245,158,11'  },
  { id: 'bakery',    label: 'Eren’s Bakery', Icon: IconCake,      color: '#FBBF24', rgb: '251,191,36', href: '/bakery' },
]

const EXIT_MS = 150
const PIXEL = '"Press Start 2P", monospace'
const GOLD = '#F5C842'

export default function RoomsMenu({
  open, onClose, onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (room: RoomDef) => void
}) {
  // `mounted` keeps the DOM alive across the exit transition; `shown` drives
  // the open/close state once it's mounted (flipped a frame after mount so the
  // entrance transition actually runs from its start state).
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null }
      setMounted(true)
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }
    if (mounted) {
      setShown(false)
      exitTimer.current = setTimeout(() => setMounted(false), EXIT_MS)
    }
  }, [open, mounted])

  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current) }, [])

  if (!mounted) return null

  const corner = (pos: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', width: 4, height: 4, background: GOLD,
    opacity: 0.7, boxShadow: '0 0 3px rgba(245,200,66,0.6)', ...pos,
  })

  return (
    <>
      {/* Scrim — gently dims the room so the menu reads as the focus. */}
      <div
        className="fixed inset-0 z-20"
        onClick={onClose}
        style={{
          background: 'rgba(6,3,12,0.34)',
          opacity: shown ? 1 : 0,
          transition: `opacity ${EXIT_MS}ms ease`,
        }}
      />

      {/* Panel — floating gallery card anchored under the door button. */}
      <div
        className="absolute right-0 top-10 z-30 flex flex-col gap-1.5 p-2.5"
        style={{
          minWidth: 190,
          borderRadius: 7,
          border: '2px solid rgba(167,139,250,0.4)',
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(245,200,66,0.14) 0%, transparent 55%),
            linear-gradient(180deg, rgba(26,14,36,0.97) 0%, rgba(16,8,24,0.98) 60%, rgba(6,3,10,0.99) 100%)
          `,
          backdropFilter: 'blur(16px)',
          boxShadow: '4px 4px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
          transformOrigin: 'top right',
          opacity: shown ? 1 : 0,
          transform: shown ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(-6px)',
          transition: shown
            ? 'opacity 150ms ease-out, transform 230ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'opacity 130ms ease-in, transform 130ms ease-in',
        }}
      >
        {/* CRT scanlines */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.16) 3px, rgba(0,0,0,0.16) 4px)',
          borderRadius: 7,
        }} />
        {/* Gold corner pixels */}
        <div style={corner({ top: 4, left: 4 })} />
        <div style={corner({ top: 4, right: 4 })} />
        <div style={corner({ bottom: 4, left: 4 })} />
        <div style={corner({ bottom: 4, right: 4 })} />

        {/* Header — gold title + a little door, echoing the Hallway's top bar. */}
        <div className="relative flex items-center justify-center gap-1.5" style={{ paddingTop: 2, paddingBottom: 1 }}>
          <span style={{ filter: 'drop-shadow(0 0 4px rgba(245,200,66,0.45))', lineHeight: 0 }}>
            <IconDoor size={12} />
          </span>
          <span style={{ fontFamily: PIXEL, fontSize: 8, color: GOLD, letterSpacing: 2, textShadow: '0 0 10px rgba(245,200,66,0.6)' }}>
            ROOMS
          </span>
        </div>
        {/* Gold hairline ribbon */}
        <div className="relative" style={{
          height: 1, margin: '0 4px 2px',
          background: 'linear-gradient(90deg, transparent, rgba(245,200,66,0.6), transparent)',
        }} />

        {/* Room options — each cascades up into place. */}
        {ROOMS.map((room, i) => (
          <button
            key={room.id}
            onClick={() => onSelect(room)}
            className="room-node relative flex items-center gap-2.5 px-2.5 py-1.5"
            style={{
              borderRadius: 5,
              background: `linear-gradient(135deg, rgba(${room.rgb},0.16), rgba(${room.rgb},0.05))`,
              border: `1px solid rgba(${room.rgb},0.3)`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.3)',
              animation: 'roomItemIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) backwards',
              animationDelay: `${60 + i * 32}ms`,
            }}
          >
            {/* Glossy, softly-glowing icon medallion */}
            <span className="flex items-center justify-center flex-shrink-0" style={{
              width: 26, height: 26, borderRadius: 4,
              background: `linear-gradient(160deg, rgba(${room.rgb},0.34) 0%, rgba(${room.rgb},0.12) 100%)`,
              border: `1px solid rgba(${room.rgb},0.5)`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), 0 0 7px rgba(${room.rgb},0.35)`,
            }}>
              <span style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.35))', lineHeight: 0 }}>
                <room.Icon size={17} />
              </span>
            </span>

            {/* Label */}
            <span className="flex-1 text-left" style={{
              fontFamily: PIXEL, fontSize: 7, color: room.color, letterSpacing: 0.5,
              textShadow: `0 0 5px rgba(${room.rgb},0.45)`,
            }}>
              {room.label.toUpperCase()}
            </span>

            {/* Chevron — nudges on hover (matches the Hallway's "<" chevron). */}
            <span className="room-chevron flex-shrink-0" style={{
              fontFamily: PIXEL, fontSize: 8, color: `rgba(${room.rgb},0.8)`, lineHeight: 1,
            }}>&gt;</span>
          </button>
        ))}
      </div>
    </>
  )
}
