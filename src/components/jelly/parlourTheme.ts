// ─── Parlour theme ──────────────────────────────────────────────────────────
// One palette for the whole Parlour so the hub, the case, the menu board and
// the stand can't drift into three slightly different browns.
//
// The room is a warm SHOP, not a pastel screen. The first build was mint on
// mint with white cards, which is the exact "default app" look the project's
// design rules call out: uniform radius, flat gradients, no depth. The fix is
// materials — stained wood, brass, dark cabinet glass, slate — lit warm, with
// the jelly art supplying every saturated colour in the room.

export const INK = '#3A1F2B'        // outline on everything; a plum-brown, not black
export const CREAM = '#FFF8EE'
export const CREAM_DIM = '#E9D8C6'

// Wall
export const WALL = '#F4D9DE'
export const WALL_STRIPE = '#EBC6CF'
export const WALL_DEEP = '#C99AA9'

// Cabinetry
export const WOOD = '#8E5A3B'
export const WOOD_DK = '#5E3A25'
export const WOOD_LT = '#B47C55'
export const CASE_IN = '#2B1A22'    // the dark inside of the display case
export const CASE_IN_LT = '#4A2E3C'

// Metal
export const BRASS = '#E0A93E'
export const BRASS_LT = '#F8DC92'
export const BRASS_DK = '#9A6E1E'

// Slate menu board
export const SLATE = '#26313A'
export const SLATE_LT = '#3A4A57'
export const CHALK = '#EAF2F5'

// Accents
export const BERRY = '#E14C7C'
export const BERRY_DK = '#9E2B51'
export const LEAF = '#2FA765'

/** The app's hard pixel-shadow, no blur. Depth comes from offset, not softness. */
export const hardShadow = (px = 4, colour: string = INK) => `${px}px ${px}px 0 ${colour}`
export const dropShadow = (px = 4, colour: string = INK) => `0 ${px}px 0 ${colour}`
