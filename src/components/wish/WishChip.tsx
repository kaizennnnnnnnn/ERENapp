'use client'

// ═════════════════════════════════════════════════════════════════════════════
// WishChip — small obsidian chip in StatsHeader showing today's wish status.
//
// Pulsing pink star when pending, solid gold + check when granted. Tappable
// for a small fold-out card with the wish text + this-week counter.
// ═════════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { IconWish } from '@/components/PixelIcons'
import { OBSIDIAN_FACE, PINK, PINK_HI, Rivets, accentA } from '@/components/obsidian'
import { playSound } from '@/lib/sounds'

interface Props {
  text: string
  status: 'pending' | 'granted'
  weekGrantedCount: number
}

export default function WishChip({ text, status, weekGrantedCount }: Props) {
  const [open, setOpen] = useState(false)
  const isGranted = status === 'granted'

  const borderColor = isGranted ? 'rgba(245,200,66,0.55)' : PINK + '55'
  const numberColor = isGranted ? '#F5C842' : PINK_HI

  return (
    <div className="relative">
      <button
        onClick={() => { playSound('ui_tap'); setOpen(o => !o) }}
        aria-label="Today's wish"
        className="flex-shrink-0 relative flex items-center active:translate-y-[1px] transition-transform"
        style={{
          height: 40,
          padding: '0 8px',
          gap: 4,
          ...OBSIDIAN_FACE,
          border: `1px solid ${borderColor}`,
          background: OBSIDIAN_FACE.background,
        }}
      >
        <Rivets inset={3} />
        <div style={{
          filter: isGranted
            ? 'drop-shadow(0 0 4px rgba(245,200,66,0.7))'
            : `drop-shadow(0 0 3px ${accentA(0.5)})`,
          animation: isGranted ? 'none' : 'wishChipPulse 1.6s ease-in-out infinite',
        }}>
          <IconWish size={16} />
        </div>
        <span style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 9, lineHeight: 1,
          color: numberColor,
          filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.8))',
        }}>
          {weekGrantedCount}
        </span>
      </button>

      {open && (
        <>
          {/* Click-outside backdrop */}
          <div
            className="fixed inset-0 z-[59]"
            onClick={() => { playSound('ui_modal_close'); setOpen(false) }}
          />
          <div
            className="absolute z-[60]"
            style={{
              top: 'calc(100% + 6px)', right: 0,
              width: 220,
              ...OBSIDIAN_FACE,
              padding: 10,
              animation: 'wishChipFold 0.18s steps(2) both',
            }}
          >
            <Rivets inset={3} />
            <div className="flex items-center gap-2 mb-2">
              <IconWish size={12} />
              <span style={{
                fontFamily: '"Press Start 2P", monospace', fontSize: 6,
                color: PINK_HI, letterSpacing: 1.5,
              }}>
                {isGranted ? 'WISH GRANTED' : "EREN'S WISH TODAY"}
              </span>
            </div>
            <p style={{
              fontFamily: '"Press Start 2P", monospace', fontSize: 7,
              color: '#FDF6FF', lineHeight: 1.6,
              textDecoration: isGranted ? 'line-through' : 'none',
              opacity: isGranted ? 0.6 : 1,
            }}>{text}</p>
            <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${accentA(0.2)}` }}>
              <span style={{
                fontFamily: '"Press Start 2P", monospace', fontSize: 6,
                color: '#FFD700',
              }}>
                {weekGrantedCount}/7 this week
              </span>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes wishChipPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.12); }
        }
        @keyframes wishChipFold {
          0%   { opacity: 0; transform: translateY(-4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
