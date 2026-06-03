'use client'

// ═════════════════════════════════════════════════════════════════════════════
// WishHintBanner — small top-of-room banner inside care scenes.
//
// Surfaces today's wish at the top of the relevant room (Feed, Wash, Sleep,
// Vet, Games index) so the user gets a soft prompt while in the right place
// to grant it. Hidden when the wish is already granted or doesn't apply to
// this room.
// ═════════════════════════════════════════════════════════════════════════════

import { IconWish } from '@/components/PixelIcons'
import { OBSIDIAN_FACE, PINK_HI, accentA } from '@/components/obsidian'

interface Props {
  text: string
  status: 'loading' | 'pending' | 'granted'
  /** Only render when this room matches the wish's hint room. */
  matchesThisRoom: boolean
}

export default function WishHintBanner({ text, status, matchesThisRoom }: Props) {
  if (!matchesThisRoom) return null
  if (status !== 'pending') return null

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2"
      style={{
        top: 10,
        zIndex: 30,
        maxWidth: 320,
        ...OBSIDIAN_FACE,
        padding: '5px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        animation: 'wishBannerIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      <div style={{ filter: `drop-shadow(0 0 4px ${accentA(0.5)})` }}>
        <IconWish size={12} />
      </div>
      <span style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 6,
        color: PINK_HI,
        letterSpacing: 1,
        textShadow: `0 0 3px ${accentA(0.4)}`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {text}
      </span>
      <style jsx global>{`
        @keyframes wishBannerIn {
          0%   { opacity: 0; transform: translate(-50%, -8px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  )
}
