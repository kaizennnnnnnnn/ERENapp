'use client'

import type { CSSProperties, ReactNode } from 'react'
import { MeadowIcon } from '@/components/PixelIcons'
import { M, RADIUS } from '@/components/meadow'
import type { RecolourSpec } from '@/lib/catRecolour'
import CatPortrait from './CatPortrait'

// ─── CatStage ────────────────────────────────────────────────────────────────
// The soft rounded stage the cat stands on in onboarding and the builder, with
// the tiny pixel meadow under its feet (hill, its shadow, two daisies, two
// tufts) — Meadow's signature. Three sizes, each copied from its board:
//   build    380 tall, cat 202x272 centred       (O2 Build your cat)
//   compact  300 tall, cat 170x229 centred       (KIT: "reuse the stage shorter")
//   tune     152 tall, cat 92x124 at the left    (O3 Fine-tune, bubble to the right)
// The stage is as wide as its container minus the boards' 20px side margins;
// everything centred is placed from the middle so it holds at any phone width.
// Overlays (the speech bubble, the Shuffle button) come in as children and
// position themselves absolutely.
//
// Not the kit's <Stage>: that one derives the meadow from the stage height by
// the boards' rule and needs a pixel width, while the Fine-tune board breaks
// the rule (cat and feet to the left, smaller flowers) and the builder is as
// wide as the phone. Right-hand decorations are anchored from the right here,
// so nothing has to be measured.

export type StageVariant = 'build' | 'compact' | 'tune'

interface Layout {
  height: number
  cat: { w: number; h: number; top: number; left: string }
  hillTop: number
  shadow: { left: string; top: number; w: number; h: number }
  daisies: Array<{ side: 'left' | 'right'; x: number; top: number; size: number }>
  tufts: Array<{ side: 'left' | 'right'; x: number; top: number; size: number }>
}

// Head centre sits at 43% of the cat's width, so a cat centred on the stage
// has left = 50% - 0.43 W (KIT "cat sprite maths").
const centred = (w: number) => `calc(50% - ${(0.43 * w).toFixed(1)}px)`

const LAYOUT: Record<StageVariant, Layout> = {
  build: {
    height: 380,
    cat: { w: 202, h: 272, top: 82, left: centred(202) },
    hillTop: 300,
    shadow: { left: 'calc(50% - 75px)', top: 342, w: 150, h: 16 },
    daisies: [{ side: 'left', x: 20, top: 316, size: 36 }, { side: 'right', x: 20, top: 312, size: 36 }],
    tufts: [{ side: 'left', x: 50, top: 330, size: 36 }, { side: 'right', x: 52, top: 330, size: 36 }],
  },
  compact: {
    height: 300,
    cat: { w: 170, h: 229, top: 45, left: centred(170) },
    hillTop: 220,
    shadow: { left: 'calc(50% - 63px)', top: 262, w: 126, h: 14 },
    daisies: [{ side: 'left', x: 20, top: 236, size: 36 }, { side: 'right', x: 20, top: 232, size: 36 }],
    tufts: [{ side: 'left', x: 50, top: 250, size: 36 }, { side: 'right', x: 52, top: 250, size: 36 }],
  },
  tune: {
    height: 152,
    cat: { w: 92, h: 124, top: 10, left: '40px' },
    hillTop: 82,
    shadow: { left: '40px', top: 128, w: 78, h: 12 },
    daisies: [{ side: 'right', x: 16, top: 108, size: 32 }],
    tufts: [{ side: 'left', x: 4, top: 110, size: 30 }, { side: 'right', x: 52, top: 116, size: 30 }],
  },
}

const at = (side: 'left' | 'right', x: number, top: number): CSSProperties =>
  ({ position: 'absolute', top, [side]: x })

interface Props {
  variant: StageVariant
  look: RecolourSpec | null | undefined
  /** Accessible name for the cat, e.g. "Mochi, your tuxedo cat". */
  alt?: string
  children?: ReactNode
  style?: CSSProperties
}

export default function CatStage({ variant, look, alt, children, style }: Props) {
  const L = LAYOUT[variant]
  return (
    <div style={{
      position: 'relative', height: L.height, margin: '0 20px',
      borderRadius: RADIUS.stage, background: M.soft, overflow: 'hidden', ...style,
    }}>
      <div aria-hidden style={{
        position: 'absolute', left: 'calc(50% - 280px)', top: L.hillTop, width: 560, height: 220,
        borderRadius: '50%', background: M.hill,
      }} />
      <div aria-hidden style={{
        position: 'absolute', left: L.shadow.left, top: L.shadow.top, width: L.shadow.w, height: L.shadow.h,
        borderRadius: '50%', background: M.hillShadow,
      }} />
      {L.daisies.map((d, i) => (
        <span key={`d${i}`} style={at(d.side, d.x, d.top)}><MeadowIcon name="daisy" size={d.size} /></span>
      ))}
      {L.tufts.map((t, i) => (
        <span key={`t${i}`} style={at(t.side, t.x, t.top)}><MeadowIcon name="tuft" size={t.size} /></span>
      ))}
      <CatPortrait
        look={look}
        width={L.cat.w}
        height={L.cat.h}
        alt={alt}
        style={{ position: 'absolute', left: L.cat.left, top: L.cat.top }}
      />
      {children}
    </div>
  )
}
