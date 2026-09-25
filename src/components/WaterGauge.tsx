'use client'

import { IconHeart, IconMeat, IconLightning, IconMoon, IconDrop } from './PixelIcons'
import { accentA } from './obsidian'

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
// The old HUD's gauge, kept as it was: a dark ring round a well that fills
// from the bottom, the surface waving, amber under 60, red under 30 and
// beating under 15. Only the dark tile, the dots and the number around it are
// gone, so five fit in one slim pill. It shrinks with the pill on a narrow
// phone (a square from 24px, where the 14px icon still clears the well, up
// to 36px). `value` null = the stats row hasn't loaded:
// an empty, calm glass rather than five red alarms at zero.
export default function WaterGauge({ def, value }: { def: GaugeDef; value: number | null }) {
  const known = value !== null
  const v = known ? Math.round(Math.max(0, Math.min(100, value))) : 0
  const isCrit = known && v < 15
  const isLow  = v < 30
  const tier: 'low' | 'mid' | 'high' = v >= 60 ? 'high' : v >= 30 ? 'mid' : 'low'

  const fillTop = tier === 'low' ? '#FF6B6B' : tier === 'mid' ? '#F2D77A' : def.hue[0]
  const fillBot = tier === 'low' ? '#8B2020' : tier === 'mid' ? '#A87826' : def.hue[1]
  const ringGlow =
    !known ? 'transparent' :
    tier === 'low' ? 'rgba(248,113,113,0.5)' :
    tier === 'mid' ? 'rgba(242,215,122,0.4)' :
    `${accentA(0.4)}`

  return (
    <div
      role="img"
      aria-label={known ? `${def.label} ${v}%` : `${def.label}, loading`}
      className={isCrit ? 'animate-heartbeat' : ''}
      style={{
        flex: '1 1 0', minWidth: 24, maxWidth: 36, aspectRatio: '1 / 1', position: 'relative',
        borderRadius: '50%',
        background: '#000',
        boxShadow: [
          `inset 0 0 0 1.5px ${accentA(0.53)}`,
          'inset 0 0 0 3px #000',
          `inset 0 0 0 4px ${accentA(0.2)}`,
          `0 0 8px ${ringGlow}`,
          '0 0 0 2px rgba(0,0,0,0.4)',
        ].join(','),
        overflow: 'hidden',
      }}>
      {/* Inner well */}
      <div style={{
        position: 'absolute', inset: 4,
        borderRadius: '50%',
        background: '#050507',
        overflow: 'hidden',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
      }}>
        {/* Liquid fill */}
        {known && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            height: `${v}%`,
            background: `linear-gradient(180deg, ${fillTop} 0%, ${fillBot} 100%)`,
            transition: 'height 700ms ease-out',
            boxShadow: `0 0 8px ${fillTop}66 inset`,
          }}>
            {/* Wave at the surface */}
            <div style={{
              position: 'absolute', top: -2, left: '-50%', width: '200%', height: 4,
              background: `radial-gradient(circle 3px at 3px 2px, ${fillTop} 50%, transparent 51%) repeat-x`,
              backgroundSize: '6px 4px',
              animation: `obsidian-wave ${isLow ? '1.4s' : '2.6s'} linear infinite`,
              opacity: 0.85,
            }} />
            {/* Highlight on the liquid */}
            <div style={{
              position: 'absolute', left: '15%', right: '15%', top: '8%', height: '25%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)',
              borderRadius: '50%',
              filter: 'blur(0.5px)',
            }} />
          </div>
        )}

        {/* Centered icon */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.9)) drop-shadow(0 1px 0 rgba(255,255,255,0.15))' }}>
            <def.Icon size={14} />
          </div>
        </div>
      </div>

      {/* Glass top sheen */}
      <div style={{
        position: 'absolute', left: '18%', right: '18%', top: '10%', height: '25%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
