'use client'

// ─── SoundWord ──────────────────────────────────────────────────────────────
// Tiny pixel sound-effect word that pops near Eren during a reaction
// ("NOM NOM", "PURRR", "SPLASH!") and fades up-and-out. Same retro house style
// as the speech bubbles: Press Start 2P, hard unblurred shadow, a 2-step pop
// then a drift that vanishes in a 1% keyframe window (no smooth crossfade).
//
// Purely presentational. The caller mounts/keys it from a WordState and renders
// it while a reaction beat is active; the erenWordPop keyframe (globals.css)
// runs once and the parent drops it when the reaction ends.

interface Props {
  word: string
  color: string
  /** Anchor as % of the parent Eren wrapper. */
  left?: number
  top?: number
  /** Font size in px (Press Start 2P). */
  size?: number
  /** Stagger the pop (ms) — lets one phase fire several words in sequence. */
  delayMs?: number
}

export default function SoundWord({ word, color, left = 50, top = 0, size = 7, delayMs = 0 }: Props) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 25,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: size,
        lineHeight: 1,
        color,
        whiteSpace: 'nowrap',
        textShadow: '1px 1px 0 rgba(0,0,0,0.35)',
        animation: `erenWordPop 1.1s linear ${delayMs}ms both`,
        willChange: 'transform, opacity',
      }}
    >
      {word}
    </div>
  )
}
