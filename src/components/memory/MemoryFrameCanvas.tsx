'use client'

// ═════════════════════════════════════════════════════════════════════════════
// MemoryFrameCanvas — Phase 3 PR 8.5
//
// Renders a single Memory Wall frame as a pixel-art picture inside an ornate
// border. Maps the catalogue's FrameIcon ref to PixelIcons.tsx components,
// then stamps the optional badge (e.g. "10", "50", "1W", "3D", "ALL") in the
// top-right corner so every milestone reads distinctly without needing a
// custom drawing per frame.
//
// Locked frames show the silhouette with a "?" — the badge is omitted.
// ═════════════════════════════════════════════════════════════════════════════

import {
  IconDrumstick, IconYarn, IconMoonZ, IconBath, IconPill,
  IconHeart, IconWish, IconCake, IconPerson, IconGift,
  IconPaw, IconStar, IconFire, IconCrown, IconLightning,
  IconFish, IconClock, IconEnvelope, IconController, IconSparkles,
  IconHeartDuo, IconCatFace, IconHouse, IconStethoscope, IconSwords,
} from '@/components/PixelIcons'
import type { FrameIcon, MemoryFrame, Rarity } from '@/lib/memoryCatalogue'

const ICON_MAP: Record<FrameIcon, React.ComponentType<{ size?: number }>> = {
  drumstick:    IconDrumstick,
  yarn:         IconYarn,
  moon:         IconMoonZ,
  bath:         IconBath,
  pill:         IconPill,
  heart:        IconHeart,
  wish:         IconWish,
  cake:         IconCake,
  person:       IconPerson,
  gift:         IconGift,
  paw:          IconPaw,
  star:         IconStar,
  fire:         IconFire,
  crown:        IconCrown,
  lightning:    IconLightning,
  fish:         IconFish,
  clock:        IconClock,
  envelope:     IconEnvelope,
  controller:   IconController,
  sparkles:     IconSparkles,
  crown_couple: IconHeartDuo,
  catface:      IconCatFace,
  house:        IconHouse,
  stethoscope:  IconStethoscope,
  swords:       IconSwords,
}

const RARITY_BORDER: Record<Rarity, { outer: string, inner: string, glow: string, badgeBg: string, badgeText: string }> = {
  common: { outer: '#8B6B3A', inner: '#5C4423', glow: 'rgba(245,200,66,0.25)', badgeBg: '#1A1408', badgeText: '#F5C842' },
  rare:   { outer: '#C0C0C0', inner: '#7A7A7A', glow: 'rgba(192,192,192,0.45)', badgeBg: '#0F0F1A', badgeText: '#E8E8FF' },
  epic:   { outer: '#F5C842', inner: '#8B5A00', glow: 'rgba(245,200,66,0.6)',  badgeBg: '#2A1408', badgeText: '#FFE7A8' },
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
  // Scale the badge to the frame size so big-detail and small-thumbnail
  // renders both read cleanly.
  const badgeFont = Math.max(4, Math.round(size * 0.11))
  const badgePadV = Math.max(1, Math.round(size * 0.03))
  const badgePadH = Math.max(2, Math.round(size * 0.05))

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
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
          overflow: 'hidden',
        }}
      >
        {/* Subtle pattern wash so the bg doesn't read flat */}
        {!locked && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 6px)',
            pointerEvents: 'none',
          }} />
        )}

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
            {/* Gold corner pixels — rare + epic only */}
            {frame.rarity !== 'common' && accentDot && (
              <>
                <div style={{ position: 'absolute', top: 2, left: 2,     width: 2, height: 2, background: accentDot }} />
                <div style={{ position: 'absolute', top: 2, right: 2,    width: 2, height: 2, background: accentDot }} />
                <div style={{ position: 'absolute', bottom: 2, left: 2,  width: 2, height: 2, background: accentDot }} />
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 2, height: 2, background: accentDot }} />
              </>
            )}

            {/* Badge — counts / streak days / time milestones / "ALL" etc.
                Sits in the top-right corner so it doesn't fight the icon. */}
            {frame.art.badge && (
              <div style={{
                position: 'absolute',
                top:   Math.max(2, Math.round(size * 0.04)),
                right: Math.max(2, Math.round(size * 0.04)),
                background: border.badgeBg,
                border: `1px solid ${border.outer}`,
                color: border.badgeText,
                fontFamily: '"Press Start 2P", monospace',
                fontSize: badgeFont,
                padding: `${badgePadV}px ${badgePadH}px`,
                letterSpacing: 0.5,
                lineHeight: 1,
                boxShadow: '1px 1px 0 rgba(0,0,0,0.5)',
              }}>{frame.art.badge}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
