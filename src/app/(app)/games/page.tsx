'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCare } from '@/contexts/CareContext'
import {
  IconController, IconMouse, IconYarn, IconPaw, IconFish,
  IconStar, IconCrown, IconHeart, IconMeat, IconCoin, IconSparkles,
  IconScroll, IconLightning, IconSwords, IconHouse, IconCatFace,
} from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import type { GameType } from '@/types'

type GameMeta = {
  id: GameType
  href: string
  title: string
  desc: string
  bg: string
  border: string
  shadow: string
  accent: string
  Icon: React.FC<{ size?: number }>
  preview: React.FC<{ size?: number }>[]
}

const GAMES: GameMeta[] = [
  {
    id: 'catch_mouse' as GameType,
    href: '/games/catch-mouse',
    title: 'CATCH THE MOUSE',
    desc: 'Tap the pixel mouse before it escapes!',
    bg: 'linear-gradient(135deg, #FFF5E0, #FFE8C0)',
    border: '#F5C842',
    shadow: '#D4A020',
    accent: '#B07F10',
    Icon: IconMouse,
    preview: [IconMouse, IconStar, IconStar],
  },
  {
    id: 'paw_tap' as GameType,
    href: '/games/paw-tap',
    title: 'PAW TAP!',
    desc: 'Tap the fish before they swim away!',
    bg: 'linear-gradient(135deg, #E8F6FF, #D0EEFF)',
    border: '#6BAED6',
    shadow: '#3A88B8',
    accent: '#3A88B8',
    Icon: IconFish,
    preview: [IconFish, IconPaw, IconStar],
  },
  {
    id: 'memory_match' as GameType,
    href: '/games/memory-match',
    title: 'PURR-FECT MEMORY',
    desc: 'Flip cards, match pairs, chain combos!',
    bg: 'linear-gradient(135deg, #F3E8FF, #E9D5FF)',
    border: '#A78BFA',
    shadow: '#7C3AED',
    accent: '#7C3AED',
    Icon: IconScroll,
    preview: [IconScroll, IconHeart, IconStar],
  },
  {
    id: 'treat_tumble' as GameType,
    href: '/games/treat-tumble',
    title: 'TREAT TUMBLE',
    desc: 'Drag Eren to catch treats, dodge junk!',
    bg: 'linear-gradient(135deg, #FFF8D0, #FFE8A0)',
    border: '#F59E0B',
    shadow: '#B45309',
    accent: '#B45309',
    Icon: IconMeat,
    preview: [IconFish, IconStar, IconMeat],
  },
  {
    id: 'flappy_eren' as GameType,
    href: '/games/flappy-eren',
    title: 'FIZZY EREN',
    desc: 'Tap to fizz! Dodge pipes, ride the can.',
    bg: 'linear-gradient(135deg, #E8FFF0, #C8F4D8)',
    border: '#10B981',
    shadow: '#047857',
    accent: '#047857',
    Icon: IconLightning,
    preview: [IconLightning, IconStar, IconHeart],
  },
  {
    id: 'tic_tac_toe' as GameType,
    href: '/games/tic-tac-toe',
    title: 'X & O VS EREN',
    desc: "Beat Eren — he plans every move.",
    bg: 'linear-gradient(135deg, #FFE0F0, #FFC8E8)',
    border: '#EC4899',
    shadow: '#9D174D',
    accent: '#9D174D',
    Icon: IconSwords,
    preview: [IconSwords, IconCrown, IconHeart],
  },
  {
    id: 'eren_stack' as GameType,
    href: '/games/eren-stack',
    title: 'EREN STACK',
    desc: 'Tap to drop. Stack pixels to the sky.',
    bg: 'linear-gradient(135deg, #DBEAFE, #BFDBFE)',
    border: '#3B82F6',
    shadow: '#1D4ED8',
    accent: '#1D4ED8',
    Icon: IconHouse,
    preview: [IconHouse, IconCrown, IconStar],
  },
  {
    id: 'yarn_pop' as GameType,
    href: '/games/yarn-pop',
    title: 'YARN POP',
    desc: 'Match three! Cascade combos for big score.',
    bg: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)',
    border: '#EC4899',
    shadow: '#9D174D',
    accent: '#9D174D',
    Icon: IconHeart,
    preview: [IconHeart, IconYarn, IconStar],
  },
  {
    id: 'eren_says' as GameType,
    href: '/games/eren-says',
    title: 'EREN SAYS',
    desc: 'Watch his paws — repeat the song.',
    bg: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)',
    border: '#7C3AED',
    shadow: '#4C1D95',
    accent: '#4C1D95',
    Icon: IconCatFace,
    preview: [IconCatFace, IconPaw, IconStar],
  },
  {
    id: 'lane_runner' as GameType,
    href: '/games/lane-runner',
    title: 'LANE RUNNER',
    desc: 'Three lanes. Dodge or perish. Run forever.',
    bg: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)',
    border: '#16A34A',
    shadow: '#166534',
    accent: '#166534',
    Icon: IconCoin,
    preview: [IconCoin, IconStar, IconCoin],
  },
  {
    id: 'paw_doku' as GameType,
    href: '/games/paw-doku',
    title: 'PAW DOKU',
    desc: 'Drop blocks. Clear lines. Chain combos.',
    bg: 'linear-gradient(135deg, #F3E8FF, #E9D5FF)',
    border: '#A78BFA',
    shadow: '#4C1D95',
    accent: '#4C1D95',
    Icon: IconSparkles,
    preview: [IconSparkles, IconHeart, IconStar],
  },
]

// ─── Per-game mini scenes ───────────────────────────────────────────────────
// Each game card shows a custom 48×48 pixel-art scene instead of a single
// generic icon. The scenes are a couple of related elements arranged so
// each card reads at a glance as that specific game.
function GameScene({ id, size = 48 }: { id: GameType; size?: number }) {
  switch (id) {
    case 'catch_mouse':  return <CatchMouseScene  size={size} />
    case 'paw_tap':      return <PawTapScene      size={size} />
    case 'memory_match': return <MemoryScene      size={size} />
    case 'treat_tumble': return <TreatTumbleScene size={size} />
    case 'flappy_eren':  return <FlappyScene      size={size} />
    case 'tic_tac_toe':  return <TicTacToeScene   size={size} />
    case 'eren_stack':   return <StackScene       size={size} />
    case 'yarn_pop':     return <YarnPopScene     size={size} />
    case 'eren_says':    return <SaysScene        size={size} />
    case 'lane_runner':  return <LaneRunnerScene  size={size} />
    case 'paw_doku':     return <PawDokuScene     size={size} />
  }
}

function svgProps(size: number) {
  return {
    width: size, height: size, viewBox: '0 0 48 48',
    shapeRendering: 'crispEdges' as const,
    style: { imageRendering: 'pixelated' as const },
  }
}

// CATCH MOUSE — gray mouse + cheese with motion dust
function CatchMouseScene({ size }: { size: number }) {
  return (
    <svg {...svgProps(size)}>
      {/* Cheese */}
      <rect x="32" y="22" width="12" height="2" fill="#FDE68A" />
      <rect x="32" y="24" width="12" height="6" fill="#FCD34D" />
      <rect x="32" y="30" width="12" height="2" fill="#92400E" />
      <rect x="34" y="25" width="2" height="2" fill="#92400E" />
      <rect x="38" y="27" width="2" height="2" fill="#92400E" />
      {/* Mouse body */}
      <rect x="14" y="22" width="2" height="2" fill="#FBCFE8" />     {/* ear */}
      <rect x="20" y="22" width="2" height="2" fill="#FBCFE8" />     {/* ear */}
      <rect x="13" y="24" width="2" height="2" fill="#9CA3AF" />
      <rect x="21" y="24" width="2" height="2" fill="#9CA3AF" />
      <rect x="13" y="24" width="10" height="6" fill="#9CA3AF" />
      <rect x="13" y="24" width="10" height="2" fill="#D1D5DB" />    {/* highlight */}
      <rect x="15" y="26" width="2" height="2" fill="#1F2937" />     {/* eye */}
      <rect x="22" y="27" width="2" height="2" fill="#FBCFE8" />     {/* nose */}
      {/* Tail */}
      <rect x="11" y="28" width="2" height="1" fill="#F472B6" />
      <rect x="9"  y="29" width="2" height="1" fill="#F472B6" />
      <rect x="7"  y="30" width="2" height="1" fill="#F472B6" />
      {/* Motion dust */}
      <rect x="4" y="32" width="3" height="2" fill="#9CA3AF" opacity="0.5" />
      <rect x="0" y="34" width="3" height="2" fill="#9CA3AF" opacity="0.3" />
    </svg>
  )
}

// PAW TAP — fish leaping out of water with bubbles
function PawTapScene({ size }: { size: number }) {
  return (
    <svg {...svgProps(size)}>
      {/* Water surface */}
      <rect x="0"  y="38" width="48" height="2" fill="#1E40AF" />
      <rect x="0"  y="36" width="48" height="2" fill="#3B82F6" opacity="0.6" />
      {/* Fish body */}
      <rect x="14" y="14" width="20" height="12" fill="#3B82F6" />
      <rect x="14" y="14" width="20" height="3"  fill="#93C5FD" />     {/* highlight */}
      <rect x="14" y="22" width="20" height="3"  fill="#1E40AF" />     {/* shadow */}
      <rect x="13" y="16" width="1"  height="8"  fill="#1E40AF" />     {/* mouth */}
      <rect x="20" y="17" width="3"  height="3"  fill="#FFFFFF" />     {/* eye */}
      <rect x="22" y="17" width="1"  height="2"  fill="#1F2937" />
      {/* Tail fin */}
      <rect x="34" y="14" width="3"  height="3"  fill="#1E40AF" />
      <rect x="37" y="11" width="3"  height="4"  fill="#1E40AF" />
      <rect x="34" y="22" width="3"  height="3"  fill="#1E40AF" />
      <rect x="37" y="24" width="3"  height="4"  fill="#1E40AF" />
      {/* Bubbles */}
      <rect x="6"  y="20" width="3" height="3" fill="#BFDBFE" opacity="0.85" />
      <rect x="3"  y="26" width="2" height="2" fill="#BFDBFE" opacity="0.7" />
      <rect x="40" y="6"  width="3" height="3" fill="#BFDBFE" opacity="0.65" />
    </svg>
  )
}

// MEMORY MATCH — three cards, the centre one flipped showing a heart
function MemoryScene({ size }: { size: number }) {
  return (
    <svg {...svgProps(size)}>
      {/* Card 1 — face down with star back */}
      <rect x="2"  y="10" width="14" height="22" fill="#5B21B6" />
      <rect x="2"  y="10" width="14" height="3"  fill="#7C3AED" />
      <rect x="2"  y="29" width="14" height="3"  fill="#3B0764" />
      <rect x="6"  y="18" width="6"  height="6"  fill="#FBBF24" />
      <rect x="7"  y="17" width="4"  height="1"  fill="#FBBF24" />
      <rect x="7"  y="24" width="4"  height="1"  fill="#FBBF24" />
      {/* Card 2 — face up with HEART (the match) */}
      <rect x="17" y="10" width="14" height="22" fill="#FFFFFF" />
      <rect x="17" y="10" width="14" height="3"  fill="#FBCFE8" />
      <rect x="17" y="29" width="14" height="3"  fill="#FCE7F3" />
      <rect x="20" y="16" width="4"  height="3"  fill="#EC4899" />
      <rect x="24" y="16" width="4"  height="3"  fill="#EC4899" />
      <rect x="19" y="19" width="10" height="3"  fill="#EC4899" />
      <rect x="20" y="22" width="8"  height="2"  fill="#EC4899" />
      <rect x="22" y="24" width="4"  height="2"  fill="#EC4899" />
      {/* Card 3 — face down */}
      <rect x="32" y="10" width="14" height="22" fill="#5B21B6" />
      <rect x="32" y="10" width="14" height="3"  fill="#7C3AED" />
      <rect x="32" y="29" width="14" height="3"  fill="#3B0764" />
      <rect x="36" y="18" width="6"  height="6"  fill="#FBBF24" />
      {/* Sparkle */}
      <rect x="38" y="4" width="1" height="3" fill="#FFFFFF" />
      <rect x="37" y="5" width="3" height="1" fill="#FFFFFF" />
    </svg>
  )
}

// TREAT TUMBLE — kibble + cookie + heart falling on a paw
function TreatTumbleScene({ size }: { size: number }) {
  return (
    <svg {...svgProps(size)}>
      {/* Kibble */}
      <rect x="6"  y="6"  width="6" height="6" fill="#D4892A" />
      <rect x="7"  y="7"  width="4" height="4" fill="#F5C842" />
      <rect x="7"  y="7"  width="1" height="1" fill="#FFF4A3" />
      {/* Cookie */}
      <rect x="20" y="2"  width="8" height="8" fill="#92400E" />
      <rect x="21" y="3"  width="6" height="6" fill="#D97706" />
      <rect x="22" y="4"  width="2" height="2" fill="#451A03" />
      <rect x="25" y="6"  width="2" height="2" fill="#451A03" />
      {/* Heart */}
      <rect x="34" y="10" width="3" height="2" fill="#EC4899" />
      <rect x="38" y="10" width="3" height="2" fill="#EC4899" />
      <rect x="33" y="12" width="9" height="3" fill="#EC4899" />
      <rect x="34" y="15" width="7" height="2" fill="#EC4899" />
      <rect x="36" y="17" width="3" height="2" fill="#EC4899" />
      {/* Motion lines */}
      <rect x="10" y="14" width="1" height="3" fill="#FBBF24" opacity="0.5" />
      <rect x="24" y="12" width="1" height="3" fill="#FBBF24" opacity="0.5" />
      {/* Paw at the bottom — main pad + 3 toe pads */}
      <rect x="14" y="36" width="3" height="3" fill="#FFFFFF" />
      <rect x="22" y="34" width="3" height="3" fill="#FFFFFF" />
      <rect x="30" y="36" width="3" height="3" fill="#FFFFFF" />
      <rect x="16" y="40" width="16" height="6" fill="#FFFFFF" />
      <rect x="14" y="42" width="20" height="4" fill="#FFFFFF" />
      <rect x="20" y="42" width="8" height="2"  fill="#F472B6" opacity="0.5" />
    </svg>
  )
}

// FIZZY EREN — energy can with lightning bolt + ears
function FlappyScene({ size }: { size: number }) {
  return (
    <svg {...svgProps(size)}>
      {/* Cat ears at top */}
      <rect x="10" y="2"  width="4" height="2" fill="#4A2E1A" />
      <rect x="9"  y="4"  width="6" height="3" fill="#9B7A5C" />
      <rect x="11" y="5"  width="2" height="1" fill="#FBCFE8" />
      <rect x="34" y="2"  width="4" height="2" fill="#4A2E1A" />
      <rect x="33" y="4"  width="6" height="3" fill="#9B7A5C" />
      <rect x="35" y="5"  width="2" height="1" fill="#FBCFE8" />
      {/* Lightning bolt big behind */}
      <rect x="20" y="6"  width="6" height="3"  fill="#FBBF24" opacity="0.4" />
      <rect x="18" y="9"  width="8" height="3"  fill="#FBBF24" opacity="0.4" />
      <rect x="22" y="12" width="8" height="3"  fill="#FBBF24" opacity="0.4" />
      {/* Energy can — vertical, dark with lime */}
      <rect x="18" y="14" width="12" height="3" fill="#525252" />
      <rect x="18" y="17" width="12" height="22" fill="#0F0F0F" />
      <rect x="18" y="39" width="12" height="3" fill="#525252" />
      {/* Lime stripes */}
      <rect x="20" y="20" width="2" height="14" fill="#10B981" />
      <rect x="23" y="22" width="2" height="12" fill="#10B981" />
      <rect x="26" y="20" width="2" height="14" fill="#10B981" />
      {/* Pull tab */}
      <rect x="22" y="11" width="4" height="3" fill="#9CA3AF" />
      {/* Lightning bolt small */}
      <rect x="32" y="22" width="3" height="2" fill="#FDE68A" />
      <rect x="30" y="24" width="5" height="2" fill="#FBBF24" />
      <rect x="33" y="26" width="3" height="2" fill="#FDE68A" />
    </svg>
  )
}

// TIC TAC TOE — 3×3 grid with a winning X / O move drawn
function TicTacToeScene({ size }: { size: number }) {
  return (
    <svg {...svgProps(size)}>
      {/* Grid lines */}
      <rect x="18" y="6"  width="2"  height="36" fill="#A78BFA" />
      <rect x="28" y="6"  width="2"  height="36" fill="#A78BFA" />
      <rect x="6"  y="18" width="36" height="2"  fill="#A78BFA" />
      <rect x="6"  y="28" width="36" height="2"  fill="#A78BFA" />
      {/* X (top-left) — pink */}
      <rect x="9"  y="9"  width="2" height="2" fill="#FF6B9D" />
      <rect x="11" y="11" width="2" height="2" fill="#FF6B9D" />
      <rect x="13" y="13" width="2" height="2" fill="#FF6B9D" />
      <rect x="15" y="9"  width="2" height="2" fill="#FF6B9D" />
      <rect x="13" y="11" width="2" height="2" fill="#FF6B9D" />
      <rect x="9"  y="15" width="2" height="2" fill="#FF6B9D" />
      {/* O (centre) — purple */}
      <rect x="22" y="20" width="4" height="2" fill="#A78BFA" />
      <rect x="22" y="26" width="4" height="2" fill="#A78BFA" />
      <rect x="20" y="22" width="2" height="4" fill="#A78BFA" />
      <rect x="26" y="22" width="2" height="4" fill="#A78BFA" />
      {/* X (bottom-right) — pink */}
      <rect x="33" y="33" width="2" height="2" fill="#FF6B9D" />
      <rect x="35" y="35" width="2" height="2" fill="#FF6B9D" />
      <rect x="37" y="37" width="2" height="2" fill="#FF6B9D" />
      <rect x="39" y="33" width="2" height="2" fill="#FF6B9D" />
      <rect x="37" y="35" width="2" height="2" fill="#FF6B9D" />
      <rect x="33" y="39" width="2" height="2" fill="#FF6B9D" />
    </svg>
  )
}

// EREN STACK — tower of stacked blocks with a crown on top
function StackScene({ size }: { size: number }) {
  return (
    <svg {...svgProps(size)}>
      {/* Crown */}
      <rect x="18" y="2"  width="2" height="3" fill="#FBBF24" />
      <rect x="22" y="0"  width="2" height="5" fill="#FBBF24" />
      <rect x="26" y="2"  width="2" height="3" fill="#FBBF24" />
      <rect x="16" y="5"  width="14" height="3" fill="#FBBF24" />
      <rect x="16" y="5"  width="14" height="1" fill="#FDE68A" />
      <rect x="20" y="6"  width="2" height="1" fill="#DC2626" />
      <rect x="24" y="6"  width="2" height="1" fill="#DC2626" />
      {/* Stacked blocks — different colours, shrinking up */}
      <rect x="6"  y="34" width="36" height="8" fill="#3B82F6" />
      <rect x="6"  y="34" width="36" height="2" fill="#93C5FD" />
      <rect x="6"  y="40" width="36" height="2" fill="#1E40AF" />
      <rect x="9"  y="26" width="30" height="8" fill="#10B981" />
      <rect x="9"  y="26" width="30" height="2" fill="#A7F3D0" />
      <rect x="9"  y="32" width="30" height="2" fill="#047857" />
      <rect x="13" y="18" width="22" height="8" fill="#EC4899" />
      <rect x="13" y="18" width="22" height="2" fill="#FBCFE8" />
      <rect x="13" y="24" width="22" height="2" fill="#9D174D" />
      <rect x="16" y="10" width="16" height="8" fill="#FBBF24" />
      <rect x="16" y="10" width="16" height="2" fill="#FDE68A" />
      <rect x="16" y="16" width="16" height="2" fill="#92400E" />
    </svg>
  )
}

// YARN POP — 3×3 colourful tiles with three matching ones lit
function YarnPopScene({ size }: { size: number }) {
  const C = (x: number, y: number, hue: string, glow = false) => (
    <g>
      <rect x={x} y={y} width="12" height="12" fill={hue} />
      <rect x={x} y={y} width="12" height="3"  fill="#FFFFFF" opacity="0.4" />
      <rect x={x} y={y+9} width="12" height="3" fill="#000000" opacity="0.25" />
      {glow && <rect x={x-1} y={y-1} width="14" height="14" fill="none" stroke="#FFD700" strokeWidth="1.5" />}
    </g>
  )
  return (
    <svg {...svgProps(size)}>
      {C(4,  4,  '#EC4899', true)}
      {C(18, 4,  '#A78BFA')}
      {C(32, 4,  '#EC4899', true)}
      {C(4,  18, '#FBBF24')}
      {C(18, 18, '#EC4899', true)}
      {C(32, 18, '#34D399')}
      {C(4,  32, '#60A5FA')}
      {C(18, 32, '#FBBF24')}
      {C(32, 32, '#A78BFA')}
      {/* Sparkles around the matched line */}
      <rect x="0"  y="8"  width="2" height="2" fill="#FFD700" />
      <rect x="44" y="8"  width="2" height="2" fill="#FFD700" />
      <rect x="22" y="0"  width="2" height="2" fill="#FFD700" />
    </svg>
  )
}

// EREN SAYS — 4 colourful pads in a 2×2 grid, one lit with a sparkle
function SaysScene({ size }: { size: number }) {
  return (
    <svg {...svgProps(size)}>
      {/* Top-left pad — green, lit */}
      <rect x="4"  y="4"  width="18" height="18" fill="#10B981" />
      <rect x="4"  y="4"  width="18" height="4"  fill="#A7F3D0" />
      <rect x="4"  y="18" width="18" height="4"  fill="#047857" />
      <rect x="2"  y="2"  width="22" height="22" fill="none" stroke="#FFD700" strokeWidth="1.5" />
      {/* Top-right pad — red */}
      <rect x="26" y="4"  width="18" height="18" fill="#7F1D1D" />
      <rect x="26" y="4"  width="18" height="4"  fill="#DC2626" opacity="0.5" />
      {/* Bottom-left pad — yellow */}
      <rect x="4"  y="26" width="18" height="18" fill="#7C5A0E" />
      <rect x="4"  y="26" width="18" height="4"  fill="#FBBF24" opacity="0.5" />
      {/* Bottom-right pad — blue */}
      <rect x="26" y="26" width="18" height="18" fill="#1E3A8A" />
      <rect x="26" y="26" width="18" height="4"  fill="#3B82F6" opacity="0.5" />
      {/* Centre sparkle on the lit pad */}
      <rect x="11" y="11" width="4" height="4"  fill="#FFFFFF" />
      <rect x="12" y="9"  width="2" height="2"  fill="#FFFFFF" />
      <rect x="12" y="15" width="2" height="2"  fill="#FFFFFF" />
      <rect x="9"  y="12" width="2" height="2"  fill="#FFFFFF" />
      <rect x="15" y="12" width="2" height="2"  fill="#FFFFFF" />
    </svg>
  )
}

// LANE RUNNER — 3 lanes with cat in the middle + obstacle ahead
function LaneRunnerScene({ size }: { size: number }) {
  return (
    <svg {...svgProps(size)}>
      {/* Road background */}
      <rect x="0"  y="0"  width="48" height="48" fill="#15803D" />
      {/* 3 lanes — slightly darker stripes */}
      <rect x="4"  y="0"  width="14" height="48" fill="#166534" />
      <rect x="30" y="0"  width="14" height="48" fill="#166534" />
      {/* Lane dividers */}
      <rect x="18" y="2"  width="2" height="6" fill="#FBBF24" />
      <rect x="18" y="14" width="2" height="6" fill="#FBBF24" />
      <rect x="18" y="26" width="2" height="6" fill="#FBBF24" />
      <rect x="18" y="38" width="2" height="6" fill="#FBBF24" />
      <rect x="28" y="2"  width="2" height="6" fill="#FBBF24" />
      <rect x="28" y="14" width="2" height="6" fill="#FBBF24" />
      <rect x="28" y="26" width="2" height="6" fill="#FBBF24" />
      <rect x="28" y="38" width="2" height="6" fill="#FBBF24" />
      {/* Coin in front lane */}
      <rect x="22" y="6"  width="4" height="4" fill="#FBBF24" />
      <rect x="21" y="7"  width="6" height="2" fill="#FBBF24" />
      <rect x="22" y="6"  width="2" height="2" fill="#FDE68A" />
      {/* Cat (back) — chibi silhouette in middle lane */}
      <rect x="20" y="22" width="2" height="2" fill="#4A2E1A" />     {/* ear */}
      <rect x="26" y="22" width="2" height="2" fill="#4A2E1A" />     {/* ear */}
      <rect x="20" y="24" width="8" height="8" fill="#F9EDD5" />     {/* head */}
      <rect x="20" y="24" width="8" height="2" fill="#4A2E1A" />     {/* outline */}
      <rect x="22" y="27" width="1" height="2" fill="#1F2937" />     {/* eye */}
      <rect x="25" y="27" width="1" height="2" fill="#1F2937" />     {/* eye */}
      <rect x="22" y="32" width="4" height="6" fill="#F9EDD5" />     {/* body */}
      <rect x="22" y="32" width="4" height="1" fill="#4A2E1A" />
      <rect x="22" y="38" width="4" height="1" fill="#4A2E1A" />
    </svg>
  )
}

// PAW DOKU — 9-cell sudoku grid with several blocks placed
function PawDokuScene({ size }: { size: number }) {
  // 3×3 of 3×3 cells. Cell size 4, gap 1.
  const filled: Array<[number, number, string]> = [
    [0, 0, '#EC4899'], [1, 0, '#EC4899'], [2, 0, '#EC4899'],   // top row of TL block
    [0, 1, '#EC4899'],                                         // partial fill TL
    [4, 4, '#A78BFA'], [5, 4, '#A78BFA'], [4, 5, '#A78BFA'], [5, 5, '#A78BFA'],  // 2x2 in centre
    [7, 7, '#FBBF24'], [8, 7, '#FBBF24'], [7, 8, '#FBBF24'], [8, 8, '#FBBF24'],  // 2x2 BR
    [0, 6, '#34D399'], [1, 6, '#34D399'], [2, 6, '#34D399'],   // line BL
    [6, 0, '#60A5FA'], [7, 0, '#60A5FA'],                      // line TR
  ]
  const cell = 4
  const gap = 1
  const offset = 4
  return (
    <svg {...svgProps(size)}>
      {/* Cells */}
      {Array.from({ length: 81 }).map((_, i) => {
        const r = Math.floor(i / 9)
        const c = i % 9
        const f = filled.find(([fc, fr]) => fc === c && fr === r)
        return (
          <rect key={i}
            x={offset + c * (cell + gap)}
            y={offset + r * (cell + gap)}
            width={cell} height={cell}
            fill={f ? f[2] : 'rgba(167,139,250,0.18)'}
            stroke={f ? 'rgba(0,0,0,0.4)' : 'none'}
            strokeWidth={f ? 0.5 : 0} />
        )
      })}
      {/* 3×3 sub-block dividers */}
      <line x1={offset + 3 * (cell+gap) - 0.5} y1={offset - 1} x2={offset + 3 * (cell+gap) - 0.5} y2={offset + 9 * (cell+gap) - 1} stroke="#FBBF24" strokeWidth="1" opacity="0.7" />
      <line x1={offset + 6 * (cell+gap) - 0.5} y1={offset - 1} x2={offset + 6 * (cell+gap) - 0.5} y2={offset + 9 * (cell+gap) - 1} stroke="#FBBF24" strokeWidth="1" opacity="0.7" />
      <line x1={offset - 1} y1={offset + 3 * (cell+gap) - 0.5} x2={offset + 9 * (cell+gap) - 1} y2={offset + 3 * (cell+gap) - 0.5} stroke="#FBBF24" strokeWidth="1" opacity="0.7" />
      <line x1={offset - 1} y1={offset + 6 * (cell+gap) - 0.5} x2={offset + 9 * (cell+gap) - 1} y2={offset + 6 * (cell+gap) - 0.5} stroke="#FBBF24" strokeWidth="1" opacity="0.7" />
    </svg>
  )
}

export default function GamesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { setHideStats } = useCare()
  // Hide the persistent StatsHeader on the games page — the page has its
  // own glass header with a back button, and the StatsHeader was covering
  // it in iOS PWA mode. Stats are still visible on /home and /care scenes.
  useEffect(() => { setHideStats(true) }, [setHideStats])
  const supabase = createClient()

  // Just my own personal-bests for the per-card score chip — the full
  // household leaderboard now lives as a modal opened from the playroom.
  const [myScores, setMyScores] = useState<Partial<Record<GameType, number>>>({})

  useEffect(() => {
    if (!user?.id) return
    async function load() {
      const { data: scores } = await supabase
        .from('game_scores')
        .select('game_type, score')
        .eq('user_id', user!.id)

      const best: Partial<Record<GameType, number>> = {}
      scores?.forEach((s: { game_type: GameType; score: number }) => {
        const current = best[s.game_type] ?? 0
        if (s.score > current) best[s.game_type] = s.score
      })
      setMyScores(best)
    }
    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page-scroll relative" style={{
      background: 'radial-gradient(ellipse at top, #2C1659 0%, #170B33 55%, #08051C 100%)',
      minHeight: '100vh',
      marginLeft: -16, marginRight: -16, marginTop: -16,
      paddingLeft: 16, paddingRight: 16,
      // StatsHeader is hidden on this page; only reserve the iOS PWA
      // safe-area at the top so the back button isn't under the status bar.
      paddingTop: 'calc(var(--safe-top) + 12px)', paddingBottom: 24,
    }}>
      {/* Drifting starfield + scanlines for the academy / arcade vibe */}
      <div className="absolute inset-0 pointer-events-none opacity-50" style={{
        backgroundImage: 'radial-gradient(circle, #FBBF24 1px, transparent 1px), radial-gradient(circle, #A78BFA 1px, transparent 1px)',
        backgroundSize: '38px 38px, 56px 56px',
        backgroundPosition: '0 0, 22px 28px',
        animation: 'gpStarDrift 32s linear infinite',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)',
        zIndex: 1,
      }} />

      {/* ── Glass header ── */}
      <div className="relative z-20 flex items-center gap-2 mb-2 px-2 py-2.5 -mx-2" style={{
        background: 'linear-gradient(180deg, rgba(20,8,40,0.85) 0%, rgba(20,8,40,0.55) 100%)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: 8,
        border: '1px solid rgba(251,191,36,0.4)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        <button onClick={() => { playSound('ui_back'); router.back() }}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{
            width: 34, height: 34,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(167,139,250,0.5)',
            borderRadius: 8,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
          }}>
          <ChevronLeft size={18} className="text-purple-200" />
        </button>
        <span className="font-pixel inline-flex items-center gap-2 px-3 py-1.5"
          style={{
            background: 'linear-gradient(180deg, rgba(20,8,40,0.7), rgba(0,0,0,0.5))',
            border: '1.5px solid #FBBF24',
            borderRadius: 6,
            fontSize: 10, letterSpacing: 2.5,
            color: '#FDE68A',
            textShadow: '1px 1px 0 rgba(0,0,0,0.6), 0 0 8px rgba(251,191,36,0.4)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(251,191,36,0.25)',
          }}>
          <IconController size={14} />
          ARCADE
        </span>
        <div className="flex-1" />
        <span className="font-pixel inline-flex items-center gap-1.5 px-2 py-1.5"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(244,114,182,0.5)',
            borderRadius: 5,
            fontSize: 6, letterSpacing: 1.4,
            color: '#FBCFE8',
          }}>
          <IconHeart size={11} />
          PLAY EARNS XP
        </span>
      </div>

      {/* ── Premium game cards ── */}
      <div className="relative z-10 flex flex-col gap-3 mb-7 mt-4">
        {GAMES.map((game, gameIdx) => {
          const myBest = myScores[game.id]
          return (
            <Link key={game.id} href={game.href} onClick={() => playSound('ui_tap')}>
              <div
                className="relative overflow-hidden active:translate-y-[2px] transition-all"
                style={{
                  background: `linear-gradient(135deg, rgba(20,10,40,0.85) 0%, rgba(8,4,22,0.95) 100%)`,
                  borderRadius: 10,
                  border: `1.5px solid ${game.border}AA`,
                  boxShadow: `
                    0 6px 22px rgba(0,0,0,0.55),
                    inset 0 1px 0 rgba(255,255,255,0.08),
                    inset 0 -1px 0 rgba(0,0,0,0.4),
                    0 0 18px ${game.border}33
                  `,
                }}>
                {/* Theme color glow strip on the left */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0, width: 4,
                  background: `linear-gradient(180deg, ${game.border}, ${game.shadow})`,
                  boxShadow: `0 0 12px ${game.border}88`,
                }} />
                {/* Subtle radial color haze in the icon area */}
                <div style={{
                  position: 'absolute', top: 4, left: 14, width: 80, height: 80,
                  background: `radial-gradient(circle, ${game.border}55 0%, transparent 70%)`,
                  pointerEvents: 'none',
                }} />
                {/* Corner gold rivets */}
                <div style={{ position: 'absolute', top: 6, right: 6, width: 4, height: 4, background: '#FBBF24', opacity: 0.85, boxShadow: '0 0 4px rgba(251,191,36,0.6)' }} />
                <div style={{ position: 'absolute', bottom: 6, right: 6, width: 4, height: 4, background: '#FBBF24', opacity: 0.85, boxShadow: '0 0 4px rgba(251,191,36,0.6)' }} />

                {/* Sweeping diagonal shine — staggered across cards via
                    the per-card gameIdx so they don't all flash in sync. */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ borderRadius: 10 }}>
                  <div className="absolute inset-0" style={{
                    background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.18) 50%, transparent 62%)',
                    animation: `gpCardShine 5.6s ease-in-out infinite`,
                    animationDelay: `${(gameIdx * 0.4) % 5.6}s`,
                  }} />
                </div>

                <div className="relative flex items-center gap-4 p-4 pl-5">
                  {/* Icon tile — bigger now, with a custom mini-scene per
                      game inside an embossed gold-rimmed coin. */}
                  <div className="flex-shrink-0 flex items-center justify-center relative"
                    style={{
                      width: 76, height: 76,
                      background: `radial-gradient(circle at 35% 30%, ${game.border}DD 0%, ${game.shadow} 75%)`,
                      borderRadius: 12,
                      border: `2px solid #FBBF24`,
                      boxShadow: `
                        inset 0 2px 0 rgba(255,255,255,0.4),
                        inset 0 -2px 0 rgba(0,0,0,0.32),
                        0 4px 14px ${game.border}66,
                        0 0 0 3px rgba(251,191,36,0.18),
                        0 0 12px ${game.border}55
                      `,
                    }}>
                    {/* Inner panel — slightly inset, holds the scene */}
                    <div className="absolute inset-1.5 flex items-center justify-center overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0,0,0,0.32), rgba(0,0,0,0.12))',
                        border: '1px solid rgba(255,255,255,0.18)',
                        borderRadius: 8,
                      }}>
                      <GameScene id={game.id} size={56} />
                    </div>
                    {/* Tiny gold rivet at each corner of the coin */}
                    <div style={{ position: 'absolute', top: 3, left: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />
                    <div style={{ position: 'absolute', top: 3, right: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />
                    <div style={{ position: 'absolute', bottom: 3, left: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />
                    <div style={{ position: 'absolute', bottom: 3, right: 3, width: 3, height: 3, background: '#FFD700', boxShadow: '0 0 3px #FFD700' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-pixel mb-1.5" style={{
                      fontSize: 9,
                      color: '#FDE68A',
                      letterSpacing: 1.5,
                      textShadow: `0 1px 0 rgba(0,0,0,0.6), 0 0 6px ${game.border}55`,
                    }}>
                      {game.title}
                    </p>
                    <p className="text-xs leading-snug mb-2" style={{ color: '#C4B5FD', letterSpacing: 0.2 }}>
                      {game.desc}
                    </p>
                    <div className="flex gap-1.5 items-center" style={{ opacity: 0.85 }}>
                      {game.preview.map((Preview, i) => (
                        <div key={i} style={{ opacity: 0.7 + i * 0.1 }}>
                          <Preview size={13} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    {myBest !== undefined && (
                      <div className="flex flex-col items-center px-2.5 py-1"
                        style={{
                          background: 'linear-gradient(180deg, rgba(120,53,15,0.55), rgba(67,20,7,0.7))',
                          border: '1px solid #FBBF24',
                          borderRadius: 5,
                          minWidth: 46,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(251,191,36,0.3)',
                        }}>
                        <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1.5, color: 'rgba(253,230,138,0.7)' }}>BEST</span>
                        <span className="font-pixel" style={{ fontSize: 11, color: '#FDE68A', textShadow: '0 1px 0 rgba(0,0,0,0.5)' }}>{myBest}</span>
                      </div>
                    )}
                    <span className="font-pixel" style={{ fontSize: 12, color: game.border, textShadow: `0 0 6px ${game.border}99` }}>▶</span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* (Household leaderboard moved — it now lives as a modal in the
          playroom, opened via the LEADERBOARD button in PlayScene.) */}

      {/* ── Happiness banner — premium dark with gold trim ── */}
      <div className="relative z-10 mt-4 p-3 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(76,29,149,0.55) 0%, rgba(46,15,92,0.75) 100%)',
          borderRadius: 6,
          border: '1.5px solid rgba(251,191,36,0.5)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(251,191,36,0.2), 0 0 18px rgba(167,139,250,0.18)',
        }}>
        <div className="absolute inset-0 opacity-25 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }} />
        <div className="flex items-center justify-center gap-2 relative">
          <IconStar size={14} />
          <p className="font-pixel text-center" style={{
            fontSize: 7, lineHeight: 2, letterSpacing: 1.5,
            color: '#FDE68A',
            textShadow: '0 1px 0 rgba(0,0,0,0.5), 0 0 8px rgba(251,191,36,0.4)',
          }}>
            PLAYING RAISES EREN&apos;S HAPPINESS
          </p>
          <IconStar size={14} />
        </div>
      </div>

      <style jsx global>{`
        @keyframes gpStarDrift {
          from { background-position: 0 0, 22px 28px; }
          to   { background-position: 200px 0, 222px 28px; }
        }
        /* Sweeping shine that crosses each card. Long pause between
           sweeps + per-card animationDelay so the row reads as
           sparkling rather than synchronised. */
        @keyframes gpCardShine {
          0%, 18%   { transform: translateX(-130%); }
          26%, 100% { transform: translateX(130%); }
        }
      `}</style>
    </div>
  )
}
