'use client'

// ═══════════════════════════════════════════════════════════════════════════
// CAN AURA — the idle sparkle halo around a SPECIAL EDITION can (Gold,
// Rainbow), in the shop grid and on the fridge shelf.
//
// Hand-placed, not random: the sparkles hug the can's silhouette — up the
// sides, clustered over the shoulder — so the halo reads as composed rather
// than as confetti dropped on a card. Positions are percentages of the box,
// so one table serves the 62px shop plate and the 48px fridge tile alike.
//
// Deliberately cheap. The gacha cinematics' header comments record what this
// project already learned the hard way: per-particle blur / mix-blend-mode /
// box-shadow-spread re-rasterizes every frame and janks on mid-range phones.
// These are flat crisp-edged squares moving on transform + opacity only.
// ═══════════════════════════════════════════════════════════════════════════

export type CanVariant = 'gold' | 'rainbow'

const HUES: Record<CanVariant, string[]> = {
  gold:    ['#FFF6D2', '#F5C842', '#FFE878', '#D4A818'],
  rainbow: ['#FF4D6D', '#FFE23D', '#4BE07A', '#35C7F5', '#A65CF6'],
}

/** x/y are % of the box; s is px at a 64px reference box; d is the delay beat. */
const MOTES = [
  { x: 12, y: 16, s: 5, d: 0.0 },
  { x: 86, y: 24, s: 4, d: 0.7 },
  { x: 6,  y: 52, s: 3, d: 1.4 },
  { x: 92, y: 60, s: 5, d: 0.35 },
  { x: 22, y: 84, s: 4, d: 1.05 },
  { x: 78, y: 88, s: 3, d: 1.75 },
  { x: 50, y: 4,  s: 6, d: 2.1 },
]

export default function CanAura({ variant, box = 64 }: {
  variant: CanVariant
  /** Size of the square the can sits in, in px — scales the mote sizes. */
  box?: number
}) {
  const hues = HUES[variant]
  const scale = box / 64

  return (
    <span aria-hidden className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="can-aura-mote"
          style={{
            position: 'absolute',
            left: `${m.x}%`, top: `${m.y}%`,
            width: Math.max(2, Math.round(m.s * scale)),
            height: Math.max(2, Math.round(m.s * scale)),
            marginLeft: -Math.round(m.s * scale / 2),
            marginTop: -Math.round(m.s * scale / 2),
            background: hues[i % hues.length],
            // 4-point star, the same shape the mood gate and the onboarding
            // sky use — a shape, never a "✦" glyph.
            clipPath: 'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)',
            animationDelay: `-${m.d}s`,
          }}
        />
      ))}

      <style jsx>{`
        .can-aura-mote {
          opacity: 0;
          animation: canAuraTwinkle 2.6s ease-in-out infinite;
          will-change: transform, opacity;
        }
        @keyframes canAuraTwinkle {
          0%, 100% { opacity: 0;    transform: scale(0.4) translateY(2px); }
          18%      { opacity: 0.95; transform: scale(1)   translateY(0); }
          46%      { opacity: 0.55; transform: scale(0.8) translateY(-3px); }
          70%      { opacity: 0;    transform: scale(0.4) translateY(-6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .can-aura-mote { animation: none; opacity: 0.7; transform: none; }
        }
      `}</style>
    </span>
  )
}
