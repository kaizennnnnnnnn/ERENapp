'use client'

// ═══════════════════════════════════════════════════════════════════════════
// ACCESSORY ART — the pixel grids for every Trophy Shop wearable.
//
// Its own module because two very different callers need the same drawing:
// ErenAccessory places it on the cat, and the shop shows it on a card. Kept in
// the PixelIcons idiom (grid of chars + a small palette) so a crown next to a
// coin reads as the same game.
// ═══════════════════════════════════════════════════════════════════════════

import type { AccessoryItem } from '@/lib/trophyShop'

// ─── The art ─────────────────────────────────────────────────────────────────
// Pixel grids, drawn as SVG rects. Rows may be ragged; the viewBox takes the
// widest. Kept in the same idiom as PixelIcons so a crown next to a coin reads
// as the same game.

export type Art = { grid: string[]; palette: Record<string, string> }

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

export function AccessorySvg({ art }: { art: AccessoryItem['art'] }) {
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
export function aspectOf(art: AccessoryItem['art']): number {
  const g = ART[art].grid
  return g.length / Math.max(...g.map(r => r.length))
}

