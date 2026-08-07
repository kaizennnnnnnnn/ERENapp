'use client'

// ═══════════════════════════════════════════════════════════════════════════
// MOOD TILE — one row of the daily picker. The old rows were near-white
// with a thin coloured border and ~60% dead space; these are saturated
// tiles built like the rest of the app's chrome: a recessed portrait
// medallion holding Eren's face, a pixel label with a caption in his voice,
// and a hard (un-blurred) offset shadow in the mood's dark tone.
// ═══════════════════════════════════════════════════════════════════════════

import SketchEren, { type SketchErenState } from '@/components/SketchEren'
import { IconChevronRight } from '@/components/PixelIcons'
import type { MOOD_THEME } from '@/lib/moods'

type Theme = (typeof MOOD_THEME)[keyof typeof MOOD_THEME]

export type TileState = 'idle' | 'selected' | 'dimmed'

const TILE_H = 60
const WELL = 46

// Framing the head inside the medallion. SketchEren draws into a 200×220
// viewBox at `size` × `size * 1.1`, and within it the head runs from the ear
// tips (y=8) to the chin (y=152) — so it is 144/220 of the sprite's height,
// centred at 80/220. Sizing off those numbers rather than by eye is what
// keeps the ears inside the circle.
const SPRITE_RATIO = 1.1
const HEAD_SPAN = 144 / 220
const HEAD_CENTRE = 80 / 220
/** How much of the medallion the head should occupy, ear tip to chin. */
const HEAD_FILL = 0.81

const SPRITE = (WELL * HEAD_FILL) / (HEAD_SPAN * SPRITE_RATIO)
const SPRITE_LEFT = (WELL - SPRITE) / 2
const SPRITE_TOP = WELL / 2 - SPRITE * SPRITE_RATIO * HEAD_CENTRE

export default function MoodTile({
  label, caption, sketch, theme, state, index, onSelect,
}: {
  label: string
  caption: string
  sketch: SketchErenState
  theme: Theme
  state: TileState
  index: number
  onSelect: () => void
}) {
  const selected = state === 'selected'
  const dimmed = state === 'dimmed'

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="relative flex items-center w-full overflow-hidden active:translate-y-[2px]"
      style={{
        height: TILE_H,
        gap: 10,
        padding: '0 8px 0 7px',
        borderRadius: 7,
        border: `2px solid ${theme.main}`,
        // Colour weight sits on the left, under the portrait, and washes out
        // to paper on the right so the label and caption stay legible.
        background: `linear-gradient(100deg, ${theme.main}4A 0%, ${theme.light} 46%, #FFFDFA 100%)`,
        boxShadow: selected
          ? `4px 4px 0 ${theme.dark}, 0 0 24px ${theme.glow}`
          : `3px 3px 0 ${theme.dark}`,
        opacity: dimmed ? 0.3 : 1,
        transform: selected ? 'scale(1.025)' : 'scale(1)',
        filter: dimmed ? 'saturate(0.3)' : 'none',
        transition: 'opacity 320ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1), filter 320ms ease, box-shadow 220ms ease',
        // `backwards`, NOT `both`: a forwards-filling animation keeps winning
        // over the inline opacity/transform above, so the dimmed state would
        // never take effect once a mood is picked.
        animation: 'mgTileIn 340ms cubic-bezier(0.34,1.56,0.64,1) backwards',
        animationDelay: `${index * 55}ms`,
      }}
    >
      {/* Pixel dither — keeps the fill from reading as a flat CSS gradient. */}
      <span aria-hidden className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, ${theme.main}24 1px, transparent 1px)`,
        backgroundSize: '6px 6px',
      }} />
      {/* Screen-shine along the top edge. */}
      <span aria-hidden className="absolute pointer-events-none" style={{
        top: 0, left: 8, right: 8, height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85) 30%, rgba(255,255,255,0.85) 70%, transparent)',
      }} />

      {/* ── Portrait medallion ── */}
      <span aria-hidden className="relative flex-shrink-0" style={{
        width: WELL, height: WELL, borderRadius: '50%', overflow: 'hidden',
        background: `radial-gradient(circle at 50% 28%, #FFFFFF 0%, ${theme.light} 72%, ${theme.main}55 100%)`,
        border: `2px solid ${theme.dark}`,
        boxShadow: `inset 0 2px 5px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.7)`,
      }}>
        <span style={{ position: 'absolute', left: SPRITE_LEFT, top: SPRITE_TOP }}>
          <SketchEren state={sketch} size={SPRITE} transparent noSpeech />
        </span>
      </span>

      <span className="flex-1 text-left relative" style={{ lineHeight: 1 }}>
        <span className="font-pixel block" style={{
          fontSize: 9.5, letterSpacing: 1.6, color: theme.text,
          textShadow: '0 1px 0 rgba(255,255,255,0.85)',
        }}>
          {label.toUpperCase()}
        </span>
        <span className="block" style={{
          marginTop: 6, fontSize: 10, letterSpacing: 0.2,
          color: theme.dark, opacity: 0.72,
        }}>
          {caption}
        </span>
      </span>

      {selected ? (
        <span className="font-pixel relative flex-shrink-0" style={{
          fontSize: 6, letterSpacing: 1.4, color: '#FFFFFF',
          background: theme.main,
          border: `1.5px solid ${theme.dark}`,
          borderRadius: 3,
          padding: '4px 5px',
          transform: 'rotate(-7deg)',
          boxShadow: `2px 2px 0 ${theme.dark}`,
          animation: 'mgStamp 260ms cubic-bezier(0.34,1.9,0.64,1) both',
        }}>
          LOGGED
        </span>
      ) : (
        <span aria-hidden className="relative flex-shrink-0" style={{ opacity: 0.9, marginRight: 3 }}>
          <IconChevronRight size={15} tone={theme.dark} />
        </span>
      )}
    </button>
  )
}
