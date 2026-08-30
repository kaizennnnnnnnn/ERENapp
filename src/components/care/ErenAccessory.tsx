'use client'

// ═══════════════════════════════════════════════════════════════════════════
// EREN ACCESSORY — the crown, the hat, the shades.
//
// Bought in the Trophy Shop, worn by the household's one cat, and therefore
// seen by both people. Layered OVER whatever skin is on him, which is the
// whole point: it never collides with the 45 costume skins and a new skin
// needs no accessory work at all.
//
// It renders inside BlinkingEren's breathing wrapper, so it rises and falls
// with him instead of hovering while he moves.
//
// WHERE IT SITS is derived, never hand-placed per skin:
//   - the horizontal centre comes from the sprite's own eye layout, because a
//     crown belongs over the FACE and a fox ear would drag a silhouette
//     midpoint off it
//   - the head line and head width come from a measured alpha scan
//     (scripts/measure_heads.py -> lib/headAnchors.ts), so a hood that puts
//     the skull 8% lower gets the crown 8% lower for free
//
// All units are percentages of BlinkingEren's SQUARE box, the same space the
// eye overlays live in — so 1% horizontal and 1% vertical are the same number
// of pixels, and the whole thing holds at any size.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import type { EyeLayout } from '@/types'
import { headBox } from '@/lib/headAnchors'
import type { AccessoryItem } from '@/lib/trophyShop'
import { AccessorySvg, aspectOf } from './accessoryArt'

// ─── Placement ───────────────────────────────────────────────────────────────

const num = (v: string | undefined, fallback: number): number => {
  const n = parseFloat(v ?? '')
  return Number.isFinite(n) ? n : fallback
}

/**
 * Chest line, as a multiple of EYE SEPARATION below the eye line.
 *
 * Deliberately not derived from the head-top: a hood or a shark snout puts the
 * measured top far above the actual skull, which inflated the estimate and
 * dropped the medal past the paws on exactly those skins. The distance between
 * the eyes is a property of the cat's face and barely moves between costumes,
 * so it is the stable ruler here.
 */
const CHEST_FROM_EYES = 1.15

export interface AccessoryPlacement {
  def: AccessoryItem
  /** The body sprite currently rendered — keys the measured head box. */
  src: string
  /** The sprite's merged eye layout, for the face centre. */
  eyes: EyeLayout
}

export default memo(function ErenAccessory({ def, src, eyes }: AccessoryPlacement) {
  const head = headBox(src)

  // Face centre and eye line, in box percent.
  const eyeCx = (num(eyes.maskLeftA, 39.3) + num(eyes.maskLeftB, 53.8) + num(eyes.maskW, 5.7)) / 2
  const eyeMidY = num(eyes.maskTop, 32.8) + num(eyes.maskH, 5.4) / 2

  const width = head.w * def.scale
  const height = width * aspectOf(def.art)
  const offX = (def.offset?.x ?? 0) * head.w
  const offY = (def.offset?.y ?? 0) * head.w

  let top: number
  if (def.anchor === 'head') {
    // Hangs its bottom edge on the head line, then sinks by the offset so a
    // crown grips the skull instead of levitating over it.
    top = head.top - height + offY
  } else if (def.anchor === 'eyes') {
    top = eyeMidY - height / 2 + offY
  } else {
    const eyeSpan = num(eyes.maskLeftB, 53.8) + num(eyes.maskW, 5.7) - num(eyes.maskLeftA, 39.3)
    top = eyeMidY + eyeSpan * CHEST_FROM_EYES + offY
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${eyeCx - width / 2 + offX}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
        pointerEvents: 'none',
        // A soft contact shadow so the piece sits ON him rather than in front
        // of him. Cheap, and it survives every skin's colour.
        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))',
      }}
    >
      <AccessorySvg art={def.art} />
    </div>
  )
})
