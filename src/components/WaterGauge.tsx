'use client'

import { IconHeart, IconMeat, IconLightning, IconMoon, IconDrop } from './PixelIcons'
import { M } from '@/components/meadow/tokens'

// ─── Water gauges ────────────────────────────────────────────────────────────
// The cat's five needs, as the round glasses of water the top bar shows
// (StatsHeader). Their own file so the bar stays about the bar, and so a
// preview can draw them with any values.

export type StatKey = 'happiness' | 'hunger' | 'energy' | 'sleep_quality' | 'cleanliness'

export interface GaugeDef {
  key: StatKey
  /** Read out with the value: "Food 42%". */
  label: string
  Icon: React.ComponentType<{ size?: number }>
  hue: [string, string]   // [topFill, bottomFill] for the high tier
}

export const GAUGES: GaugeDef[] = [
  { key: 'happiness',     label: 'Happiness', Icon: IconHeart,     hue: ['#F4C2D5', '#C77E96'] },
  { key: 'hunger',        label: 'Food',      Icon: IconMeat,      hue: ['#F0C97A', '#A87826'] },
  { key: 'energy',        label: 'Energy',    Icon: IconLightning, hue: ['#9FE0B2', '#3F9763'] },
  { key: 'sleep_quality', label: 'Sleep',     Icon: IconMoon,      hue: ['#B8C5F0', '#5A6BA8'] },
  { key: 'cleanliness',   label: 'Clean',     Icon: IconDrop,      hue: ['#A8D8F0', '#3D7BA8'] },
]

// ── One need, as a round glass of water ─────────────────────────────────────
// A light glass that fills from the bottom: the surface waves, the water is
// the need's own colour when it's fine, amber under 60, red under 30, and the
// glass beats under 15. Meadow-light (a cream well, a soft rim) where the old
// HUD's was an obsidian porthole; the water itself is the same. It shrinks
// with the pill on a narrow phone, from 32px down to 24px (where the 14px icon
// still clears the rim). `value` null = the stats row hasn't loaded: an
// empty, calm glass rather than five red alarms at zero.
export default function WaterGauge({ def, value }: { def: GaugeDef; value: number | null }) {
  const known = value !== null
  const v = known ? Math.round(Math.max(0, Math.min(100, value))) : 0
  const isCrit = known && v < 15
  const isLow  = v < 30
  const tier: 'low' | 'mid' | 'high' = v >= 60 ? 'high' : v >= 30 ? 'mid' : 'low'

  const fillTop = tier === 'low' ? '#FF8A8A' : tier === 'mid' ? '#F5DC8A' : def.hue[0]
  const fillBot = tier === 'low' ? '#D14848' : tier === 'mid' ? '#D9A640' : def.hue[1]
  // The rim warms with the need: neutral when fine, amber, then red.
  const rim =
    !known || tier === 'high' ? '#E4DED4' :
    tier === 'mid' ? '#EBCB7E' : '#EE9A9A'

  return (
    <div
      role="img"
      aria-label={known ? `${def.label} ${v}%` : `${def.label}, loading`}
      className={isCrit ? 'animate-heartbeat' : ''}
      style={{
        // A width, not only a flex-basis: the pill sizes to its content, and a
        // glass has no content width of its own.
        width: 32, flexShrink: 1, minWidth: 24, aspectRatio: '1 / 1', position: 'relative',
        borderRadius: '50%',
        background: M.soft,
        overflow: 'hidden',
        // A critical need glows red round the glass, on top of the beat.
        boxShadow: isCrit ? '0 0 0 3px rgba(238,110,110,0.28)' : 'none',
      }}>
      {/* The water */}
      {known && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: `${v}%`,
          background: `linear-gradient(180deg, ${fillTop} 0%, ${fillBot} 100%)`,
          transition: 'height 700ms ease-out',
        }}>
          {/* Wave at the surface */}
          <div style={{
            position: 'absolute', top: -2, left: '-50%', width: '200%', height: 4,
            background: `radial-gradient(circle 3px at 3px 2px, ${fillTop} 50%, transparent 51%) repeat-x`,
            backgroundSize: '6px 4px',
            animation: `obsidian-wave ${isLow ? '1.4s' : '2.6s'} linear infinite`,
          }} />
          {/* Highlight on the water */}
          <div style={{
            position: 'absolute', left: '15%', right: '15%', top: '8%', height: '25%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)',
            borderRadius: '50%',
          }} />
        </div>
      )}

      {/* Centered icon */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.7))' }}>
          <def.Icon size={14} />
        </div>
      </div>

      {/* Rim, and the glass's sheen, over the water. */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none',
        boxShadow: `inset 0 0 0 2px ${rim}`,
      }} />
      <div style={{
        position: 'absolute', left: '20%', right: '20%', top: '9%', height: '22%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
