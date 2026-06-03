'use client'

// ═════════════════════════════════════════════════════════════════════════════
// ErenPartyHat — Phase 3 PR 10
//
// Tiny SVG party-hat overlay that pops on top of Eren on calendar event days:
// Eren's birthday, the couple anniversary, or either partner's birthday.
// Compares today's MM-DD against each of those four fields.
// Pure presentational; the host (home/page.tsx) decides when to mount it.
// ═════════════════════════════════════════════════════════════════════════════

interface Props {
  /** Mode chooses the hat colour palette so the same kind of event reads the
   *  same way across sessions. */
  reason: 'eren_birthday' | 'couple_anniversary' | 'my_birthday' | 'partner_birthday'
  size?: number
}

const PALETTES: Record<Props['reason'], { hat: string, stripe: string, pom: string, brim: string }> = {
  eren_birthday:      { hat: '#FF6B9D', stripe: '#FFD0DC', pom: '#FFF5C8', brim: '#5A1A3A' },
  couple_anniversary: { hat: '#F5C842', stripe: '#FFF5C8', pom: '#FF6B9D', brim: '#5A3A00' },
  my_birthday:        { hat: '#A86040', stripe: '#FFE7A8', pom: '#F5C842', brim: '#3A1A10' },
  partner_birthday:   { hat: '#FF9DBE', stripe: '#FFFFFF', pom: '#F5C842', brim: '#5A1A3A' },
}

export default function ErenPartyHat({ reason, size = 64 }: Props) {
  const p = PALETTES[reason]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      style={{
        position: 'absolute',
        // Sits on top of Eren's sprite — overlay caller positions the wrapper.
        imageRendering: 'pixelated',
        pointerEvents: 'none',
        animation: 'partyHatBob 1.8s ease-in-out infinite',
      }}
    >
      {/* Pom-pom on top */}
      <rect x="7" y="0" width="2" height="2" fill={p.pom} />
      <rect x="6" y="1" width="1" height="1" fill={p.pom} />
      <rect x="9" y="1" width="1" height="1" fill={p.pom} />
      {/* Cone */}
      <rect x="7" y="2" width="2" height="1" fill={p.hat} />
      <rect x="6" y="3" width="4" height="1" fill={p.hat} />
      <rect x="6" y="4" width="4" height="1" fill={p.stripe} />
      <rect x="5" y="5" width="6" height="1" fill={p.hat} />
      <rect x="5" y="6" width="6" height="1" fill={p.hat} />
      <rect x="4" y="7" width="8" height="1" fill={p.stripe} />
      <rect x="4" y="8" width="8" height="1" fill={p.hat} />
      <rect x="3" y="9" width="10" height="1" fill={p.hat} />
      {/* Brim */}
      <rect x="2" y="10" width="12" height="1" fill={p.brim} />
      <rect x="2" y="11" width="12" height="1" fill={p.brim} />
      <style>{`
        @keyframes partyHatBob {
          0%, 100% { transform: translateY(0)    rotate(-3deg); }
          50%      { transform: translateY(-2px) rotate(3deg);  }
        }
      `}</style>
    </svg>
  )
}
