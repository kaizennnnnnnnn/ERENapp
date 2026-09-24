'use client'

// ─── Stage + SpeechBubble ────────────────────────────────────────────────────
// The Meadow signature: the cat stands on a soft grey stage with a tiny pixel
// meadow under its feet (a flat green hill, a darker patch where the feet go,
// two daisies and two tufts), and talks in a rounded bubble. Nothing else is
// decoration: no blobs, no glow, no gradients.

import type { CSSProperties, ReactNode } from 'react'
import { MeadowIcon, type MeadowIconName } from '@/components/PixelIcons'
import { FONT_ROUNDED, M } from './tokens'

// ─── Stage ───────────────────────────────────────────────────────────────────

export interface StageProps {
  width: number | string
  height: number
  /**
   * 'large' = the onboarding stage (O2: 350x380, 36px flowers, radius 28).
   * 'portrait' = the small cat card on Me / Settings (128x148, 24px flowers, radius 18).
   */
  variant?: 'large' | 'portrait'
  /** Horizontal centre of the patch under the cat's feet, in px. Defaults to the middle. */
  footX?: number
  /** Numeric width is needed to place the right-hand flowers when width is a string. */
  measuredWidth?: number
  bg?: string
  radius?: number
  /** The cat, the bubble, any round buttons: absolutely positioned by the caller, drawn over the meadow. */
  children?: ReactNode
  style?: CSSProperties
  className?: string
}

/**
 * The hill and flowers follow the boards' rule for any stage height H:
 * large: hill top H-80, feet patch top H-38, daisies/tufts at H-64 / H-50;
 * portrait: hill top H-48, patch H-22, tuft H-40, daisy H-46.
 */
export function Stage({
  width, height: H, variant = 'large', footX, measuredWidth, bg = M.soft, radius, children, style, className,
}: StageProps) {
  const W = typeof width === 'number' ? width : measuredWidth ?? 350
  const large = variant === 'large'
  const cx = footX ?? W / 2
  const hill = large ? { w: 560, h: 220, top: H - 80 } : { w: 240, h: 120, top: H - 48 }
  const patch = large ? { w: 150, h: 16, top: H - 38 } : { w: 76, h: 10, top: H - 22 }
  const flower = large ? 36 : 24
  const decor: Array<{ icon: MeadowIconName; left: number; top: number }> = large
    ? [
        { icon: 'daisy', left: 20, top: H - 64 },
        { icon: 'tuft', left: 50, top: H - 50 },
        { icon: 'tuft', left: W - 88, top: H - 50 },
        { icon: 'daisy', left: W - 56, top: H - 68 },
      ]
    : [
        { icon: 'tuft', left: 4, top: H - 40 },
        { icon: 'daisy', left: W - 28, top: H - 46 },
      ]
  return (
    <div className={className} style={{
      position: 'relative', width, height: H, flexShrink: 0, borderRadius: radius ?? (large ? 28 : 18),
      background: bg, overflow: 'hidden', ...style,
    }}>
      <div aria-hidden style={{
        position: 'absolute', left: (W - hill.w) / 2, top: hill.top, width: hill.w, height: hill.h,
        borderRadius: '50%', background: M.hill,
      }} />
      <div aria-hidden style={{
        position: 'absolute', left: cx - patch.w / 2, top: patch.top, width: patch.w, height: patch.h,
        borderRadius: '50%', background: M.hillShadow,
      }} />
      {decor.map((d, i) => (
        <span key={i} aria-hidden style={{ position: 'absolute', left: d.left, top: d.top }}>
          <MeadowIcon name={d.icon} size={flower} />
        </span>
      ))}
      {children}
    </div>
  )
}

// ─── SpeechBubble ────────────────────────────────────────────────────────────

export interface SpeechBubbleProps {
  children: ReactNode
  /**
   * The bubble's own colour. White on the stage or over room art; soft grey
   * (#F4F2EE) when the bubble sits on a white ground. The tail matches.
   */
  surface?: 'white' | 'soft'
  /** Where the tail points from: 'down' (towards a cat below), 'left', or none. */
  tail?: 'down' | 'left' | 'none'
  /** px from the bubble's left edge (tail down) or top edge (tail left) to the tail. */
  tailOffset?: number
  /** 'lg' = the onboarding question (17/1.35, centred); 'md' = the home wish (15, left, with an icon). */
  size?: 'lg' | 'md'
  /** A small icon before the text (the wish star). */
  icon?: MeadowIconName
  /** Position/width come from the caller (the bubble is usually absolute). */
  style?: CSSProperties
  className?: string
}

export function SpeechBubble({
  children, surface = 'white', tail = 'down', tailOffset, size = 'lg', icon, style, className,
}: SpeechBubbleProps) {
  const bg = surface === 'white' ? '#FFFFFF' : M.soft
  const lg = size === 'lg'
  const tailCss: CSSProperties | null = tail === 'none' ? null : tail === 'down'
    ? { left: tailOffset ?? 'calc(50% - 7px)', bottom: -6 }
    : { left: -6, top: tailOffset ?? 18 }
  return (
    <div className={className} style={{
      position: 'relative', boxSizing: 'border-box', padding: lg ? '12px 16px' : '10px 14px 11px',
      borderRadius: 20, background: bg, fontFamily: FONT_ROUNDED, fontSize: lg ? 17 : 15, lineHeight: 1.35,
      fontWeight: 700, color: M.text, textAlign: lg && !icon ? 'center' : 'left',
      display: icon ? 'flex' : 'block', alignItems: 'flex-start', gap: 10, ...style,
    }}>
      {icon && <MeadowIcon name={icon} size={20} style={{ marginTop: 2 }} />}
      {icon ? <span>{children}</span> : children}
      {tailCss && (
        <span aria-hidden style={{
          position: 'absolute', width: 14, height: 14, background: bg, transform: 'rotate(45deg)', ...tailCss,
        }} />
      )}
    </div>
  )
}
