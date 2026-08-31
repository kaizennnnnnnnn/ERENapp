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
  // Rounded points, a pearl on each, two gem colours in the band.
  crown: {
    grid: [
      '..W....W....W..',
      '.KWK..KWK..KWK.',
      '.KYK..KYK..KYK.',
      'KYYYKKYYYKKYYYK',
      'KYYYYYYYYYYYYYK',
      'KYRYYYYBYYYYRYK',
      'KYYYYYYYYYYYYYK',
      'KLLLLLLLLLLLLLK',
      'KKKKKKKKKKKKKKK',
    ],
    palette: {
      K: '#8A5A00', Y: '#FFD24A', L: '#FFEC9E', W: '#FFF9DC',
      R: '#FF4D7D', B: '#5AC8FF',
    },
  },

  // Pompom, two stripes, and a brim he could actually chew.
  party_hat: {
    grid: [
      '....PPP....',
      '...PPPPP...',
      '....PPP....',
      '....KAK....',
      '...KAAAK...',
      '...KBBBK...',
      '..KAAAAAK..',
      '..KAAAAAK..',
      '.KBBBBBBBK.',
      '.KAAAAAAAK.',
      'KAAAAAAAAAK',
      'KKKKKKKKKKK',
    ],
    palette: { K: '#8A1030', A: '#FF7FA8', B: '#FFF06B', P: '#8FF0C0' },
  },

  // Felt, a ribbon band, and one small flower tucked into it.
  tophat: {
    grid: [
      '...KKKKKKK...',
      '...KWWWWWK...',
      '...KWWWWWK...',
      '...KWWWWWK...',
      '...KWWFWWK...',
      '...KRFYFRK...',
      '...KRRRRRK...',
      '...KWLWWWK...',
      '.KKKKKKKKKKK.',
      'KWWWWWWWWWWWK',
      'KKKKKKKKKKKKK',
    ],
    palette: {
      K: '#0A0A10', W: '#3E3E58', L: '#5E5E7E', R: '#E31E5A',
      F: '#FFB3D1', Y: '#FFE066',
    },
  },

  // Daisies alternating with pink ones, on a green vine.
  flowers: {
    grid: [
      '.WWW..PPP..WWW.',
      'WWYWWWPYPWWWYWW',
      '.WWW..PPP..WWW.',
      'GGGGGGGGGGGGGGG',
    ],
    palette: { W: '#FFFFFF', P: '#FFB3D1', Y: '#FFD700', G: '#63D48A' },
  },

  // Cat-ear headphones, because he already has the ears for it.
  cans: {
    grid: [
      '...K.......K...',
      '..KPK.....KPK..',
      '.KPPPK...KPPPK.',
      '.KKKKKKKKKKKKK.',
      'KKBBBBBBBBBBBKK',
      'KCCK.......KCCK',
      'KCCCK.....KCCCK',
      'KCHCK.....KCCCK',
      'KCCCK.....KCCCK',
      'KCCK.......KCCK',
      '.KK.........KK.',
    ],
    palette: { K: '#14141C', P: '#FF9EC4', B: '#4A4A5E', C: '#7FE3FF', H: '#FF6B9D' },
  },

  // Rounder lenses and a proper glint.
  shades: {
    grid: [
      '.KKKKK.KKKKK.',
      'KDWWDKKKDWWDK',
      'KDWDDK.KDWDDK',
      'KDDDDK.KDDDDK',
      '.KDDK...KDDK.',
      '..KK.....KK..',
    ],
    palette: { K: '#0A0A12', D: '#2A3A6A', W: '#9FD0FF' },
  },

  // A star struck into the disc, on a ribbon.
  medal: {
    grid: [
      'RRR.....RRR',
      'RRR.....RRR',
      '.RRR...RRR.',
      '..RRRRRRR..',
      '..KKKKKKK..',
      '.KYYYDYYYK.',
      'KYWYDDDYYYK',
      'KYDDDDDDDYK',
      'KYYDDDDDYYK',
      'KYYDYYYDYYK',
      '.KYYYYYYYK.',
      '..KKKKKKK..',
    ],
    palette: {
      R: '#E31E5A', K: '#8A5A00', Y: '#FFD24A', D: '#A8700A', W: '#FFF9DC',
    },
  },

  // Fatter loops, a highlight, and a gold knot.
  bow: {
    grid: [
      '.KKK.....KKK.',
      'KBHBK...KBHBK',
      'KBBBBKMKBBBBK',
      'KBBBBKMKBBBBK',
      'KBBBBKMKBBBBK',
      'KBBBK...KBBBK',
      '.KKK.....KKK.',
    ],
    palette: { K: '#7A0A28', B: '#FF4D7D', H: '#FFC0D8', M: '#FFD24A' },
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
