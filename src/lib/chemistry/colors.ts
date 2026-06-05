// Color helpers for the periodic-table tiles.
//
// Ported from AminaChemistry/lib/colors.ts. Mastery mode lights up once
// the chemistry store has card states for the household device.

import type { ElementCategory, ElementState } from './elements'

export type ColorMode = 'category' | 'state' | 'mastery'

export const CATEGORY_COLORS: Record<ElementCategory, string> = {
  'alkali-metal':         '#f87171', // red
  'alkaline-earth-metal': '#fb923c', // orange
  'transition-metal':     '#fbbf24', // amber
  'post-transition-metal':'#34d399', // emerald
  metalloid:              '#2dd4bf', // teal
  nonmetal:               '#38bdf8', // sky
  halogen:                '#a78bfa', // violet
  'noble-gas':            '#f472b6', // pink
  lanthanide:             '#818cf8', // indigo
  actinide:               '#c084fc', // purple
}

export const STATE_COLORS: Record<ElementState, string> = {
  solid:   '#94a3b8', // slate
  liquid:  '#22d3ee', // cyan
  gas:     '#f59e0b', // amber
  unknown: '#52525b', // zinc
}

export const STATE_LABELS: Record<ElementState, string> = {
  solid:   'Solid',
  liquid:  'Liquid',
  gas:     'Gas',
  unknown: 'Unknown',
}

// Mastery heatmap: box 0 (new) = grey, 1-5 deepening green, 6 = bright.
// Matches Amina's palette so a future cross-device sync feels consistent.
export const MASTERY_COLORS: string[] = [
  '#3f3f46', // 0 new — grey
  '#0f3d2e', // 1
  '#15573f', // 2
  '#1a7050', // 3
  '#1f9462', // 4
  '#22c55e', // 5
  '#4ade80', // 6 mastered — bright
]

export function masteryColor(box: number): string {
  const i = Math.max(0, Math.min(box, 6))
  return MASTERY_COLORS[i]
}

/** Pick readable text color (dark for bright fills, light for dark fills). */
export function readableText(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#0b1220' : '#f8fafc'
}
