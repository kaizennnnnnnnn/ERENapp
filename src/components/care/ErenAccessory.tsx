'use client'

// ═══════════════════════════════════════════════════════════════════════════
// EREN ACCESSORY — the crown, the hat, the shades.
//
// Bought in the Closet, worn by the household's one cat, and therefore seen by
// both people. Layered OVER whatever skin is on him, which is the whole point:
// it never collides with the 45 costume skins and a new skin needs no
// accessory work at all.
//
// It renders inside BlinkingEren's breathing wrapper, so it rises and falls
// with him instead of hovering while he moves.
//
// WHERE IT SITS comes entirely from the sprite's OWN EYE LAYOUT.
//
// The first cut measured a head box off each sprite's alpha channel
// (scripts/measure_heads.py -> lib/headAnchors.ts) and hung the hat on the
// topmost opaque row. That works for the room sprites and is worthless for
// the costumes: every skin PNG is trimmed to its content, so the topmost
// opaque row is row ZERO for all 44 of them. The hat was therefore placed
// with its brim at the very top of the sprite box — floating a clear head's
// height above a bunny hood — and scaled to the width of the whole BODY,
// which is why a party hat came out enormous on Koala (76% box width) and
// small on Banana (39%).
//
// Eyes do not have that problem. Every costume is the same cat underneath, so
// the distance between his eyes is a stable ruler that no hood, ear or snout
// moves. Both constants below are calibrated against the plain sprite, where
// the alpha measurement WAS the head:
//
//   /erenGood.png   head top 13.77%, head width 40.35%
//   its eyes        mid-line 35.5%, eye span 20.2%
//   => top  is 1.076 eye-spans above the eye line
//   => width is 2.00 eye-spans
//
// All units are percentages of BlinkingEren's SQUARE box, the same space the
// eye overlays live in — so 1% horizontal and 1% vertical are the same number
// of pixels, and the whole thing holds at any size.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import type { EyeLayout } from '@/types'
import type { AccessoryItem } from '@/lib/trophyShop'
import { AccessorySvg, aspectOf } from './accessoryArt'

// ─── Placement ───────────────────────────────────────────────────────────────

const num = (v: string | undefined, fallback: number): number => {
  const n = parseFloat(v ?? '')
  return Number.isFinite(n) ? n : fallback
}

/** Skull line, in eye-spans above the eye line. */
const HEAD_FROM_EYES = 1.076
/** Head width, in eye-spans. */
const HEAD_W_FROM_EYES = 2.0

/**
 * Chest line, as a multiple of EYE SEPARATION below the eye line.
 *
 * Same ruler as the head line, for the same reason: a hood or a shark snout
 * moves the silhouette but not the face.
 */
const CHEST_FROM_EYES = 1.15

export interface AccessoryPlacement {
  def: AccessoryItem
  /** The body sprite currently rendered. Kept for callers/debugging. */
  src?: string
  /** The sprite's merged eye layout — the only thing placement reads. */
  eyes: EyeLayout
}

export default memo(function ErenAccessory({ def, eyes }: AccessoryPlacement) {
  // The face, in box percent.
  const eyeL = num(eyes.maskLeftA, 39.3)
  const eyeR = num(eyes.maskLeftB, 53.8)
  const eyeW = num(eyes.maskW, 5.7)
  const eyeCx = (eyeL + eyeR + eyeW) / 2
  const eyeMidY = num(eyes.maskTop, 32.8) + num(eyes.maskH, 5.4) / 2
  const eyeSpan = eyeR + eyeW - eyeL

  const headTop = eyeMidY - eyeSpan * HEAD_FROM_EYES
  const headW = eyeSpan * HEAD_W_FROM_EYES

  const width = headW * def.scale
  const height = width * aspectOf(def.art)
  const offX = (def.offset?.x ?? 0) * headW
  const offY = (def.offset?.y ?? 0) * headW

  let top: number
  if (def.anchor === 'head') {
    // Hangs its bottom edge on the head line, then sinks by the offset so a
    // crown grips the skull instead of levitating over it.
    top = headTop - height + offY
  } else if (def.anchor === 'eyes') {
    top = eyeMidY - height / 2 + offY
  } else {
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
