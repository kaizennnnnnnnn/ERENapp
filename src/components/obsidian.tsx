// ═══════════════════════════════════════════════════════════════════════════
// OBSIDIAN CHROME — shared building blocks for the dark HUD theme.
// Single source of truth for the panel face, button chrome, rivet pixels,
// and gradient text used across StatsHeader, home, couple, etc.
//
// Color values resolve through CSS variables (--accent / --accent-hi /
// --accent-lo, plus the *-rgb variants for transparency) so the palette
// can swap at runtime via ThemeProvider without re-rendering every styled
// component.
// ═══════════════════════════════════════════════════════════════════════════
import type { CSSProperties, ReactNode } from 'react'

// ── Palette (CSS-var aliases — the names PINK*/PINK_HI/PINK_LO are kept
// for historical reasons; the actual hue depends on the active theme). ──
export const PINK    = 'var(--accent)'
export const PINK_HI = 'var(--accent-hi)'
export const PINK_LO = 'var(--accent-lo)'

/** rgba(accent) at the given opacity. Replaces the old `${accentA(0.33)}`-style
 *  hex+alpha appendix, which doesn't compose with var(). */
export const accentA   = (a: number) => `rgba(var(--accent-rgb), ${a})`
export const accentLoA = (a: number) => `rgba(var(--accent-lo-rgb), ${a})`

// Gradient text fill ("liquid rose" — used for headline numbers/labels).
export const pinkText: CSSProperties = {
  background: `linear-gradient(180deg, ${PINK_HI} 0%, ${PINK} 50%, ${PINK_LO} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: `drop-shadow(0 0 2px ${accentA(0.33)})`,
}

// ── Surfaces ──

/** Card / panel face — large surfaces (anniversary card, gauge wells, etc.) */
export const OBSIDIAN_FACE: CSSProperties = {
  background: 'linear-gradient(180deg, #131317 0%, #050507 100%)',
  border: `1px solid ${accentA(0.33)}`,
  boxShadow: [
    '0 4px 14px rgba(0,0,0,0.6)',
    'inset 0 1px 0 rgba(255,255,255,0.06)',
    'inset 0 -1px 0 rgba(0,0,0,0.6)',
    'inset 0 0 0 1px rgba(255,255,255,0.02)',
  ].join(','),
  borderRadius: 4,
}

/** Smaller / interactive chrome — nav buttons, send button, chips. */
export const OBSIDIAN_BTN: CSSProperties = {
  background: 'linear-gradient(180deg, #131317 0%, #050507 100%)',
  border: `1px solid ${accentA(0.53)}`,
  boxShadow: [
    '0 3px 10px rgba(0,0,0,0.55)',
    'inset 0 1px 0 rgba(255,255,255,0.07)',
    'inset 0 -1px 0 rgba(0,0,0,0.6)',
  ].join(','),
  borderRadius: 4,
}

// ── Cute candy buttons ──
// A softer, friendlier variant of OBSIDIAN_BTN used for the home HUD nav
// row + the quest pill. Each button is a SOLID colour candy tile (passed as
// an `r,g,b` triplet) with a glossy top highlight and a chunky drop. The
// button colour is chosen to CONTRAST its icon — never the icon's own hue —
// so the pixel icon stays clearly readable on top.

/** Cute button chrome. Pass the button's solid colour as `r,g,b`. */
export const cuteBtn = (rgb: string): CSSProperties => ({
  background: `rgb(${rgb})`,
  border: '1.5px solid rgba(0,0,0,0.32)',
  borderRadius: 11,
  boxShadow: `0 0 7px rgba(${rgb},0.4), 0 2px 5px rgba(0,0,0,0.45), inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 5px rgba(0,0,0,0.22)`,
})

/** Wraps a pixel icon with a soft dark drop-shadow so its edges separate
 *  from the solid button colour underneath. */
export function CuteIcon({ children }: { children: ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', position: 'relative',
      filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.5))',
    }}>
      {children}
    </span>
  )
}

/** Circular orb chrome — level badge, VS badge, avatar circles. */
export const OBSIDIAN_ORB: CSSProperties = {
  borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 28%, #2a2a2e 0%, #0a0a0c 50%, #000 100%)',
  boxShadow: [
    `0 0 0 1.5px ${PINK}`,
    '0 0 0 3px #000',
    `0 0 0 4px ${accentA(0.33)}`,
    '0 4px 14px rgba(0,0,0,0.7)',
    'inset 0 1px 0 rgba(255,255,255,0.15)',
  ].join(','),
}

// ── Components ──

/** Four corner rivets (3×3 px each, pink radial-gradient gem look). */
export function Rivets({ inset = 3, size = 3 }: { inset?: number; size?: number }) {
  const dot: CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    background: `radial-gradient(circle at 30% 30%, ${PINK_HI}, ${PINK} 60%, ${PINK_LO})`,
    boxShadow: `0 0 3px ${accentA(0.67)}`,
    pointerEvents: 'none',
  }
  return (
    <>
      <span style={{ ...dot, top: inset, left: inset }} />
      <span style={{ ...dot, top: inset, right: inset }} />
      <span style={{ ...dot, bottom: inset, left: inset }} />
      <span style={{ ...dot, bottom: inset, right: inset }} />
    </>
  )
}

/**
 * Inline pill — obsidian button chrome with rivets and an optional accent
 * tint streak across the middle.
 *   <ObsidianChip>...</ObsidianChip>
 */
export function ObsidianChip({
  children,
  accentRgb,
}: {
  children: ReactNode
  /** Optional `r,g,b` triplet for a subtle horizontal accent streak. */
  accentRgb?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 relative" style={{
      padding: '5px 10px 5px 8px',
      ...OBSIDIAN_BTN,
    }}>
      <Rivets inset={2} size={2} />
      {accentRgb && (
        <span aria-hidden style={{
          position: 'absolute', inset: 0, borderRadius: 4, pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent, rgba(${accentRgb},0.10), transparent)`,
        }} />
      )}
      {children}
    </span>
  )
}
