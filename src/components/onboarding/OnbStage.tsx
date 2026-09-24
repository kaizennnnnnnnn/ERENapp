'use client'

// ─── OnbStage ────────────────────────────────────────────────────────────────
// The soft stage the cat stands on through onboarding, with the little pixel
// meadow under its feet (hill, the darker patch under the feet, two daisies,
// two tufts). Three sizes, each copied from the prototype board's geometry:
//   build    380 tall, cat 202x272      (Save; the builder has its own)
//   std      364 tall, cat 170x229      (Boy or girl, Name, Say hello, Notify, Code)
//   partner  250 tall, cat 142x191 left (Invite your person, bubble on the right)
// Everything centred is placed from the stage's middle and the right-hand
// flowers from its right edge, so it holds at any phone width. The stage is
// the container's width minus the boards' 20px margins.
//
// The cat is the household's real look (recoloured live), the classic art
// for null, or a silhouette for the joiner, who hasn't met their cat yet.

import type { CSSProperties, ReactNode } from 'react'
import { MeadowIcon, type MeadowIconName } from '@/components/PixelIcons'
import { M, RADIUS, SpeechBubble } from '@/components/meadow'
import CatFigure from './CatFigure'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { CatLook } from '@/lib/catIdentity'

export type OnbStageKind = 'build' | 'std' | 'partner'

interface Decor { icon: MeadowIconName; side: 'left' | 'right'; x: number; top: number; size: number }
interface Layout {
  h: number
  cat: { w: number; h: number; top: number; left: string }
  shadow: { w: number; h: number; top: number; left: string }
  decor: Decor[]
}

// Head centre sits at 43% of the sprite's width (KIT "cat sprite maths").
const centred = (w: number) => `calc(50% - ${(0.43 * w).toFixed(1)}px)`

const LAYOUT: Record<OnbStageKind, Layout> = {
  build: {
    h: 380,
    cat: { w: 202, h: 272, top: 82, left: centred(202) },
    shadow: { w: 150, h: 16, top: 342, left: 'calc(50% - 75px)' },
    decor: [
      { icon: 'daisy', side: 'left', x: 20, top: 316, size: 36 },
      { icon: 'tuft', side: 'left', x: 50, top: 330, size: 36 },
      { icon: 'tuft', side: 'right', x: 52, top: 330, size: 36 },
      { icon: 'daisy', side: 'right', x: 20, top: 312, size: 36 },
    ],
  },
  std: {
    h: 364,
    cat: { w: 170, h: 229, top: 109, left: centred(170) },
    shadow: { w: 144, h: 16, top: 328, left: 'calc(50% - 72px)' },
    decor: [
      { icon: 'daisy', side: 'left', x: 20, top: 300, size: 36 },
      { icon: 'tuft', side: 'left', x: 50, top: 314, size: 36 },
      { icon: 'tuft', side: 'right', x: 50, top: 314, size: 36 },
      { icon: 'daisy', side: 'right', x: 18, top: 296, size: 36 },
    ],
  },
  partner: {
    h: 250,
    cat: { w: 142, h: 191, top: 36, left: '44px' },
    shadow: { w: 106, h: 14, top: 210, left: '52px' },
    decor: [
      { icon: 'tuft', side: 'left', x: 12, top: 190, size: 30 },
      { icon: 'tuft', side: 'right', x: 24, top: 196, size: 36 },
      { icon: 'daisy', side: 'right', x: 70, top: 184, size: 36 },
    ],
  },
}

interface Props {
  kind: OnbStageKind
  /** null = the classic cat. */
  look: CatLook | null
  /** The joiner's cat, not met yet: drawn as a shadow. */
  silhouette?: boolean
  alt: string
  children?: ReactNode
  style?: CSSProperties
}

export default function OnbStage({ kind, look, silhouette = false, alt, children, style }: Props) {
  const L = LAYOUT[kind]
  return (
    <div style={{
      position: 'relative', height: L.h, margin: '0 20px', borderRadius: RADIUS.stage,
      background: M.soft, overflow: 'hidden', ...style,
    }}>
      <div aria-hidden style={{
        position: 'absolute', left: 'calc(50% - 280px)', top: L.h - 80, width: 560, height: 220,
        borderRadius: '50%', background: M.hill,
      }} />
      {L.decor.map((d, i) => (
        <span key={i} aria-hidden style={{ position: 'absolute', top: d.top, [d.side]: d.x }}>
          <MeadowIcon name={d.icon} size={d.size} />
        </span>
      ))}
      <div aria-hidden style={{
        position: 'absolute', left: L.shadow.left, top: L.shadow.top, width: L.shadow.w, height: L.shadow.h,
        borderRadius: '50%', background: M.hillShadow,
      }} />
      <CatFigure
        look={look}
        width={L.cat.w}
        height={L.cat.h}
        alt={alt}
        silhouette={silhouette}
        style={{ position: 'absolute', left: L.cat.left, top: L.cat.top }}
      />
      {children}
    </div>
  )
}

/**
 * The cat's line, centred over the stage with its tail pointing down at the
 * head. `top` 18 for two lines, 40 for one (the boards' positions). It pops in
 * when the screen arrives.
 */
export function StageBubble({ top, width, minWidth, children }: {
  top: number; width?: number; minWidth?: number; children: ReactNode
}) {
  const reduced = useReducedMotion()
  return (
    <div style={{
      position: 'absolute', left: 16, right: 16, top, display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <SpeechBubble style={{
        width, minWidth, maxWidth: '100%', whiteSpace: 'pre-line', textWrap: 'balance',
        animation: reduced ? undefined : 'modalPop 240ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both',
        transformOrigin: '50% 100%',
      } as CSSProperties}>
        {children}
      </SpeechBubble>
    </div>
  )
}

/** A bubble whose tail points left, at a cat standing to its left (Fine-tune, Invite). */
export function SideBubble({ left, top, maxWidth, children }: {
  left: number; top: number; maxWidth: number; children: ReactNode
}) {
  const reduced = useReducedMotion()
  return (
    <SpeechBubble tail="left" tailOffset={26} style={{
      position: 'absolute', left, right: 12, top, maxWidth, padding: '12px 14px', textAlign: 'left',
      animation: reduced ? undefined : 'modalPop 240ms cubic-bezier(0.2, 0.8, 0.2, 1) 120ms both',
      transformOrigin: '0 50%',
    }}>
      {children}
    </SpeechBubble>
  )
}
