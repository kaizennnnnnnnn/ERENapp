'use client'

// The Potion Mixer's pixel art: the cauldron (its liquid in the batch's mixed
// colour), the ingredient vials on the shelf, and the bottle a finished potion
// comes in. Liquids are recoloured per batch, so every grid keeps its liquid in
// two letters (L, and l for its highlight) and the palette fills them in.

import { memo } from 'react'
import { Pix, type Pal } from '@/components/PixelArt'
import { tint } from '@/lib/potions'

const IRON = { K: '#2B2733', I: '#4A4558', i: '#6E6884', d: '#37323F', e: '#1E1B26', g: '#8A8399' }

// ─── Cauldron ────────────────────────────────────────────────────────────────
// Drawn from shapes rather than typed, so the round belly is round and the two
// sides mirror: a rim band on top with the liquid in it, a dark seam where it
// sits on the belly, the belly lit on the left and shaded down the right, two
// stubby legs, and one outline round the lot.

const CW = 30
const CH = 26

function cauldronGrid(): string[] {
  const rows: string[] = []
  const body = { cx: 15, cy: 15.5, rx: 13.6, ry: 9.6 }
  const mouth = { cx: 15, cy: 5, rx: 9.4, ry: 2.2 }
  const inBody = (x: number, y: number) => ((x + 0.5 - body.cx) / body.rx) ** 2 + ((y + 0.5 - body.cy) / body.ry) ** 2 <= 1
  const inMouth = (x: number, y: number) => ((x + 0.5 - mouth.cx) / mouth.rx) ** 2 + ((y + 0.5 - mouth.cy) / mouth.ry) ** 2 <= 1
  // The rim: a band narrower than the belly, its top corners rounded off.
  const inRim = (x: number, y: number) => y >= 2 && y <= 8 && x >= 4 && x <= 25 && !(y === 2 && (x === 4 || x === 25))
  const inLeg = (x: number, y: number) => y >= 23 && y <= 25 && ((x >= 6 && x <= 8) || (x >= 21 && x <= 23))
  const solid = (x: number, y: number) => inBody(x, y) || inRim(x, y) || inLeg(x, y)
  for (let y = 0; y < CH; y++) {
    let row = ''
    for (let x = 0; x < CW; x++) {
      let ch = '.'
      if (solid(x, y)) {
        const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)
        if (edge) ch = 'K'
        else if (inMouth(x, y)) ch = x < mouth.cx - 4 && y <= 4 ? 'l' : 'L'
        else if (inRim(x, y) && y <= 7) ch = y <= 3 ? 'i' : y >= 7 ? 'd' : 'I'
        else if (y === 9) ch = 'K' // where the rim sits on the belly
        else if (inLeg(x, y) && !inBody(x, y)) ch = 'd'
        else if (x < body.cx - 7) ch = 'i'
        else if (x > body.cx + 6 || y > body.cy + 5) ch = 'd'
        else ch = 'I'
      }
      row += ch
    }
    rows.push(row)
  }
  return rows
}
const CAULDRON = cauldronGrid()

export const Cauldron = memo(function Cauldron({ liquid, size }: { liquid: string | null; size: number }) {
  const pal: Pal = { ...IRON, L: liquid ?? IRON.e, l: liquid ? tint(liquid, 0.4) : IRON.d }
  return <Pix grid={CAULDRON} pal={pal} size={size} />
})

/** Where the liquid's surface sits, as fractions of the cauldron's box (for bubbles and drops). */
export const CAULDRON_MOUTH = { x: 15 / CW, y: 5 / CH, w: 19 / CW }

// ─── Ingredient vial ─────────────────────────────────────────────────────────

const VIAL = [
  '...KKKK...',
  '...KccK...',
  '...KKKK...',
  '...KggK...',
  '...KggK...',
  '..KggggK..',
  '.KggggggK.',
  '.KLLLLLLK.',
  '.KLlLLLLK.',
  '.KLlLLLLK.',
  '.KLLLLLLK.',
  '.KLLLLLLK.',
  '..KKKKKK..',
]

const GLASS = { K: '#3B3646', g: '#E4EEF4', c: '#B07A45' }

export const Vial = memo(function Vial({ color, size }: { color: string; size: number }) {
  // Milk is near-white, so its glass edge does the work and the liquid stays put.
  return <Pix grid={VIAL} pal={{ ...GLASS, L: color, l: tint(color, 0.55) }} size={size} />
})

// ─── Potion bottle ───────────────────────────────────────────────────────────

const BOTTLE = [
  '.....KKKK.....',
  '.....KccK.....',
  '.....KKKK.....',
  '.....KggK.....',
  '.....KggK.....',
  '....KggggK....',
  '..KKggggggKK..',
  '.KggggggggggK.',
  'KLLLLLLLLLLLLK',
  'KLlLLLLLLLLLLK',
  'KLlLLLLLLLLLLK',
  'KLLLLLLLLLLLLK',
  'KLLLLLLLLLLLLK',
  '.KLLLLLLLLLLK.',
  '..KKLLLLLLKK..',
  '....KKKKKK....',
]

/** A finished potion, or (no colour) the grey shape of one not found yet. */
export const PotionBottle = memo(function PotionBottle({ color, size }: { color: string | null; size: number }) {
  if (!color) {
    const grey = '#D9D3CB'
    return <Pix grid={BOTTLE} pal={{ K: grey, g: grey, c: grey, L: grey, l: grey }} size={size} />
  }
  return <Pix grid={BOTTLE} pal={{ ...GLASS, L: color, l: tint(color, 0.5) }} size={size} />
})
