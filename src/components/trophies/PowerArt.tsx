'use client'

// ═══════════════════════════════════════════════════════════════════════════
// POWER ART — one drawing per privilege.
//
// All five used to share IconLightning, which made the POWERS shelf look like
// the same item listed five times. They are the only shelf where the thing
// bought is not a picture, so the picture has to do the whole job of saying
// what it does: a bubble talks, a shield holds, a snowflake stops, an arrow
// takes, a x2 doubles.
//
// Sized off the widest row, so a caller gives a width and gets the right
// height back from `powerAspect`.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { PixelGrid, gridAspect, type PixelArt } from '@/components/pixelGrid'
import type { PrivilegeId } from '@/lib/trophyShop'

const ART: Record<PrivilegeId, PixelArt> = {
  // A speech bubble mid-sentence.
  eren_says: {
    grid: [
      '..KKKKKKKKKKKK..',
      '.KGGGGGGGGGGGGK.',
      'KGWWGGGGGGGGGGGK',
      'KGWGGGGGGGGGGGGK',
      'KGGGGGGGGGGGGGGK',
      'KGGDDGGDDGGDDGGK',
      'KGGDDGGDDGGDDGGK',
      'KGGGGGGGGGGGGGGK',
      '.KGGGGGGGGGGGGK.',
      '..KKKKKGGGKKKK..',
      '.......KGK......',
      '........K.......',
    ],
    palette: { K: '#06301E', G: '#5FE39A', W: '#CFFFE4', D: '#06301E' },
  },

  // The multiplier, spelled out. Anything subtler reads as decoration.
  double_hour: {
    grid: [
      '.........KKKKKKK.',
      '........KKYYYYYKK',
      'KKKK.KKKKYYKKKYYK',
      'KYYKKKYYKYYK.KYYK',
      'KKYYKYYKKKKKKKYYK',
      '.KKYYYKK..KKKYYKK',
      '.KKYYYKK.KKYYYKK.',
      'KKYYKYYKKKYYKKK..',
      'KYYKKKYYKYYKKKKKK',
      'KKKK.KKKKYYYYYYYK',
      '........KKKKKKKKK',
    ],
    palette: { K: '#6B4200', Y: '#FFD650' },
  },

  // One point, coming off the top of somebody's score.
  point_steal: {
    grid: [
      '....KKK....',
      '...KRRRK...',
      '...KRRRK...',
      '...KRRRK...',
      '.KKKRRRKKK.',
      '.KRRRRRRRK.',
      '..KRRRRRK..',
      '...KRRRK...',
      '....KRK....',
      '.....K.....',
      '...KKKKK...',
      '..KYWYYYK..',
      '..KYYYYYK..',
      '...KKKKK...',
    ],
    palette: { K: '#4A0A18', R: '#FF4D6D', Y: '#FFD650', W: '#FFF4A3' },
  },

  // A shield with the streak still burning inside it.
  streak_shield: {
    grid: [
      '..KKKKKKKK..',
      '.KBBBBBBBBK.',
      'KBWWBBBBBBBK',
      'KBWBBBBBBBBK',
      'KBBBBFFBBBBK',
      'KBBBFLLFBBBK',
      'KBBBFLLFBBBK',
      'KBBBBFFBBBBK',
      '.KBBBBBBBBK.',
      '.KBBBBBBBBK.',
      '..KBBBBBBK..',
      '...KBBBBK...',
      '....KKKK....',
    ],
    palette: { K: '#12233A', B: '#2F6FD0', W: '#9CC8FF', F: '#FF8A3D', L: '#FFD650' },
  },

  // Everything holds still.
  decay_freeze: {
    grid: [
      '.....KKK.....',
      '..K..KCK..K..',
      '..KK.KCK.KK..',
      '...KKKCKKK...',
      '....KCCCK....',
      'KKKKKCCCKKKKK',
      'KCCCCCWCCCCCK',
      'KKKKKCCCKKKKK',
      '....KCCCK....',
      '...KKKCKKK...',
      '..KK.KCK.KK..',
      '..K..KCK..K..',
      '.....KKK.....',
    ],
    palette: { K: '#17475E', C: '#9BE8FF', W: '#FFFFFF' },
  },
}

/** Grid aspect (height / width) for a privilege's drawing. */
export function powerAspect(id: PrivilegeId): number {
  return gridAspect(ART[id].grid)
}

/** The tone a power's UI should borrow — matches the dominant ink. */
export const POWER_TONE: Record<PrivilegeId, string> = {
  eren_says: '#5FE39A',
  double_hour: '#FFD650',
  point_steal: '#FF4D6D',
  streak_shield: '#4C8FEA',
  decay_freeze: '#9BE8FF',
}

export default memo(function PowerArt({ id, width = 40 }: {
  id: PrivilegeId; width?: number
}) {
  const art = ART[id]
  return (
    <div style={{
      width,
      height: width * gridAspect(art.grid),
      filter: `drop-shadow(0 0 4px ${POWER_TONE[id]}44) drop-shadow(0 1px 1px rgba(0,0,0,0.65))`,
    }}>
      <PixelGrid grid={art.grid} palette={art.palette} />
    </div>
  )
})
