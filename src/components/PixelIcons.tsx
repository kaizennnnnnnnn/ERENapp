'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PIXEL ART ICONS — pure SVG, pixel-art style, no emojis
// Each icon is drawn on a 12x12 grid for consistency
// ═══════════════════════════════════════════════════════════════════════════════

interface IconProps {
  size?: number
}

const PX = 12

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

// ── HEART (happiness) ──────────────────────────────────────────────────────
export function IconHeart({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..KKK..KKK..',
    '.KPPPKKPPPK.',
    'KPPPPPPPPPK.',
    'KPWPPPPPPPK.',
    'KPPPPPPPPPK.',
    '.KPPPPPPPK..',
    '..KPPPPPK...',
    '...KPPPK....',
    '....KPK.....',
    '.....K......',
    '............',
  ]
  return drawPixels(grid, {
    K: '#8B1538', P: '#FF4D7D', W: '#FFC0D0',
  }, size)
}

// ── DRUMSTICK (hunger) ─────────────────────────────────────────────────────
export function IconMeat({ size = 20 }: IconProps) {
  const grid = [
    '...KKKK.....',
    '..KBBBBK....',
    '..KBLBBK....',
    '..KBBBBK....',
    '...KKBK.....',
    '....KBK.....',
    '...KMMMK....',
    '..KRRRRRK...',
    '.KRRRRRRRK..',
    '.KRRRRRRRK..',
    '..KRRRRRK...',
    '...KKKKK....',
  ]
  return drawPixels(grid, {
    K: '#3A2010', B: '#F5E6C8', L: '#FFFAEB', M: '#6B3410', R: '#C8733A',
  }, size)
}

// ── LIGHTNING (energy) ─────────────────────────────────────────────────────
export function IconLightning({ size = 20 }: IconProps) {
  const grid = [
    '......KKK...',
    '.....KYYYK..',
    '....KYYYK...',
    '...KYYYYK...',
    '..KYYYYYK...',
    '.KYYYYYKKK..',
    '.KYYYKKK....',
    '..KYYK......',
    '..KYK.......',
    '.KYK........',
    '.KK.........',
    '............',
  ]
  return drawPixels(grid, {
    K: '#8B6400', Y: '#FFD700',
  }, size)
}

// ── MOON (sleep) ───────────────────────────────────────────────────────────
export function IconMoon({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '....KKKK....',
    '..KKSSSSK...',
    '.KSSSKKKK...',
    '.KSSSK......',
    '.KSSSK......',
    '.KSSSK......',
    '.KSSSKKKK...',
    '..KSSSSSK...',
    '...KKKKK....',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#312E81', S: '#C4B5FD',
  }, size)
}

// ── WATER DROP (cleanliness) ───────────────────────────────────────────────
export function IconDrop({ size = 20 }: IconProps) {
  const grid = [
    '.....K......',
    '.....K......',
    '....KBK.....',
    '....KBK.....',
    '...KBBBK....',
    '..KBBCBBK...',
    '..KBBBBBK...',
    '.KBBBBBBBK..',
    '.KBBCCBBBK..',
    '.KBBBBBBBK..',
    '..KKKKKKK...',
    '............',
  ]
  return drawPixels(grid, {
    K: '#075985', B: '#38BDF8', C: '#E0F7FF',
  }, size)
}

// ── COIN ───────────────────────────────────────────────────────────────────
export function IconCoin({ size = 20 }: IconProps) {
  const grid = [
    '...KKKKKK...',
    '..KYLLLLYK..',
    '.KYLLYYLYGK.',
    'KYLLYYYLYYGK',
    'KYLYYYYYYGGK',
    'KYYYYKYYYYGK',
    'KYYYYYYYYYGK',
    'KYGGGGGGGGGK',
    '.KGGGGGGGGK.',
    '..KGGGGGGGK.',
    '...KKKKKK...',
    '............',
  ]
  return drawPixels(grid, {
    K: '#7A4F00', Y: '#FFD700', L: '#FFF4A3', G: '#B88400',
  }, size)
}

// ── GIFT BOX ───────────────────────────────────────────────────────────────
export function IconGift({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..K.K..K.K..',
    '..PKPPPPKP..',
    '..KPPPPPPK..',
    '.KKKKRKKKKK.',
    '.KBBBRBBBBK.',
    '.KBBBRBBBBK.',
    '.KRRRKRRRRK.',
    '.KBBBRBBBBK.',
    '.KBBBRBBBBK.',
    '.KKKKKKKKKK.',
    '............',
  ]
  return drawPixels(grid, {
    K: '#2A1040', B: '#A78BFA', P: '#FFD700', R: '#FF4D7D',
  }, size)
}

// ── CAPSULE / GACHA ────────────────────────────────────────────────────────
export function IconCapsule({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..KKKKKKKK..',
    '.KPPPPPPPPK.',
    'KPPWWPPPPPPK',
    'KPPPPPPPPPPK',
    'KPPPPPPPPPPK',
    'KKKKKKKKKKKK',
    'KVVVVVVVVVVK',
    'KVVVVVVVWWVK',
    'KVVVVVVVVVVK',
    '.KVVVVVVVVK.',
    '..KKKKKKKK..',
  ]
  return drawPixels(grid, {
    K: '#1F0D40', P: '#FF6B9D', W: '#FFFFFF', V: '#A78BFA',
  }, size)
}

// ── BELL ───────────────────────────────────────────────────────────────────
export function IconBell({ size = 20 }: IconProps) {
  const grid = [
    '.....KK.....',
    '.....KK.....',
    '....KYYK....',
    '...KYYYYK...',
    '..KYYYYYYK..',
    '.KYYYYYYYYK.',
    '.KYYYYYYYYK.',
    '.KYYYYYYYYK.',
    'KYYYYYYYYYYK',
    'KKKKKKKKKKKK',
    '....KKKK....',
    '.....KK.....',
  ]
  return drawPixels(grid, {
    K: '#7A4F00', Y: '#FFD700',
  }, size)
}

// ── PERSON ─────────────────────────────────────────────────────────────────
export function IconPerson({ size = 20 }: IconProps) {
  const grid = [
    '....KKKK....',
    '...KSSSSK...',
    '...KSSSSK...',
    '...KSSSSK...',
    '....KKKK....',
    '.....KK.....',
    '...KKKKKK...',
    '..KPPPPPPK..',
    '.KPPPPPPPPK.',
    '.KPPPPPPPPK.',
    '.KPPPPPPPPK.',
    '.KK......KK.',
  ]
  return drawPixels(grid, {
    K: '#2A1040', S: '#F5C89A', P: '#A78BFA',
  }, size)
}

// ── DOOR ───────────────────────────────────────────────────────────────────
export function IconDoor({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.KKKKKKKKKK.',
    '.KBBBBBBBBK.',
    '.KBWWWWWWBK.',
    '.KBWKWWWWBK.',
    '.KBWWWWWWBK.',
    '.KBWWWWWYBK.',
    '.KBWWWWWYBK.',
    '.KBWWWWWWBK.',
    '.KBWWWWWWBK.',
    '.KBBBBBBBBK.',
    '.KKKKKKKKKK.',
  ]
  return drawPixels(grid, {
    K: '#1A1000', B: '#5A3000', W: '#B88440', Y: '#FFD700',
  }, size)
}

// ── QUESTS (scroll) ────────────────────────────────────────────────────────
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

// ── PHOTOS ─────────────────────────────────────────────────────────────────
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

// ── PAW ────────────────────────────────────────────────────────────────────
export function IconPaw({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..KK..KK....',
    '.KPPK.KPK...',
    '.KPPKKPPK...',
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
