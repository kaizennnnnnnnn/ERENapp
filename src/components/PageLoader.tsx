'use client'

// ═══════════════════════════════════════════════════════════════════════════
// Single source of truth for "loading…" screens. Always renders the
// animated Eren sprite + pulsing accent dots over the obsidian background.
// Used by the home, profile, couple, rewards pages and the Leaderboard
// modal so no loading state is ever a static image/text.
// ═══════════════════════════════════════════════════════════════════════════
import AnimatedEren from './AnimatedEren'
import { PINK } from './obsidian'

interface Props {
  /** Optional pixel-font label shown under the sprite (e.g. "LOADING REWARDS"). */
  label?: string
  /** Render absolutely inside the parent instead of fixed-fullscreen. */
  inline?: boolean
}

export default function PageLoader({ label = 'LOADING', inline = false }: Props) {
  return (
    <div
      className={`${inline ? 'absolute' : 'fixed'} inset-0 z-40 flex flex-col items-center justify-center gap-5 select-none`}
      style={{ background: 'radial-gradient(ellipse at top, #1f0f18 0%, #0a0a0c 60%, #050507 100%)' }}
    >
      <AnimatedEren px={4} />

      <p className="font-pixel" style={{
        fontSize: 9, letterSpacing: 2,
        color: 'var(--accent-hi)',
        textShadow: `0 0 4px ${PINK}66`,
      }}>{label}</p>

      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display: 'block',
            width: 4, height: 4, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 4px var(--accent)',
            animation: `pageLoadDot 1s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}
