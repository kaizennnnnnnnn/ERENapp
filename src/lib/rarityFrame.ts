import type { CSSProperties } from 'react'
import type { GachaRarity } from '@/types'

// ═══════════════════════════════════════════════════════════════════════════
// RARITY FRAME — how a collectible card is dressed by tier, and how a card you
// DON'T own is hidden.
//
// Prestige escalates: common (plain) → rare (calm blue hint) → epic (purple
// gradient frame + glow + corner gems) → legendary (gold gradient frame + 4
// rivets + a slow shimmer).
//
// A LOCKED card is a blacked-out slab: no art, no name, only a dimmed hint of
// its tier. That's deliberate — the point of a collection screen is the pull of
// the gaps, and a greyed-but-legible card spoils the thing it's asking you to
// chase. `lockedArt` is the filter that crushes a thumbnail to a silhouette.
//
// Lived in ClosetView until the collection grid needed the same treatment;
// two hand-matched copies of this table would have drifted on the first tweak.
// ═══════════════════════════════════════════════════════════════════════════

export interface CardFrame {
  style: CSSProperties
  rivets: boolean
  gems: boolean
  shine: boolean
}

/** Crushes a thumbnail to a black silhouette — locked cards show shape only. */
export const lockedArt = 'grayscale(1) brightness(0.06) contrast(1.4)'

const DIM: Record<GachaRarity, string> = {
  legendary: '#7A5E1A',
  epic: '#4E3E78',
  rare: 'rgba(96,165,250,0.30)',
  common: 'rgba(124,58,237,0.22)',
}

export function frameFor(rarity: GachaRarity, locked: boolean): CardFrame {
  if (locked) {
    return {
      style: { background: 'rgba(6,4,14,0.72)', border: `2px solid ${DIM[rarity]}` },
      rivets: false, gems: false, shine: false,
    }
  }
  switch (rarity) {
    case 'legendary':
      return {
        style: {
          border: '2px solid transparent',
          background:
            'radial-gradient(116% 86% at 50% 26%, rgba(245,200,66,0.24), rgba(20,12,40,0.5) 76%) padding-box, ' +
            'linear-gradient(155deg, #FFF1C2 0%, #F5C842 42%, #B45309 100%) border-box',
          boxShadow: '0 0 15px rgba(245,158,11,0.5), inset 0 1px 0 rgba(255,245,200,0.35)',
        },
        rivets: true, gems: false, shine: true,
      }
    case 'epic':
      return {
        style: {
          border: '2px solid transparent',
          background:
            'radial-gradient(116% 86% at 50% 26%, rgba(167,139,250,0.18), rgba(20,12,40,0.42) 78%) padding-box, ' +
            'linear-gradient(155deg, #E4DBFF 0%, #A78BFA 55%, #7C3AED 100%) border-box',
          boxShadow: '0 0 10px rgba(167,139,250,0.34)',
        },
        rivets: false, gems: true, shine: false,
      }
    case 'rare':
      return {
        style: { border: '2px solid rgba(96,165,250,0.5)', background: 'rgba(96,165,250,0.07)' },
        rivets: false, gems: false, shine: false,
      }
    default:
      return {
        style: { border: '2px solid rgba(167,139,250,0.18)', background: 'rgba(255,255,255,0.05)' },
        rivets: false, gems: false, shine: false,
      }
  }
}
