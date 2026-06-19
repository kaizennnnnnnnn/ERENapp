'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useTasks } from '@/contexts/TaskContext'
import { useCare } from '@/contexts/CareContext'
import { useGameRewards, type GameRewardResult } from '@/hooks/useGameRewards'
import { useGameTimers } from '@/hooks/useGameTimers'
import { useVisibilityPause } from '@/hooks/useVisibilityPause'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import GameCoinReward from '@/components/games/GameCoinReward'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import {
  IconMeat, IconFish, IconHeart, IconStar, IconCrown, IconBook,
} from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { fireMinigameDone } from '@/lib/minigames'

// ── Config ───────────────────────────────────────────────────────────────────
const GAME_DURATION = 45
const START_LIVES   = 3
const MAX_LIVES     = 5
const START_SPAWN_MS = 760
const MIN_SPAWN_MS   = 170
const SPAWN_RAMP_PER_SEC = 24          // was 18 — even steeper
const ITEM_BASE_SPEED = 175             // was 160
const ITEM_SPEED_PER_SEC = 12           // was 8 — climbs faster
const EREN_WIDTH  = 72
const ITEM_SIZE   = 34

type ItemKind = 'kibble' | 'fish' | 'cream' | 'golden' | 'heart' | 'cookie' | 'milk'
  | 'bomb' | 'spider' | 'knife' | 'trap' | 'skull'

interface ItemMeta {
  label: string
  points: number
  life: number
  rarity: number   // weight
  Icon: React.FC<{ size?: number }>
  tint: string
  danger: boolean
}

const ITEMS: Record<ItemKind, ItemMeta> = {
  // Good items — five originals plus cookie + milk for more friendly variety.
  kibble:   { label: 'Kibble',   points: 1,  life: 0,  rarity: 32, Icon: memo(KibbleIcon),   tint: '#F5C842', danger: false },
  fish:     { label: 'Fish',     points: 3,  life: 0,  rarity: 18, Icon: memo(IconFish),     tint: '#6BAED6', danger: false },
  cookie:   { label: 'Cookie',   points: 2,  life: 0,  rarity: 16, Icon: memo(CookieIcon),   tint: '#A06030', danger: false },
  milk:     { label: 'Milk',     points: 2,  life: 0,  rarity: 12, Icon: memo(MilkIcon),     tint: '#FFFFFF', danger: false },
  cream:    { label: 'Cream',    points: 5,  life: 0,  rarity: 9,  Icon: memo(CreamIcon),    tint: '#E9D5FF', danger: false },
  golden:   { label: 'Golden',   points: 10, life: 0,  rarity: 4,  Icon: memo(IconStar),     tint: '#FFD700', danger: false },
  heart:    { label: 'Heart',    points: 0,  life: 1,  rarity: 3,  Icon: memo(IconHeart),    tint: '#FF6B9D', danger: false },
  // Dangers — items that read as actual threats. The previous "fire"
  // entry looked like a friendly candle flame, so it's been swapped for
  // a sprung mousetrap — recognisably dangerous AND thematic for a cat.
  spider:   { label: 'Spider',   points: -5, life: -1, rarity: 5,  Icon: memo(SpiderIcon),   tint: '#4B0082', danger: true },
  bomb:     { label: 'Bomb',     points: -6, life: -1, rarity: 4,  Icon: memo(BombIcon),     tint: '#DC2626', danger: true },
  knife:    { label: 'Knife',    points: -5, life: -1, rarity: 5,  Icon: memo(KnifeIcon),    tint: '#9CA3AF', danger: true },
  trap:     { label: 'Trap',     points: -5, life: -1, rarity: 5,  Icon: memo(TrapIcon),     tint: '#7C2D12', danger: true },
  skull:    { label: 'Skull',    points: -8, life: -1, rarity: 3,  Icon: memo(SkullIcon),    tint: '#E5E7EB', danger: true },
}

const KINDS = Object.keys(ITEMS) as ItemKind[]
const WEIGHT_SUM = KINDS.reduce((s, k) => s + ITEMS[k].rarity, 0)

function pickKind(): ItemKind {
  const r = Math.random() * WEIGHT_SUM
  let acc = 0
  for (const k of KINDS) {
    acc += ITEMS[k].rarity
    if (r < acc) return k
  }
  return 'kibble'
}

interface FallingItem {
  id: number
  x: number
  y: number
  kind: ItemKind
  caught: boolean
  missed: boolean
  wobble: number // starting rotation phase
}

interface FloatText { id: number; x: number; y: number; text: string; color: string; t0: number }

// Radial particle burst spawned on positive catches.
interface Particle { id: number; x: number; y: number; dx: number; dy: number; color: string; t0: number; size: number }
// Heart-shard burst spawned when a life is lost.
interface Shard { id: number; x: number; y: number; dx: number; dy: number; t0: number }
// Smoke puff when a missed good treat hits the floor.
interface Puff { id: number; x: number; y: number; t0: number }

// ── Pixel-art icons specific to this game ────────────────────────────────────
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
      <rect x="4" y="1" width="3" height="1" fill="#D1D5DB" />
      <rect x="4" y="2" width="3" height="1" fill="#D1D5DB" />
      <rect x="4" y="3" width="3" height="1" fill="#D1D5DB" />
      <rect x="4" y="4" width="3" height="1" fill="#D1D5DB" />
      <rect x="4" y="5" width="3" height="1" fill="#D1D5DB" />
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
      <rect x="2" y="2" width="8" height="1" fill="#9CA3AF" opacity="0.4" />
      {/* Side rails / spring posts */}
      <rect x="1" y="1" width="1" height="3" fill="#374151" />
      <rect x="10" y="1" width="1" height="3" fill="#374151" />
      <rect x="1" y="2" width="1" height="1" fill="#6B7280" />
      <rect x="10" y="2" width="1" height="1" fill="#6B7280" />
      {/* Wooden base — dark border + lighter centre with grain */}
      <rect x="0" y="4" width="12" height="1" fill="#451A03" />
      <rect x="0" y="5" width="12" height="6" fill="#7C2D12" />
      <rect x="0" y="11" width="12" height="1" fill="#451A03" />
      <rect x="0" y="5" width="12" height="1" fill="#92400E" />     {/* top highlight */}
      <rect x="0" y="10" width="12" height="1" fill="#5A1A0A" />    {/* bottom shadow */}
      {/* Wood grain flecks */}
      <rect x="1" y="7" width="1" height="1" fill="#5A1A0A" />
      <rect x="9" y="8" width="1" height="1" fill="#5A1A0A" />
      <rect x="2" y="9" width="1" height="1" fill="#5A1A0A" />
      <rect x="10" y="6" width="1" height="1" fill="#5A1A0A" />
      {/* Red trigger plate (the "bait" pad) */}
      <rect x="3" y="6" width="6" height="3" fill="#991B1B" />     {/* outline */}
      <rect x="3" y="6" width="6" height="1" fill="#DC2626" />     {/* highlight */}
      <rect x="4" y="7" width="4" height="1" fill="#EF4444" />
      <rect x="4" y="8" width="4" height="1" fill="#7F1D1D" />     {/* shadow */}
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

// ── Eren sprite — Ragdoll, smiling, rosy cheeks, happy eyes ───────────────────
function ErenSprite({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* ears */}
      <rect x="3" y="2" width="3" height="1" fill="#4A2E1A" />
      <rect x="16" y="2" width="3" height="1" fill="#4A2E1A" />
      <rect x="3" y="3" width="3" height="2" fill="#9B7A5C" />
      <rect x="16" y="3" width="3" height="2" fill="#9B7A5C" />
      <rect x="4" y="4" width="1" height="1" fill="#F4B0B8" />
      <rect x="17" y="4" width="1" height="1" fill="#F4B0B8" />
      {/* head — ragdoll cream */}
      <rect x="5" y="3" width="12" height="1" fill="#4A2E1A" />
      <rect x="4" y="4" width="14" height="1" fill="#4A2E1A" />
      <rect x="3" y="5" width="16" height="1" fill="#4A2E1A" />
      <rect x="4" y="5" width="14" height="1" fill="#F9EDD5" />
      <rect x="3" y="6" width="1" height="6" fill="#4A2E1A" />
      <rect x="18" y="6" width="1" height="6" fill="#4A2E1A" />
      <rect x="4" y="6" width="14" height="6" fill="#F9EDD5" />
      {/* brown mask (Ragdoll points) around eyes */}
      <rect x="5" y="6" width="3" height="2" fill="#D4B896" />
      <rect x="14" y="6" width="3" height="2" fill="#D4B896" />
      {/* eyes — bigger highlights to read as cheerful */}
      <rect x="6" y="7" width="2" height="2" fill="#6BAED6" />
      <rect x="6" y="7" width="1" height="1" fill="#FFFFFF" />
      <rect x="7" y="8" width="1" height="1" fill="#1A1A2E" />
      <rect x="14" y="7" width="2" height="2" fill="#6BAED6" />
      <rect x="14" y="7" width="1" height="1" fill="#FFFFFF" />
      <rect x="15" y="8" width="1" height="1" fill="#1A1A2E" />
      {/* rosy cheeks */}
      <rect x="5" y="9" width="2" height="1" fill="#F4B0B8" />
      <rect x="15" y="9" width="2" height="1" fill="#F4B0B8" />
      {/* nose */}
      <rect x="10" y="9" width="2" height="1" fill="#F48B9B" />
      <rect x="10" y="10" width="2" height="1" fill="#4A2E1A" />
      {/* mouth — upturned smile :3 */}
      <rect x="9" y="11" width="1" height="1" fill="#4A2E1A" />
      <rect x="12" y="11" width="1" height="1" fill="#4A2E1A" />
      <rect x="10" y="12" width="2" height="1" fill="#4A2E1A" />
      {/* muzzle around the smile */}
      <rect x="10" y="11" width="2" height="1" fill="#F9EDD5" />
      {/* chin fluff */}
      <rect x="4" y="12" width="14" height="1" fill="#4A2E1A" />
      <rect x="5" y="12" width="5" height="1" fill="#F9EDD5" />
      <rect x="12" y="12" width="5" height="1" fill="#F9EDD5" />
      {/* body */}
      <rect x="4" y="13" width="14" height="1" fill="#4A2E1A" />
      <rect x="3" y="14" width="1" height="5" fill="#4A2E1A" />
      <rect x="18" y="14" width="1" height="5" fill="#4A2E1A" />
      <rect x="4" y="14" width="14" height="5" fill="#F9EDD5" />
      {/* body shading */}
      <rect x="5" y="14" width="2" height="1" fill="#E5D9BE" />
      <rect x="15" y="14" width="2" height="1" fill="#E5D9BE" />
      <rect x="4" y="19" width="14" height="1" fill="#4A2E1A" />
      {/* paws */}
      <rect x="5" y="19" width="2" height="1" fill="#D4B896" />
      <rect x="15" y="19" width="2" height="1" fill="#D4B896" />
      <rect x="5" y="20" width="3" height="1" fill="#4A2E1A" />
      <rect x="14" y="20" width="3" height="1" fill="#4A2E1A" />
      {/* whiskers — tilted up to support smile */}
      <rect x="1" y="9" width="3" height="1" fill="rgba(255,255,255,0.65)" />
      <rect x="18" y="9" width="3" height="1" fill="rgba(255,255,255,0.65)" />
      <rect x="2" y="11" width="2" height="1" fill="rgba(255,255,255,0.55)" />
      <rect x="18" y="11" width="2" height="1" fill="rgba(255,255,255,0.55)" />
    </svg>
  )
}

// ── Sad Eren variant — used on the GAME OVER overlay (0 HP) ──────────────────
function SadErenSprite({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* ears — drooped: shorter, slightly lower */}
      <rect x="3" y="3" width="3" height="1" fill="#4A2E1A" />
      <rect x="16" y="3" width="3" height="1" fill="#4A2E1A" />
      <rect x="3" y="4" width="3" height="1" fill="#9B7A5C" />
      <rect x="16" y="4" width="3" height="1" fill="#9B7A5C" />
      {/* head */}
      <rect x="5" y="3" width="12" height="1" fill="#4A2E1A" />
      <rect x="4" y="4" width="14" height="1" fill="#4A2E1A" />
      <rect x="3" y="5" width="16" height="1" fill="#4A2E1A" />
      <rect x="4" y="5" width="14" height="1" fill="#F9EDD5" />
      <rect x="3" y="6" width="1" height="6" fill="#4A2E1A" />
      <rect x="18" y="6" width="1" height="6" fill="#4A2E1A" />
      <rect x="4" y="6" width="14" height="6" fill="#F9EDD5" />
      {/* mask points */}
      <rect x="5" y="6" width="3" height="2" fill="#D4B896" />
      <rect x="14" y="6" width="3" height="2" fill="#D4B896" />
      {/* sad eyes — closed/squinted with tear */}
      <rect x="6" y="8" width="2" height="1" fill="#1A1A2E" />
      <rect x="14" y="8" width="2" height="1" fill="#1A1A2E" />
      <rect x="6" y="7" width="1" height="1" fill="#1A1A2E" />
      <rect x="15" y="7" width="1" height="1" fill="#1A1A2E" />
      {/* tear under right eye */}
      <rect x="14" y="9" width="1" height="2" fill="#6BAED6" />
      {/* nose */}
      <rect x="10" y="9" width="2" height="1" fill="#F48B9B" />
      <rect x="10" y="10" width="2" height="1" fill="#4A2E1A" />
      {/* frown — :( downturned */}
      <rect x="10" y="12" width="2" height="1" fill="#4A2E1A" />
      <rect x="9" y="13" width="1" height="1" fill="#4A2E1A" />
      <rect x="12" y="13" width="1" height="1" fill="#4A2E1A" />
      {/* muzzle */}
      <rect x="10" y="11" width="2" height="1" fill="#F9EDD5" />
      {/* chin fluff */}
      <rect x="4" y="13" width="14" height="1" fill="#4A2E1A" />
      <rect x="5" y="13" width="5" height="1" fill="#F9EDD5" />
      <rect x="12" y="13" width="5" height="1" fill="#F9EDD5" />
      {/* body — slumped */}
      <rect x="4" y="14" width="14" height="1" fill="#4A2E1A" />
      <rect x="3" y="15" width="1" height="4" fill="#4A2E1A" />
      <rect x="18" y="15" width="1" height="4" fill="#4A2E1A" />
      <rect x="4" y="15" width="14" height="4" fill="#F9EDD5" />
      <rect x="4" y="19" width="14" height="1" fill="#4A2E1A" />
      <rect x="5" y="19" width="2" height="1" fill="#D4B896" />
      <rect x="15" y="19" width="2" height="1" fill="#D4B896" />
      <rect x="5" y="20" width="3" height="1" fill="#4A2E1A" />
      <rect x="14" y="20" width="3" height="1" fill="#4A2E1A" />
      {/* drooping whiskers */}
      <rect x="1" y="10" width="3" height="1" fill="rgba(255,255,255,0.65)" />
      <rect x="18" y="10" width="3" height="1" fill="rgba(255,255,255,0.65)" />
      <rect x="2" y="12" width="2" height="1" fill="rgba(255,255,255,0.55)" />
      <rect x="18" y="12" width="2" height="1" fill="rgba(255,255,255,0.55)" />
    </svg>
  )
}

const MemoErenSprite = memo(ErenSprite)
const MemoSadErenSprite = memo(SadErenSprite)
const MemoIconHeart = memo(IconHeart)
const MemoIconStar = memo(IconStar)
const MemoIconMeat = memo(IconMeat)

// ── Component ────────────────────────────────────────────────────────────────
export default function TreatTumbleGame() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const { applyAction } = useErenStats(profile?.household_id ?? null)
  const { completeTask } = useTasks()
  const { reportGameResult } = useGameRewards()
  const timers = useGameTimers()
  const reduced = useReducedMotion()

  const sceneRef = useRef<HTMLDivElement>(null)

  const [gameState, setGameState] = useState<'idle' | 'running' | 'finished'>('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [erenX, setErenX] = useState(50)
  const [items, setItems] = useState<FallingItem[]>([])
  const [floats, setFloats] = useState<FloatText[]>([])
  const [shake, setShake] = useState(false)
  const [hurtFlash, setHurtFlash] = useState(false)
  const [savedOnce, setSavedOnce] = useState(false)
  // scoreBump: +1 = good pop (gold), -1 = bad pop (red), 0 = idle
  const [scoreBump, setScoreBump] = useState<0 | 1 | -1>(0)
  const [erenPop, setErenPop] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])
  const [shards, setShards] = useState<Shard[]>([])
  const [puffs, setPuffs] = useState<Puff[]>([])
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [comboFlash, setComboFlash] = useState(0) // bump animation when multiplier ticks up
  // For animated count-up of the final score on the finish overlay.
  const [displayedScore, setDisplayedScore] = useState(0)
  const [reward, setReward] = useState<GameRewardResult | null>(null)

  const itemId  = useRef(0)
  const floatId = useRef(0)
  const particleId = useRef(0)
  const shardId = useRef(0)
  const puffId = useRef(0)
  const lastSpawn = useRef(0)
  const lastTick  = useRef(0)
  const rafId = useRef<number | null>(null)
  const dragging = useRef(false)
  const erenXRef = useRef(50)
  const livesRef = useRef(START_LIVES)
  const comboRef = useRef(0)
  const gameStartRef = useRef(0)
  const pausedRef = useRef(false)
  const hideAtRef = useRef(0)
  const loopRef = useRef<((t: number) => void) | null>(null)

  // ── Start ──────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    timers.clearAll()
    setScore(0)
    setLives(START_LIVES)
    livesRef.current = START_LIVES
    setTimeLeft(GAME_DURATION)
    setItems([])
    setFloats([])
    setParticles([])
    setShards([])
    setPuffs([])
    setCombo(0)
    comboRef.current = 0
    setBestCombo(0)
    setComboFlash(0)
    setDisplayedScore(0)
    setReward(null)
    setErenX(50)
    erenXRef.current = 50
    setSavedOnce(false)
    setGameState('running')
    lastSpawn.current = 0
    lastTick.current = 0
    gameStartRef.current = performance.now()
    pausedRef.current = false
    hideAtRef.current = 0
  }, [timers])

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'running') return
    const id = timers.setInterval(() => {
      // Freeze the countdown while backgrounded — pairs with the rAF pause so
      // a tab-switch doesn't silently drain the clock.
      if (document.hidden) return
      setTimeLeft(t => {
        if (t <= 1) {
          timers.clearInterval(id)
          setGameState('finished')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => timers.clearInterval(id)
  }, [gameState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Round-end jingle when the overlay appears (covers both timeout & 0 HP) ──
  useEffect(() => {
    if (gameState === 'finished') playSound('tt_round_end')
  }, [gameState])

  // ── Count-up tween on final score when overlay opens ───────────────────────
  useEffect(() => {
    if (gameState !== 'finished') return
    const target = Math.max(0, score)
    setDisplayedScore(0)
    const start = performance.now()
    const DURATION = 600
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayedScore(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gameState, score])

  // ── End-of-game save ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'finished' || savedOnce || !user?.id) return
    setSavedOnce(true)
    setReward(reportGameResult({ gameType: 'treat_tumble', score: Math.max(0, score) }))
    ;(async () => {
      fireMinigameDone('treat_tumble', Math.max(0, score))
      await applyAction(user.id, 'play')
      completeTask('daily_game')
      if (score >= 30) completeTask('weekly_high_score')
    })()
  }, [gameState, savedOnce, user?.id, score]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Score bump animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (scoreBump === 0) return
    const id = timers.setTimeout(() => setScoreBump(0), 280)
    return () => timers.clearTimeout(id)
  }, [scoreBump]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Eren chomp pop reset ──────────────────────────────────────────────────
  useEffect(() => {
    if (!erenPop) return
    const id = timers.setTimeout(() => setErenPop(false), 140)
    return () => timers.clearTimeout(id)
  }, [erenPop]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Combo flash reset ─────────────────────────────────────────────────────
  useEffect(() => {
    if (comboFlash === 0) return
    const id = timers.setTimeout(() => setComboFlash(0), 380)
    return () => timers.clearTimeout(id)
  }, [comboFlash]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Main game loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'running') return

    function loop(t: number) {
      const rect = sceneRef.current?.getBoundingClientRect()
      if (!rect) { rafId.current = requestAnimationFrame(loop); return }

      // Clamp per-frame dt so a long frame (or a resume hiccup) can't teleport
      // items across the catch zone in a single step.
      const rawElapsed = lastTick.current === 0 ? 16 : (t - lastTick.current)
      const elapsed = Math.min(50, rawElapsed)
      lastTick.current = t
      const gameElapsedSec = (t - gameStartRef.current) / 1000
      const speed = ITEM_BASE_SPEED + ITEM_SPEED_PER_SEC * gameElapsedSec
      const spawnInterval = Math.max(MIN_SPAWN_MS, START_SPAWN_MS - SPAWN_RAMP_PER_SEC * gameElapsedSec)

      // Spawn
      if (t - lastSpawn.current > spawnInterval) {
        lastSpawn.current = t
        const kind = pickKind()
        setItems(prev => [...prev, {
          id: itemId.current++,
          x: Math.random() * (rect.width - ITEM_SIZE - 24) + 12 + ITEM_SIZE / 2,
          y: -ITEM_SIZE,
          kind,
          caught: false,
          missed: false,
          wobble: Math.random() * Math.PI * 2,
        }])
      }

      // Advance items
      const erenCX = (erenXRef.current / 100) * rect.width
      const catchY = rect.height - 110

      // Frame outcome is collected here and the side-effects are fired AFTER the
      // state updater returns. The setItems updater must stay pure: under React
      // StrictMode it runs twice, so firing setState / playSound / setTimeout
      // inside it would double-count score, lives and sounds.
      let dLives = 0
      let dScore = 0
      let comboDelta = 0   // +N good catches, -1 means broken
      let hadDanger = false
      let hadGolden = false
      let hadHeart = false
      let hadGoodCatch = false
      const newFloats: FloatText[] = []
      const newParticles: Particle[] = []
      const newPuffs: Puff[] = []
      const groundY = rect.height - 72   // top of the grass strip

      setItems(prev => {
        // Reset accumulators so a StrictMode double-invocation of this updater
        // recomputes from scratch instead of doubling score / lives / bursts.
        const updated: FallingItem[] = []
        dLives = 0
        dScore = 0
        comboDelta = 0
        hadDanger = false
        hadGolden = false
        hadHeart = false
        hadGoodCatch = false
        newFloats.length = 0
        newParticles.length = 0
        newPuffs.length = 0

        for (const it of prev) {
          if (it.caught || it.missed) continue
          const ny = it.y + speed * (elapsed / 1000)

          const dx = Math.abs(it.x - erenCX)
          if (ny >= catchY && ny <= catchY + ITEM_SIZE + 18 && dx <= EREN_WIDTH / 2 + ITEM_SIZE / 2 - 4) {
            const meta = ITEMS[it.kind]
            const isGood = !meta.danger && (meta.points > 0 || meta.life > 0)
            // Combo multiplier: applies to positive point items, not danger.
            let pointsAwarded = meta.points
            const currentMult = comboRef.current >= 10 ? 3 : comboRef.current >= 5 ? 2 : 1
            if (meta.points > 0 && currentMult > 1) {
              pointsAwarded = meta.points * currentMult
            }
            dScore += pointsAwarded
            if (meta.life < 0) dLives += meta.life
            else if (meta.life > 0) dLives += meta.life
            if (meta.danger) { hadDanger = true; comboDelta = -1 }
            else {
              hadGoodCatch = true
              if (it.kind === 'golden') hadGolden = true
              if (it.kind === 'heart') hadHeart = true
              if (meta.points > 0) comboDelta = comboDelta < 0 ? comboDelta : comboDelta + 1
            }

            newFloats.push({
              id: floatId.current++,
              x: it.x, y: catchY - 10,
              text: pointsAwarded > 0
                ? (currentMult > 1 ? `+${pointsAwarded} x${currentMult}` : `+${pointsAwarded}`)
                : pointsAwarded < 0 ? `${pointsAwarded}` : meta.life > 0 ? '+♥' : '',
              color: pointsAwarded > 0 ? (currentMult > 1 ? '#FBBF24' : '#FDE68A') : pointsAwarded < 0 ? '#FCA5A5' : '#FF6B9D',
              t0: t,
            })

            // Particle burst on positive catches (tinted to the item color).
            if (isGood && !reduced) {
              const count = it.kind === 'golden' ? 9 : 6
              for (let i = 0; i < count; i++) {
                const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4
                const speedP = 38 + Math.random() * 26
                newParticles.push({
                  id: particleId.current++,
                  x: it.x,
                  y: catchY,
                  dx: Math.cos(ang) * speedP,
                  dy: Math.sin(ang) * speedP - 18,
                  color: meta.tint,
                  size: it.kind === 'golden' ? 4 : 3,
                  t0: t,
                })
              }
            }
            continue
          }

          // Missed good items hitting the floor — smoke puff + small penalty.
          if (ny >= groundY) {
            const meta = ITEMS[it.kind]
            if (!meta.danger && (meta.points > 0 || meta.life > 0)) {
              newPuffs.push({ id: puffId.current++, x: it.x, y: groundY, t0: t })
              // Tiny penalty so chasing low-value treats matters; combo breaks.
              dScore -= 1
              comboDelta = -1
            }
            continue
          }

          if (ny > rect.height + 10) continue
          updated.push({ ...it, y: ny })
        }

        return updated
      })

      // ── Side-effects (fired once per frame, OUTSIDE the pure updater) ───────
      if (dScore !== 0) {
        setScore(s => Math.max(0, s + dScore))
        setScoreBump(dScore > 0 ? 1 : -1)
      }
      if (dLives !== 0) {
        const before = livesRef.current
        const newLives = Math.max(0, Math.min(MAX_LIVES, before + dLives))
        livesRef.current = newLives
        setLives(newLives)
        if (dLives < 0) {
          // Screen shake + red flash are pure spectacle — skip under reduced motion.
          if (!reduced) {
            setShake(true)
            setHurtFlash(true)
            timers.setTimeout(() => setShake(false), 280)
            timers.setTimeout(() => setHurtFlash(false), 220)
            // Spawn heart shards from the slot of the heart that was just lost.
            // The HUD's heart row sits roughly at the top of the screen.
            const shardSlotIndex = Math.max(0, before - 1)
            const shardOriginX = rect.width - 84 + shardSlotIndex * 20
            const shardOriginY = 110
            const burstShards: Shard[] = []
            for (let i = 0; i < 4; i++) {
              const ang = -Math.PI / 2 + (i - 1.5) * 0.55 + (Math.random() - 0.5) * 0.3
              const v = 60 + Math.random() * 30
              burstShards.push({
                id: shardId.current++,
                x: shardOriginX,
                y: shardOriginY,
                dx: Math.cos(ang) * v,
                dy: Math.sin(ang) * v,
                t0: t,
              })
            }
            setShards(prev => [...prev, ...burstShards].slice(-40))
          }
        }
        if (newLives === 0) setGameState('finished')
      }

      // Combo handling: tick up on each consecutive good catch, reset on any
      // danger or missed positive. Multiplier thresholds: 5 -> x2, 10 -> x3.
      if (comboDelta !== 0) {
        if (comboDelta < 0) {
          comboRef.current = 0
          setCombo(0)
        } else {
          const prevC = comboRef.current
          const next = prevC + comboDelta
          comboRef.current = next
          setCombo(next)
          setBestCombo(b => Math.max(b, next))
          // Fire combo-up sound when crossing a multiplier threshold (5 or 10).
          const prevMult = prevC >= 10 ? 3 : prevC >= 5 ? 2 : 1
          const nextMult = next >= 10 ? 3 : next >= 5 ? 2 : 1
          if (nextMult > prevMult) {
            playSound('tt_combo_up')
            setComboFlash(nextMult)
          }
        }
      }

      // Pop Eren on any good catch (chomp); play category sounds.
      if (hadGoodCatch) setErenPop(true)
      if (hadGolden) playSound('tt_catch_golden')
      else if (hadHeart) playSound('tt_catch_heart')
      else if (hadGoodCatch) playSound('tt_catch_good')
      if (hadDanger) playSound('tt_hit_danger')

      if (newFloats.length > 0) {
        setFloats(prev => [...prev, ...newFloats].slice(-22))
      }
      if (newParticles.length > 0) {
        setParticles(prev => [...prev, ...newParticles].slice(-80))
      }
      if (newPuffs.length > 0) {
        setPuffs(prev => [...prev, ...newPuffs].slice(-20))
      }

      if (gameState === 'running' && !pausedRef.current) {
        rafId.current = requestAnimationFrame(loop)
      }
    }

    loopRef.current = loop
    if (!pausedRef.current) {
      rafId.current = requestAnimationFrame(loop)
    }
    return () => {
      loopRef.current = null
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [gameState, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pause on hidden ────────────────────────────────────────────────────────
  // Backgrounding the tab cancels the rAF and records when we left, so the frame
  // clock and wall-clock anchors can be rebased on return. Without this, items
  // teleport across the catch zone and the difficulty ramp spikes on resume.
  const handleHide = useCallback(() => {
    if (gameState !== 'running' || pausedRef.current) return
    pausedRef.current = true
    hideAtRef.current = performance.now()
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }, [gameState])

  const handleShow = useCallback(() => {
    if (!pausedRef.current) return
    pausedRef.current = false
    const now = performance.now()
    const gap = now - hideAtRef.current
    // Rebase every wall-clock anchor by the time spent hidden so the spawn
    // interval, difficulty ramp and frame dt all resume as if no time passed.
    gameStartRef.current += gap
    if (lastSpawn.current !== 0) lastSpawn.current += gap
    lastTick.current = now
    if (gameState === 'running' && loopRef.current) {
      rafId.current = requestAnimationFrame(loopRef.current)
    }
  }, [gameState])

  useVisibilityPause(handleHide, handleShow)

  // ── Clean up old float texts ───────────────────────────────────────────────
  useEffect(() => {
    if (floats.length === 0) return
    const id = setTimeout(() => setFloats(prev => prev.filter(f => performance.now() - f.t0 < 900)), 700)
    return () => clearTimeout(id)
  }, [floats])

  // ── Cull expired particles / shards / puffs ───────────────────────────────
  useEffect(() => {
    if (particles.length === 0) return
    const id = setTimeout(() => setParticles(prev => prev.filter(p => performance.now() - p.t0 < 480)), 320)
    return () => clearTimeout(id)
  }, [particles])
  useEffect(() => {
    if (shards.length === 0) return
    const id = setTimeout(() => setShards(prev => prev.filter(s => performance.now() - s.t0 < 700)), 500)
    return () => clearTimeout(id)
  }, [shards])
  useEffect(() => {
    if (puffs.length === 0) return
    const id = setTimeout(() => setPuffs(prev => prev.filter(p => performance.now() - p.t0 < 520)), 380)
    return () => clearTimeout(id)
  }, [puffs])

  // ── Drag / touch input ────────────────────────────────────────────────────
  function updatePos(clientX: number) {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100))
    erenXRef.current = pct
    setErenX(pct)
  }
  function onPointerDown(e: React.PointerEvent) {
    if (gameState !== 'running') return
    dragging.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    updatePos(e.clientX)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || gameState !== 'running') return
    updatePos(e.clientX)
  }
  function onPointerUp() {
    dragging.current = false
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const timeWarning = timeLeft <= 10
  const lowLives = lives <= 1
  const timePct = (timeLeft / GAME_DURATION) * 100

  return (
    <div className="fixed inset-0 z-40 overflow-hidden select-none game-shell"
      style={{
        background: 'linear-gradient(180deg, #FEF3C7 0%, #FDE68A 40%, #FBBF24 100%)',
        touchAction: 'none',
        animation: shake ? 'sceneShake 0.28s linear' : 'none',
      }}
      ref={sceneRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}>

      {/* Red hurt flash */}
      {hurtFlash && (
        <div className="absolute inset-0 pointer-events-none z-40" style={{
          background: 'radial-gradient(circle at center, rgba(220,38,38,0.35) 0%, rgba(220,38,38,0.08) 55%, transparent 80%)',
          animation: 'hurtFade 0.22s ease-out forwards',
        }} />
      )}

      {/* Drifting clouds */}
      <div className="absolute inset-0 pointer-events-none opacity-70" style={{
        backgroundImage: 'radial-gradient(ellipse 60px 18px at 20% 15%, rgba(255,255,255,0.85), transparent 65%), radial-gradient(ellipse 80px 22px at 65% 28%, rgba(255,255,255,0.7), transparent 65%), radial-gradient(ellipse 50px 14px at 85% 50%, rgba(255,255,255,0.8), transparent 65%)',
        animation: reduced ? 'none' : 'cloudDrift 22s linear infinite',
      }} />

      {/* Grass floor */}
      <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{
        height: 72,
        background: 'linear-gradient(180deg, #4ADE80 0%, #16A34A 60%, #166534 100%)',
        borderTop: '3px solid #14532D',
      }}>
        <div className="absolute top-0 inset-x-0" style={{
          height: 4,
          background: 'repeating-linear-gradient(90deg, transparent 0 6px, #166534 6px 8px)',
        }} />
      </div>

      {/* Header */}
      <div className="absolute top-0 inset-x-0 pt-3 px-3 z-30 flex items-center gap-2">
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.9)', borderRadius: 6, border: '2px solid #D97706', boxShadow: '0 2px 0 #B45309' }}>
          <ChevronLeft size={18} className="text-amber-700" />
        </button>
        <div className="flex-1 flex items-center justify-center">
          <span className="font-pixel text-amber-900 px-3 py-1.5 inline-flex items-center gap-1.5"
            style={{ background: 'rgba(255,255,255,0.92)', border: '2px solid #D97706', borderRadius: 4, boxShadow: '0 2px 0 #B45309', fontSize: 7, letterSpacing: 1.5 }}>
            <MemoIconMeat size={12} />
            TREAT TUMBLE
          </span>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* ══ PREMIUM HUD ═════════════════════════════════════════════════════ */}
      {gameState !== 'idle' && (
        <div className="absolute top-14 inset-x-0 px-3 z-20">
          {/* Big score banner */}
          <div className="mb-2 relative overflow-hidden py-2.5 px-3"
            style={{
              background: 'linear-gradient(180deg, rgba(120,53,15,0.92) 0%, rgba(69,26,3,0.95) 100%)',
              border: '3px solid #F59E0B',
              borderRadius: 5,
              boxShadow: '0 4px 0 #92400E, inset 0 1px 0 rgba(255,255,255,0.25), 0 0 14px rgba(245,158,11,0.4)',
            }}>
            {/* Corner rivets */}
            <div style={{ position: 'absolute', top: 3, left: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />
            <div style={{ position: 'absolute', top: 3, right: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />
            <div style={{ position: 'absolute', bottom: 3, left: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />
            <div style={{ position: 'absolute', bottom: 3, right: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />

            <div className="flex items-center justify-between gap-3">
              {/* Score */}
              <div className="flex items-center gap-1.5">
                <MemoIconStar size={14} />
                <span className="font-pixel" style={{ fontSize: 6, color: '#FCD34D', letterSpacing: 2 }}>SCORE</span>
                <span className="font-pixel" style={{
                  fontSize: 16,
                  color: scoreBump === -1 ? '#FCA5A5' : '#FFFFFF',
                  textShadow: scoreBump === -1
                    ? '2px 2px 0 #7F1D1D, 0 0 6px rgba(220,38,38,0.85)'
                    : '2px 2px 0 #92400E, 0 0 6px rgba(251,191,36,0.7)',
                  letterSpacing: 1,
                  transform: scoreBump === 1 ? 'scale(1.22)' : scoreBump === -1 ? 'scale(0.88)' : 'scale(1)',
                  transition: 'transform 0.16s cubic-bezier(0.34,1.56,0.64,1), color 0.18s, text-shadow 0.18s',
                  display: 'inline-block',
                  animation: scoreBump === -1 ? 'scoreShake 0.26s linear' : 'none',
                }}>{Math.max(0, score)}</span>
                {/* Combo multiplier badge — only visible at x2+ */}
                {combo >= 5 && (
                  <span className="font-pixel ml-1 px-1.5 py-0.5" style={{
                    fontSize: 7,
                    color: '#451A03',
                    background: 'linear-gradient(180deg, #FDE68A, #F59E0B)',
                    border: '2px solid #7C2D12',
                    borderRadius: 3,
                    boxShadow: '0 2px 0 #5A1A0A, 0 0 6px rgba(251,191,36,0.7)',
                    letterSpacing: 1,
                    transform: comboFlash ? 'scale(1.32)' : 'scale(1)',
                    transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                    display: 'inline-block',
                  }}>x{combo >= 10 ? 3 : 2}</span>
                )}
              </div>

              {/* Lives — large, labelled */}
              <div className="flex items-center gap-1.5 px-2 py-1"
                style={{
                  background: lowLives ? 'rgba(220,38,38,0.4)' : 'rgba(0,0,0,0.45)',
                  border: lowLives ? '2px solid #FCA5A5' : '2px solid rgba(245,158,11,0.5)',
                  borderRadius: 4,
                  boxShadow: lowLives ? '0 2px 0 rgba(0,0,0,0.4), 0 0 8px rgba(248,113,113,0.55)' : '0 2px 0 rgba(0,0,0,0.4)',
                  transition: 'all 0.25s',
                }}>
                <span className="font-pixel" style={{
                  fontSize: 6, letterSpacing: 2,
                  color: lowLives ? '#FFE4E4' : '#FCD34D',
                  textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
                }}>HP</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: MAX_LIVES }).map((_, i) => (
                    <div key={i} style={{
                      opacity: i < lives ? 1 : 0.18,
                      transform: i < lives ? 'scale(1)' : 'scale(0.75)',
                      transition: 'opacity 0.25s, transform 0.25s',
                      filter: i < lives && lowLives && gameState === 'running' ? 'drop-shadow(0 0 5px rgba(255,107,157,1))' : 'none',
                      animation: i < lives && lowLives && gameState === 'running' && !reduced ? 'heartBeat 0.55s ease-in-out infinite' : 'none',
                    }}>
                      <MemoIconHeart size={18} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Time progress bar */}
            <div className="mt-2 relative overflow-hidden" style={{
              height: 6,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: 2,
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
            }}>
              <div style={{
                height: '100%',
                width: `${timePct}%`,
                background: timeWarning
                  ? 'linear-gradient(180deg, #FCA5A5 0%, #DC2626 100%)'
                  : 'linear-gradient(180deg, #FDE68A 0%, #F59E0B 100%)',
                transition: 'width 0.9s linear, background 0.3s',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
              }} />
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(0,0,0,0.35) calc(10% - 1px) 10%)',
              }} />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 2, color: '#FCD34D' }}>TIME</span>
              <span className="font-pixel" style={{
                fontSize: 7,
                color: timeWarning ? '#FCA5A5' : '#FDE68A',
                animation: timeWarning && gameState === 'running' && !reduced ? 'timerPulse 0.6s ease-in-out infinite' : 'none',
              }}>{String(Math.floor(timeLeft / 60))}:{String(timeLeft % 60).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Idle intro — premium amber plaque with rivets, sweep shine,
            and grouped goods/dangers panels ──────────────────────────── */}
      {/* pointer-events-none on the root so this full-screen z-30 overlay doesn't
          swallow taps on the same-z header back button; START re-enables pointer events. */}
      {gameState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-start z-30 px-4 pt-12 pb-6 overflow-y-auto pointer-events-none">
          {/* Drifting sparkle field behind the plaque */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle, rgba(251,191,36,0.55) 1px, transparent 1.5px), radial-gradient(circle, rgba(252,211,77,0.4) 1px, transparent 1.5px)',
            backgroundSize: '38px 38px, 56px 56px',
            backgroundPosition: '0 0, 22px 28px',
            animation: reduced ? 'none' : 'ttStarDrift 32s linear infinite',
            opacity: 0.55,
          }} />

          {/* Plaque */}
          <div className="relative px-5 py-5 w-full max-w-[340px] z-10" style={{
            background: 'linear-gradient(180deg, #FEF3C7 0%, #FDE68A 50%, #F59E0B 100%)',
            border: '3px solid #7C2D12',
            borderRadius: 8,
            boxShadow: '0 8px 0 #5A1A0A, 0 0 28px rgba(251,191,36,0.55), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -3px 0 rgba(120,53,15,0.3)',
            overflow: 'hidden',
          }}>
            {/* Gold rivets at all 4 corners */}
            <div style={{ position: 'absolute', top: 6, left: 6, width: 6, height: 6, background: '#FFD700', borderRadius: 1, boxShadow: '0 0 4px rgba(255,215,0,0.9), inset 0 1px 0 rgba(255,255,255,0.6)' }} />
            <div style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, background: '#FFD700', borderRadius: 1, boxShadow: '0 0 4px rgba(255,215,0,0.9), inset 0 1px 0 rgba(255,255,255,0.6)' }} />
            <div style={{ position: 'absolute', bottom: 6, left: 6, width: 6, height: 6, background: '#FFD700', borderRadius: 1, boxShadow: '0 0 4px rgba(255,215,0,0.9), inset 0 1px 0 rgba(255,255,255,0.6)' }} />
            <div style={{ position: 'absolute', bottom: 6, right: 6, width: 6, height: 6, background: '#FFD700', borderRadius: 1, boxShadow: '0 0 4px rgba(255,215,0,0.9), inset 0 1px 0 rgba(255,255,255,0.6)' }} />

            {/* Sweep shine across the plaque */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.55) 50%, transparent 62%)',
              animation: reduced ? 'none' : 'ttPlaqueShine 3.6s ease-in-out infinite',
            }} />

            {/* Title with twinkling stars */}
            <div className="flex items-center justify-center gap-2 mb-2 relative">
              <div style={{ animation: reduced ? 'none' : 'twinkle 1.5s ease-in-out infinite', filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.7))' }}>
                <IconStar size={16} />
              </div>
              <p className="font-pixel" style={{
                fontSize: 12, letterSpacing: 3, color: '#7C2D12',
                textShadow: '0 1px 0 rgba(255,255,255,0.7), 0 2px 0 rgba(120,53,15,0.4)',
              }}>TREAT TUMBLE</p>
              <div style={{ animation: reduced ? 'none' : 'twinkle 1.5s ease-in-out 0.75s infinite', filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.7))' }}>
                <IconStar size={16} />
              </div>
            </div>

            {/* Decorative divider */}
            <div className="mb-3 mx-auto" style={{
              width: '85%',
              height: 2,
              background: 'linear-gradient(90deg, transparent, #B45309, #FBBF24, #B45309, transparent)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.5)',
            }} />

            {/* Description */}
            <p className="font-pixel text-center mb-3" style={{
              fontSize: 6, lineHeight: 1.9, letterSpacing: 1, color: '#7C2D12',
            }}>
              DRAG TO MOVE EREN<br/>
              CATCH TREATS · DODGE DANGERS<br/>
              HEARTS GIVE LIVES<br/>
              <span style={{ color: '#B91C1C', fontSize: 5 }}>⚡ IT GETS FASTER ⚡</span>
            </p>

            {/* GOODS panel — green-tinted card */}
            <div className="mb-2.5 relative px-2 pt-2 pb-2.5" style={{
              background: 'linear-gradient(180deg, rgba(187,247,208,0.6) 0%, rgba(134,239,172,0.4) 100%)',
              border: '2px solid #15803D',
              borderRadius: 4,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 2px 0 rgba(21,128,61,0.35)',
            }}>
              <p className="font-pixel mb-2 text-center" style={{
                fontSize: 7, letterSpacing: 2.5, color: '#14532D',
                textShadow: '0 1px 0 rgba(255,255,255,0.6)',
              }}>★ GOODS ★</p>
              <div className="grid grid-cols-7 gap-1">
                <LegendTile Icon={KibbleIcon} tint="#F5C842" pts="+1" />
                <LegendTile Icon={CookieIcon} tint="#A06030" pts="+2" />
                <LegendTile Icon={MilkIcon}   tint="#FFFFFF" pts="+2" />
                <LegendTile Icon={IconFish}   tint="#6BAED6" pts="+3" />
                <LegendTile Icon={CreamIcon}  tint="#A78BFA" pts="+5" />
                <LegendTile Icon={IconStar}   tint="#FFD700" pts="+10" />
                <LegendTile Icon={IconHeart}  tint="#FF6B9D" pts="+♥" />
              </div>
            </div>

            {/* DANGERS panel — red-tinted card */}
            <div className="relative px-2 pt-2 pb-2.5" style={{
              background: 'linear-gradient(180deg, rgba(254,202,202,0.6) 0%, rgba(248,113,113,0.4) 100%)',
              border: '2px solid #B91C1C',
              borderRadius: 4,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 2px 0 rgba(185,28,28,0.35)',
            }}>
              <p className="font-pixel mb-2 text-center" style={{
                fontSize: 7, letterSpacing: 2.5, color: '#7F1D1D',
                textShadow: '0 1px 0 rgba(255,255,255,0.6)',
              }}>⚠ DANGERS ⚠</p>
              <div className="grid grid-cols-5 gap-1">
                <LegendTile Icon={TrapIcon}   tint="#7C2D12" pts="-5" danger />
                <LegendTile Icon={KnifeIcon}  tint="#9CA3AF" pts="-5" danger />
                <LegendTile Icon={SpiderIcon} tint="#4B0082" pts="-5" danger />
                <LegendTile Icon={BombIcon}   tint="#DC2626" pts="-6" danger />
                <LegendTile Icon={SkullIcon}  tint="#E5E7EB" pts="-8" danger />
              </div>
            </div>
          </div>

          {/* Premium START button */}
          <button onClick={() => { playSound('ui_tap'); start() }}
            className="relative mt-5 px-8 py-3 text-white active:translate-y-[2px] transition-transform z-10 overflow-hidden pointer-events-auto"
            style={{
              background: 'linear-gradient(180deg, #F59E0B 0%, #D97706 50%, #B45309 100%)',
              border: '3px solid #7C2D12',
              borderRadius: 4,
              boxShadow: '0 6px 0 #5A1A0A, inset 0 2px 0 rgba(255,255,255,0.4), 0 0 22px rgba(251,191,36,0.65)',
              fontFamily: '"Press Start 2P"', fontSize: 11, letterSpacing: 2,
              textShadow: '0 2px 0 #5A1A0A',
            }}>
            ▶ START
            {/* Sweeping shine across the button */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.5) 50%, transparent 62%)',
              animation: reduced ? 'none' : 'ttPlaqueShine 2.4s ease-in-out infinite',
            }} />
          </button>
        </div>
      )}

      {/* ── Falling items — dangers pulse a sharper red aura + wobble to stand out */}
      {gameState !== 'idle' && items.map(it => {
        const meta = ITEMS[it.kind]
        const danger = meta.danger
        return (
          <div key={it.id} className="absolute pointer-events-none z-10"
            style={{
              left: it.x - ITEM_SIZE / 2,
              top: it.y - ITEM_SIZE / 2,
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              animation: reduced
                ? 'none'
                : danger
                  ? 'itemSpin 1.4s linear infinite, dangerWobble 0.42s ease-in-out infinite'
                  : 'itemSpin 1.4s linear infinite',
            }}>
            <div style={{
              width: '100%', height: '100%',
              animation: danger && !reduced ? 'dangerPulse 0.55s ease-in-out infinite' : 'none',
              filter: danger
                ? `drop-shadow(0 3px 0 rgba(0,0,0,0.35)) drop-shadow(0 0 7px rgba(220,38,38,0.95)) drop-shadow(0 0 12px rgba(220,38,38,0.55))`
                : `drop-shadow(0 3px 0 rgba(0,0,0,0.25)) drop-shadow(0 0 6px ${meta.tint}55)`,
            }}>
              <meta.Icon size={ITEM_SIZE} />
            </div>
          </div>
        )
      })}

      {/* ── Particle bursts (positive catches) ──────────────────────────────── */}
      {particles.map(p => (
        <div key={p.id} className="absolute pointer-events-none z-30" style={{
          left: p.x, top: p.y,
          width: p.size, height: p.size,
          background: p.color,
          boxShadow: `0 0 4px ${p.color}`,
          imageRendering: 'pixelated',
          // Custom property drives the keyframe translate.
          ['--dx' as string]: `${p.dx}px`,
          ['--dy' as string]: `${p.dy}px`,
          animation: 'ttParticle 420ms cubic-bezier(0.22,1,0.36,1) forwards',
        } as React.CSSProperties} />
      ))}

      {/* ── Heart shards when a life is lost ────────────────────────────────── */}
      {shards.map(s => (
        <div key={s.id} className="absolute pointer-events-none z-40" style={{
          left: s.x, top: s.y,
          width: 4, height: 4,
          background: '#DC2626',
          boxShadow: '0 0 3px #FCA5A5',
          imageRendering: 'pixelated',
          ['--dx' as string]: `${s.dx}px`,
          ['--dy' as string]: `${s.dy}px`,
          animation: 'ttShard 650ms cubic-bezier(0.34,1.06,0.64,1) forwards',
        } as React.CSSProperties} />
      ))}

      {/* ── Smoke puffs for missed treats ───────────────────────────────────── */}
      {puffs.map(p => (
        <div key={p.id} className="absolute pointer-events-none z-20" style={{
          left: p.x - 8, top: p.y - 6,
          width: 16, height: 12,
          animation: 'ttPuff 500ms ease-out forwards',
        }}>
          <div style={{
            position: 'absolute', left: 2, top: 4, width: 4, height: 4,
            background: 'rgba(180,180,180,0.85)', boxShadow: '0 0 3px rgba(200,200,200,0.6)',
          }} />
          <div style={{
            position: 'absolute', left: 8, top: 2, width: 4, height: 4,
            background: 'rgba(210,210,210,0.85)', boxShadow: '0 0 3px rgba(220,220,220,0.6)',
          }} />
          <div style={{
            position: 'absolute', left: 5, top: 7, width: 3, height: 3,
            background: 'rgba(160,160,160,0.8)',
          }} />
        </div>
      ))}

      {/* ── Eren (new sprite) + floating HP bar ─────────────────────────────── */}
      {gameState !== 'idle' && (
        <div className="absolute pointer-events-none z-20"
          style={{
            left: `${erenX}%`,
            bottom: 48,
            transform: 'translateX(-50%)',
            transition: dragging.current ? 'none' : 'left 0.08s ease-out',
            filter: hurtFlash
              ? 'drop-shadow(0 0 10px rgba(220,38,38,1)) drop-shadow(0 0 16px rgba(220,38,38,0.6))'
              : 'drop-shadow(0 5px 0 rgba(0,0,0,0.25)) drop-shadow(0 0 8px rgba(255,255,255,0.25))',
            animation: reduced ? 'none' : 'erenBob 0.7s ease-in-out infinite',
          }}>
          {/* Floating HP indicator above head */}
          <div className="flex items-center justify-center gap-0.5 mb-1"
            style={{
              padding: '2px 5px',
              background: 'rgba(0,0,0,0.55)',
              border: lowLives ? '2px solid #FCA5A5' : '2px solid rgba(255,255,255,0.45)',
              borderRadius: 3,
              boxShadow: lowLives ? '0 1px 0 rgba(0,0,0,0.45), 0 0 6px rgba(248,113,113,0.7)' : '0 1px 0 rgba(0,0,0,0.45)',
              animation: lowLives && !reduced ? 'heartBeat 0.5s ease-in-out infinite' : 'none',
            }}>
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <div key={i} style={{
                opacity: i < lives ? 1 : 0.15,
                transform: i < lives ? 'scale(1)' : 'scale(0.7)',
                transition: 'opacity 0.25s, transform 0.25s',
              }}>
                <MemoIconHeart size={10} />
              </div>
            ))}
          </div>

          <div style={{
            display: 'inline-block',
            transformOrigin: '50% 100%',
            animation: erenPop ? 'erenChomp 140ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
          }}>
            <MemoErenSprite size={EREN_WIDTH} />
          </div>
        </div>
      )}

      {/* ── Float texts ─────────────────────────────────────────────────────── */}
      {floats.map(f => (
        <div key={f.id} className="absolute z-30 pointer-events-none font-pixel" style={{
          left: f.x, top: f.y, transform: 'translateX(-50%)',
          color: f.color, fontSize: 13, letterSpacing: 1,
          textShadow: '2px 2px 0 rgba(0,0,0,0.6)',
          animation: 'floatUp 0.95s ease-out forwards',
        }}>
          {f.text}
        </div>
      ))}

      {/* ── Finish overlay ─────────────────────────────────────────────────── */}
      {gameState === 'finished' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 p-6"
          style={{ background: 'rgba(60,25,0,0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="px-6 py-6 max-w-[340px] w-full text-center relative"
            style={{ background: 'linear-gradient(180deg, #FFF8E0 0%, #FFF0C0 100%)', border: '3px solid #D97706', borderRadius: 6, boxShadow: '0 5px 0 #B45309, 0 0 24px rgba(251,191,36,0.6)' }}>
            <div className="flex justify-center mb-3">
              {lives > 0 ? (
                <IconCrown size={28} />
              ) : (
                <div style={{ animation: reduced ? 'none' : 'sadBob 1.8s ease-in-out infinite' }}>
                  <MemoSadErenSprite size={48} />
                </div>
              )}
            </div>
            <p className="font-pixel text-amber-800 mb-1" style={{ fontSize: 9, letterSpacing: 2 }}>
              {lives > 0 ? 'TIME UP' : 'GAME OVER'}
            </p>
            <p className="font-pixel text-amber-900 mb-4" style={{
              fontSize: 28,
              textShadow: '2px 2px 0 rgba(180,83,9,0.35)',
              display: 'inline-block',
              transition: 'transform 0.2s',
            }}>
              {displayedScore}
            </p>
            {bestCombo >= 5 && (
              <p className="font-pixel mb-2" style={{ fontSize: 6, color: '#7C2D12', letterSpacing: 2 }}>
                BEST COMBO x{bestCombo >= 10 ? 3 : 2} ({bestCombo} CATCHES)
              </p>
            )}
            {reward && (
              <div className="mb-4">
                <GameCoinReward coins={reward.coins} blocked={reward.blocked} />
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button onClick={() => { playSound('ui_tap'); start() }}
                className="flex items-center gap-1.5 px-4 py-2 text-white active:translate-y-[2px] transition-transform"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: '2px solid #B45309', borderRadius: 3, boxShadow: '0 3px 0 #92400E', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                <RefreshCw size={12} />
                AGAIN
              </button>
              <button onClick={() => { playSound('ui_back'); router.push('/games') }}
                className="px-4 py-2 text-amber-900 active:translate-y-[2px] transition-transform"
                style={{ background: 'rgba(255,255,255,0.9)', border: '2px solid #D97706', borderRadius: 3, boxShadow: '0 3px 0 #B45309', fontFamily: '"Press Start 2P"', fontSize: 7 }}>
                BACK
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes cloudDrift {
          from { transform: translateX(-25px); }
          to   { transform: translateX(25px); }
        }
        @keyframes itemSpin {
          from { transform: rotate(-8deg); }
          50%  { transform: rotate(8deg); }
          to   { transform: rotate(-8deg); }
        }
        @keyframes erenBob {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(-5px); }
        }
        @keyframes floatUp {
          0%   { transform: translateX(-50%) translateY(0); opacity: 1; }
          100% { transform: translateX(-50%) translateY(-46px); opacity: 0; }
        }
        @keyframes timerPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @keyframes sceneShake {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          45%      { transform: translateX(6px); }
          70%      { transform: translateX(-4px); }
        }
        @keyframes hurtFade {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes heartBeat {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.18); }
        }
        /* Slow drifting sparkle field behind the start plaque */
        @keyframes ttStarDrift {
          from { background-position: 0 0, 22px 28px; }
          to   { background-position: 200px 0, 222px 28px; }
        }
        /* Sweeping shine across the plaque + start button */
        @keyframes ttPlaqueShine {
          0%, 30%   { transform: translateX(-130%); }
          70%, 100% { transform: translateX(130%); }
        }
        /* Quick chomp / squash on positive catch */
        @keyframes erenChomp {
          0%   { transform: scale(1, 1); }
          40%  { transform: scale(1.15, 0.92); }
          100% { transform: scale(1, 1); }
        }
        /* Side-to-side wobble for dangers — small, fast */
        @keyframes dangerWobble {
          0%, 100% { translate: -1px 0; }
          50%      { translate:  1px 0; }
        }
        /* Pulsing red aura so dangers read at a glance */
        @keyframes dangerPulse {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
        /* Radial particle burst — moves toward --dx/--dy and fades */
        @keyframes ttParticle {
          0%   { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.4); opacity: 0; }
        }
        /* Heart shard fly-out with gravity-ish arc */
        @keyframes ttShard {
          0%   { transform: translate(-50%, -50%) translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) translate(var(--dx), calc(var(--dy) + 28px)) rotate(140deg); opacity: 0; }
        }
        /* Smoke puff rising as it fades */
        @keyframes ttPuff {
          0%   { transform: translateY(0) scale(0.75); opacity: 0.95; }
          100% { transform: translateY(-14px) scale(1.4); opacity: 0; }
        }
        /* Score shake on negative score change */
        @keyframes scoreShake {
          0%, 100% { transform: translateX(0) scale(0.88); }
          25%      { transform: translateX(-3px) scale(0.88); }
          75%      { transform: translateX(3px) scale(0.88); }
        }
        /* Sad Eren bob — slower, smaller */
        @keyframes sadBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}

// ── Small legend tile used in intro ─────────────────────────────────────────
function LegendTile({ Icon, tint, pts, danger }: { Icon: React.FC<{ size?: number }>, tint: string, pts: string, danger?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-1.5 px-1 relative"
      style={{
        // Subtle gradient + soft inner highlight gives each tile depth.
        background: danger
          ? 'linear-gradient(180deg, rgba(255,255,255,0.6), rgba(254,202,202,0.35))'
          : 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.25))',
        border: `1.5px solid ${danger ? '#B91C1C' : tint}`,
        borderRadius: 4,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 0 rgba(0,0,0,0.18)',
      }}>
      <Icon size={20} />
      <span className="font-pixel" style={{
        fontSize: 6,
        color: danger ? '#7F1D1D' : '#7C2D12',
        letterSpacing: 0.5,
        textShadow: '0 1px 0 rgba(255,255,255,0.5)',
      }}>{pts}</span>
    </div>
  )
}
