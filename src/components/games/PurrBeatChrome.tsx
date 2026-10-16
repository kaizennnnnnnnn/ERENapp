'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PURR BEAT — Eren at the decks.
//
// Split out of the page so the 60fps half and the once-a-run half are not the
// same 700-line file. The start and results screens are the shared Meadow
// GameChrome kit now; this file keeps only the game's own sprite.
// ═══════════════════════════════════════════════════════════════════════════

/** A 24x24 pixel Eren in DJ headphones. He bops with the kick — the game
 *  writes that transform onto a wrapper imperatively rather than re-rendering
 *  this SVG sixty times a second — grins wider on a multiplier, and frets when
 *  he is down to his last heart. */
export function ErenDJ({ size, hyped, worried, blink, twitch, glance = 0 }:
  { size: number; hyped?: boolean; worried?: boolean; blink?: boolean; twitch?: boolean; glance?: number }) {
  const eyeH = worried ? 3 : hyped ? 2 : 3
  // A blink never eats the down-to-last-heart face — that one is information.
  const shut = !!blink && !worried
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* headphone band */}
      <rect x="5" y="2" width="14" height="2" fill="#22D3EE" />
      <rect x="4" y="3" width="2" height="2" fill="#22D3EE" />
      <rect x="18" y="3" width="2" height="2" fill="#22D3EE" />
      {/* ears */}
      <rect x="5" y="4" width="4" height="4" fill="#4A2E1A" />
      <rect x="6" y="5" width="2" height="2" fill="#F472B6" />
      <g transform={twitch ? 'translate(0,1)' : undefined}>
        <rect x="15" y="4" width="4" height="4" fill="#4A2E1A" />
        <rect x="16" y="5" width="2" height="2" fill="#F472B6" />
      </g>
      {/* ear cups */}
      <rect x="2" y="8" width="3" height="5" fill="#0E7490" />
      <rect x="19" y="8" width="3" height="5" fill="#0E7490" />
      <rect x="3" y="9" width="1" height="3" fill="#67E8F9" />
      <rect x="20" y="9" width="1" height="3" fill="#67E8F9" />
      {/* head */}
      <rect x="5" y="8" width="14" height="12" fill="#F9EDD5" />
      <rect x="5" y="8" width="14" height="2" fill="#FFFFFF" opacity="0.45" />
      <rect x="5" y="18" width="14" height="2" fill="#E8D4B0" />
      {/* eyes */}
      <g transform={glance && !shut ? `translate(${glance},0)` : undefined}>
        {shut
          ? <><rect x="8" y="12" width="2" height="1" fill="#1F2937" /><rect x="14" y="12" width="2" height="1" fill="#1F2937" /></>
          : <><rect x="8" y="11" width="2" height={eyeH} fill="#1F2937" /><rect x="14" y="11" width="2" height={eyeH} fill="#1F2937" /></>}
      </g>
      {hyped && <><rect x="8" y="10" width="2" height="1" fill="#FDE047" /><rect x="14" y="10" width="2" height="1" fill="#FDE047" /></>}
      {/* blush */}
      <rect x="6" y="14" width="2" height="2" fill="#F9A8D4" opacity={hyped ? 0.95 : 0.6} />
      <rect x="16" y="14" width="2" height="2" fill="#F9A8D4" opacity={hyped ? 0.95 : 0.6} />
      {/* nose + mouth */}
      <rect x="11" y="14" width="2" height="2" fill="#F472B6" />
      {worried
        ? <rect x="10" y="17" width="4" height="1" fill="#9A3412" />
        : <><rect x="9" y="16" width="2" height="1" fill="#9A3412" /><rect x="13" y="16" width="2" height="1" fill="#9A3412" /><rect x="10" y="17" width="4" height="1" fill="#9A3412" /></>}
    </svg>
  )
}
