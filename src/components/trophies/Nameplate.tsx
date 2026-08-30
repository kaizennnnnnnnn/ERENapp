'use client'

// ═══════════════════════════════════════════════════════════════════════════
// NAMEPLATE — a name, wearing whatever prestige its owner has bought.
//
// The frame wraps the name; the title hangs under it. Both are trophy-only, so
// a nameplate with anything on it is a statement about days won, which is the
// entire reason the prestige shelf exists: it is worthless except as a signal,
// and a signal is only worth something where the other person will see it.
//
// Takes ids, not values, so a caller only has to hand over a profile. The
// drawing itself lives in prestigeArt, shared with the shop cards — what you
// buy is exactly what you saw.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { prestigeDef } from '@/lib/trophyShop'
import { FramePlate, TitlePlate } from './prestigeArt'

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
  const framed = frame?.slot === 'frame'

  return (
    <span className="inline-flex flex-col items-center" style={{ gap: 3 }}>
      {framed ? (
        <FramePlate tone={frame.value} name={name} scale={size} />
      ) : (
        <span className="font-pixel" style={{
          fontSize: size, letterSpacing: 1.5, color: tone, whiteSpace: 'nowrap',
        }}>{name.toUpperCase()}</span>
      )}

      {title?.slot === 'title' && (
        <TitlePlate
          value={title.value}
          focus={title.focus}
          scale={Math.max(4, size - 2)}
          glory={title.rarity === 'legendary'}
        />
      )}
    </span>
  )
})
