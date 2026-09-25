'use client'

// ═════════════════════════════════════════════════════════════════════════════
// MemoryFrameCanvas — one Memory Wall picture
//
// A memory as a small framed picture in the Meadow look: the frame's pixel
// icon on a soft tint of its family's colour, inside a rim a shade deeper, so
// a wall of them reads as pictures hung in a hallway. The optional badge
// ("10", "50", "1W", "3D", "ALL") sits on the top-right corner so every
// milestone reads distinctly without a custom drawing per frame.
//
// The catalogue (lib/memoryCatalogue) still carries each family's colours as
// the dark-panel pair it was drawn with; the ACCENT names the family, and
// FAMILY maps it to its Meadow tint here, so the catalogue needn't change.
//
// Locked frames are a plain soft tile with a lock: no icon, no badge.
// ═════════════════════════════════════════════════════════════════════════════

import {
  IconDrumstick, IconYarn, IconMoonZ, IconBath, IconPill,
  IconHeart, IconWish, IconCake, IconPerson, IconGift,
  IconPaw, IconStar, IconFire, IconCrown, IconLightning,
  IconFish, IconClock, IconEnvelope, IconController, IconSparkles,
  IconHeartDuo, IconCatFace, IconHouse, IconStethoscope, IconSwords,
  MeadowIcon,
} from '@/components/PixelIcons'
import { M, TINT } from '@/components/meadow/tokens'
import type { FrameIcon, MemoryFrame } from '@/lib/memoryCatalogue'

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

interface Family { tint: string; rim: string; ink: string }

/** Keyed by the catalogue's accent colour (its eight palette families). */
const FAMILY: Record<string, Family> = {
  '#F5C842': { tint: TINT.amber,  rim: '#F1D9A4', ink: '#8A5A12' },   // gold
  '#FF6B9D': { tint: TINT.love,   rim: '#F2C4D2', ink: '#A2405F' },   // pink
  '#818CF8': { tint: TINT.lilac,  rim: '#DCD1EC', ink: '#5B4A8A' },   // indigo
  '#38BDF8': { tint: TINT.sky,    rim: '#C9DCEC', ink: '#2F5F86' },   // sky
  '#34D399': { tint: TINT.leaf,   rim: '#CBE3D0', ink: M.leafInk },   // green
  '#FF4D6D': { tint: TINT.danger, rim: '#F1CBC5', ink: '#A2403A' },   // ruby
  '#FFE7A8': { tint: TINT.soft,   rim: '#E3DED6', ink: M.text2 },     // cream
  '#FF9DBE': { tint: '#F8DEDA',   rim: '#EEC3BD', ink: '#A2405F' },   // rose
}
const PLAIN: Family = { tint: TINT.soft, rim: M.hairline, ink: M.text2 }

/** The family colours a frame is drawn in (the detail sheet reuses them). */
export function frameFamily(frame: MemoryFrame): Family {
  return (frame.art.accent && FAMILY[frame.art.accent.toUpperCase()]) || PLAIN
}

interface Props {
  frame: MemoryFrame
  size?: number
  /** Render the locked tile instead of the picture. */
  locked?: boolean
}

export default function MemoryFrameCanvas({ frame, size = 64, locked = false }: Props) {
  const Icon = ICON_MAP[frame.art.icon] ?? IconHeart
  const fam = frameFamily(frame)
  // Rounder when small, like the Meadow icon tiles (60 -> 18).
  const radius = Math.round(size * 0.28)

  if (locked) {
    return (
      <div aria-hidden style={{
        width: size, height: size, flexShrink: 0, boxSizing: 'border-box', borderRadius: radius,
        background: M.soft, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MeadowIcon name="lock" size={Math.round(size * 0.4)} color={M.faint} />
      </div>
    )
  }

  const badgeFont = Math.max(11, Math.round(size * 0.15))
  return (
    <div aria-hidden style={{
      position: 'relative', width: size, height: size, flexShrink: 0, boxSizing: 'border-box',
      borderRadius: radius, background: fam.tint,
      // The rim: an inset line a shade deeper than the tint, the picture's frame.
      boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(size * 0.04))}px ${fam.rim}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={Math.round(size * 0.55)} />

      {/* Counts, streak days, time milestones, "ALL": on the corner, like a
          tag pinned to the frame. */}
      {frame.art.badge && (
        <span style={{
          position: 'absolute', top: -Math.round(badgeFont * 0.4), right: -Math.round(badgeFont * 0.4),
          minWidth: badgeFont * 1.9, height: badgeFont * 1.7, boxSizing: 'border-box',
          padding: `0 ${Math.round(badgeFont * 0.45)}px`, borderRadius: 999,
          background: '#FFFFFF', boxShadow: `0 0 0 2px ${fam.rim}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: badgeFont, fontWeight: 800, lineHeight: 1, color: fam.ink,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>{frame.art.badge}</span>
      )}
    </div>
  )
}
