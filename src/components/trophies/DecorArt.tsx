'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DECOR ART — the props the Trophy Shop hangs in the rooms.
//
// Drawn in code rather than shipped as PNGs, for two reasons: they have to
// look right at both a 60px shop thumbnail and a 200px wall fixture, and the
// trophy shelf is not static art at all — it shows the trophies you have
// actually won, so it has to be built from data.
//
// Each piece takes only a width; height follows from its own aspect. The
// parent positions it (see lib/trophyShop DECOR `at`).
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { TROPHY_TONE, type TrophyTier } from '@/lib/dailyTwist'
import type { DecorItem } from '@/lib/trophyShop'

export interface TrophyCounts {
  bronze: number
  silver: number
  gold: number
}

interface Props {
  art: DecorItem['art']
  /** CSS width. The piece sizes everything else off it. */
  width?: number | string
  /** Trophy shelf only. */
  counts?: TrophyCounts
  /** Quieter, for a shop card on a dark surface. */
  muted?: boolean
}

export default memo(function DecorArt({ art, width = '100%', counts, muted }: Props) {
  const style: React.CSSProperties = { width, display: 'block' }
  switch (art) {
    case 'trophy_shelf':  return <Shelf style={style} counts={counts} />
    case 'neon_champ':    return <Neon style={style} muted={muted} />
    case 'string_lights': return <Lights style={style} muted={muted} />
    case 'rosette':       return <Rosette style={style} />
    case 'pennants':      return <Pennants style={style} />
  }
})

// ─── Trophy shelf ────────────────────────────────────────────────────────────
// The one piece of decor that is a readout. Two boards; the trophies you have
// won stand on them, best first, and it fills up over months.

const SHELF_CAPACITY = 7

function Shelf({ style, counts }: { style: React.CSSProperties; counts?: TrophyCounts }) {
  const c = counts ?? { bronze: 0, silver: 0, gold: 0 }
  const line: TrophyTier[] = [
    ...Array(Math.min(c.gold, SHELF_CAPACITY)).fill('gold' as const),
    ...Array(Math.min(c.silver, SHELF_CAPACITY)).fill('silver' as const),
    ...Array(Math.min(c.bronze, SHELF_CAPACITY)).fill('bronze' as const),
  ].slice(0, SHELF_CAPACITY * 2)
  const top = line.slice(0, SHELF_CAPACITY)
  const bottom = line.slice(SHELF_CAPACITY, SHELF_CAPACITY * 2)

  return (
    <div style={{ ...style, position: 'relative' }}>
      <svg viewBox="0 0 100 62" width="100%" shapeRendering="crispEdges" style={{ display: 'block' }}>
        {/* back panel */}
        <rect x="2" y="1" width="96" height="60" fill="#2E1D10" />
        <rect x="4" y="3" width="92" height="56" fill="#3F2716" />
        {[0, 1].map(row => {
          const shelfY = 24 + row * 26
          const items = row === 0 ? top : bottom
          return (
            <g key={row}>
              {items.map((tier, i) => (
                <MiniTrophy key={i} x={7 + i * 12.6} y={shelfY - 15} tier={tier} />
              ))}
              {/* board */}
              <rect x="3" y={shelfY} width="94" height="4" fill="#8B5A2B" />
              <rect x="3" y={shelfY} width="94" height="1" fill="#C08B54" />
              <rect x="3" y={shelfY + 4} width="94" height="2" fill="#20140B" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** 10x15 trophy at 1 unit = 1 svg unit. */
function MiniTrophy({ x, y, tier }: { x: number; y: number; tier: TrophyTier }) {
  const body = TROPHY_TONE[tier]
  const dark = tier === 'gold' ? '#7A4F00' : tier === 'silver' ? '#6C7482' : '#8A4B18'
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0.5" y="0" width="9" height="6" fill={body} />
      <rect x="0.5" y="0" width="9" height="1" fill={dark} />
      <rect x="0" y="1" width="1" height="3" fill={dark} />
      <rect x="9.5" y="1" width="1" height="3" fill={dark} />
      <rect x="2.5" y="6" width="5" height="2" fill={body} />
      <rect x="4" y="8" width="2" height="3" fill={dark} />
      <rect x="1.5" y="11" width="7" height="2" fill={body} />
      <rect x="1.5" y="13" width="7" height="1" fill={dark} />
    </g>
  )
}

// ─── Neon CHAMPION sign ──────────────────────────────────────────────────────

function Neon({ style, muted }: { style: React.CSSProperties; muted?: boolean }) {
  const tube = '#FF4FA3'
  return (
    <div style={{
      ...style,
      padding: '6% 4%',
      border: '2px solid #14101C',
      borderRadius: 3,
      background: 'linear-gradient(180deg, rgba(20,14,28,0.9) 0%, rgba(8,5,12,0.9) 100%)',
      boxShadow: muted ? undefined : `0 0 14px ${tube}55, inset 0 0 10px ${tube}22`,
      textAlign: 'center',
    }}>
      <span className="font-pixel" style={{
        fontSize: '0.9em',
        color: '#FFD9EC',
        letterSpacing: 2,
        textShadow: muted
          ? undefined
          : `0 0 4px ${tube}, 0 0 10px ${tube}, 0 0 18px ${tube}`,
        animation: muted ? undefined : 'decNeon 4.5s ease-in-out infinite',
        display: 'inline-block',
      }}>CHAMPION</span>
      <style>{`
        @keyframes decNeon {
          0%, 44%, 48%, 100% { opacity: 1; }
          46%                { opacity: 0.45; }
          92%                { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}

// ─── String lights ───────────────────────────────────────────────────────────
// A swag of bulbs. The wire is a border-radius arc rather than an SVG path so
// it stays crisp at any width, and each bulb blinks on its own offset so the
// row never pulses in unison.

const BULB_TONES = ['#FFD650', '#FF6B9D', '#63F094', '#4FD8FF', '#FFB255']

function Lights({ style, muted }: { style: React.CSSProperties; muted?: boolean }) {
  const bulbs = 11
  return (
    <div style={{ ...style, position: 'relative', height: 0, paddingBottom: '9%' }}>
      <div style={{
        position: 'absolute', inset: 0,
        borderBottom: '2px solid #241C2E',
        borderRadius: '0 0 50% 50% / 0 0 100% 100%',
      }} />
      {Array.from({ length: bulbs }).map((_, i) => {
        const t = i / (bulbs - 1)
        // Follow the sag: a parabola, deepest in the middle.
        const sag = Math.sin(t * Math.PI) * 100
        const tone = BULB_TONES[i % BULB_TONES.length]
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${t * 100}%`,
            top: `${sag}%`,
            width: 5, height: 7,
            marginLeft: -2.5,
            background: tone,
            borderRadius: '40% 40% 50% 50%',
            boxShadow: muted ? undefined : `0 0 6px ${tone}, 0 0 12px ${tone}66`,
            animation: muted ? undefined : `decBulb 2.6s ease-in-out ${(i * 0.21).toFixed(2)}s infinite`,
          }} />
        )
      })}
      <style>{`
        @keyframes decBulb {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(0.55); }
        }
      `}</style>
    </div>
  )
}

// ─── Rosette ─────────────────────────────────────────────────────────────────

function Rosette({ style }: { style: React.CSSProperties }) {
  return (
    <div style={style}>
      <svg viewBox="0 0 40 56" width="100%" shapeRendering="crispEdges" style={{ display: 'block' }}>
        {/* pleated disc */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2
          return (
            <rect key={i}
              x={20 + Math.cos(a) * 13 - 3.5} y={20 + Math.sin(a) * 13 - 3.5}
              width="7" height="7" fill={i % 2 ? '#C8265F' : '#FF6B9D'} />
          )
        })}
        <circle cx="20" cy="20" r="11" fill="#FF8DB8" />
        <circle cx="20" cy="20" r="8" fill="#FFD650" />
        <rect x="17" y="16" width="6" height="2" fill="#7A4F00" />
        <rect x="17" y="19" width="6" height="2" fill="#7A4F00" />
        <rect x="17" y="22" width="6" height="2" fill="#7A4F00" />
        {/* tails */}
        <rect x="12" y="30" width="6" height="20" fill="#C8265F" />
        <rect x="22" y="30" width="6" height="20" fill="#C8265F" />
        <rect x="12" y="50" width="6" height="4" fill="#8A1440" />
        <rect x="22" y="50" width="6" height="4" fill="#8A1440" />
      </svg>
    </div>
  )
}

// ─── Pennants ────────────────────────────────────────────────────────────────

const PENNANT_TONES = ['#FF6B9D', '#FFD650', '#4FD8FF', '#63F094', '#BB78FF']

function Pennants({ style }: { style: React.CSSProperties }) {
  const n = 12
  return (
    <div style={{ ...style, position: 'relative', height: 0, paddingBottom: '7%' }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0,
        borderBottom: '2px solid #241C2E',
        borderRadius: '0 0 50% 50% / 0 0 100% 100%',
        bottom: '55%',
      }} />
      {Array.from({ length: n }).map((_, i) => {
        const t = i / (n - 1)
        const sag = Math.sin(t * Math.PI) * 38
        const tone = PENNANT_TONES[i % PENNANT_TONES.length]
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${t * 100}%`,
            top: `${sag}%`,
            marginLeft: -4,
            width: 0, height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: `11px solid ${tone}`,
            filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.4))',
            transformOrigin: 'top center',
            animation: `decFlag 3.2s ease-in-out ${(i * 0.13).toFixed(2)}s infinite`,
          }} />
        )
      })}
      <style>{`
        @keyframes decFlag {
          0%, 100% { transform: rotate(-3deg); }
          50%      { transform: rotate(3deg); }
        }
      `}</style>
    </div>
  )
}
