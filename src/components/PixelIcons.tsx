'use client'

import { memo } from 'react'

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
export const IconHeart = memo(function IconHeart({ size = 20 }: IconProps) {
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
})

// ── DRUMSTICK (hunger) — vertical, meaty top + bone handle below ──
export const IconMeat = memo(function IconMeat({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '....KKKK....',
    '...KSSSSK...',
    '..KSLSSSMK..',
    '..KSWLSSSK..',
    '..KSSSSSMK..',
    '...KMSSSMK..',
    '....KMMMK...',
    '.....KBK....',
    '....KBBBK...',
    '...KWBLBWK..',
    '....KKKK....',
  ]
  return drawPixels(grid, {
    K: '#1A0A00', // outline
    M: '#7A3812', // meat shadow
    S: '#D17A30', // meat
    L: '#FFD89A', // meat highlight
    B: '#E8D5A8', // bone
    W: '#FFFEF4', // bone highlight
  }, size)
})

// ── LIGHTNING (energy) ─────────────────────────────────────────────────────
export const IconLightning = memo(function IconLightning({ size = 20 }: IconProps) {
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
})

// ── MOON (sleep) ───────────────────────────────────────────────────────────
export const IconMoon = memo(function IconMoon({ size = 20 }: IconProps) {
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
})

// ── WATER DROP (cleanliness) ───────────────────────────────────────────────
export const IconDrop = memo(function IconDrop({ size = 20 }: IconProps) {
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
})

// ── COIN ───────────────────────────────────────────────────────────────────
// Polished gold doubloon: a 5-step gold ramp (outline → deep → mid → face →
// highlight) lights the disc from the top-left so it reads as a beveled,
// glossy minted coin instead of a flat yellow circle. The two W pixels are a
// hot specular glint; the dark rim wraps the lower-right for depth.
export const IconCoin = memo(function IconCoin({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '...KKLLKK...',
    '..KLLYYLLK..',
    '.KLYLLYYYDK.',
    '.KLLWWYYYDK.',
    '.LYYLLYYGGD.',
    '.LYYYYYGGGD.',
    '.KLYYYGGGDK.',
    '.KLYYGGGGDK.',
    '..KDDGGDDK..',
    '...KKDDKK...',
    '............',
  ]
  return drawPixels(grid, {
    K: '#5A3A00', D: '#9A6A00', G: '#D89A1E', Y: '#FFD23D', L: '#FFF1A6', W: '#FFFFFF',
  }, size)
})

// ── GIFT BOX ───────────────────────────────────────────────────────────────
export const IconGift = memo(function IconGift({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '...KK..KK...',
    '..KRRKKRRK..',
    '...KRRRRK...',
    '..KKKKKKKK..',
    '..KWBRRBBK..',
    '..KKKRRKKK..',
    '..KBBRRBBK..',
    '..KBBRRBBK..',
    '..KBBRRBBK..',
    '..KKKKKKKK..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#2A1040', B: '#A78BFA', W: '#D9C5FF', R: '#FF6FA5',
  }, size)
})

// ── TREASURE CHEST (gacha / capsule) ──────────────────────────────────────
export const IconCapsule = memo(function IconCapsule({ size = 20 }: IconProps) {
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
})

// ── BELL ───────────────────────────────────────────────────────────────────
export const IconBell = memo(function IconBell({ size = 20 }: IconProps) {
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
})

// ── PERSON ─────────────────────────────────────────────────────────────────
export const IconPerson = memo(function IconPerson({ size = 20 }: IconProps) {
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
})

// ── DOOR ───────────────────────────────────────────────────────────────────
export const IconDoor = memo(function IconDoor({ size = 20 }: IconProps) {
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
})

// ── FLASK (chemistry lab) — erlenmeyer with bubbling lime liquid ──
export const IconFlask = memo(function IconFlask({ size = 20 }: IconProps) {
  const grid = [
    '....KKKK....',
    '....KGGK....',
    '....KGGK....',
    '....KLLK....',
    '...KLLLLK...',
    '..KLLLLLLK..',
    '..KLLLLLLK..',
    '.KLLLLLLLLK.',
    '.KLLLBLLLLK.',
    '.KLLLLLLLLK.',
    '.KLLLLLLLLK.',
    '.KKKKKKKKKK.',
  ]
  return drawPixels(grid, {
    K: '#1F3D0A', G: '#D7F7C8', L: '#84CC16', B: '#F0FFD0',
  }, size)
})

// ── QUESTS (scroll) ────────────────────────────────────────────────────────
export const IconScroll = memo(function IconScroll({ size = 20 }: IconProps) {
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
})

// ── PHOTOS ─────────────────────────────────────────────────────────────────
export const IconPhoto = memo(function IconPhoto({ size = 20 }: IconProps) {
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
})

// ── PAW (3 toes) ───────────────────────────────────────────────────────────
export const IconPaw = memo(function IconPaw({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.KK..KK..KK.',
    'KPK.KPK.KPK.',
    'KPK.KPK.KPK.',
    '.KK..KK..KK.',
    '...KKKKKK...',
    '..KPPPPPPK..',
    '.KPPPPPPPPK.',
    '.KPPPPPPPPK.',
    '..KPPPPPPK..',
    '...KKKKKK...',
    '............',
  ]
  return drawPixels(grid, {
    K: '#3B1D1D', P: '#FFB0C8',
  }, size)
})

// ── CHERRY (cake topping) ──────────────────────────────────────────────────
export const IconCherry = memo(function IconCherry({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '........TG..',
    '.......T.GG.',
    '.......T.G..',
    '......T.....',
    '..KKKK......',
    '.KRRRRK.....',
    'KRWRRRRK....',
    'KRRRRRRK....',
    'KRRRRRRK....',
    '.KRRRRK.....',
    '..KKKK......',
  ]
  return drawPixels(grid, {
    K: '#5A1020', R: '#EE2E4D', W: '#FF9FB2', T: '#7A4A1E', G: '#5BA83C',
  }, size)
})

// ── FLOWER (cute bloom) ────────────────────────────────────────────────────
export const IconFlower = memo(function IconFlower({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '....K..K....',
    '...KPKKPK...',
    '..KPPPPPPK..',
    '..KPPYYPPK..',
    '..KPPYYPPK..',
    '..KPPPPPPK..',
    '...KPKKPK...',
    '....K..K....',
    '............',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#B23A6A', P: '#FF8FBC', Y: '#FFD64D',
  }, size)
})

// ── CROWN (winner) ─────────────────────────────────────────────────────────
export const IconCrown = memo(function IconCrown({ size = 20 }: IconProps) {
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
})

// ── SWORDS (care battle) ───────────────────────────────────────────────────
export const IconSwords = memo(function IconSwords({ size = 20 }: IconProps) {
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
})

// ── HOUSE (cozy home / invite) ────────────────────────────────────────────
export const IconHouse = memo(function IconHouse({ size = 20 }: IconProps) {
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
})

// ── DRESS (fashion) ────────────────────────────────────────────────────────
export const IconDress = memo(function IconDress({ size = 20 }: IconProps) {
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
})

// ── BOW (cute costume accent — gacha "clothes" pull) ──────────────────────
export const IconBow = memo(function IconBow({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..KKK..KKK..',
    '.KPHPKKPHPK.',
    'KPPPPKKPPPPK',
    'KPPPPGGPPPPK',
    'KPPPPGGPPPPK',
    '.KPPPKKPPPK.',
    '..KKK..KKK..',
    '....KGGK....',
    '.....KK.....',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#A11E5E', P: '#FF7FB8', H: '#FFD0E4', G: '#F5C842',
  }, size)
})

// ── BEANIE (cute knit hat — gacha "clothes" pull, gender-neutral) ─────────
export const IconBeanie = memo(function IconBeanie({ size = 20 }: IconProps) {
  const grid = [
    '.....WW.....',
    '....WWWW....',
    '....KKKK....',
    '...KBBBBK...',
    '..KBLLBBBK..',
    '..KBBBBBBK..',
    '.KBBBBBBBBK.',
    '.KBBBBBBBBK.',
    'KDDDDDDDDDDK',
    'KDDDDDDDDDDK',
    '.KKKKKKKKKK.',
    '............',
  ]
  return drawPixels(grid, {
    K: '#2A3F6B', B: '#5B8DEF', L: '#A9C8FF', D: '#3B6FC8', W: '#FFFFFF',
  }, size)
})

// ── BOOK (collection / serbian class) ─────────────────────────────────────
export const IconBook = memo(function IconBook({ size = 20 }: IconProps) {
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
})

// ── TICKET (gacha ticket) ─────────────────────────────────────────────────
// A glossy raffle ticket: a 2px tear-off stub on the left, a dashed
// perforation, a gold star on the main panel, a light gloss band up top and a
// shadow band at the base for depth. Reads as a ticket at 14–20px, not a card.
export const IconTicket = memo(function IconTicket({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '............',
    '.KKKKKKKKKK.',
    'KLLKLLLLLLLK',
    'KPPPPPPGPPPK',
    'KPPKPPGGGPPK',
    'KPPPPGGGGGPK',
    'KPPKPPGPGPPK',
    'KDDDDDDDDDDK',
    '.KKKKKKKKKK.',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#7A1142', D: '#C8377E', P: '#FF6FA8', L: '#FFC6E0', G: '#FFD65A',
  }, size)
})

// ── CLOCK (time) ──────────────────────────────────────────────────────────
export const IconClock = memo(function IconClock({ size = 20 }: IconProps) {
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
})

// ── STAR ──────────────────────────────────────────────────────────────────
export const IconStar = memo(function IconStar({ size = 20 }: IconProps) {
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
})

// ── SPARKLES (stardust) ───────────────────────────────────────────────────
export const IconSparkles = memo(function IconSparkles({ size = 20 }: IconProps) {
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
})

// ── CONTROLLER (games chip) ───────────────────────────────────────────────
export const IconController = memo(function IconController({ size = 20 }: IconProps) {
  // Gamepad — clearly readable d-pad on the left, two action buttons on the
  // right, handle bumps at the bottom. Old version had W/K/W/K patterns the
  // eye couldn't parse below 40px.
  const grid = [
    '............',
    '..KKKKKKKK..',
    '.KPPPPPPPPK.',
    'KPPWPPPPRPPK',
    'KPWWWPPPPPPK',
    'KPPWPPPPYBPK',
    'KPPPPPPPPPPK',
    'KPPPPPPPPPPK',
    'KPPPPPPPPPPK',
    '.KKKKKKKKKK.',
    '..KKK..KKK..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#1A0A2A', P: '#7C5DD4', W: '#FFFFFF', R: '#FF4D7D', B: '#38BDF8', Y: '#FFD700',
  }, size)
})

// ── SLOT MACHINE (gacha chip) ─────────────────────────────────────────────
export const IconSlots = memo(function IconSlots({ size = 20 }: IconProps) {
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
})

// ── ENVELOPE (journal / message) ──────────────────────────────────────────
export const IconEnvelope = memo(function IconEnvelope({ size = 20 }: IconProps) {
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
})

// ── EREN'S FACE ───────────────────────────────────────────────────────────
// Ragdoll cat — cream body, grey-brown point markings on the ear tips +
// face mask, big bright blue eyes (the breed's defining feature), and a
// little pink nose. Palette pulled from SketchEren so the pixel version
// reads as the same character.
export const IconCatFace = memo(function IconCatFace({ size = 20 }: IconProps) {
  // Eren straight from the loading-screen sprite (AnimatedEren's IDLE_R pose),
  // so the First Mood memory frame shows the very same cat the splash screen
  // does instead of a bespoke face. The sprite isn't square, so we render it
  // fit to its content bounds and let the frame centre it.
  const grid = [
    '.KK..........KK.......',
    'KMMK........KMMK......',
    'KMCKK......KKCMK......',
    'KMCCCCCCCCCCCCMK......',
    'KCCCCCCCCCCCCCCCK.....',
    'KCCEEPCCCCEEPCCK......',
    'KCCEWPCCCCEWPCCK......',
    'KCCCCCCCNNCCCCK.......',
    '.KCCCCCKKCCCCK........',
    '..KKCCCCCCCCKKK.......',
    '...KCCCCCCCCCCK..KMMK.',
    '...KCWCCCCCCWCKKMMMK..',
    '...KCCCCCCCCCCKMMMK...',
    '...KCCCCCCCCCCKMMK....',
    '..KKCSSCCCCSSCKKK.....',
    '..K.KK......KK.K.....',
  ]
  const pal: Record<string, string> = {
    K: '#2A2030', M: '#7E7272', C: '#F5F3EF', E: '#4898D4',
    P: '#1A1A2E', W: '#FFFFFF', N: '#F28898', S: '#D0CCC4',
  }
  // Crop to the drawn pixels so the cat fills the icon box regardless of the
  // sprite's empty margins, preserving aspect ratio.
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (pal[grid[y][x]]) {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
  }
  const w = maxX - minX + 1, h = maxY - minY + 1
  const scale = size / Math.max(w, h)
  const rects: React.ReactElement[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const c = pal[grid[y][x]]
      if (c) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={c} />)
    }
  }
  return (
    <svg
      width={Math.round(w * scale)}
      height={Math.round(h * scale)}
      viewBox={`${minX} ${minY} ${w} ${h}`}
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated' }}
    >
      {rects}
    </svg>
  )
})

// ── WISH (4-point star, soft glow palette) — Phase 3 daily wish indicator ──
export const IconWish = memo(function IconWish({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.....KK.....',
    '....KGGK....',
    '....KGGK....',
    '.KKKKGGKKKK.',
    'KGGGGGGGGGK.',
    'KGGGGWWGGGK.',
    '.KKKKGGKKKK.',
    '....KGGK....',
    '....KGGK....',
    '.....KK.....',
    '............',
  ]
  return drawPixels(grid, {
    K: '#8B5A00', G: '#F5C842', W: '#FFF5C8',
  }, size)
})

// ── PENCIL (edit) ─────────────────────────────────────────────────────────
export const IconPencil = memo(function IconPencil({ size = 20 }: IconProps) {
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
})

// ── MOUSE (game) ──────────────────────────────────────────────────────────
export const IconMouse = memo(function IconMouse({ size = 20 }: IconProps) {
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
})

// ── YARN BALL ─────────────────────────────────────────────────────────────
export const IconYarn = memo(function IconYarn({ size = 20 }: IconProps) {
  // Yarn ball — bold dark outline + clear diagonal strands that read at
  // small render sizes. The previous version washed into a pink blob in the
  // Memory Wall thumbnails; this one keeps strand contrast tight.
  const grid = [
    '............',
    '....KKKK....',
    '..KKLPPLKK..',
    '.KLPDPPDPLK.',
    'KLPPDPDPPPLK',
    'KPDPPDPPDPDK',
    'KPPDPPDPPDPK',
    'KLPDPDPPDPLK',
    '.KPPDPDPPPK.',
    '..KLPPPPLK..',
    '...KKKKKK...',
    '............',
  ]
  return drawPixels(grid, {
    K: '#5A0A28', P: '#FF6B9D', D: '#A8204F', L: '#FFD0DC',
  }, size)
})

// ── FISH ──────────────────────────────────────────────────────────────────
export const IconFish = memo(function IconFish({ size = 20 }: IconProps) {
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
})

// ── BATHTUB (bathroom) ────────────────────────────────────────────────────
export const IconBath = memo(function IconBath({ size = 20 }: IconProps) {
  // Bathtub with bubbles floating above + water inside. Bubbles give it a
  // recognisable silhouette at small size; the steam was previously the
  // only "bath" cue and didn't read.
  const grid = [
    '.O....OO....',
    'O.O..O..O...',
    '.O....OO....',
    'KKKKKKKKKKKK',
    'KWWWWWWWWWWK',
    'KBBOBBBBOBBK',
    'KBBBBBOBBBBK',
    'KBOBBBBBBOBK',
    'KBBBOBBOBBBK',
    'KWWWWWWWWWWK',
    'KK........KK',
    '.K........K.',
  ]
  return drawPixels(grid, {
    K: '#1A3A5A', W: '#E0EEF8', B: '#3B8FC8', O: '#FFFFFF',
  }, size)
})

// ── PILL (vet / medicine) ─────────────────────────────────────────────────
export const IconPill = memo(function IconPill({ size = 20 }: IconProps) {
  // Capsule pill — half coloured, half white, with a clear seam down the
  // middle. The previous diagonal lozenge read as a smear at thumbnail size.
  const grid = [
    '............',
    '..KKKKKKKK..',
    '.KRRRRKWWWK.',
    'KRRLRRKWWWWK',
    'KRRRRRKWWWWK',
    'KRLRRRKWWLWK',
    'KRRRRRKWWWWK',
    'KRRRRRKWWLWK',
    'KRRLRRKWWWWK',
    '.KRRRRKWWWK.',
    '..KKKKKKKK..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#4A0A1A', R: '#FF6B9D', L: '#FFC0D5', W: '#FFFEF6',
  }, size)
})

// ── DRUMSTICK (kitchen) — alias of IconMeat ─────────────────────────────
export const IconDrumstick = memo(function IconDrumstick({ size = 20 }: IconProps) {
  return <IconMeat size={size} />
})

// ── MOON Z (bedroom / sleep) ──────────────────────────────────────────────
export const IconMoonZ = memo(function IconMoonZ({ size = 20 }: IconProps) {
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
})

// ── STETHOSCOPE (vet) ─────────────────────────────────────────────────────
export const IconStethoscope = memo(function IconStethoscope({ size = 20 }: IconProps) {
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
})

// ── FRIDGE (kitchen storage) ──────────────────────────────────────────────
export const IconFridge = memo(function IconFridge({ size = 20 }: IconProps) {
  const grid = [
    '.KKKKKKKKKK.',
    '.KGGFFFFFFK.',
    '.KFFFFFFHHK.',
    '.KFFFFFFHHK.',
    '.KKKKKKKKKK.',
    '.KFFFFFFHHK.',
    '.KFFFFFFHHK.',
    '.KFFFFFFFFK.',
    '.KFFFFFFFFK.',
    '.KKKKKKKKKK.',
    '..K......K..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#2F557A', F: '#EAF6FF', G: '#FFFFFF', H: '#5FA8DC',
  }, size)
})

// ── SHOPPING CART (shop) ──────────────────────────────────────────────────
export const IconCart = memo(function IconCart({ size = 20 }: IconProps) {
  // Cart with a left handle, a tapered wire basket carrying two grocery items
  // (leafy green + round red), and two chunky wheels — reads "food shopping".
  const grid = [
    '............',
    '..K.........',
    '..K..GG.RR..',
    '..K..GG.RR..',
    '..KKKKKKKKK.',
    '...K.....K..',
    '...K.....K..',
    '....KKKKK...',
    '....K...K...',
    '...OO...OO..',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#6B4A12', O: '#3D2A0A', G: '#5DBB63', R: '#EF5B54',
  }, size)
})

// ── HEART CARD (couple US chip) ───────────────────────────────────────────
export const IconHeartDuo = memo(function IconHeartDuo({ size = 20 }: IconProps) {
  // Two interlocked hearts — brown on the left (Jovan), pink on the right
  // (her). Matches the heart-color convention used everywhere else in the
  // app for sender attribution.
  const grid = [
    '.BB....KK...',
    'BMMBB.KPPK..',
    'BMLMMBKPWPK.',
    'BMMMMBKPPPK.',
    '.BMMBBPPPK..',
    '..BMBBPPK...',
    '...BBPPK....',
    '...BBPK.....',
    '....BK......',
    '............',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    B: '#5A3020', M: '#A86040', L: '#E0C0A0',     // brown heart
    K: '#7A1238', P: '#FF4D7D', W: '#FFC8D8',     // pink heart
  }, size)
})

// ── CAKE — pink-frosted layered cake with a candle on top ────────────────
export const IconCake = memo(function IconCake({ size = 20 }: IconProps) {
  const grid = [
    '......F.....',   // F = candle flame
    '......T.....',   // T = candle wick / stem
    '...PPPPPP...',   // P = pink frosting top
    '..PWPPPWPP..',   // W = white frosting highlight
    '.BBBBBBBBBB.',   // B = cake body (brown)
    '.BDDDDDDDDB.',   // D = cream filling layer
    '.BBBBBBBBBB.',
    '.BDDDDDDDDB.',
    '.BBBBBBBBBB.',
    '.KKKKKKKKKK.',   // K = base / plate
    '............',
    '............',
  ]
  return drawPixels(grid, {
    F: '#FBBF24', T: '#7C2D12',
    P: '#EC4899', W: '#FBCFE8',
    B: '#92400E', D: '#FDE68A', K: '#525252',
  }, size)
})

// ── DONUT (snack — gacha "food" pull) ─────────────────────────────────────
// Pink-glazed ring with a transparent hole + a few sprinkles. Silhouette-first
// so it still reads as a donut at ~14px.
export const IconDonut = memo(function IconDonut({ size = 20 }: IconProps) {
  // Pink frosting (P) on top, tan dough (D) below, and a BIG open hole so the
  // ring silhouette reads as a donut (not a bullseye) even at ~16px. Sprinkles
  // sit on the wider top/bottom arcs.
  const grid = [
    '............',
    '...KKKKKK...',
    '..KPLPUPPK..',
    '.KPPKKKKPPK.',
    '.KPK....KPK.',
    '.KPK....KPK.',
    '.KDK....KDK.',
    '.KDK....KDK.',
    '.KDDKKKKDDK.',
    '..KDTDDUDK..',
    '...KKKKKK...',
    '............',
  ]
  return drawPixels(grid, {
    K: '#6B3A1A', P: '#FF8FC0', L: '#FFE3F0', D: '#E8B07A', U: '#FBBF24', T: '#7DD3FC',
  }, size)
})

// ── FIRE (streak) ────────────────────────────────────────────────────────
export const IconFire = memo(function IconFire({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.....KK.....',
    '....KOOK....',
    '....KOOOK...',
    '...KOOYOK...',
    '...KOYYYOK..',
    '..KOYYYYOK..',
    '..KOYRRYOK..',
    '..KORRRROK..',
    '...KORRROK..',
    '...KKKKKKK..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#7A2000', O: '#FF6B00', Y: '#FFD700', R: '#FF3300',
  }, size)
})

// ── TROPHY (achievements) ────────────────────────────────────────────────
export const IconTrophy = memo(function IconTrophy({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '.KKKKKKKKKK.',
    'KKYYYYYYYKKK',
    'KLYYYYYYYRLK',
    'KKYYYYYYYKKK',
    '.KYYYYYYYK..',
    '..KYYYYYK...',
    '...KYYYK....',
    '....KYK.....',
    '....KYK.....',
    '...KKKKKK...',
    '..KYYYYYYK..',
  ]
  return drawPixels(grid, {
    K: '#7A4F00', Y: '#FFD700', L: '#FFF4A3', R: '#B88400',
  }, size)
})

// ── LOCK (locked achievement) ────────────────────────────────────────────
export const IconLock = memo(function IconLock({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '....KKKK....',
    '...KGGGKK...',
    '...KG..GK...',
    '...KG..GK...',
    '..KKKKKKKK..',
    '..KSSSSSSSK.',
    '..KSSWWSSK..',
    '..KSSYYSSKK.',
    '..KSSSSSSK..',
    '..KKKKKKKK..',
    '............',
  ]
  return drawPixels(grid, {
    K: '#3A3A4A', G: '#6A6A7A', S: '#8A8A9A', W: '#FFD700', Y: '#B88400',
  }, size)
})

// ── SHAWARMA — meat wrap in flatbread with lettuce poking out top ────────
export const IconShawarma = memo(function IconShawarma({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '....KKKK....',
    '...KGGGGK...',
    '..KKSSSSKK..',
    '..KFMMMMFK..',
    '..KFSMMSFK..',
    '..KFMRRMFK..',
    '..KFFMMFFK..',
    '...KFFFFK...',
    '...KFFFFK...',
    '....KFFK....',
    '.....KK.....',
  ]
  return drawPixels(grid, {
    K: '#3A1F0A',  // dark outline
    F: '#E8C792',  // flatbread / lavash
    M: '#7A3812',  // meat shadow
    S: '#D17A30',  // meat highlight
    R: '#C04030',  // red sauce / tomato
    G: '#7AB05A',  // lettuce greens
  }, size)
})

// ── FLY (stinky indicator) ────────────────────────────────────────────────
export const IconFly = memo(function IconFly({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..WW....WW..',
    '.WWWW..WWWW.',
    '..WW.KK.WW..',
    '....KKKK....',
    '...KGKKGK...',
    '...KKKKKK...',
    '....KKKK....',
    '.....KK.....',
    '............',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#2D2D2D', G: '#556B2F', W: 'rgba(200,220,255,0.7)',
  }, size)
})

// ── EYE (show password) ────────────────────────────────────────────────────
export const IconEye = memo(function IconEye({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '............',
    '...KKKKKK...',
    '..KWWWWWWK..',
    '.KWWPPPPWWK.',
    'KWWPPIIPPWWK',
    'KWWPPIIPPWWK',
    '.KWWPPPPWWK.',
    '..KWWWWWWK..',
    '...KKKKKK...',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#1A1A2E', W: '#FFFFFF', P: '#4898D4', I: '#1A1A2E',
  }, size)
})

// ── COIN BAG (daily-fortune coin reward) ──────────────────────────────────
// Tan burlap sack cinched with a light cord, a gold coin emblem on the belly.
// Replaces the 💰 emoji on the Small/Coin/Heavy coin-bag fortune gifts.
export const IconCoinBag = memo(function IconCoinBag({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '....KKKK....',
    '...KGGGGK...',
    '...KCKKCK...',
    '..KBBBBBBK..',
    '.KBLBBBBBDK.',
    'KBBBSSSSBBDK',
    'KBLBSHHSBBBK',
    'KBBBSSSSBBDK',
    'KBBLBBBBBBDK',
    '.KKKKKKKKKK.',
    '............',
  ]
  return drawPixels(grid, {
    K: '#4A2F08', B: '#C28A3C', D: '#8A5E1E', L: '#E6B765',
    G: '#E6C77A', C: '#6E4A14', S: '#F5C842', H: '#FFF1B8',
  }, size)
})

// ── GEM (stardust crystal) ─────────────────────────────────────────────────
// Cyan brilliant-cut diamond — flat table on top tapering to a point. Replaces
// the 💎 emoji on the Stardust Crystal fortune gift.
export const IconGem = memo(function IconGem({ size = 20 }: IconProps) {
  const grid = [
    '............',
    '..KKKKKKKK..',
    '.KHHCCCCHHK.',
    'KCCCCCCCCCCK',
    '.KCCCCCCCCK.',
    '..KCCWCCCK..',
    '...KCCCCK...',
    '....KCCK....',
    '.....KK.....',
    '............',
    '............',
    '............',
  ]
  return drawPixels(grid, {
    K: '#0E6F8A', C: '#2FD4EE', H: '#CFFAFE', W: '#FFFFFF',
  }, size)
})

// ── FEATHER (Eren's whisker keepsake) ──────────────────────────────────────
// Soft cream feather on a diagonal with a quill at the base. Replaces the 🪶
// emoji on the Eren's Whisker fortune keepsake.
export const IconFeather = memo(function IconFeather({ size = 20 }: IconProps) {
  const grid = [
    '..........K.',
    '.........KW.',
    '........KWL.',
    '.......KWWL.',
    '......KWWLK.',
    '.....KWWLK..',
    '....KWWLK...',
    '...KWWLK....',
    '..KWLLK.....',
    '.KWLK.......',
    '.KKK........',
    'K...........',
  ]
  return drawPixels(grid, {
    K: '#8A7A55', W: '#FFFEF6', L: '#D9CDB0',
  }, size)
})

// ── EYE OFF (hide password) — same eye, pink slash through it ─────────────
export const IconEyeOff = memo(function IconEyeOff({ size = 20 }: IconProps) {
  const grid = [
    '..........S.',
    '.........S..',
    '...KKKKKS...',
    '..KWWWWSWK..',
    '.KWWPPSPWWK.',
    'KWWPPSIPPWWK',
    'KWWPSIIPPWWK',
    '.KWSPPPPWWK.',
    '..SWWWWWWK..',
    '.S.KKKKKK...',
    'S...........',
    '............',
  ]
  return drawPixels(grid, {
    K: '#1A1A2E', W: '#FFFFFF', P: '#4898D4', I: '#1A1A2E', S: '#FF6B9D',
  }, size)
})
