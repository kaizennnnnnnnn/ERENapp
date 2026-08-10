'use client'

import { memo } from 'react'

// ─── Eren the runner — back-view gallop ──────────────────────────────────────
// The road scrolls toward the camera, so Eren is sprinting AWAY from us: what
// you see is the back of his head, his ruff, an up-held tail and two hind legs.
//
// Four frames — contact-left, airborne, contact-right, airborne. Two things
// keep this from reading as a head wobbling side to side:
//   * the bob is baked into the art (RUN_BOB drops the torso one pixel on the
//     contact frames) instead of being a CSS rotate on the whole sprite, so a
//     planted paw stays welded to the road while the body compresses over it;
//   * the tail rides with the torso and sits a further pixel higher on the
//     airborne beats, which is what actually sells a cat at full tilt.
// The caller drives `frame` off distance travelled rather than wall-clock, so
// his stride rate ramps up exactly as much as the road does.

const RUN_PAL: Record<string, string> = {
  K: '#3A2412', // outline
  D: '#6B5138', // seal point — backs of the ears, tail tip, lower legs
  M: '#9B7A5C', // mid point — head cap, saddle, tail
  C: '#F9EDD5', // cream fur
  P: '#D4B896', // upper leg fur
  N: '#F4B0B8', // paw pad — only visible on the leg that is off the ground
}

const RUN_W = 24
const RUN_H = 26
const CELL = 2.5

// Display box. The tail needs elbow room on the right, so the cat is not
// centred in the grid — RUN_BODY_CX is where his spine actually sits, and that
// is what the caller should line up with the lane centre.
export const RUN_BOX_W = RUN_W * CELL   // 60
export const RUN_BOX_H = RUN_H * CELL   // 65
export const RUN_BODY_CX = 10.5 * CELL  // 26.25

export const RUN_FRAME_COUNT = 4

// Contact frames are the ones with a paw on the road: that's when the shadow
// tightens and grit gets kicked back.
export function isRunContact(frame: number): boolean {
  return frame % 2 === 0
}

// Head, ruff and back. Rows 20+ belong to the legs, which never shift.
// The silhouette does the perspective work: small head up top, a flared Ragdoll
// ruff, then the rump as the widest thing on screen because it's nearest to us.
// Row 10 is a solid outline — the jaw — so the head can never melt into the
// ruff behind it, which is what made the old sprite read as one cream loaf.
const RUN_TORSO: string[] = [
  /*  0 */ '.....K..........K.......',
  /*  1 */ '....KDK........KDK......',
  /*  2 */ '...KDMDK......KDMDK.....',
  /*  3 */ '...KDDDKKKKKKKKDDDK.....',
  /*  4 */ '....KDDMMMMMMMMDDK......',
  /*  5 */ '....KMCCCCCCCCCCMK......',
  /*  6 */ '....KCCCCCCCCCCCCK......',
  /*  7 */ '....KCCCCCCCCCCCCK......',
  /*  8 */ '.....KCCCCCCCCCCK.......',
  /*  9 */ '......KCCCCCCCCK........',
  /* 10 */ '......KKKKKKKKKK........',
  /* 11 */ '....KMMMMMMMMMMMMK......',
  /* 12 */ '....KMCCCCCCCCCCMK......',
  /* 13 */ '....KMCCCCCCCCCCMK......',
  /* 14 */ '....KMCCCCCCCCCCMK......',
  /* 15 */ '...KMMCCCCCCCCCCMMK.....',
  /* 16 */ '...KMMCCCCCCCCCCMMK.....',
  /* 17 */ '...KMMCCCCCCCCCCMMK.....',
  /* 18 */ '....KMMCCCCCCCCMMK......',
  /* 19 */ '....KPPPPKKKKPPPPK......',
]

// Tail, rooted inside the rump so it reads as rising from behind him and
// tapering to a dark point. The two poses differ by a single row: on the
// airborne beats the whole tail whips up.
const TAIL_UP: Record<number, string> = {
   9: '....................KDDK',
  10: '....................KDDK',
  11: '....................KMMK',
  12: '....................KMMK',
  13: '...................KMMK.',
  14: '...................KMMK.',
  15: '..................KMMK..',
  16: '..................KMMK..',
  17: '.................KMMK...',
}
const TAIL_DOWN: Record<number, string> = {
  10: '....................KDDK',
  11: '....................KDDK',
  12: '....................KMMK',
  13: '....................KMMK',
  14: '...................KMMK.',
  15: '...................KMMK.',
  16: '..................KMMK..',
  17: '..................KMMK..',
  18: '.................KMMK...',
}

// Left leg lives at x4–9, right leg at x12–17 — the same columns as the thighs
// on torso row 19, so hip and limb always line up. A lifted paw shows its pads.
const LEGS_CONTACT_L: Record<number, string> = {
  20: '....KPPPPK..KPPPPK......',
  21: '....KPPPPK..KDDDDK......',
  22: '....KDDDDK..KDNNDK......',
  23: '....KDDDDK..KKKKKK......',
  24: '....KDDDDK..............',
  25: '....KKKKKK..............',
}
const LEGS_AIR_L: Record<number, string> = {
  20: '....KPPPPK..KPPPPK......',
  21: '....KDDDDK..KPPPPK......',
  22: '....KDNNDK..KDDDDK......',
  23: '....KKKKKK..KDNNDK......',
  24: '............KKKKKK......',
}
const LEGS_CONTACT_R: Record<number, string> = {
  20: '....KPPPPK..KPPPPK......',
  21: '....KDDDDK..KPPPPK......',
  22: '....KDNNDK..KDDDDK......',
  23: '....KKKKKK..KDDDDK......',
  24: '............KDDDDK......',
  25: '............KKKKKK......',
}
const LEGS_AIR_R: Record<number, string> = {
  20: '....KPPPPK..KPPPPK......',
  21: '....KPPPPK..KDDDDK......',
  22: '....KDDDDK..KDNNDK......',
  23: '....KDNNDK..KKKKKK......',
  24: '....KKKKKK..............',
}
// Both paws down — the pose used when the player asked for reduced motion.
const LEGS_STAND: Record<number, string> = {
  20: '....KPPPPK..KPPPPK......',
  21: '....KPPPPK..KPPPPK......',
  22: '....KDDDDK..KDDDDK......',
  23: '....KDDDDK..KDDDDK......',
  24: '....KDDDDK..KDDDDK......',
  25: '....KKKKKK..KKKKKK......',
}

const RUN_LEGS = [LEGS_CONTACT_L, LEGS_AIR_L, LEGS_CONTACT_R, LEGS_AIR_R]
const RUN_TAIL = [TAIL_DOWN, TAIL_UP, TAIL_DOWN, TAIL_UP]
const RUN_BOB  = [1, 0, 1, 0]

const EMPTY_ROW = '.'.repeat(RUN_W)

function padRow(row: string | undefined): string {
  if (!row) return EMPTY_ROW
  return row.length >= RUN_W ? row.slice(0, RUN_W) : row + '.'.repeat(RUN_W - row.length)
}

function overlay(base: string, top: string): string {
  let out = ''
  for (let x = 0; x < RUN_W; x++) out += top[x] === '.' ? base[x] : top[x]
  return out
}

// Torso and tail shift together by `bob`; the legs stay put so the contact paw
// never slides.
function composeFrame(
  legs: Record<number, string>,
  tail: Record<number, string>,
  bob: number,
): string[] {
  const rows: string[] = []
  for (let y = 0; y < RUN_H; y++) {
    const body = overlay(padRow(RUN_TORSO[y - bob]), padRow(tail[y - bob]))
    rows.push(overlay(body, padRow(legs[y])))
  }
  return rows
}

interface RunRect { x: number; y: number; w: number; c: string }

// Run-length encode each row so a frame is ~135 rects instead of ~400 — this
// sprite re-renders up to 14x a second on a phone.
function toRects(grid: string[]): RunRect[] {
  const rects: RunRect[] = []
  grid.forEach((row, y) => {
    let x = 0
    while (x < RUN_W) {
      const ch = row[x]
      if (ch === '.') { x++; continue }
      let w = 1
      while (x + w < RUN_W && row[x + w] === ch) w++
      rects.push({ x, y, w, c: RUN_PAL[ch] })
      x += w
    }
  })
  return rects
}

const RUN_RECTS = RUN_LEGS.map((legs, i) => toRects(composeFrame(legs, RUN_TAIL[i], RUN_BOB[i])))
const STAND_RECTS = toRects(composeFrame(LEGS_STAND, TAIL_UP, 0))

interface Props {
  frame: number
  standing?: boolean
}

const ErenRunner = memo(function ErenRunner({ frame, standing = false }: Props) {
  const rects = standing ? STAND_RECTS : (RUN_RECTS[frame] ?? RUN_RECTS[0])
  return (
    <svg
      width="100%" height="100%"
      viewBox={`0 0 ${RUN_W} ${RUN_H}`}
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      {rects.map(r => (
        <rect key={`${r.y}-${r.x}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  )
})

export default ErenRunner
