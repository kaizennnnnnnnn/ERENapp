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
import { PixelGrid, gridAspect, type PixelArt } from '@/components/pixelGrid'

// ─── The art ─────────────────────────────────────────────────────────────────
// Pixel grids, drawn as SVG rects. Rows may be ragged; the viewBox takes the
// widest. Kept in the same idiom as PixelIcons so a crown next to a coin reads
// as the same game.

const ART: Record<AccessoryItem['art'], PixelArt> = {
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

/** The raw grid, for a caller that composes it into its own svg. */
export function accessoryArt(art: AccessoryItem['art']): PixelArt {
  return ART[art]
}

export function AccessorySvg({ art }: { art: AccessoryItem['art'] }) {
  const { grid, palette } = ART[art]
  return <PixelGrid grid={grid} palette={palette} />
}

/** Grid aspect (height / width) — how tall a piece is for a given width. */
export function aspectOf(art: AccessoryItem['art']): number {
  return gridAspect(ART[art].grid)
}
