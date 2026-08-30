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

// ─── The art ─────────────────────────────────────────────────────────────────
// Pixel grids, drawn as SVG rects. Rows may be ragged; the viewBox takes the
// widest. Kept in the same idiom as PixelIcons so a crown next to a coin reads
// as the same game.

type Art = { grid: string[]; palette: Record<string, string> }

const ART: Record<AccessoryItem['art'], Art> = {
  crown: {
    grid: [
      '..W...W...W..',
      '.KWK.KWK.KWK.',
      'KYYYKYYYKYYYK',
      'KYYYYYYYYYYYK',
      'KYRYYYRYYYRYK',
      'KYYYYYYYYYYYK',
      'KKKKKKKKKKKKK',
    ],
    palette: { K: '#7A4F00', Y: '#FFD700', W: '#FFF4A3', R: '#E31E5A' },
  },
  party_hat: {
    grid: [
      '....P....',
      '...PPP...',
      '....K....',
      '...KAK...',
      '...KAK...',
      '..KAAAK..',
      '..KABAK..',
      '.KAAAAAK.',
      '.KABAAAK.',
      'KAAAAAAAK',
      'KKKKKKKKK',
    ],
    palette: { K: '#7A1030', A: '#FF5C7A', B: '#FFF06B', P: '#FFF06B' },
  },
  tophat: {
    grid: [
      '..KKKKKKK..',
      '..KWWWWWK..',
      '..KWWWWWK..',
      '..KWWWWWK..',
      '..KBBBBBK..',
      '..KWWWWWK..',
      '.KKKKKKKKK.',
      'KWWWWWWWWWK',
      'KKKKKKKKKKK',
    ],
    palette: { K: '#08080C', W: '#2A2A38', B: '#E31E5A' },
  },
  flowers: {
    grid: [
      '.W...W...W...W.',
      'WYW.WYW.WYW.WYW',
      '.W.G.W.G.W.G.W.',
      '..GGGGGGGGGGG..',
    ],
    palette: { W: '#FFE0EC', Y: '#FFD700', G: '#63F094' },
  },
  cans: {
    grid: [
      '....KKKKKKK....',
      '..KKBBBBBBBKK..',
      '.KKB.......BKK.',
      'KKB.........BKK',
      'KCK.........KCK',
      'KCCK.......KCCK',
      'KCCK.......KCCK',
      'KCK.........KCK',
      '.K...........K.',
    ],
    palette: { K: '#14141C', B: '#3A3A4A', C: '#4FD8FF' },
  },
  shades: {
    grid: [
      'KKKKKKKKKKKKK',
      'KDWDDKKKDWDDK',
      'KDDDDK.KDDDDK',
      '.KDDK...KDDK.',
      '..KK.....KK..',
    ],
    palette: { K: '#08080C', D: '#1B2A4A', W: '#7FB0FF' },
  },
  medal: {
    grid: [
      '.RR...RR.',
      '.RR...RR.',
      '..RR.RR..',
      '...RRR...',
      '..KKKKK..',
      '.KYYYYYK.',
      'KYYWYYYYK',
      'KYYYYYYYK',
      '.KYYYYYK.',
      '..KKKKK..',
    ],
    palette: { R: '#E31E5A', K: '#7A4F00', Y: '#FFD700', W: '#FFF4A3' },
  },
  bow: {
    grid: [
      '.KK.....KK.',
      'KBBK.K.KBBK',
      'KBBBKMKBBBK',
      'KBBBKMKBBBK',
      'KBBK.K.KBBK',
      '.KK.....KK.',
    ],
    palette: { K: '#3A0A18', B: '#E31E5A', M: '#FF8DB8' },
  },
}

function AccessorySvg({ art }: { art: AccessoryItem['art'] }) {
  const { grid, palette } = ART[art]
  const cols = Math.max(...grid.map(r => r.length))
  const rows = grid.length
  const rects: React.ReactElement[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = palette[grid[y][x]]
      if (!c) continue
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={c} />)
    }
  }
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      width="100%" height="100%"
      shapeRendering="crispEdges"
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden
    >
      {rects}
    </svg>
  )
}

/** Grid aspect (height / width) — how tall a piece is for a given width. */
function aspectOf(art: AccessoryItem['art']): number {
  const g = ART[art].grid
  return g.length / Math.max(...g.map(r => r.length))
}

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
