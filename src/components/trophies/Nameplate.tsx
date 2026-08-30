'use client'

// ═══════════════════════════════════════════════════════════════════════════
// NAMEPLATE — a name, wearing whatever prestige its owner has bought.
//
// The frame wraps the name; the title sits under it. Both are trophy-only, so
// a nameplate with anything on it is a statement about days won, which is the
// entire reason the prestige shelf exists: it is worthless except as a signal,
// and a signal is only worth something where the other person will see it.
//
// Takes ids, not values, so a caller only has to hand over a profile.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { prestigeDef } from '@/lib/trophyShop'
import { FRAME_SKINS } from './TrophyShopView'

interface Props {
  name: string
  titleId?: string | null
  frameId?: string | null
  /** Name size in px. The title scales off it. */
  size?: number
  tone?: string
}

export default memo(function Nameplate({
  name, titleId, frameId, size = 7, tone = '#FFD9EC',
}: Props) {
  const title = prestigeDef(titleId)
  const frame = prestigeDef(frameId)
  const skin = frame?.slot === 'frame' ? FRAME_SKINS[frame.value] : null

  const label = (
    <span className="font-pixel relative" style={{
      fontSize: size, letterSpacing: 1.5,
      color: skin ? skin.text : tone,
      textShadow: skin ? `0 0 5px ${skin.glow}` : undefined,
      whiteSpace: 'nowrap',
    }}>{name.toUpperCase()}</span>
  )

  return (
    <span className="inline-flex flex-col items-center" style={{ gap: 2 }}>
      {skin ? (
        <span className="relative inline-flex items-center justify-center px-2 py-1" style={{
          border: `2px solid ${skin.border}`,
          borderRadius: 3,
          background: skin.bg,
          boxShadow: `0 0 9px ${skin.glow}`,
          overflow: 'hidden',
        }}>
          {skin.shine && (
            <span aria-hidden className="absolute inset-0" style={{
              background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.45) 50%, transparent 62%)',
              animation: 'npShine 3.4s ease-in-out infinite',
            }} />
          )}
          {label}
        </span>
      ) : label}

      {title?.slot === 'title' && (
        <span className="font-pixel" style={{
          fontSize: Math.max(4, size - 2), letterSpacing: 1,
          color: skin ? skin.text : '#9A8AA8',
          opacity: 0.9,
        }}>{title.value}</span>
      )}

      <style>{`
        @keyframes npShine {
          0%, 25%   { transform: translateX(-130%); }
          70%, 100% { transform: translateX(130%); }
        }
      `}</style>
    </span>
  )
})
