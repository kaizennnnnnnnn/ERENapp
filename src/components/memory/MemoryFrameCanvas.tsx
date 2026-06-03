'use client'

// ═════════════════════════════════════════════════════════════════════════════
// MemoryFrameCanvas — Phase 3 PR 7
//
// Renders a single Memory Wall frame as a pixel-art picture in an ornate
// border. Pulls art from the catalogue's FrameIcon + bg palette. Tries to
// stay icon-neutral so adding new frames doesn't require touching this file
// — only memoryCatalogue.ts.
//
// Locked frames render the silhouette: same border, dim bg, a "?" inside.
// ═════════════════════════════════════════════════════════════════════════════

import {
  IconDrumstick, IconYarn, IconMoonZ, IconBath, IconPill,
  IconHeart, IconWish, IconCake, IconPerson, IconGift,
} from '@/components/PixelIcons'
import type { FrameIcon, MemoryFrame, Rarity } from '@/lib/memoryCatalogue'

const ICON_MAP: Record<FrameIcon, React.ComponentType<{ size?: number }>> = {
  drumstick: IconDrumstick,
  yarn:      IconYarn,
  moon:      IconMoonZ,
  bath:      IconBath,
  pill:      IconPill,
  heart:     IconHeart,
  wish:      IconWish,
  cake:      IconCake,
  person:    IconPerson,
  gift:      IconGift,
}

const RARITY_BORDER: Record<Rarity, { outer: string, inner: string, glow: string }> = {
  common: { outer: '#8B6B3A', inner: '#5C4423', glow: 'rgba(245,200,66,0.25)' },
  rare:   { outer: '#C0C0C0', inner: '#7A7A7A', glow: 'rgba(192,192,192,0.45)' },
  epic:   { outer: '#F5C842', inner: '#8B5A00', glow: 'rgba(245,200,66,0.6)'  },
}

interface Props {
  frame: MemoryFrame
  size?: number
  /** Render the locked silhouette instead of the icon. */
  locked?: boolean
}

export default function MemoryFrameCanvas({ frame, size = 64, locked = false }: Props) {
  const Icon = ICON_MAP[frame.art.icon] ?? IconHeart
  const border = RARITY_BORDER[frame.rarity]
  const iconSize = Math.round(size * 0.55)
  const bg = locked ? '#1A1A22' : frame.art.bg
  const accentDot = frame.art.accent

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        // Outer ornate border + drop shadow. Two stacked borders mimic a
        // hand-painted picture frame.
        background: border.outer,
        padding: 3,
        borderRadius: 2,
        boxShadow: locked
          ? '2px 2px 0 #050507, inset 0 0 0 1px rgba(0,0,0,0.3)'
          : `2px 2px 0 #050507, inset 0 0 0 1px ${border.inner}, 0 0 ${size * 0.18}px ${border.glow}`,
        imageRendering: 'pixelated',
        opacity: locked ? 0.45 : 1,
        transition: 'transform 0.15s ease, opacity 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%', height: '100%',
          background: bg,
          border: `1px solid ${border.inner}`,
          display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
      >
        {locked ? (
          <span style={{
            fontFamily: '"Press Start 2P", monospace',
            color: '#5A5A6E',
            fontSize: Math.round(size * 0.35),
            lineHeight: 1,
          }}>?</span>
        ) : (
          <>
            <Icon size={iconSize} />
            {/* Accent gold corner pixels — only on rare/epic */}
            {frame.rarity !== 'common' && accentDot && (
              <>
                <div style={{ position: 'absolute', top: 2, left: 2,     width: 2, height: 2, background: accentDot }} />
                <div style={{ position: 'absolute', top: 2, right: 2,    width: 2, height: 2, background: accentDot }} />
                <div style={{ position: 'absolute', bottom: 2, left: 2,  width: 2, height: 2, background: accentDot }} />
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 2, height: 2, background: accentDot }} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
