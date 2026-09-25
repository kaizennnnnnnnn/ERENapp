// ─── Meadow design tokens ────────────────────────────────────────────────────
// The single place the Meadow redesign's numbers live. Every value is copied
// from the approved boards (scratchpad redesign/KIT_meadow.md, the "tokens
// actually used" table), so a page built from these lines up with the demo the
// owner signed off. If a page needs a colour that is not here, it probably
// wants one of these instead.
//
// The look in one breath: white rounded pieces on a flat section colour, one
// leaf-green lipped button, hard lips (solid offset shadows), never blur, never
// gradients, one rounded font.

import type { UserMood } from '@/types'

export const M = {
  // Surfaces
  ground: '#FFFFFF',      // onboarding background, cards, tab bar
  soft: '#F4F2EE',        // stage, bubble on white, back button, secondary face, icon tiles
  hairline: '#ECE8E1',    // 2px borders on white ground, tab-bar top 1px
  divider: '#F0EDE7',     // 1px list dividers inside white cards
  // Text
  text: '#2F2B28',        // primary text, dark icons
  text2: '#6E6A66',       // secondary text, inactive nav label, mono need icons
  label: '#66615C',       // 12px uppercase labels (contrast-safe on every ground)
  faint: '#A7A29C',       // row chevrons, placeholders
  iconOff: '#8F8A84',     // inactive nav icons
  // Leaf: the one accent
  leaf: '#3F8452',        // primary face, selection border, active icons, "fine" meters
  leafLip: '#2D6340',
  leafTint: '#EAF4EC',    // active nav tile, selected chip bg, input focus ring
  leafInk: '#2D6340',     // text on leafTint
  softLip: '#DAD5CC',     // lip under soft buttons and white round buttons
  // Money, streaks, love, energy
  coin: '#F2B33D',
  coinRim: '#C98C1E',
  coinShine: '#FFE3A0',
  flame: '#F08A3C',
  flameCore: '#F7C04A',
  love: '#E57C9F',        // hearts, unread dot, flower petals
  loveLight: '#F6BCCD',
  energy: '#F2A93B',      // the ONE low need
  energyTint: '#FDF1DC',
  // Controls
  track: '#EEEAE3',       // every meter / ring track
  toggleOff: '#E3DED6',
  danger: '#C0453A',      // destructive row text
  dangerTint: '#FBEAE7',
  // The meadow under the cat
  hill: '#E3EEDF',
  hillShadow: '#CFE2CB',
  tuft: '#8DBF8E',
  // Lips for white pieces sitting ON room art, and the cat's floor shadow
  overArtLip: 'rgba(47, 43, 40, 0.16)',
  groundLip: 'rgba(47, 43, 40, 0.12)',   // white round buttons on a section ground (A2 gear, A4 back)
  floorShadow: 'rgba(90, 58, 30, 0.18)',
} as const

/** Full-bleed page colours, one per section. */
export const GROUND = {
  white: '#FFFFFF',
  us: '#F8DEDA',
  me: '#F7EACB',
  settings: '#ECF0F4',
  play: '#D5ECDD',
} as const
export type GroundName = keyof typeof GROUND

/** Soft tints for icon tiles (A5 game tiles, A3 note board, mood tiles). */
export const TINT = {
  soft: '#F4F2EE',
  leaf: '#EAF4EC',
  amber: '#FDF1DC',
  love: '#FBE6EC',
  blue: '#E3EEF8',
  sky: '#E6EFF7',
  orange: '#FDEBDD',
  lilac: '#EFE9F5',
  danger: '#FBEAE7',
} as const

export const RADIUS = {
  sheet: 28, stage: 28,
  card: 22,
  row: 20, bubble: 20,   // option rows, needs card, speech bubble, love-tray tiles
  tile: 18,
  button: 16, input: 16, navTile: 16,
  segment: 14, segmentInner: 11,
  pill: 999,
} as const

/** Hard lips (solid offset shadows). Never add blur. */
export const LIP = {
  button: (c: string) => `0 4px 0 ${c}`,
  round: (c: string) => `0 3px 0 ${c}`,
  segment: (c: string) => `0 2px 0 ${c}`,
} as const

export const FONT_ROUNDED = "'M PLUS Rounded 1c', 'Arial Rounded MT Bold', system-ui, sans-serif"

/**
 * Type scale (px). Use fixed sizes, never Tailwind's text-* scale.
 * Nothing below 11px; body copy never below 13px.
 */
export const TYPE = {
  heading: { fontSize: 26, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.01em' },   // onboarding h1
  title: { fontSize: 28, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.01em' },     // in-app page title
  bubble: { fontSize: 17, lineHeight: 1.35, fontWeight: 700 },
  body: { fontSize: 15, lineHeight: 1.45, fontWeight: 500 },
  rowLabel: { fontSize: 16, fontWeight: 700 },
  button: { fontSize: 17, fontWeight: 800 },
  label: { fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  chip: { fontSize: 14 },
  tiny: { fontSize: 11 },
  number: { fontWeight: 800, fontVariantNumeric: 'tabular-nums' as const },
} as const

/** Rarity tags: tags, never glows. `legendary` is not on the boards (they show three tiers). */
export const RARITY_TAG = {
  common: { bg: '#F4F2EE', ink: '#6E6A66' },
  rare: { bg: '#EAF4EC', ink: '#2D6340' },
  epic: { bg: '#F8DEDA', ink: '#A2405F' },
  legendary: { bg: '#FDF1DC', ink: '#8A5A12' },
} as const

// ─── Household colours ───────────────────────────────────────────────────────
// Sender-coloured bits only (avatars, split bars, the dot beside a name).
// profiles.heart decides who is which: the creator is brown, the partner who
// joined is pink (migration_per_profile_heart.sql). 'sparkle' is Eren himself.
export const PERSON = {
  brown: '#8A5A3C',
  pink: '#E68FAE',
  eren: '#F2B33D',
} as const

export function personColor(heart: 'brown_heart' | 'pink_heart' | 'sparkle' | null | undefined): string {
  if (heart === 'brown_heart') return PERSON.brown
  if (heart === 'sparkle') return PERSON.eren
  return PERSON.pink
}

// ─── Moods ───────────────────────────────────────────────────────────────────
// good / mid / tired / sad match the boards' dots (Happy, Calm, Tired, Sad);
// angry is not on a board and takes a warm clay so it never reads as "sad".
export const MOOD_STYLE: Record<UserMood, {
  label: string
  dot: string
  tint: string
  icon: 'sun' | 'leaf' | 'moon' | 'cloudRain' | 'storm'
  iconColor?: string
}> = {
  good:  { label: 'Happy',  dot: '#F2B33D', tint: '#FDF1DC', icon: 'sun' },
  mid:   { label: 'Calm',   dot: '#8DBF8E', tint: '#EAF4EC', icon: 'leaf' },
  tired: { label: 'Tired',  dot: '#B7A5A8', tint: '#F1ECED', icon: 'moon', iconColor: '#8E7F86' },
  sad:   { label: 'Sad',    dot: '#6FA3D2', tint: '#E6EFF7', icon: 'cloudRain' },
  angry: { label: 'Grumpy', dot: '#E0795A', tint: '#FBE7E0', icon: 'storm' },
}

// ─── The bottom nav's footprint ──────────────────────────────────────────────
// 1px top border + 6px top pad + 53px row (the 50px tiles, centred) + a bottom
// pad that is at least 24px (the board: 84 in all) and grows to the phone's
// home-indicator inset. Pages that sit under the nav pad their bottom by
// NAV_PAGE_PADDING so the last card clears it with air.
export const NAV_HEIGHT = 'calc(60px + max(24px, env(safe-area-inset-bottom, 0px)))'
export const NAV_PAGE_PADDING = 'calc(84px + env(safe-area-inset-bottom, 0px) + 28px)'

/**
 * The top bar (StatsHeader): 6px under the safe area, a 48px row, its 3px lip
 * and 7px of air. A screen that shows the bar starts its own content this far
 * below the safe area: `calc(var(--safe-top) + ${HEADER_CLEARANCE}px)`.
 * globals.css .page-scroll repeats the number (CSS can't import it).
 */
export const HEADER_CLEARANCE = 64

/**
 * The same bar inside a care room, where it is the only thing up top and so
 * grows: the level and coins on the first line (a 56px row), the needs on a
 * second line of their own (8px under it, 62px tall), then the lip and air.
 * Room UI that sits under the bar starts this far below the safe area.
 */
export const ROOM_HEADER_CLEARANCE = 142

/** How the bar grows into a room and shrinks back out, every piece at once. */
export const HEADER_GROW = '480ms cubic-bezier(0.34, 1.3, 0.64, 1)'
