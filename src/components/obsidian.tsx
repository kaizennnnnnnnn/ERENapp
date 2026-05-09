// ═══════════════════════════════════════════════════════════════════════════
// OBSIDIAN CHROME — shared building blocks for the dark/purple HUD theme.
// Single source of truth for the panel face, button chrome, rivet pixels,
// and gradient text used across StatsHeader, home, couple, etc.
// ═══════════════════════════════════════════════════════════════════════════
import type { CSSProperties, ReactNode } from 'react'

// ── Palette ──
export const PURPLE    = '#A78BFA'   // mid lavender — primary accent
export const PURPLE_HI = '#E9D5FF'   // pale highlight
export const PURPLE_LO = '#5B21B6'   // deep shadow

// Gradient text fill ("liquid amethyst" — used for headline numbers/labels).
export const purpleText: CSSProperties = {
  background: `linear-gradient(180deg, ${PURPLE_HI} 0%, ${PURPLE} 50%, ${PURPLE_LO} 100%)`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: `drop-shadow(0 0 2px ${PURPLE}55)`,
}

// ── Surfaces ──

/** Card / panel face — large surfaces (anniversary card, gauge wells, etc.) */
export const OBSIDIAN_FACE: CSSProperties = {
  background: 'linear-gradient(180deg, #131317 0%, #050507 100%)',
  border: `1px solid ${PURPLE}55`,
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
  border: `1px solid ${PURPLE}88`,
  boxShadow: [
    '0 3px 10px rgba(0,0,0,0.55)',
    'inset 0 1px 0 rgba(255,255,255,0.07)',
    'inset 0 -1px 0 rgba(0,0,0,0.6)',
  ].join(','),
  borderRadius: 4,
}

/** Circular orb chrome — level badge, VS badge, avatar circles. */
export const OBSIDIAN_ORB: CSSProperties = {
  borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 28%, #2a2a2e 0%, #0a0a0c 50%, #000 100%)',
  boxShadow: [
    `0 0 0 1.5px ${PURPLE}`,
    '0 0 0 3px #000',
    `0 0 0 4px ${PURPLE}55`,
    '0 4px 14px rgba(0,0,0,0.7)',
    'inset 0 1px 0 rgba(255,255,255,0.15)',
  ].join(','),
}

// ── Components ──

/** Four corner rivets (3×3 px each, purple radial-gradient gem look). */
export function Rivets({ inset = 3, size = 3 }: { inset?: number; size?: number }) {
  const dot: CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    background: `radial-gradient(circle at 30% 30%, ${PURPLE_HI}, ${PURPLE} 60%, ${PURPLE_LO})`,
    boxShadow: `0 0 3px ${PURPLE}aa`,
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
