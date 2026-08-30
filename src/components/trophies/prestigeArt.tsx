'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PRESTIGE ART — the two things you can pin to your own name.
//
// The first cut drew a title as grey text in a hairline box and a frame as the
// word NAME in a slightly different grey box, so nine items looked like one
// item nine times. Both are fixed here the same way: give each piece a tone of
// its own and enough chrome to read as a made object.
//
//   TITLE  a ribbon plaque, tinted by the care action it brags about, with
//          that action's icon cast into the left end.
//   FRAME  a metal plate around a real name — four rivets, a bevelled edge,
//          a swept highlight on the two expensive ones, a crown on the top one.
//
// Both take the name from the caller rather than a placeholder, because the
// entire value of the shelf is seeing YOUR name wearing it.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import type { BattleAction } from '@/lib/dailyTwist'
import {
  IconBath, IconBowl, IconYarn, IconMoonZ, IconPill, IconCrown,
} from '@/components/PixelIcons'

// ─── Titles ──────────────────────────────────────────────────────────────────

/** A title is tinted by the room it brags about; the trophy-only one is gold. */
export const TITLE_TONE: Record<string, { ink: string; edge: string; deep: string }> = {
  wash:     { ink: '#9DE9FF', edge: '#4FD8FF', deep: '#06344A' },
  feed:     { ink: '#FFD9A8', edge: '#FFB255', deep: '#4A2A06' },
  play:     { ink: '#B4F7CE', edge: '#63F094', deep: '#083A22' },
  sleep:    { ink: '#DCC0FF', edge: '#BB78FF', deep: '#2B0F4A' },
  medicine: { ink: '#FFB8C6', edge: '#FF5C7A', deep: '#4A0A1C' },
  crown:    { ink: '#FFEFAE', edge: '#FFD650', deep: '#4A3406' },
}

export function titleTone(focus?: BattleAction | null) {
  return TITLE_TONE[focus ?? 'crown'] ?? TITLE_TONE.crown
}

function TitleIcon({ focus, size }: { focus?: BattleAction | null; size: number }) {
  switch (focus) {
    case 'wash':     return <IconBath size={size} />
    case 'feed':     return <IconBowl size={size} />
    case 'play':     return <IconYarn size={size} />
    case 'sleep':    return <IconMoonZ size={size} />
    case 'medicine': return <IconPill size={size} />
    default:         return <IconCrown size={size} />
  }
}

/**
 * A title, as it appears on the shelf and beside a name. `scale` is the pixel
 * font size; everything else is derived so one component covers the 5px
 * version under a nameplate and the 7px version on a shop card.
 */
export const TitlePlate = memo(function TitlePlate({
  value, focus, scale = 6, glory,
}: {
  value: string
  focus?: BattleAction | null
  scale?: number
  /** The legendary one. Adds the sweep and a heavier bloom. */
  glory?: boolean
}) {
  const t = titleTone(focus)
  const pad = Math.round(scale * 0.7)
  const notch = Math.round(scale * 0.9)
  return (
    <span className="relative inline-flex items-center" style={{
      gap: pad,
      padding: `${pad}px ${notch + pad}px`,
      background: `linear-gradient(180deg, ${t.deep} 0%, #07040C 100%)`,
      border: `1.5px solid ${t.edge}`,
      boxShadow: `0 0 ${glory ? 12 : 7}px ${t.edge}${glory ? '77' : '44'}, inset 0 1px 0 rgba(255,255,255,0.12)`,
      // Ribbon ends: a notch cut from each side, so it reads as a pennant
      // rather than another rounded chip.
      clipPath: `polygon(0 0, 100% 0, calc(100% - ${notch}px) 50%, 100% 100%, 0 100%, ${notch}px 50%)`,
      overflow: 'hidden',
    }}>
      {glory && (
        <span aria-hidden className="absolute inset-0 tpSweep" style={{
          background: 'linear-gradient(112deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%)',
        }} />
      )}
      {scale >= 5 && <TitleIcon focus={focus} size={Math.round(scale * 1.6)} />}
      <span className="font-pixel relative" style={{
        fontSize: scale, letterSpacing: 1.2, color: t.ink,
        textShadow: `0 0 5px ${t.edge}66`, whiteSpace: 'nowrap',
      }}>{value}</span>
      <style>{`
        @keyframes tpSweepKf {
          0%, 30%   { transform: translateX(-140%); }
          75%, 100% { transform: translateX(140%); }
        }
        .tpSweep { animation: tpSweepKf 3.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .tpSweep { animation: none; opacity: 0; } }
      `}</style>
    </span>
  )
})

// ─── Frames ──────────────────────────────────────────────────────────────────

export interface FrameSkin {
  /** Border metal. */
  edge: string
  /** Bevel highlight along the top inner edge. */
  hi: string
  /** Bevel shadow along the bottom inner edge. */
  lo: string
  bg: string
  glow: string
  text: string
  /** Corner rivets. */
  rivet: string
  shine?: boolean
  crown?: boolean
}

export const FRAME_SKINS: Record<string, FrameSkin> = {
  bronze: {
    edge: '#A65F22', hi: '#E0975A', lo: '#5A2F0A', rivet: '#FFD9B0',
    bg: 'linear-gradient(180deg, #43250E 0%, #1A0E06 55%, #0A0710 100%)',
    glow: 'rgba(224,151,90,0.30)', text: '#FFD9B0',
  },
  silver: {
    edge: '#AAB4C4', hi: '#F2F5FA', lo: '#4A515E', rivet: '#FFFFFF',
    bg: 'linear-gradient(180deg, #39404E 0%, #171A21 55%, #0A0710 100%)',
    glow: 'rgba(216,220,230,0.32)', text: '#F2F5FA',
  },
  gold: {
    edge: '#F5C842', hi: '#FFF4A3', lo: '#7A4F00', rivet: '#FFFDEB',
    bg: 'linear-gradient(180deg, #4A3406 0%, #221703 55%, #0A0710 100%)',
    glow: 'rgba(245,200,66,0.42)', text: '#FFEFAE', shine: true,
  },
  champion: {
    edge: '#FFD700', hi: '#FFFBDC', lo: '#8A5A00', rivet: '#FFFFFF',
    bg: 'linear-gradient(180deg, #6B4A05 0%, #3A2402 45%, #1A0E06 100%)',
    glow: 'rgba(255,215,0,0.6)', text: '#FFF4A3', shine: true, crown: true,
  },
}

/**
 * A name wearing a frame. `scale` is the pixel font size.
 */
export const FramePlate = memo(function FramePlate({
  tone, name, scale = 7,
}: { tone: string; name: string; scale?: number }) {
  const s = FRAME_SKINS[tone] ?? FRAME_SKINS.bronze
  const pad = Math.round(scale * 0.8)
  const rivet = Math.max(2, Math.round(scale / 3))
  const corners: React.CSSProperties[] = [
    { top: 1, left: 1 }, { top: 1, right: 1 }, { bottom: 1, left: 1 }, { bottom: 1, right: 1 },
  ]
  return (
    <span className="relative inline-flex flex-col items-center" style={{ gap: 1 }}>
      {s.crown && (
        <span className="fpBob" style={{ lineHeight: 0, marginBottom: -1 }}>
          <IconCrown size={Math.round(scale * 1.7)} />
        </span>
      )}
      <span className="relative inline-flex items-center justify-center" style={{
        padding: `${pad}px ${pad * 2}px`,
        background: s.bg,
        border: `2px solid ${s.edge}`,
        borderRadius: 2,
        boxShadow: [
          `inset 0 1px 0 ${s.hi}`,
          `inset 0 -1px 0 ${s.lo}`,
          `0 0 10px ${s.glow}`,
          '2px 2px 0 rgba(0,0,0,0.55)',
        ].join(','),
        overflow: 'hidden',
      }}>
        {s.shine && (
          <span aria-hidden className="absolute inset-0 fpSweep" style={{
            background: 'linear-gradient(112deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)',
          }} />
        )}
        {corners.map((c, i) => (
          <span key={i} aria-hidden className="absolute" style={{
            ...c, width: rivet, height: rivet, background: s.rivet, opacity: 0.85,
          }} />
        ))}
        <span className="font-pixel relative" style={{
          fontSize: scale, letterSpacing: 1.6, color: s.text,
          textShadow: `0 0 6px ${s.glow}`, whiteSpace: 'nowrap',
        }}>{name.toUpperCase()}</span>
      </span>
      <style>{`
        @keyframes fpSweepKf {
          0%, 28%   { transform: translateX(-140%); }
          72%, 100% { transform: translateX(140%); }
        }
        @keyframes fpBobKf {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1.5px); }
        }
        .fpSweep { animation: fpSweepKf 3.6s ease-in-out infinite; }
        .fpBob   { animation: fpBobKf 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .fpSweep { animation: none; opacity: 0; }
          .fpBob   { animation: none; }
        }
      `}</style>
    </span>
  )
})
