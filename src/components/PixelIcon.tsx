'use client'

// ─── Tiny pixel icons (8×8 grid, each pixel = `size` px) ────────────────────
// Used to replace emoji throughout the app

type IconName =
  | 'heart'     // happiness
  | 'food'      // hunger / feed
  | 'lightning' // energy
  | 'zzz'       // sleep
  | 'paw'       // paw / pet
  | 'yarn'      // play / yarn
  | 'fish'      // paw tap game
  | 'mouse'     // catch mouse game
  | 'broom'     // clean litter
  | 'pill'      // medicine
  | 'brush'     // brush
  | 'sparkle'   // happy
  | 'bell'      // reminder
  | 'good'      // mood: good
  | 'mid'       // mood: mid
  | 'sad'       // mood: sad
  | 'angry'     // mood: angry
  | 'tired'     // mood: tired
  | 'camera'    // memories
  | 'trophy'    // high score
  | 'droplet'   // wash / cleanliness

// Each icon is an 8×8 array of color strings or '.' for transparent
const ICONS: Record<IconName, { grid: string[]; colors: Record<string, string> }> = {

  heart: {
    colors: { H: '#FF6B9D', D: '#CC3366', '.': 'transparent' },
    grid: [
      '..HH.HH.',
      '.HHHHHH.',
      '.HHHHHH.',
      '.HHHHHH.',
      '..HHHH..',
      '...HH...',
      '....H...',
      '........',
    ],
  },

  food: {
    colors: { B: '#D4892A', Y: '#F5C842', W: '#FFFFFF', R: '#CC3333', '.': 'transparent' },
    grid: [
      '...RR...',
      '..RRRR..',
      '.BBBBBB.',
      '.BYYBYB.',
      '.BBBBBBB',
      '.BYBYBBB',
      '..BBBBB.',
      '........',
    ],
  },

  lightning: {
    colors: { Y: '#F5C842', O: '#E8A020', '.': 'transparent' },
    grid: [
      '...YYY..',
      '..YYYY..',
      '.YYYYY..',
      '..YYYY..',
      '...YYYY.',
      '....YYY.',
      '.....YY.',
      '........',
    ],
  },

  zzz: {
    colors: { B: '#A78BFA', L: '#C4B5FD', '.': 'transparent' },
    grid: [
      '........',
      '..BBB...',
      '...BB...',
      '..BBB...',
      '....BBB.',
      '.....BB.',
      '....BBB.',
      '........',
    ],
  },

  paw: {
    colors: { P: '#9B7A5C', L: '#C4A882', '.': 'transparent' },
    grid: [
      '.PP.PP..',
      '.PP.PP..',
      '........',
      '.PPPPPP.',
      'PPPPPPPP',
      'PPPPPPPP',
      '.PPPPPP.',
      '..PPPP..',
    ],
  },

  yarn: {
    colors: { P: '#FF6B9D', D: '#CC3366', W: '#FFD6E7', '.': 'transparent' },
    grid: [
      '..PPPP..',
      '.PPWPPP.',
      'PPWPPWPP',
      'PPPPPPPP',
      'PWPPWPPP',
      '.PPWPPP.',
      '..PPPP..',
      '........',
    ],
  },

  fish: {
    colors: { B: '#6BAED6', L: '#9ECAE1', O: '#F48B9B', W: '#FFFFFF', '.': 'transparent' },
    grid: [
      '........',
      'B..BBBB.',
      'BBBLLLBB',
      'BBBWLBBB',
      'BBBLLLBB',
      'B..BBBB.',
      '........',
      '........',
    ],
  },

  mouse: {
    colors: { G: '#9B9B9B', L: '#C8C8C8', P: '#F48B9B', E: '#333333', '.': 'transparent' },
    grid: [
      '.GG.GG..',
      'GGGGGGGG',
      'GGLPLLGG',
      'GGLLLLGG',
      'GGGGGGGG',
      '.GGGGGG.',
      '..GGGG..',
      '....GGG.',
    ],
  },

  broom: {
    colors: { B: '#9B7A5C', Y: '#F5C842', G: '#6BAB6B', '.': 'transparent' },
    grid: [
      '.......B',
      '......BB',
      '.....BB.',
      '....BB..',
      '...GBG..',
      '..GGGGG.',
      '.GGGGGGG',
      'GGGGGGGG',
    ],
  },

  pill: {
    colors: { R: '#FF6B9D', W: '#FFFFFF', G: '#6BAB6B', '.': 'transparent' },
    grid: [
      '..RRRR..',
      '.RRRRRR.',
      'RRRRWWWW',
      'RRRRWWWW',
      'RRRRWWWW',
      'RRRRWWWW',
      '.RRRWWW.',
      '..RRRR..',
    ],
  },

  brush: {
    colors: { P: '#A78BFA', S: '#6B5E9B', W: '#FFFFFF', Y: '#F5C842', '.': 'transparent' },
    grid: [
      '.......P',
      '......PP',
      '.....PP.',
      '....PP..',
      '...PPP..',
      '..PPPP..',
      '.YYYYY..',
      'YYYYYYY.',
    ],
  },

  sparkle: {
    colors: { Y: '#F5C842', W: '#FFFFFF', '.': 'transparent' },
    grid: [
      '...Y....',
      '...Y....',
      'YYYYYYY.',
      '...Y....',
      '..YYY...',
      '.Y...Y..',
      'Y.....Y.',
      '........',
    ],
  },

  bell: {
    colors: { Y: '#F5C842', O: '#E8A020', '.': 'transparent' },
    grid: [
      '...YY...',
      '..YYYY..',
      '.YYYYYY.',
      '.YYYYYY.',
      'YYYYYYYY',
      '........',
      '..YYYY..',
      '...YY...',
    ],
  },

  good: {
    colors: { Y: '#F5C842', E: '#333333', P: '#F48B9B', '.': 'transparent' },
    grid: [
      '.YYYYYY.',
      'YYYYYYYY',
      'YE.YY.EY',
      'YYYYYYYY',
      'YP....PY',
      'Y.PPPP.Y',
      'YYYYYYYY',
      '.YYYYYY.',
    ],
  },

  mid: {
    colors: { Y: '#F5C842', E: '#333333', '.': 'transparent' },
    grid: [
      '.YYYYYY.',
      'YYYYYYYY',
      'YE.YY.EY',
      'YYYYYYYY',
      'Y......Y',
      'YEEEEEY.',
      'YYYYYYYY',
      '.YYYYYY.',
    ],
  },

  sad: {
    colors: { B: '#6BAED6', E: '#333333', P: '#F48B9B', T: '#9ECAE1', '.': 'transparent' },
    grid: [
      '.BBBBBB.',
      'BBBBBBBB',
      'BE.BB.EB',
      'BBBBBBBB',
      'B.BBBB.B',
      'BBEEEEBB',
      'BBBBBBBB',
      '.BBBBBB.',
    ],
  },

  angry: {
    colors: { R: '#FF6B4A', E: '#333333', '.': 'transparent' },
    grid: [
      'R......R',
      '.RRRRRR.',
      'RE.RR.ER',
      'RRRRRRRR',
      'RREEEERR',
      'RRRRRRRR',
      '.RRRRRR.',
      '........',
    ],
  },

  tired: {
    colors: { P: '#A78BFA', E: '#333333', '.': 'transparent' },
    grid: [
      '.PPPPPP.',
      'PPPPPPPP',
      'PEEPPEP.',
      'PPPPPPPP',
      'PP....PP',
      'PPPPPPPP',
      '.PPPPPP.',
      '........',
    ],
  },

  camera: {
    colors: { B: '#1F1F2E', L: '#4A4A6E', W: '#FFFFFF', G: '#6BAED6', '.': 'transparent' },
    grid: [
      '.BBBBB..',
      'BBBBBBBB',
      'B.GGGG.B',
      'B.GWWG.B',
      'B.GGGG.B',
      'BBBBBBBB',
      '........',
      '........',
    ],
  },

  trophy: {
    colors: { Y: '#F5C842', O: '#E8A020', B: '#9B7A5C', '.': 'transparent' },
    grid: [
      'YYYYYYYB',
      'YYYYYYYY',
      'YYYYYYYY',
      '.YYYYYY.',
      '..YYYY..',
      '...YY...',
      '..BBBB..',
      '.BBBBBB.',
    ],
  },

  droplet: {
    colors: { B: '#6BAED6', L: '#9ECAE1', W: '#FFFFFF', '.': 'transparent' },
    grid: [
      '...BB...',
      '..BBBB..',
      '.BBBBBB.',
      'BBBWBBBB',
      'BBLWLBBB',
      'BBBBBBBB',
      '.BBBBBB.',
      '..BBBB..',
    ],
  },
}

interface Props {
  icon: IconName
  size?: number   // px per pixel, default 4
  className?: string
}

export default function PixelIcon({ icon, size = 4, className = '' }: Props) {
  const def = ICONS[icon]
  if (!def) return null
  const { grid, colors } = def

  return (
    <div
      className={`inline-block pixel-art select-none ${className}`}
      style={{ lineHeight: 0 }}
      aria-hidden="true"
    >
      {grid.map((row, y) => (
        <div key={y} style={{ display: 'flex' }}>
          {row.split('').map((char, x) => (
            <div
              key={x}
              style={{
                width: size,
                height: size,
                backgroundColor: colors[char] ?? 'transparent',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
