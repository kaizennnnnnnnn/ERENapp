'use client'

import { IconHeart, IconMeat, IconLightning, IconMoon, IconDrop } from './PixelIcons'
import { HEADER_GROW, M } from '@/components/meadow/tokens'
import { useReducedMotion } from '@/hooks/useReducedMotion'

// ─── Need gauges ─────────────────────────────────────────────────────────────
// The cat's five needs as the top bar shows them (StatsHeader): a ring round
// each need's icon, drawn like the level circle beside them, so the whole bar
// reads as one family. Their own file so the bar stays about the bar, and so a
// preview can draw them with any values.

export type StatKey = 'happiness' | 'hunger' | 'energy' | 'sleep_quality' | 'cleanliness'

export interface GaugeDef {
  key: StatKey
  /** Read out with the value: "Food 42%". */
  label: string
  Icon: React.ComponentType<{ size?: number }>
  /** The ring's colour while the need is fine. */
  color: string
}

export const GAUGES: GaugeDef[] = [
  { key: 'happiness',     label: 'Happiness', Icon: IconHeart,     color: '#C77E96' },
  { key: 'hunger',        label: 'Food',      Icon: IconMeat,      color: '#A87826' },
  { key: 'energy',        label: 'Energy',    Icon: IconLightning, color: '#3F9763' },
  { key: 'sleep_quality', label: 'Sleep',     Icon: IconMoon,      color: '#5A6BA8' },
  { key: 'cleanliness',   label: 'Clean',     Icon: IconDrop,      color: '#3D7BA8' },
]

// Past these the ring stops being the need's colour: amber under 60, red under
// 30, and the whole gauge beats under 15.
const AMBER = '#E3A63A'
const RED = '#E0565A'

/** The ring, in the 32-unit viewBox the gauge scales from. */
const R = 13
const C = 2 * Math.PI * R

// ── One need ────────────────────────────────────────────────────────────────
// A 32px circle, 46 in a care room (it shrinks with the pill on a narrow
// phone, down to 24px, where the 14px icon still clears the ring). The ring and
// icon scale together, and ease when the size changes. The arc is the need's
// level and eases when it moves. `value` null = the stats row hasn't loaded:
// the bare track, calm, rather than five red alarms at zero.
export default function NeedGauge({ def, value, size = 32 }: { def: GaugeDef; value: number | null; size?: number }) {
  const known = value !== null
  const v = known ? Math.round(Math.max(0, Math.min(100, value))) : 0
  const isCrit = known && v < 15
  const color = v >= 60 ? def.color : v >= 30 ? AMBER : RED
  const still = useReducedMotion()

  return (
    <div
      role="img"
      aria-label={known ? `${def.label} ${v}%` : `${def.label}, loading`}
      className={isCrit ? 'animate-heartbeat' : ''}
      style={{
        // A width, not only a flex-basis: the pill sizes to its content, and a
        // gauge has no content width of its own.
        width: size, flexShrink: 1, minWidth: 24, aspectRatio: '1 / 1', position: 'relative',
        transition: still ? undefined : `width ${HEADER_GROW}`,
      }}>
      <svg width="100%" height="100%" viewBox="0 0 32 32" aria-hidden style={{ position: 'absolute', inset: 0 }}>
        <circle cx="16" cy="16" r={R} fill="none" stroke={M.track} strokeWidth="4" />
        {/* A zero-length round cap would still paint a dot, so no arc at 0. */}
        {known && v > 0 && (
          <circle cx="16" cy="16" r={R} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
            transform="rotate(-90 16 16)"
            style={{ strokeDasharray: `${(v / 100) * C} ${C}`, transition: 'stroke-dasharray 700ms ease-out, stroke 300ms ease' }} />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Scaled rather than redrawn, so it grows with the ring. The pixel
            icons are SVG, so they stay sharp. */}
        <span style={{ display: 'flex', transform: `scale(${size / 32})`, transition: still ? undefined : `transform ${HEADER_GROW}` }}>
          <def.Icon size={14} />
        </span>
      </div>
    </div>
  )
}
