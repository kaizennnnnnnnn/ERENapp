'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PIXEL ART ICONS — pure SVG, pixel-art style, no emojis
// Each icon is drawn on a 12x12 grid for consistency
// ═══════════════════════════════════════════════════════════════════════════════

interface IconProps {
  size?: number
  className?: string
}

const PX = 12 // grid size

// Helper: builds an SVG from a pixel grid
function drawPixels(grid: string[], palette: Record<string, string>, size: number) {
  const rects: React.ReactElement[] = []
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const ch = grid[y][x]
      const color = palette[ch]
      if (color && color !== 'transparent') {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={color} />)
      }
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${PX} ${PX}`} shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {rects}
    </svg>
  )
}

// ── HEART (happiness) ──
export function IconHeart({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.KK....KK...',
    'KPPKK.KPPK..',
    'KPPPPKPPPK..',
    'KPPPPPPPPK..',
    'KPPPWPPPPK..',
    '.KPPPPPPK...',
    '..KPPPPK....',
    '...KPPK.....',
    '....KK......',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#9B1D4A', P: '#FF5C94', W: '#FFB3CF',
  }, size)
}

// ── MEAT / HUNGER ──
export function IconMeat({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '......KK....',
    '.....KBBK...',
    '...KKBBBBK..',
    '..KBBBBBBBK.',
    '.KBRRRRRRBK.',
    '.KRRWWRRRRBK',
    '.KRRRRRRRRBK',
    '..KRRRRRRBK.',
    '...KKRRRBK..',
    '.....KKKK...',
    '............',
  ]
  return drawPixels(grid, {
    K: '#4A2818', B: '#8B5A2B', R: '#D4804A', W: '#F4B978',
  }, size)
}

// ── LIGHTNING (energy) ──
export function IconLightning({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '......KKK...',
    '.....KYYYK..',
    '....KYYYK...',
    '...KYYYK....',
    '..KYYYYYK...',
    '...KYYYYK...',
    '....KYYK....',
    '...KYYK.....',
    '..KYYK......',
    '..KYK.......',
    '..KK........',
  ]
  return drawPixels(grid, {
    K: '#8B6400', Y: '#FFD700',
  }, size)
}

// ── MOON (sleep) ──
export function IconMoon({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '....KKKK....',
    '..KKSSSSKK..',
    '..KSSSKKKK..',
    '.KSSSKK.....',
    '.KSSSK......',
    '.KSSSK......',
    '.KSSSKK.....',
    '..KSSSKKKK..',
    '..KKSSSSKK..',
    '....KKKK....',
    '............',
  ]
  return drawPixels(grid, {
    K: '#3B3A8E', S: '#A5B4FC',
  }, size)
}

// ── WATER DROP (cleanliness) ──
export function IconDrop({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.....KK.....',
    '.....BBK....',
    '....KBBBK...',
    '....KBBCBK..',
    '...KBBBBBBK.',
    '...KBBBBBBK.',
    '...KBBCCBBK.',
    '...KBBBBBBK.',
    '....KBBBBK..',
    '.....KKKK...',
    '............',
  ]
  return drawPixels(grid, {
    K: '#0C4A6E', B: '#38BDF8', C: '#BAE6FD',
  }, size)
}

// ── COIN ──
export function IconCoin({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '...KKKKKK...',
    '..KYYYYYYK..',
    '.KYLYYYYGK..',
    '.KYYYYYYYGK.',
    '.KYYKKKYYGK.',
    '.KYYKKYYYGK.',
    '.KYYKKKYYGK.',
    '.KYYYYYYYGK.',
    '.KYGGGGGGK..',
    '..KKKKKKK...',
    '............',
  ]
  return drawPixels(grid, {
    K: '#7A4F00', Y: '#FFD700', L: '#FFF4A3', G: '#C89800',
  }, size)
}

// ── GIFT BOX ──
export function IconGift({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '...KKK..KKK.',
    '..KPPK.KPPK.',
    '..KPPPKPPPK.',
    '.KKKKKKKKKK.',
    '.KRRRKKKRRK.',
    '.KRRRKKKRRK.',
    '.KRRRKKKRRK.',
    '.KRRRKKKRRK.',
    '.KKKKKKKKKK.',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#3B1D1D', R: '#FF5C94', P: '#FFD700',
  }, size)
}

// ── CAPSULE (gacha machine) ──
export function IconCapsule({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '...KKKKKK...',
    '..KPPPPPPK..',
    '.KPWPPPPPPK.',
    '.KPPPPPPPPK.',
    '.KKKKKKKKKK.',
    '.KVVVVVVVVK.',
    '.KVVWVVVVVK.',
    '.KVVVVVVVVK.',
    '.KKKKKKKKKK.',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#3B0D5E', P: '#FF6B9D', W: '#FFD6E5', V: '#A78BFA',
  }, size)
}

// ── BELL ──
export function IconBell({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.....KK.....',
    '....KYYK....',
    '...KYYYYK...',
    '...KYYYYK...',
    '..KYYYYYYK..',
    '..KYYYYYYK..',
    '.KYYYYYYYYK.',
    '.KKKKKKKKKK.',
    '.....KK.....',
    '.....KK.....',
    '............',
  ]
  return drawPixels(grid, {
    K: '#7A4F00', Y: '#FFD700',
  }, size)
}

// ── PERSON ──
export function IconPerson({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '....KKKK....',
    '...KSSSSK...',
    '...KSSSSK...',
    '...KSSSSK...',
    '....KKKK....',
    '..KKKKKKKK..',
    '.KPPPPPPPPK.',
    '.KPPPPPPPPK.',
    '.KPPPPPPPPK.',
    '.KKKKKKKKKK.',
    '............',
  ]
  return drawPixels(grid, {
    K: '#3B1D5E', S: '#F5C89A', P: '#A78BFA',
  }, size)
}

// ── DOOR ──
export function IconDoor({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..KKKKKKKK..',
    '.KBBBBBBBBK.',
    '.KBLLLLLLBK.',
    '.KBLLLLLLBK.',
    '.KBLLYLLLBK.',
    '.KBLLLLLLBK.',
    '.KBLLLLLLBK.',
    '.KBLLLLLLBK.',
    '.KBBBBBBBBK.',
    '.KKKKKKKKKK.',
    '............',
  ]
  return drawPixels(grid, {
    K: '#2A1F0C', B: '#6B3F1F', L: '#A87A4A', Y: '#FFD700',
  }, size)
}

// ── QUESTS (scroll) ──
export function IconScroll({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..KKKKKKKK..',
    '.KBBBBBBBBK.',
    '.KBWWWWWWBK.',
    '.KBWKKKWWBK.',
    '.KBWWWWWWBK.',
    '.KBWKKKKKBK.',
    '.KBWWWWWWBK.',
    '.KBWKKKWWBK.',
    '.KBBBBBBBBK.',
    '..KKKKKKKK..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#5B3A1F', B: '#C89060', W: '#FFF8E8',
  }, size)
}

// ── PHOTOS (image icon) ──
export function IconPhoto({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.KKKKKKKKKK.',
    '.KWWWWWWWWK.',
    '.KWWYYWWWWK.',
    '.KWYYYYWWWK.',
    '.KWWWWWGGWK.',
    '.KWWGGGGGGK.',
    '.KGGGGGGGGK.',
    '.KGGGGGGGGK.',
    '.KKKKKKKKKK.',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#1F1F2E', W: '#A0D8FF', Y: '#FFD700', G: '#4A9D4A',
  }, size)
}

// ── PAW PRINT ──
export function IconPaw({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..KK..KK.KK.',
    '.KPPK.KPK.PK',
    '.KPPKKPPK.KK',
    '..KK..KK....',
    '....KKKKK...',
    '...KPPPPPK..',
    '..KPPPPPPPK.',
    '..KPPPPPPPK.',
    '..KPPPPPPPK.',
    '...KKKKKKK..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#3B1D1D', P: '#FFB0C8',
  }, size)
}
