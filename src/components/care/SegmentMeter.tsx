'use client'

// A premium segmented "LED gauge" shared by the care rooms — the bathroom's
// SOAP / RINSE meters, the playroom ENERGY bar, and the bedroom SLEEP QUALITY
// bar all render through this. The segments sit in a recessed dark channel
// with a hard pixel drop-shadow, themed corner rivets, glossy gradient-lit
// segments, a brighter pulsing "fill head", and a slow shimmer sweep across
// the lit portion. Pixel-art consistent: hard offsets, crisp edges, no blurry
// surfaces. Each room passes its own `palette` so the colour story stays local
// while the premium chrome stays shared (DRY).
//
// Motion (`meterSheen`, `meterHead`) lives in globals.css.

const PIXEL_FONT = '"Press Start 2P", monospace'

export interface MeterPalette {
  fillHi: string      // top of the lit segment gradient
  fillBase: string    // mid of the lit segment gradient
  fillLo: string      // bottom of the lit segment gradient
  fillEdge: string    // lit segment border
  glow: string        // rgba glow cast by lit segments
  track: string       // unlit segment fill
  trackEdge: string   // unlit segment border
  groove: string      // recessed channel background behind the segments
  frame: string       // channel border + hard drop-shadow ink
  rivet: string       // corner rivet colour
}

interface Props {
  label: string
  value: number                 // 0–100, drives the fill
  palette: MeterPalette
  valueText?: string            // right-side readout (default: rounded value)
  segments?: number             // default 12
  labelColor: string
  valueColor: string
  shimmer?: boolean             // sweeping highlight across lit area (default true)
}

const RIVET_POS = [
  { left: 3, top: 3 },
  { right: 3, top: 3 },
  { left: 3, bottom: 3 },
  { right: 3, bottom: 3 },
] as const

export default function SegmentMeter({
  label, value, palette: p, valueText, segments = 12,
  labelColor, valueColor, shimmer = true,
}: Props) {
  const clamped = Math.max(0, Math.min(100, value))
  const filled = Math.round((clamped / 100) * segments)
  const litFrac = filled / segments

  return (
    <div style={{ width: '100%' }}>
      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: PIXEL_FONT, fontSize: 7, letterSpacing: 1, color: labelColor, textShadow: '0 1px 0 rgba(0,0,0,0.35)' }}>{label}</span>
        <span style={{ fontFamily: PIXEL_FONT, fontSize: 7, letterSpacing: 0.5, color: valueColor, textShadow: '0 1px 0 rgba(0,0,0,0.35)' }}>{valueText ?? Math.round(clamped)}</span>
      </div>

      {/* Recessed channel holding the segments */}
      <div style={{
        position: 'relative',
        display: 'flex',
        gap: 2,
        padding: 3,
        borderRadius: 4,
        background: p.groove,
        border: `2px solid ${p.frame}`,
        boxShadow: `0 2px 0 ${p.frame}, inset 0 2px 3px rgba(0,0,0,0.5)`,
      }}>
        {Array.from({ length: segments }).map((_, i) => {
          const lit = i < filled
          const isHead = lit && i === filled - 1
          return (
            <div key={i} style={{
              flex: 1,
              height: 11,
              borderRadius: 1.5,
              background: lit
                ? `linear-gradient(180deg, ${p.fillHi} 0%, ${p.fillBase} 55%, ${p.fillLo} 100%)`
                : p.track,
              border: `1px solid ${lit ? p.fillEdge : p.trackEdge}`,
              boxShadow: lit
                ? `inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.3), 0 0 ${isHead ? 6 : 3}px ${p.glow}`
                : 'inset 0 1px 1px rgba(0,0,0,0.4)',
              animation: isHead ? 'meterHead 1.4s ease-in-out infinite' : undefined,
              transition: 'background 0.15s, box-shadow 0.15s',
              transitionDelay: `${i * 18}ms`,
            }} />
          )
        })}

        {/* Shimmer sweep, clipped to roughly the lit portion */}
        {shimmer && filled > 0 && (
          <div aria-hidden style={{
            position: 'absolute', left: 3, top: 3, bottom: 3,
            width: `calc(${litFrac * 100}% - 6px)`,
            borderRadius: 1.5, overflow: 'hidden', pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)',
              animation: 'meterSheen 2.6s linear infinite',
            }} />
          </div>
        )}

        {/* Corner rivets — the premium-card signature used across the app */}
        {RIVET_POS.map((pos, i) => (
          <span key={`r${i}`} aria-hidden style={{
            position: 'absolute', ...pos, width: 2.5, height: 2.5,
            background: p.rivet, boxShadow: `1px 1px 0 ${p.frame}`,
          }} />
        ))}
      </div>
    </div>
  )
}
