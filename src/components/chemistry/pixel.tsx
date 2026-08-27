'use client'

// ═════════════════════════════════════════════════════════════════════════════
// The chemistry wing's pixel kit.
//
// The lab was the one corner of the app still wearing the imported neo-brutalism
// skin — rounded sans, soft 24px radii, circular progress rings — which is why
// it read as a different product bolted onto a pixel-art game. These are the
// three or four pieces every chemistry surface actually needs (panel, button,
// label, rivets, scanlines) in the house style: 2–3px borders, hard offset
// shadows with no blur, Press Start 2P for labels, gold rivets on the premium
// cards.
//
// Theme-aware, because the study overlay's light/dark toggle predates this and
// throwing it away would be a downgrade. Both skins are pixel skins — light is
// warm parchment with dark ink, dark is the same plum "game panel" the gacha,
// closet and collection screens already share.
// ═════════════════════════════════════════════════════════════════════════════

import type { CSSProperties, ReactNode } from 'react'
import type { Theme } from '@/lib/chemistry/theme'

export const PIXEL_FONT = '"Press Start 2P", monospace'
/** Body copy stays in a real sans — Press Start 2P is unreadable past a label. */
export const BODY_FONT = 'ui-rounded, "Quicksand", "Nunito", system-ui, -apple-system, sans-serif'

export interface PixelSkin {
  /** Page background (a gradient, so it goes on `background`). */
  bg: string
  /** CRT scanline colour. */
  scan: string
  /** Standard card surface. */
  panel: string
  /** Recessed surface — empty slots, grooves. */
  panelLo: string
  /** Lifted surface — buttons, tiles sitting on a panel. */
  raised: string
  /** Border colour. */
  edge: string
  /** Hard drop-shadow colour. Always the darkest thing in the skin. */
  ink: string
  fg: string
  fgDim: string
  /** Rivets and premium accents. */
  gold: string
  /** Text that sits ON a bright accent fill. */
  onAccent: string
  /** Flask outline. Deliberately NOT `ink` — a near-black outline on a dark
   *  bench turns the flask into a hole in the panel. */
  glassEdge: string
  /** Empty-glass interior, behind the liquid. */
  glassFill: string
}

const DARK: PixelSkin = {
  bg: 'radial-gradient(120% 80% at 50% 0%, #2A1B4A 0%, #160E2E 55%, #0B0717 100%)',
  scan: 'rgba(0,0,0,0.16)',
  panel: '#1B1233',
  panelLo: '#120B24',
  raised: '#2A1B4A',
  edge: '#4C1D95',
  ink: '#08040F',
  fg: '#FBF1D9',
  fgDim: '#B9A8D6',
  gold: '#F5C842',
  onAccent: '#1A0F2D',
  glassEdge: '#9C8BC9',
  glassFill: 'rgba(214,203,240,0.14)',
}

const LIGHT: PixelSkin = {
  bg: 'radial-gradient(120% 80% at 50% 0%, #FFF8E4 0%, #FBEBCB 55%, #F0DCB0 100%)',
  scan: 'rgba(90,60,20,0.05)',
  panel: '#FFF7DA',
  panelLo: '#EFDCB4',
  raised: '#FFFDF2',
  edge: '#7C3AED',
  ink: '#2A1B0A',
  fg: '#2A1B0A',
  fgDim: '#7A6242',
  gold: '#D97706',
  onAccent: '#1A0F2D',
  glassEdge: '#4A3520',
  glassFill: 'rgba(42,27,10,0.08)',
}

export function pixelSkin(theme: Theme): PixelSkin {
  return theme === 'light' ? LIGHT : DARK
}

/** Hard offset shadow. No blur, ever — that's the whole look. */
export const hard = (ink: string, size = 3): string => `${size}px ${size}px 0 ${ink}`

const RIVET_POS = [
  { left: 3, top: 3 },
  { right: 3, top: 3 },
  { left: 3, bottom: 3 },
  { right: 3, bottom: 3 },
] as const

/** Four gold corner pixels — the app's marker for a "premium" surface. */
export function Rivets({ color, ink }: { color: string; ink: string }) {
  return (
    <>
      {RIVET_POS.map((p, i) => (
        <span key={i} aria-hidden style={{
          position: 'absolute', ...p, width: 3, height: 3,
          background: color, boxShadow: `1px 1px 0 ${ink}`,
        }} />
      ))}
    </>
  )
}

/** Full-bleed CRT scanlines. Sits above the background, below the content. */
export function Scanlines({ skin, zIndex = 1 }: { skin: PixelSkin; zIndex?: number }) {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: `repeating-linear-gradient(0deg, ${skin.scan} 0px, ${skin.scan} 1px, transparent 1px, transparent 3px)`,
      zIndex,
    }} />
  )
}

interface PanelProps {
  skin: PixelSkin
  /** Override the surface — pass an accent to make the whole card coloured. */
  tone?: string
  rivets?: boolean
  style?: CSSProperties
  children: ReactNode
}

export function PixelPanel({ skin, tone, rivets, style, children }: PanelProps) {
  return (
    <div style={{
      position: 'relative',
      background: tone ?? skin.panel,
      border: `3px solid ${skin.edge}`,
      boxShadow: hard(skin.ink),
      padding: 12,
      ...style,
    }}>
      {rivets && <Rivets color={skin.gold} ink={skin.ink} />}
      {children}
    </div>
  )
}

/** Tiny all-caps pixel-font label — the app's section-heading voice. */
export function PixelLabel({ children, color, size = 7, style }: {
  children: ReactNode; color: string; size?: number; style?: CSSProperties
}) {
  return (
    <span style={{
      fontFamily: PIXEL_FONT, fontSize: size, letterSpacing: 1,
      lineHeight: 1.6, color, ...style,
    }}>
      {children}
    </span>
  )
}

interface ButtonProps {
  skin: PixelSkin
  /** Fill colour. Defaults to the raised surface. */
  tone?: string
  /** Text colour. Defaults to fg, or onAccent when a tone is given. */
  textColor?: string
  onClick: () => void
  disabled?: boolean
  ariaLabel?: string
  size?: number
  style?: CSSProperties
  children: ReactNode
}

export function PixelButton({
  skin, tone, textColor, onClick, disabled, ariaLabel, size = 8, style, children,
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="chem-pixel-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: '11px 14px',
        background: disabled ? skin.panelLo : (tone ?? skin.raised),
        color: disabled ? skin.fgDim : (textColor ?? (tone ? skin.onAccent : skin.fg)),
        border: `3px solid ${skin.edge}`,
        boxShadow: disabled ? 'none' : hard(skin.ink),
        transform: disabled ? 'translate(3px, 3px)' : undefined,
        fontFamily: PIXEL_FONT,
        fontSize: size,
        letterSpacing: 1,
        lineHeight: 1.6,
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
