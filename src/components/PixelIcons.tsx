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

// ── DRUMSTICK (hunger) — vertical, meaty top + bone handle below ──
export function IconMeat({ size = 20 }: IconProps) {
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

// ── PAW (3 toes) ───────────────────────────────────────────────────────────
export function IconPaw({ size = 20 }: IconProps) {
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

// ── EREN'S FACE ───────────────────────────────────────────────────────────
// Ragdoll cat — cream body, grey-brown point markings on the ear tips +
// face mask, big bright blue eyes (the breed's defining feature), and a
// little pink nose. Palette pulled from SketchEren so the pixel version
// reads as the same character.
export function IconCatFace({ size = 20 }: IconProps) {
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
}

// ── WISH (4-point star, soft glow palette) — Phase 3 daily wish indicator ──
export function IconWish({ size = 20 }: IconProps) {
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
}

// ── PILL (vet / medicine) ─────────────────────────────────────────────────
export function IconPill({ size = 20 }: IconProps) {
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
}

// ── DRUMSTICK (kitchen) — alias of IconMeat ─────────────────────────────
export function IconDrumstick({ size = 20 }: IconProps) {
  return IconMeat({ size })
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
}

// ── CAKE — pink-frosted layered cake with a candle on top ────────────────
export function IconCake({ size = 20 }: IconProps) {
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
}

// ── FIRE (streak) ────────────────────────────────────────────────────────
export function IconFire({ size = 20 }: IconProps) {
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
}

// ── TROPHY (achievements) ────────────────────────────────────────────────
export function IconTrophy({ size = 20 }: IconProps) {
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
}

// ── LOCK (locked achievement) ────────────────────────────────────────────
export function IconLock({ size = 20 }: IconProps) {
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
}

// ── SHAWARMA — meat wrap in flatbread with lettuce poking out top ────────
export function IconShawarma({ size = 20 }: IconProps) {
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
}

// ── FLY (stinky indicator) ────────────────────────────────────────────────
export function IconFly({ size = 20 }: IconProps) {
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
}
