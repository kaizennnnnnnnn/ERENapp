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

// ── TREASURE CHEST (gacha / capsule) ──────────────────────────────────────
export function IconCapsule({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..KKKKKKKK..',
    '.KDDDDDDDDK.',
    '.KDMMMMMMDK.',
    '.KDMSSSSMDK.',
    'KKKKKKYYKKKK',
    'KDDDDDYYDDDK',
    'KDMSSSYYSSMK',
    'KDMSSSSSSSMK',
    'KDMMMMMMMMDK',
    'KDDDDDDDDDDK',
    'KKKKKKKKKKKK',
  ]
  return drawPixels(grid, {
    K: '#2A1005', D: '#8B4513', M: '#B87830', S: '#6B3410', Y: '#FFD700',
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
    '...KKKKKK...',
    '..KDDDDDDK..',
    '.KDMMMMMMDK.',
    'KDMLLLLLLMDK',
    'KDMLSSSSLMDK',
    'KDMLSSSSLMDK',
    'KDMLLLLLLMDK',
    'KDMLSSSSLMDK',
    'KDMLSSSSLYDK',
    'KDMLLLLLLMDK',
    'KDDDDDDDDDDK',
    'KKKKKKKKKKKK',
  ]
  return drawPixels(grid, {
    K: '#1A0A00', D: '#4A2008', M: '#8B4513', L: '#B87830', S: '#6B3410', Y: '#FFD700',
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

// ── CROWN (winner) ─────────────────────────────────────────────────────────
export function IconCrown({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.K...K....K.',
    '.KRK.KRK.KRK',
    'KRRKKKRKKKRK',
    'KYYYYYYYYYYK',
    'KYYBYYPYYBYK',
    'KYYYYYYYYYYK',
    'KYYYYYYYYYYK',
    'KKKKKKKKKKKK',
    'KLYLYLYLYLYK',
    'KKKKKKKKKKKK',
    '............',
  ]
  return drawPixels(grid, {
    K: '#6B3F00', Y: '#FFD700', L: '#FFEC80', R: '#FF6B6B', B: '#38BDF8', P: '#FF4D7D',
  }, size)
}

// ── SWORDS (care battle) ───────────────────────────────────────────────────
export function IconSwords({ size = 20 }: IconProps) {
  const grid = [
    '..K......K..',
    '.KWK....KWK.',
    '.KWWK..KWWK.',
    '..KWWK.KWWK.',
    '...KWWKWWK..',
    '....KWKWK...',
    '....KGWGK...',
    '...KGKKKGK..',
    '..KYGKKKYGK.',
    '.KYYKKKKKYYK',
    '..KKKGKGKK..',
    '....KG.GK...',
  ]
  return drawPixels(grid, {
    K: '#1F1F2A', W: '#D8DFE8', Y: '#E89A3A', G: '#6B3410',
  }, size)
}

// ── HOUSE (cozy home / invite) ────────────────────────────────────────────
export function IconHouse({ size = 20 }: IconProps) {
  const grid = [
    '.....RR.....',
    '....RRRR....',
    '...RRRRRR...',
    '..RRRRRRRR..',
    '.RRRRRRRRRR.',
    'KKKKKKKKKKKK',
    'KBBBWWBBBBBK',
    'KBBBWWBBYYBK',
    'KBBBBBBBYYBK',
    'KBBBBBBBBBBK',
    'KBBBBBBBBBBK',
    'KKKKKKKKKKKK',
  ]
  return drawPixels(grid, {
    K: '#3A1A0A', R: '#D85040', B: '#F2C893', W: '#6BAED6', Y: '#5A3A1A',
  }, size)
}

// ── DRESS (fashion) ────────────────────────────────────────────────────────
export function IconDress({ size = 20 }: IconProps) {
  const grid = [
    '...KKKKKK...',
    '..KBBBBBBK..',
    '..KBBWBBBK..',
    '...KBBBBK...',
    '...KBBBBK...',
    '..KBBBBBBK..',
    '..KBBBBBBK..',
    '.KBBBBBBBBK.',
    'KBBBBBBBBBBK',
    'KBBBLBBBBBBK',
    'KBBBBBLBBBBK',
    'KKKKKKKKKKKK',
  ]
  return drawPixels(grid, {
    K: '#1E3A8A', B: '#3B82F6', W: '#FFFFFF', L: '#93C5FD',
  }, size)
}

// ── BOOK (collection / serbian class) ─────────────────────────────────────
export function IconBook({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.KKKKKKKKKK.',
    '.KRRRKRRRRK.',
    '.KRLRKRLLRK.',
    '.KRRRKRRRRK.',
    '.KRLLKLLLRK.',
    '.KRRRKRRRRK.',
    '.KRLRKRLRRK.',
    '.KRRRKRRRRK.',
    '.KKKKKKKKKK.',
    '.KBBBBBBBBK.',
    '............',
  ]
  return drawPixels(grid, {
    K: '#4A1C05', R: '#C8491F', L: '#FFE8C8', B: '#7A3010',
  }, size)
}

// ── TICKET (gacha ticket) ─────────────────────────────────────────────────
export function IconTicket({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '............',
    'KKKKKKKKKKKK',
    'KPPKPPPPPPPK',
    'KPPKPPWWPPPK',
    'KPPKPWWWWPPK',
    'KPPKPPWWPPPK',
    'KPPKPPPPPPPK',
    'KKKKKKKKKKKK',
    '............',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#991A4A', P: '#FF6B9D', W: '#FFF3B8',
  }, size)
}

// ── CLOCK (time) ──────────────────────────────────────────────────────────
export function IconClock({ size = 20 }: IconProps) {
  const grid = [
    '...KKKKKK...',
    '..KFFFFFFK..',
    '.KFYFFFFYFK.',
    '.KFFFKFFFFK.',
    'KFFFFKFFFFFK',
    'KFFFFKHHHFFK',
    'KFFFFFFFFFFK',
    'KFYFFFFFFYFK',
    '.KFFFFFFFFK.',
    '.KFYFFFFYFK.',
    '..KFFFFFFK..',
    '...KKKKKK...',
  ]
  return drawPixels(grid, {
    K: '#7A4F00', F: '#FFF3B8', Y: '#C89000', H: '#C02020',
  }, size)
}

// ── STAR ──────────────────────────────────────────────────────────────────
export function IconStar({ size = 20 }: IconProps) {
  const grid = [
    '.....KK.....',
    '....KYYK....',
    '....KYYK....',
    '....KYYK....',
    'KKKKKYYKKKKK',
    'KYYYYLLYYYYK',
    '.KYYYYYYYYK.',
    '..KYYYYYYK..',
    '..KYYKKYYK..',
    '.KYYK..KYYK.',
    '.KK......KK.',
    '............',
  ]
  return drawPixels(grid, {
    K: '#7A4F00', Y: '#FFD700', L: '#FFF8C8',
  }, size)
}

// ── SPARKLES (stardust) ───────────────────────────────────────────────────
export function IconSparkles({ size = 20 }: IconProps) {
  const grid = [
    '...K........',
    '...YK.......',
    '..KYYK.K....',
    '.KYLYYKYK...',
    'KYYLLYYYYK..',
    '.KYYLYYYK...',
    '..KYYYYK..K.',
    '...KYYK..YK.',
    '...KYK..YLK.',
    '....K..KYYK.',
    '........KK..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#7A4FC0', Y: '#C4B5FD', L: '#FFFFFF',
  }, size)
}

// ── CONTROLLER (games chip) ───────────────────────────────────────────────
export function IconController({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '............',
    '..KKKKKKKK..',
    '.KPPPPPPPPK.',
    'KPPWKPPPPPPK',
    'KPWWWKPPBPPK',
    'KPPWKPRPBPPK',
    'KPPPPPPPBBPK',
    'KPPPPPPRPPPK',
    '.KKKKKKKKKK.',
    '..KK....KK..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#2A1040', P: '#A78BFA', W: '#FFFFFF', R: '#FF4D7D', B: '#38BDF8',
  }, size)
}

// ── SLOT MACHINE (gacha chip) ─────────────────────────────────────────────
export function IconSlots({ size = 20 }: IconProps) {
  const grid = [
    '.....KK.....',
    '.....KK.....',
    '..KKKKKKKK..',
    '.KRRRRRRRRK.',
    '.KWKWKWKWWK.',
    '.KWYWPWBWWK.',
    '.KWKWKWKWWK.',
    'KKRRRRRRRRKK',
    'KYKKKKKKKKYK',
    'KYYYYYYYYYYK',
    '.KKKKKKKKKK.',
    '............',
  ]
  return drawPixels(grid, {
    K: '#2A1040', R: '#FF4D7D', W: '#FFFFFF', Y: '#FFD700', P: '#A78BFA', B: '#38BDF8',
  }, size)
}

// ── ENVELOPE (journal / message) ──────────────────────────────────────────
export function IconEnvelope({ size = 20 }: IconProps) {
  const grid = [
    '............',
    'KKKKKKKKKKKK',
    'KWWWWWWWWWWK',
    'KWKWWWWWWKWK',
    'KWWKWWWWKWWK',
    'KWWWKWWKWWWK',
    'KWWWWKKWWWWK',
    'KWWWWWWWWWWK',
    'KWW.HHHH.WWK',
    'KWW.HHHH.WWK',
    'KKKKKKKKKKKK',
    '............',
  ]
  return drawPixels(grid, {
    K: '#5A1A3A', W: '#FFE0F0', H: '#FF4D7D',
  }, size)
}

// ── CAT FACE ──────────────────────────────────────────────────────────────
export function IconCatFace({ size = 20 }: IconProps) {
  const grid = [
    '.KK......KK.',
    'KDDK....KDDK',
    'KDDDKKKKDDDK',
    'KCCCCCCCCCCK',
    'KCCMCCCCMCCK',
    'KCCCCCCCCCCK',
    'KCKCCCCCCKCK',
    'KCCCCPPCCCCK',
    'KCCCKPPKCCCK',
    '.KCCCCCCCCK.',
    '..KCCCCCCK..',
    '...KKKKKK...',
  ]
  return drawPixels(grid, {
    K: '#2A1A3A', C: '#F5E6D3', D: '#D4B896', M: '#6BAED6', P: '#F48B9B',
  }, size)
}

// ── PENCIL (edit) ─────────────────────────────────────────────────────────
export function IconPencil({ size = 20 }: IconProps) {
  const grid = [
    '..........K.',
    '.........KPK',
    '........KPYK',
    '.......KYYK.',
    '......KBBK..',
    '.....KBBK...',
    '....KBBK....',
    '...KBBK.....',
    '..KBBK......',
    '.KWWK.......',
    'KKWK........',
    '.K..........',
  ]
  return drawPixels(grid, {
    K: '#2A2A2A', P: '#FF9AC0', Y: '#FFD700', B: '#F5C842', W: '#3A3A3A',
  }, size)
}

// ── MOUSE (game) ──────────────────────────────────────────────────────────
export function IconMouse({ size = 20 }: IconProps) {
  const grid = [
    '.KK.....KK..',
    'KPPK...KPPK.',
    'KPPPK.KPPPK.',
    'KGGKKKKGGK..',
    'KGGGGGGGGK..',
    'KGLGGGGLGK..',
    'KGGGNNGGGK..',
    '.KGGGGGGGK..',
    '..KGGGGGGGK.',
    '...KKGGGGGGK',
    '......KKKKGK',
    '..........K.',
  ]
  return drawPixels(grid, {
    K: '#2A2A2A', G: '#B0B0B0', L: '#2A2A2A', N: '#F48B9B', P: '#FFB0C8',
  }, size)
}

// ── YARN BALL ─────────────────────────────────────────────────────────────
export function IconYarn({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '...KKKKKK...',
    '..KPPPPPPK..',
    '.KPLPPPPPPK.',
    'KPLPPDPPPPPK',
    'KPPPDPPPDPPK',
    'KPDPPPPDPPPK',
    'KPPPPDPPPDPK',
    'KPPDPPPPPPPK',
    '.KPPPPDPPPK.',
    '..KPPPPPPK..',
    '...KKKKKK...',
  ]
  return drawPixels(grid, {
    K: '#991A4A', P: '#FF6B9D', D: '#CC3366', L: '#FFC8D8',
  }, size)
}

// ── FISH ──────────────────────────────────────────────────────────────────
export function IconFish({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '........KK..',
    '...KKKKKBBK.',
    '..KBBBBLBBKK',
    '.KBLLBLBBBBK',
    'KBLWLBBBBBBK',
    'KBLLBBBBBBBK',
    '.KBBBBBBBBKK',
    '..KKKKKKBBK.',
    '........KK..',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#0A5A80', B: '#6BAED6', L: '#A0D8FF', W: '#1A1A1A',
  }, size)
}

// ── BATHTUB (bathroom) ────────────────────────────────────────────────────
export function IconBath({ size = 20 }: IconProps) {
  const grid = [
    '.W....W.....',
    'W.W..W.W....',
    '.W....W.....',
    '............',
    'KKKKKKKKKKKK',
    'KWWWWWWWWWWK',
    'KWBBBBBBBBWK',
    'KWBBBBBBBBWK',
    'KWBBBBBBBBWK',
    'KWWWWWWWWWWK',
    'KKKKKKKKKKKK',
    '.K........K.',
  ]
  return drawPixels(grid, {
    K: '#4A4A5A', W: '#F5F5F8', B: '#6BAED6',
  }, size)
}

// ── PILL (vet / medicine) ─────────────────────────────────────────────────
export function IconPill({ size = 20 }: IconProps) {
  const grid = [
    '...KKKK.....',
    '..KRRRRK....',
    '.KRRRRRRKK..',
    'KRRLRRRRRKK.',
    'KRLLRRKKWWWK',
    'KRRRRKKWWWWK',
    'KRRRKKWWWWWK',
    '.KKKWWWWWLWK',
    '..KWWWWWLLWK',
    '...KWWWWWWK.',
    '....KKKKKK..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#4A0A1A', R: '#FF6B9D', L: '#FFC0D5', W: '#FFF8E8',
  }, size)
}

// ── DRUMSTICK (kitchen) ───────────────────────────────────────────────────
export function IconDrumstick({ size = 20 }: IconProps) {
  const grid = [
    '.....KKKKK..',
    '....KBBBBBK.',
    '....KBLBBBK.',
    '....KBBBBBK.',
    '.....KKBKK..',
    '......KBK...',
    '....KKBBBK..',
    '...KRRRRRRK.',
    '..KRROORRRK.',
    '.KRROOORRRK.',
    '.KRRRRRRRRK.',
    '..KKKKKKKK..',
  ]
  return drawPixels(grid, {
    K: '#2A1010', B: '#F5E6C8', L: '#FFFAEB', R: '#C87038', O: '#E89050',
  }, size)
}

// ── MOON Z (bedroom / sleep) ──────────────────────────────────────────────
export function IconMoonZ({ size = 20 }: IconProps) {
  const grid = [
    '...KKKK.....',
    '..KSSSSK.KK.',
    '.KSSKKKKKSK.',
    '.KSSK....KK.',
    '.KSSK..KK...',
    '.KSSK.KK....',
    '.KSSKKKKK...',
    '.KSSSSK.....',
    '..KSSSK.....',
    '...KKK......',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#312E81', S: '#C4B5FD',
  }, size)
}

// ── STETHOSCOPE (vet) ─────────────────────────────────────────────────────
export function IconStethoscope({ size = 20 }: IconProps) {
  const grid = [
    '.KK.....KK..',
    'KWWK...KWWK.',
    'KWKK...KKWK.',
    'KWK.....KWK.',
    'KWK.....KWK.',
    'KWK.....KWK.',
    '.KWK...KWK..',
    '..KWKKKWK...',
    '...KWWWK....',
    '....KKK.....',
    '...KRRRK....',
    '....KKK.....',
  ]
  return drawPixels(grid, {
    K: '#1A3A5A', W: '#4A7A9A', R: '#FF4D7D',
  }, size)
}

// ── HEART CARD (couple US chip) ───────────────────────────────────────────
export function IconHeartDuo({ size = 20 }: IconProps) {
  const grid = [
    '.KK.KK......',
    'KPPKPPK.....',
    'KPWPPPK..KK.',
    'KPPPPPK.KPPK',
    '.KPPPKK.KWPK',
    '..KPPKKKKPPK',
    '...KPKPPPPK.',
    '....KKPPPK..',
    '.....KPPK...',
    '.....KPK....',
    '......K.....',
    '............',
  ]
  return drawPixels(grid, {
    K: '#8B1538', P: '#FF4D7D', W: '#FFC0D0',
  }, size)
}
