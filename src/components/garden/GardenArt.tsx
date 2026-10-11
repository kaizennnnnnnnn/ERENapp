'use client'

// The garden's pixel art: the three flowers (each recoloured per bloom colour),
// a sprout and a bud for the days in between, the raised bed they grow in, and
// a butterfly. Flat Meadow pixels, no outlines, like the rest of the set; the
// flowers are 16x16 because they are the thing you came to look at.

import { memo, type CSSProperties } from 'react'
import { colourOf, type Species, type Stage } from '@/lib/garden'

type Pal = Record<string, string>

/** One <rect> per horizontal run, like MeadowIcon. */
const Pix = memo(function Pix({ grid, pal, size, style }: { grid: string[]; pal: Pal; size: number; style?: CSSProperties }) {
  const w = grid[0].length
  const h = grid.length
  const rects: JSX.Element[] = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let e = x + 1
      while (e < row.length && row[e] === ch) e++
      if (pal[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={e - x} height={1} fill={pal[ch]} />)
      x = e
    }
  })
  return (
    <svg aria-hidden width={size} height={(size * h) / w} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges"
      style={{ display: 'block', overflow: 'visible', ...style }}>
      {rects}
    </svg>
  )
})

const LEAF = { G: '#3F8452', g: '#8DBF8E' }

const FLOWER_GRID: Record<Species, string[]> = {
  daisy: [
    '.......WW.......',
    '...WW..WW..WW...',
    '...WWW.WW.WWW...',
    '....WWWWWWWW....',
    '.WWWWWYYYYWWWWW.',
    '.wwWWYYYyYYWWww.',
    '....wWYyyYWw....',
    '...wwwWYYWwww...',
    '...ww..GG..ww...',
    '.......GG.......',
    '..gg...GG.......',
    '..gGG..GG...gg..',
    '...gGG.GG..GGg..',
    '....GGGGGGGGg...',
    '.......GG.......',
    '.......GG.......',
  ],
  tulip: [
    '................',
    '....P..PP..P....',
    '....PP.PP.PP....',
    '....PPPPPPPP....',
    '....PlPPPPPp....',
    '....PlPPPPpp....',
    '....PPPPPPpp....',
    '.....PPPPpp.....',
    '......pppp......',
    '.......GG.......',
    '.......GG..gg...',
    '..gg...GG.gGG...',
    '..GGg..GGgGG....',
    '...GGg.GGGG.....',
    '....GGGGGG......',
    '.......GG.......',
  ],
  sunflower: [
    '......Y..Y......',
    '...Y.YYYYYY.Y...',
    '...YYyyyyyyYY...',
    '.YYyyBBBBBByyYY.',
    '..YyBBbBBbBByY..',
    '.YYyBBBBBBBByYY.',
    '.YYyBbBBBBbByYY.',
    '..YyBBBBBBBByY..',
    '.YYyyBBBBBByyYY.',
    '...YYyyyyyyYY...',
    '...Y.YYGGYY.Y...',
    '..ggg..GG..ggg..',
    '.gGGGg.GG.gGGGg.',
    '..gGGGgGGgGGGg..',
    '....GGGGGGGG....',
    '.......GG.......',
  ],
}

const SPROUT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....gg..gg.....',
  '....gGGg.GGg....',
  '.....gGGGGg.....',
  '.......GG.......',
  '.......GG.......',
  '.......GG.......',
  '.......GG.......',
  '.......GG.......',
]

const BUD: Record<Species, string[]> = {
  daisy: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......ww.......',
    '......wGGw......',
    '......GGGG......',
    '.......GG.......',
    '.......GG.......',
    '..gg...GG.......',
    '..gGG..GG...gg..',
    '...gGG.GG..GGg..',
    '....GGGGGGGGg...',
    '.......GG.......',
    '.......GG.......',
  ],
  tulip: [
    '................',
    '................',
    '................',
    '.......gg.......',
    '......gGGg......',
    '.....gGGGGg.....',
    '.....GGGGGG.....',
    '......GGGG......',
    '.......GG.......',
    '.......GG.......',
    '.......GG..gg...',
    '..gg...GG.gGG...',
    '..GGg..GGgGG....',
    '...GGg.GGGG.....',
    '....GGGGGG......',
    '.......GG.......',
  ],
  sunflower: [
    '................',
    '................',
    '.....g.gg.g.....',
    '....gGGGGGGg....',
    '...gGGgGGgGGg...',
    '...GGGGGGGGGG...',
    '...gGGgGGgGGg...',
    '....GGGGGGGG....',
    '......GGGG......',
    '.......GG.......',
    '...ggg.GG.ggg...',
    '..gGGGgGG.gGGGg.',
    '...gGGGGGgGGGg..',
    '....GGGGGGGG....',
    '.......GG.......',
    '.......GG.......',
  ],
}

/** A flower in full bloom, in one of its colours. */
export function Flower({ species, colour, size, style }: { species: Species; colour: string | null; size: number; style?: CSSProperties }) {
  return <Pix grid={FLOWER_GRID[species]} pal={{ ...LEAF, ...colourOf(species, colour).pal }} size={size} style={style} />
}

/** A flower not grown yet, for the book: its shape, in one flat grey. */
export function GhostFlower({ species, size }: { species: Species; size: number }) {
  const grey = '#E3DED6'
  const pal = Object.fromEntries('WwYyPplBbGg'.split('').map(ch => [ch, grey]))
  return <Pix grid={FLOWER_GRID[species]} pal={pal} size={size} />
}

/** Whatever is in a bed right now: nothing yet, a sprout, a bud, or the flower. */
export function Plant({ species, stage, colour, size }: { species: Species; stage: Stage; colour: string | null; size: number }) {
  if (stage === 'bloom') return <Flower species={species} colour={colour} size={size} />
  if (stage === 'bud') return <Pix grid={BUD[species]} pal={{ ...LEAF, w: '#F4F2EE' }} size={size} />
  if (stage === 'sprout') return <Pix grid={SPROUT} pal={LEAF} size={size} />
  return null
}

// ── The raised bed ───────────────────────────────────────────────────────────

const BED = [
  '..................................',
  '..dddddddddddddddddddddddddddddd..',
  '.dsSsSsssSsSssSsSsssSsSssSsSsssSd.',
  '.dSsSssSsSssSsssSsSsSssSsssSsSsSd.',
  'aAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAa',
  'aBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBa',
  'aBkBBBBBBBBBBBBBBBBBBBBBBBBBBBBkBa',
  'aBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBa',
  'acccccccccccccccccccccccccccccccca',
  'aBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBa',
  'aBkBBBBBBBBBBBBBBBBBBBBBBBBBBBBkBa',
  'aBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBa',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '.oooooooooooooooooooooooooooooooo.',
]

const BED_PAL: Pal = {
  d: '#6B4A33', S: '#7A5640', s: '#5E4130',          // soil
  A: '#E9C79A', a: '#9C6A45', B: '#D8AE7C', c: '#B98A5B', k: '#8A6040',  // planks
  o: 'rgba(60, 90, 40, 0.25)',                       // its shadow on the lawn
}
const BED_WET: Pal = { ...BED_PAL, S: '#5A3E2C', s: '#47301F', d: '#4E3424' }

/** The planter box. `wet` darkens the soil: it was watered today. */
export function Bed({ width, wet }: { width: number; wet?: boolean }) {
  return <Pix grid={BED} pal={wet ? BED_WET : BED_PAL} size={width} />
}

// ── A butterfly ──────────────────────────────────────────────────────────────

const BUTTERFLY = [
  'WW...WW',
  'WWW.WWW',
  'WwWkWwW',
  '.WWkWW.',
  '.Ww.wW.',
]

export function Butterfly({ size, tone }: { size: number; tone: string }) {
  return <Pix grid={BUTTERFLY} pal={{ W: tone, w: '#FFFFFF', k: '#2F2B28' }} size={size} />
}
