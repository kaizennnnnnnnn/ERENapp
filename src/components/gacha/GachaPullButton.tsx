'use client'

// The gacha machine's PULL x1 / PULL x10 buttons — candy-pill versions themed to
// each machine instead of the old flat obsidian slab. The FOOD machine (snacks)
// gets a strawberry-pink pill with a donut/cake medallion + cherry trinket; the
// CLOTHES machine (kitty hats) gets a grape-purple pill with a dress/crown
// medallion + bow trinket. x1 ("single") is a plain candy pill; x10 ("ten") is
// the premium pull — a bigger gold-ringed medallion, an icon upgrade
// (cake / crown), gold rivets, a gold value-coin trinket, and a gold sparkle
// frame + glow baked into `.pull-btn--deluxe`.
//
// Matches the room-action button language (KitchenNavButton et al.): glossy
// vertical gradient face, 2px ink border, four corner rivets, a medallion that
// bobs (sleepBob) over a breathing halo (sleepGlow), a twinkling trinket
// (sleepTwinkle), and a hard pixel press that sinks into its drop shadow. The
// press + hard drop-shadow live in globals.css (`.pull-btn`) and are themed via
// the inline `--pull-ink` property, the same pattern as `--knav-ink`.

import type { CSSProperties, ComponentType } from 'react'
import {
  IconCake, IconDonut, IconCherry,
  IconDress, IconCrown, IconBow,
  IconCoin, IconTicket,
} from '@/components/PixelIcons'

type Variant = 'food' | 'clothes'
type Tier = 'single' | 'ten'

interface Props {
  variant: Variant
  tier: Tier
  /** Coin price, rendered in the subline. */
  cost: number
  disabled?: boolean
  /** Single only: caller has enough tickets but not enough coins — show the
   *  ticket affordance instead of the coin price. */
  showTicket?: boolean
  onClick: () => void
}

const PIXEL_FONT = '"Press Start 2P", monospace'

const RIVETS = [
  { left: 4, top: 4 },
  { right: 4, top: 4 },
  { left: 4, bottom: 4 },
  { right: 4, bottom: 4 },
] as const

export default function GachaPullButton({ variant, tier, cost, disabled, showTicket, onClick }: Props) {
  const isTen = tier === 'ten'
  const isFood = variant === 'food'
  const c = resolve(variant, tier)

  const Medal = c.medalIcon
  const Trinket = c.trinketIcon

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isTen ? 'Pull ten times' : 'Pull once'}
      className={isTen ? 'pull-btn pull-btn--deluxe flex-1 relative' : 'pull-btn flex-1 relative'}
      style={{
        '--pull-ink': c.ink,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: isTen ? '13px 10px 13px 9px' : '11px 10px 11px 9px',
        minHeight: isTen ? 54 : 48,
        borderRadius: isTen ? 12 : 11,
        border: `2px solid ${c.ink}`,
        background: c.face,
      } as CSSProperties}
    >
      {/* Corner rivets — light pixel + hard 1px offset shadow in the ink. */}
      {RIVETS.map((pos, i) => (
        <span key={i} aria-hidden style={{
          position: 'absolute', ...pos, width: 2.5, height: 2.5,
          background: c.rivet, boxShadow: `1px 1px 0 ${c.ink}`,
        }} />
      ))}

      {/* Medallion — pixel icon bobbing over a breathing halo, with a twinkling
          themed trinket perched at its top-right corner. */}
      <span aria-hidden style={{
        position: 'relative', flexShrink: 0,
        width: isTen ? 28 : 24, height: isTen ? 28 : 24,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          position: 'absolute', inset: 1, borderRadius: '50%',
          boxShadow: c.halo, animation: `sleepGlow ${isTen ? 3 : 3.2}s ease-in-out infinite`,
        }} />
        <span style={{
          position: 'relative', width: isTen ? 26 : 22, height: isTen ? 26 : 22,
          borderRadius: '50%', background: c.discBg,
          border: `2px solid ${c.discBorder}`,
          boxShadow: isTen
            ? `inset 0 1px 2px rgba(255,255,255,0.7), 0 0 0 1.5px ${c.discKeyline}`
            : 'inset 0 1px 2px rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'sleepBob 3s ease-in-out infinite',
        }}>
          <Medal size={isTen ? 17 : 16} />
        </span>
        <span style={{
          position: 'absolute', top: -3, right: -3, lineHeight: 0, zIndex: 2,
          animation: `sleepTwinkle ${isTen ? 2.2 : 2.4}s ease-in-out infinite`,
          animationDelay: isTen ? '0.5s' : '0s',
          filter: `drop-shadow(0 1px 0 ${c.trinketShadow})`,
        }}>
          <Trinket size={isTen ? 11 : 10} />
        </span>
      </span>

      {/* Label — title over a coin/ticket subline. */}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{
          fontFamily: PIXEL_FONT, fontSize: isTen ? 8 : 7, letterSpacing: 1,
          color: c.title, textShadow: c.titleShadow, whiteSpace: 'nowrap',
        }}>
          {isTen ? 'PULL x10' : 'PULL x1'}
        </span>
        {showTicket && !isTen ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IconTicket size={10} />
            <span style={{ fontFamily: PIXEL_FONT, fontSize: 6, color: c.title, whiteSpace: 'nowrap' }}>
              USE TICKET
            </span>
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IconCoin size={9} />
            <span style={{ fontFamily: PIXEL_FONT, fontSize: 6, color: c.cost, whiteSpace: 'nowrap' }}>
              {cost} coins
            </span>
          </span>
        )}
      </span>
    </button>
  )
}

// ── Per (variant, tier) resolved styling ──────────────────────────────────
interface Cfg {
  ink: string
  rivet: string
  face: string
  discBg: string
  discBorder: string
  discKeyline: string // x10 only
  halo: string
  title: string
  titleShadow: string
  cost: string
  trinketShadow: string
  medalIcon: ComponentType<{ size?: number }>
  trinketIcon: ComponentType<{ size?: number }>
}

function resolve(variant: Variant, tier: Tier): Cfg {
  const isTen = tier === 'ten'
  if (variant === 'food') {
    const ink = '#A11E5E'
    return {
      ink,
      rivet: isTen ? '#FFE9A8' : '#FFFFFF',
      face: isTen
        ? 'linear-gradient(180deg,#FFE0F0 0%,#FFA8D4 52%,#F56AAE 100%)'
        : 'linear-gradient(180deg,#FFD2E8 0%,#FF9CCB 55%,#F56AAE 100%)',
      discBg: 'radial-gradient(circle at 50% 35%, #FFF6FB, #FFE0EF)',
      discBorder: isTen ? '#F5C842' : '#F56AAE',
      discKeyline: '#C23B79',
      halo: isTen ? '0 0 7px 2px rgba(255,205,130,0.85)' : '0 0 6px 1.5px rgba(255,170,210,0.8)',
      title: isTen ? '#FFF1F8' : '#7A0F44',
      titleShadow: isTen ? `0 1px 0 ${ink}, 0 2px 0 rgba(245,200,66,0.5)` : '0 1px 0 rgba(255,255,255,0.45)',
      cost: isTen ? '#FBE3B0' : '#9A3E6C',
      trinketShadow: isTen ? 'rgba(168,120,15,0.5)' : 'rgba(122,15,68,0.5)',
      medalIcon: isTen ? IconCake : IconDonut,
      trinketIcon: isTen ? IconCoin : IconCherry,
    }
  }
  // clothes
  const ink = '#4A2487'
  return {
    ink,
    rivet: isTen ? '#FFE9A8' : '#F3ECFF',
    face: isTen
      ? 'linear-gradient(180deg,#E4D4FF 0%,#B894F8 52%,#8B5CF6 100%)'
      : 'linear-gradient(180deg,#D9C2FF 0%,#B08CF5 55%,#8B5CF6 100%)',
    discBg: 'radial-gradient(circle at 50% 35%, #FBF7FF, #ECE0FF)',
    discBorder: isTen ? '#F5C842' : '#8B5CF6',
    discKeyline: '#6B21D4',
    halo: isTen ? '0 0 7px 2px rgba(220,190,255,0.9)' : '0 0 6px 1.5px rgba(196,162,255,0.85)',
    title: isTen ? '#FFF7FF' : '#FBF5FF',
    titleShadow: isTen ? `0 1px 0 #3B1A6E, 0 2px 0 rgba(245,200,66,0.5)` : '0 1px 0 #3B1A6E',
    cost: isTen ? '#F2D9A8' : '#C9B4F0',
    trinketShadow: isTen ? 'rgba(168,120,15,0.5)' : 'rgba(74,36,135,0.5)',
    medalIcon: isTen ? IconCrown : IconDress,
    trinketIcon: isTen ? IconCoin : IconBow,
  }
}
