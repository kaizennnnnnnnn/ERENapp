'use client'

// ═══════════════════════════════════════════════════════════════════════════
// TREAT TUMBLE — the things that fall.
//
// Twelve sprites used to do exactly two jobs between them: "+points" and
// "-life". Every danger fell at the same speed on the same straight line and
// was told apart only by a red aura that all five wore, which is the same
// mistake Lane Runner had — identical treatment swamps the artwork and the
// player stops reading the sprite at all.
//
// So behaviour now lives on the item, not on the category. A knife drops fast
// and dead straight, a spider creeps side to side, a heart floats down slowly
// enough that you can always get it. You can tell what a thing is from how it
// moves before it is close enough to identify, which is the whole point at the
// speeds this reaches by second 40.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { IconFish, IconHeart, IconStar } from '@/components/PixelIcons'

export type ItemKind =
  | 'kibble' | 'fish' | 'cream' | 'golden' | 'heart' | 'cookie' | 'milk'
  | 'bomb' | 'spider' | 'knife' | 'trap' | 'skull'

/** How a thing falls.
 *  - `straight` — dead vertical, the baseline.
 *  - `sway`     — wide sine drift; you have to lead it.
 *  - `float`    — slow with a lazy wobble; light things and rewards.       */
export type FallKind = 'straight' | 'sway' | 'float'

export interface ItemMeta {
  label: string
  points: number
  life: number
  rarity: number          // spawn weight
  Icon: React.FC<{ size?: number }>
  tint: string
  danger: boolean
  fall: FallKind
  /** Multiplier on the round's base fall speed. */
  speed: number
  /** Horizontal travel in px for `sway` / `float`. */
  amp: number
}

export const ITEMS: Record<ItemKind, ItemMeta> = {
  // ── Goods ────────────────────────────────────────────────────────────────
  kibble: { label: 'Kibble', points: 1,  life: 0, rarity: 32, Icon: memo(KibbleIcon), tint: '#F5C842', danger: false, fall: 'straight', speed: 1.00, amp: 0 },
  fish:   { label: 'Fish',   points: 3,  life: 0, rarity: 18, Icon: memo(IconFish),   tint: '#6BAED6', danger: false, fall: 'sway',     speed: 1.00, amp: 26 },
  cookie: { label: 'Cookie', points: 2,  life: 0, rarity: 16, Icon: memo(CookieIcon), tint: '#A06030', danger: false, fall: 'straight', speed: 1.05, amp: 0 },
  milk:   { label: 'Milk',   points: 2,  life: 0, rarity: 12, Icon: memo(MilkIcon),   tint: '#FFFFFF', danger: false, fall: 'straight', speed: 0.95, amp: 0 },
  cream:  { label: 'Cream',  points: 5,  life: 0, rarity: 9,  Icon: memo(CreamIcon),  tint: '#E9D5FF', danger: false, fall: 'float',    speed: 0.80, amp: 14 },
  // The two best things in the game are also the two hardest to line up.
  golden: { label: 'Golden', points: 10, life: 0, rarity: 4,  Icon: memo(IconStar),   tint: '#FFD700', danger: false, fall: 'sway',     speed: 1.15, amp: 34 },
  // …except the heart, which drifts down slow on purpose. Being handed a life
  // you then fumble is a worse feeling than never being offered one.
  heart:  { label: 'Heart',  points: 0,  life: 1, rarity: 3,  Icon: memo(IconHeart),  tint: '#FF6B9D', danger: false, fall: 'float',    speed: 0.70, amp: 10 },

  // ── Dangers ──────────────────────────────────────────────────────────────
  spider: { label: 'Spider', points: -5, life: -1, rarity: 5, Icon: memo(SpiderIcon), tint: '#4B0082', danger: true, fall: 'sway',     speed: 0.90, amp: 30 },
  bomb:   { label: 'Bomb',   points: -6, life: -1, rarity: 4, Icon: memo(BombIcon),   tint: '#DC2626', danger: true, fall: 'straight', speed: 0.85, amp: 0 },
  // The knife is the only thing in the game that outruns everything else.
  knife:  { label: 'Knife',  points: -5, life: -1, rarity: 5, Icon: memo(KnifeIcon),  tint: '#9CA3AF', danger: true, fall: 'straight', speed: 1.55, amp: 0 },
  trap:   { label: 'Trap',   points: -5, life: -1, rarity: 5, Icon: memo(TrapIcon),   tint: '#7C2D12', danger: true, fall: 'straight', speed: 1.05, amp: 0 },
  skull:  { label: 'Skull',  points: -8, life: -1, rarity: 3, Icon: memo(SkullIcon),  tint: '#E5E7EB', danger: true, fall: 'float',    speed: 0.78, amp: 18 },
}

const KINDS = Object.keys(ITEMS) as ItemKind[]
const GOOD_KINDS = KINDS.filter(k => !ITEMS[k].danger)

const ALL_WEIGHT  = KINDS.reduce((s, k) => s + ITEMS[k].rarity, 0)
const GOOD_WEIGHT = GOOD_KINDS.reduce((s, k) => s + ITEMS[k].rarity, 0)

/** Weighted spawn. `goodsOnly` powers TREAT RAIN — the same table with the
 *  dangers lifted out, so the rain keeps every treat's relative rarity. */
export function pickKind(goodsOnly = false): ItemKind {
  const pool = goodsOnly ? GOOD_KINDS : KINDS
  let r = Math.random() * (goodsOnly ? GOOD_WEIGHT : ALL_WEIGHT)
  for (const k of pool) {
    r -= ITEMS[k].rarity
    if (r < 0) return k
  }
  return 'kibble'
}

/** Horizontal offset from an item's spawn column at a given age.
 *  Pure — the loop calls it per item per frame and stores nothing. */
export function fallDriftX(meta: ItemMeta, phase: number, ageSec: number): number {
  if (meta.fall === 'straight') return 0
  const freq = meta.fall === 'sway' ? 2.3 : 1.4
  return Math.sin(phase + ageSec * freq) * meta.amp
}

// ── Pixel-art icons ─────────────────────────────────────────────────────────
function KibbleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="3" width="6" height="6" fill="#D4892A" />
      <rect x="4" y="4" width="4" height="4" fill="#F5C842" />
      <rect x="4" y="4" width="1" height="1" fill="#FFF4A3" />
    </svg>
  )
}
function CreamIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="3" y="2" width="6" height="2" fill="#FFFFFF" />
      <rect x="2" y="4" width="8" height="6" fill="#E9D5FF" />
      <rect x="2" y="4" width="8" height="1" fill="#FFFFFF" />
      <rect x="3" y="10" width="6" height="1" fill="#A78BFA" />
    </svg>
  )
}
function CookieIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* outer crust */}
      <rect x="3" y="1" width="6" height="1" fill="#7A4A1A" />
      <rect x="2" y="2" width="8" height="1" fill="#7A4A1A" />
      <rect x="1" y="3" width="10" height="6" fill="#7A4A1A" />
      <rect x="2" y="9" width="8" height="1" fill="#7A4A1A" />
      <rect x="3" y="10" width="6" height="1" fill="#7A4A1A" />
      {/* dough */}
      <rect x="3" y="2" width="6" height="1" fill="#C0824A" />
      <rect x="2" y="3" width="8" height="6" fill="#C0824A" />
      <rect x="3" y="9" width="6" height="1" fill="#C0824A" />
      {/* highlight */}
      <rect x="3" y="3" width="2" height="1" fill="#E0AC72" />
      {/* chocolate chips */}
      <rect x="4" y="4" width="2" height="1" fill="#3A1A05" />
      <rect x="4" y="5" width="1" height="1" fill="#3A1A05" />
      <rect x="7" y="3" width="1" height="2" fill="#3A1A05" />
      <rect x="7" y="6" width="2" height="2" fill="#3A1A05" />
      <rect x="3" y="7" width="2" height="1" fill="#3A1A05" />
    </svg>
  )
}
function MilkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* roof */}
      <rect x="4" y="0" width="4" height="1" fill="#9CA3AF" />
      <rect x="3" y="1" width="6" height="1" fill="#D1D5DB" />
      {/* carton body */}
      <rect x="2" y="2" width="8" height="9" fill="#FFFFFF" />
      <rect x="2" y="2" width="1" height="9" fill="#E5E7EB" />
      <rect x="9" y="2" width="1" height="9" fill="#9CA3AF" />
      <rect x="2" y="11" width="8" height="1" fill="#6B7280" />
      {/* M for milk + small drop */}
      <rect x="3" y="4" width="1" height="3" fill="#3B82F6" />
      <rect x="4" y="5" width="1" height="1" fill="#3B82F6" />
      <rect x="5" y="6" width="1" height="1" fill="#3B82F6" />
      <rect x="6" y="5" width="1" height="1" fill="#3B82F6" />
      <rect x="7" y="4" width="1" height="3" fill="#3B82F6" />
      <rect x="4" y="8" width="4" height="1" fill="#60A5FA" />
    </svg>
  )
}
function BombIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      <rect x="6" y="1" width="1" height="3" fill="#F5C842" />
      <rect x="7" y="0" width="1" height="1" fill="#F97316" />
      <rect x="8" y="1" width="1" height="1" fill="#F97316" />
      <rect x="3" y="4" width="6" height="6" fill="#1A1A1A" />
      <rect x="2" y="5" width="8" height="4" fill="#2A2A2A" />
      <rect x="3" y="5" width="1" height="1" fill="#555555" />
    </svg>
  )
}
function SpiderIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* legs */}
      <rect x="0" y="4" width="1" height="1" fill="#1A1A1A" />
      <rect x="1" y="5" width="1" height="1" fill="#1A1A1A" />
      <rect x="2" y="6" width="1" height="1" fill="#1A1A1A" />
      <rect x="0" y="8" width="1" height="1" fill="#1A1A1A" />
      <rect x="1" y="7" width="1" height="1" fill="#1A1A1A" />
      <rect x="11" y="4" width="1" height="1" fill="#1A1A1A" />
      <rect x="10" y="5" width="1" height="1" fill="#1A1A1A" />
      <rect x="9" y="6" width="1" height="1" fill="#1A1A1A" />
      <rect x="11" y="8" width="1" height="1" fill="#1A1A1A" />
      <rect x="10" y="7" width="1" height="1" fill="#1A1A1A" />
      {/* body */}
      <rect x="3" y="4" width="6" height="5" fill="#1A1A1A" />
      <rect x="4" y="3" width="4" height="1" fill="#1A1A1A" />
      {/* eyes */}
      <rect x="4" y="5" width="1" height="1" fill="#DC2626" />
      <rect x="7" y="5" width="1" height="1" fill="#DC2626" />
    </svg>
  )
}
// ─── Knife — silver blade with brown handle, tip up. Reads as sharp ──────────
function KnifeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* tip */}
      <rect x="5" y="0" width="2" height="1" fill="#E5E7EB" />
      {/* blade — light edge + dark spine */}
      <rect x="4" y="1" width="3" height="5" fill="#D1D5DB" />
      {/* spine shadow */}
      <rect x="6" y="1" width="1" height="5" fill="#9CA3AF" />
      {/* edge highlight */}
      <rect x="4" y="1" width="1" height="5" fill="#FFFFFF" />
      {/* bolster */}
      <rect x="3" y="6" width="5" height="1" fill="#525252" />
      {/* handle */}
      <rect x="4" y="7" width="3" height="4" fill="#7A4A1A" />
      <rect x="4" y="7" width="1" height="4" fill="#A06A30" />
      <rect x="6" y="7" width="1" height="4" fill="#4A2810" />
      <rect x="3" y="11" width="5" height="1" fill="#3A1A05" />
    </svg>
  )
}
// ─── Mousetrap — wooden base + sprung metal bar + red trigger plate ────────
function TrapIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* Sprung metal bar across the top */}
      <rect x="2" y="1" width="8" height="1" fill="#374151" />
      <rect x="2" y="2" width="8" height="1" fill="#6B7280" />
      {/* Side rails / spring posts */}
      <rect x="1" y="1" width="1" height="3" fill="#374151" />
      <rect x="10" y="1" width="1" height="3" fill="#374151" />
      <rect x="1" y="2" width="1" height="1" fill="#6B7280" />
      <rect x="10" y="2" width="1" height="1" fill="#6B7280" />
      {/* Wooden base — dark border + lighter centre with grain */}
      <rect x="0" y="4" width="12" height="1" fill="#451A03" />
      <rect x="0" y="5" width="12" height="6" fill="#7C2D12" />
      <rect x="0" y="11" width="12" height="1" fill="#451A03" />
      <rect x="0" y="5" width="12" height="1" fill="#92400E" />
      <rect x="0" y="10" width="12" height="1" fill="#5A1A0A" />
      {/* Wood grain flecks */}
      <rect x="1" y="7" width="1" height="1" fill="#5A1A0A" />
      <rect x="9" y="8" width="1" height="1" fill="#5A1A0A" />
      <rect x="2" y="9" width="1" height="1" fill="#5A1A0A" />
      <rect x="10" y="6" width="1" height="1" fill="#5A1A0A" />
      {/* Red trigger plate (the "bait" pad) */}
      <rect x="3" y="6" width="6" height="3" fill="#991B1B" />
      <rect x="3" y="6" width="6" height="1" fill="#DC2626" />
      <rect x="4" y="7" width="4" height="1" fill="#EF4444" />
      <rect x="4" y="8" width="4" height="1" fill="#7F1D1D" />
    </svg>
  )
}
// ─── Skull — pure death icon, white bone with dark sockets ───────────────────
function SkullIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* cranium top */}
      <rect x="3" y="1" width="6" height="1" fill="#E5E7EB" />
      <rect x="2" y="2" width="8" height="1" fill="#E5E7EB" />
      <rect x="2" y="3" width="8" height="4" fill="#E5E7EB" />
      {/* skull shading */}
      <rect x="2" y="2" width="1" height="5" fill="#FFFFFF" />
      <rect x="9" y="2" width="1" height="5" fill="#9CA3AF" />
      {/* eye sockets */}
      <rect x="3" y="4" width="2" height="2" fill="#0F0F0F" />
      <rect x="7" y="4" width="2" height="2" fill="#0F0F0F" />
      <rect x="3" y="4" width="1" height="1" fill="#3A3A3A" />
      <rect x="7" y="4" width="1" height="1" fill="#3A3A3A" />
      {/* nose */}
      <rect x="5" y="6" width="2" height="1" fill="#0F0F0F" />
      {/* jaw */}
      <rect x="3" y="7" width="6" height="1" fill="#E5E7EB" />
      <rect x="3" y="8" width="1" height="2" fill="#E5E7EB" />
      <rect x="8" y="8" width="1" height="2" fill="#E5E7EB" />
      <rect x="4" y="8" width="4" height="1" fill="#0F0F0F" />
      <rect x="4" y="9" width="1" height="1" fill="#E5E7EB" />
      <rect x="6" y="9" width="1" height="1" fill="#E5E7EB" />
      <rect x="5" y="9" width="1" height="1" fill="#0F0F0F" />
      <rect x="7" y="9" width="1" height="1" fill="#0F0F0F" />
    </svg>
  )
}

export { KibbleIcon, CreamIcon, CookieIcon, MilkIcon, BombIcon, SpiderIcon, KnifeIcon, TrapIcon, SkullIcon }
