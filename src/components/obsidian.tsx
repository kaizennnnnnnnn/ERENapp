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
// row + the quest pill. Each button is tinted to its own icon colour (an
// `r,g,b` triplet), squircle-rounded, ringed + glowing in that colour, and
// half-filled with a liquid so it reads like a little potion jar.

/** Cute button chrome. Pass the button's accent colour as `r,g,b`. */
export const cuteBtn = (rgb: string): CSSProperties => ({
  background: `radial-gradient(circle at 50% 16%, rgba(${rgb},0.42) 0%, rgba(${rgb},0.14) 46%, rgba(10,8,20,0.9) 100%)`,
  border: `1.5px solid rgba(${rgb},0.78)`,
  borderRadius: 11,
  boxShadow: `0 0 9px rgba(${rgb},0.42), 0 2px 6px rgba(0,0,0,0.5), inset 0 1.5px 0 rgba(255,255,255,0.32), inset 0 -2px 5px rgba(0,0,0,0.38)`,
})

/** Glossy top sheen — the "candy" highlight. Render before the icon so the
 *  icon paints on top. The parent must be `position: relative`. */
export function Gloss() {
  return (
    <span aria-hidden style={{
      position: 'absolute', top: 2, left: 3, right: 3, height: '38%',
      borderRadius: 9,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)',
      pointerEvents: 'none',
    }} />
  )
}

/** Liquid that fills the whole button behind the icon, clipped to the
 *  button's rounded corners — a full, vivid colour gel tinted to `rgb`,
 *  slightly deeper toward the bottom for depth. Render before the icon. */
export function Liquid({ rgb }: { rgb: string }) {
  return (
    <span aria-hidden style={{
      position: 'absolute', top: 1.5, left: 1.5, right: 1.5, bottom: 1.5,
      borderRadius: 9,
      background: `linear-gradient(180deg, rgba(${rgb},0.68) 0%, rgba(${rgb},0.86) 58%, rgba(${rgb},0.96) 100%)`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -3px 6px rgba(0,0,0,0.3)',
      pointerEvents: 'none',
    }} />
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
