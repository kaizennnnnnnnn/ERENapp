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
// parent positions it (see lib/trophyShop DECOR `at`). `px` is that width in
// real pixels where a piece needs it — the neon sign sets a font size, and an
// em-relative one inherits whatever the room happens to be using.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import type { TrophyTier } from '@/lib/dailyTwist'
import type { DecorItem } from '@/lib/trophyShop'
import { CupGroup } from './TrophyCup'

export interface TrophyCounts {
  bronze: number
  silver: number
  gold: number
}

interface Props {
  art: DecorItem['art']
  /** CSS width. The piece sizes everything else off it. */
  width?: number | string
  /** The same width in real pixels, when the caller knows it. */
  px?: number
  /** Trophy shelf only. */
  counts?: TrophyCounts
  /** Quieter, for a shop card on a dark surface. */
  muted?: boolean
}

export default memo(function DecorArt({ art, width = '100%', px, counts, muted }: Props) {
  const style: React.CSSProperties = { width, display: 'block' }
  switch (art) {
    case 'trophy_shelf':  return <Shelf style={style} counts={counts} />
    case 'neon_champ':    return <Neon style={style} px={px} muted={muted} />
    case 'string_lights': return <Lights style={style} muted={muted} />
    case 'rosette':       return <Rosette style={style} />
    case 'pennants':      return <Pennants style={style} />
  }
})

// ─── Trophy shelf ────────────────────────────────────────────────────────────
// The one piece of decor that is a readout. Two boards; the trophies you have
// won stand on them, best first, and it fills up over months. The cups are the
// same drawing as everywhere else — one silhouette, three metals.

const SHELF_CAPACITY = 7
const CUP_W = 11.4
const BOARD_Y = [27, 57]

function Shelf({ style, counts }: { style: React.CSSProperties; counts?: TrophyCounts }) {
  const c = counts ?? { bronze: 0, silver: 0, gold: 0 }
  const line: TrophyTier[] = [
    ...Array(Math.min(c.gold, SHELF_CAPACITY)).fill('gold' as const),
    ...Array(Math.min(c.silver, SHELF_CAPACITY)).fill('silver' as const),
    ...Array(Math.min(c.bronze, SHELF_CAPACITY)).fill('bronze' as const),
  ].slice(0, SHELF_CAPACITY * 2)

  return (
    <div style={{ ...style, position: 'relative' }}>
      <svg viewBox="0 0 100 63" width="100%" shapeRendering="crispEdges" style={{ display: 'block' }}>
        {/* carcass */}
        <rect x="0" y="0" width="100" height="63" fill="#1B1008" />
        <rect x="2" y="1" width="96" height="61" fill="#3B2413" />
        <rect x="4" y="3" width="92" height="57" fill="#24160B" />
        {/* grain */}
        {[8, 17, 35, 44, 62].map(y => (
          <rect key={y} x="4" y={y} width="92" height="1" fill="#2E1C0E" />
        ))}
        {/* side posts, so it reads as a case and not a plank */}
        <rect x="2" y="1" width="3" height="61" fill="#4A2D17" />
        <rect x="95" y="1" width="3" height="61" fill="#160D06" />
        <rect x="2" y="1" width="96" height="2" fill="#5C3A1E" />

        {BOARD_Y.map((y, row) => {
          const items = line.slice(row * SHELF_CAPACITY, (row + 1) * SHELF_CAPACITY)
          return (
            <g key={y}>
              {items.map((tier, i) => (
                <CupGroup key={i} tier={tier}
                  x={7 + i * 12.6} y={y - CUP_W * 27 / 26} w={CUP_W} />
              ))}
              <rect x="5" y={y} width="90" height="1" fill="#C08B54" />
              <rect x="5" y={y + 1} width="90" height="3" fill="#8B5A2B" />
              <rect x="5" y={y + 4} width="90" height="2" fill="#160D06" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Neon CHAMPION sign ──────────────────────────────────────────────────────
// A backing board, two mounting arms and a pink tube. The flicker is a 4%
// keyframe window rather than a fade, because a fading neon reads as a
// dimmer, not a bad ballast.

function Neon({ style, px, muted }: {
  style: React.CSSProperties; px?: number; muted?: boolean
}) {
  const tube = '#FF4FA3'
  // Solve for the largest size that still fits the board rather than picking
  // a divisor and hoping: Press Start 2P is square, the tracking adds a sixth
  // of a glyph, and CHAMPION is eight of them. Guessing clipped it to
  // "CHAMPIO" in the 46px loadout tile.
  const font = px ? Math.max(3, Math.floor((px * 0.84) / (8 * (7 / 6)))) : undefined
  return (
    <div style={{ ...style, position: 'relative' }}>
      {/* mounting arms */}
      <div aria-hidden style={{
        position: 'absolute', left: '18%', right: '18%', top: -4, height: 5,
        borderTop: '2px solid #1E1728', borderLeft: '2px solid #1E1728',
        borderRight: '2px solid #1E1728',
      }} />
      <div style={{
        padding: '9% 6%',
        border: '2px solid #0C0812',
        borderRadius: 3,
        background: 'linear-gradient(180deg, #1A1326 0%, #08050E 100%)',
        boxShadow: muted
          ? 'inset 0 0 8px rgba(0,0,0,0.8)'
          : `0 0 16px ${tube}55, inset 0 0 12px ${tube}26, inset 0 0 8px rgba(0,0,0,0.7)`,
        textAlign: 'center',
      }}>
        <span style={{
          fontSize: font ?? '0.9em',
          color: '#FFF0F7',
          letterSpacing: font ? font / 6 : 2,
          textShadow: muted
            ? `0 0 3px ${tube}`
            : `0 0 3px #fff, 0 0 7px ${tube}, 0 0 14px ${tube}, 0 0 24px ${tube}aa`,
          display: 'inline-block',
        }}
          className={`font-pixel${muted ? '' : ' decNeonTube'}`}
        >CHAMPION</span>
      </div>
      <style>{`
        @keyframes decNeon {
          0%, 43%, 47%, 91%, 93%, 100% { opacity: 1; }
          45%, 92%                     { opacity: 0.35; }
        }
        .decNeonTube { animation: decNeon 4.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .decNeonTube { animation: none; }
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
        // Follow the sag: a parabola, deepest in the middle. Rounded because
        // an unrounded ratio differs in its last float digit between the
        // server render and the client one, and React calls that a mismatch.
        const at = Math.round(t * 10000) / 100
        const sag = Math.round(Math.sin(t * Math.PI) * 10000) / 100
        const tone = BULB_TONES[i % BULB_TONES.length]
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${at}%`,
            top: `${sag}%`,
            width: 5, height: 7,
            marginLeft: -2.5,
            background: tone,
            borderRadius: '40% 40% 50% 50%',
            boxShadow: muted
              ? `0 0 3px ${tone}`
              : `0 0 6px ${tone}, 0 0 12px ${tone}66`,
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
// Two rings of pleats offset by half a step, so the edge is scalloped rather
// than a ring of squares, and a gold centre with a stamped "1".

function Rosette({ style }: { style: React.CSSProperties }) {
  const pleat = (r: number, n: number, phase: number, size: number, tones: [string, string]) =>
    Array.from({ length: n }).map((_, i) => {
      const a = ((i + phase) / n) * Math.PI * 2
      // Rounded to 2dp: an unrounded cos() differs in the last float digit
      // between the server render and the client one, and React calls that a
      // hydration mismatch.
      const round = (n: number) => Math.round(n * 100) / 100
      return (
        <rect key={`${r}-${i}`}
          x={round(20 + Math.cos(a) * r - size / 2)} y={round(20 + Math.sin(a) * r - size / 2)}
          width={size} height={size} fill={tones[i % 2]} />
      )
    })
  return (
    <div style={style}>
      <svg viewBox="0 0 40 58" width="100%" shapeRendering="crispEdges" style={{ display: 'block' }}>
        {/* tails first, so the disc overlaps them */}
        <rect x="11" y="28" width="7" height="22" fill="#C8265F" />
        <rect x="22" y="28" width="7" height="22" fill="#A81A4C" />
        <rect x="11" y="28" width="2" height="22" fill="#FF6B9D" />
        <rect x="11" y="50" width="7" height="5" fill="#8A1440" />
        <rect x="22" y="50" width="7" height="5" fill="#6E0F33" />

        {pleat(14, 12, 0, 7, ['#C8265F', '#FF6B9D'])}
        {pleat(11.5, 12, 0.5, 6, ['#FF8DB8', '#E0407F'])}
        <circle cx="20" cy="20" r="9" fill="#FFD650" />
        <circle cx="20" cy="20" r="7" fill="#FFEC9E" />
        <rect x="18" y="15" width="2" height="1" fill="#8A5A00" />
        <rect x="19" y="15" width="2" height="10" fill="#8A5A00" />
        <rect x="17" y="24" width="6" height="1" fill="#8A5A00" />
        <rect x="15" y="16" width="2" height="2" fill="#FFFDEB" />
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
        const at = Math.round(t * 10000) / 100
        const sag = Math.round(Math.sin(t * Math.PI) * 3800) / 100
        const tone = PENNANT_TONES[i % PENNANT_TONES.length]
        return (
          <span key={i} style={{
            position: 'absolute',
            left: `${at}%`,
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
