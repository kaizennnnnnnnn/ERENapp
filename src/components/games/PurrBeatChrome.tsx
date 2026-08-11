'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PURR BEAT — the non-canvas furniture: the dark game panel, its stat blocks,
// and Eren at the decks.
//
// Split out of the page so the 60fps half and the once-a-run half are not the
// same 700-line file, and so the panels can be rendered somewhere that isn't
// behind the app's auth gate.
// ═══════════════════════════════════════════════════════════════════════════

/** The project's dark game-panel: purple gradient, CRT scanlines, gold corner
 *  rivets, hard shadow. Shared by the idle and results screens so they read as
 *  the same object rather than two dialogs that happen to be purple. */
export function Panel({ children, animate }: { children: React.ReactNode; animate?: boolean }) {
  return (
    <div className="relative px-6 py-5 flex flex-col items-center gap-3" style={{
      background: 'linear-gradient(180deg, #34105C 0%, #1C0636 100%)',
      border: '3px solid #C026D3',
      borderRadius: 6,
      boxShadow: '0 6px 0 #701A75, 0 0 34px rgba(192,38,211,0.5)',
      maxWidth: 340,
      animation: animate ? 'pbPop 0.42s cubic-bezier(0.34,1.56,0.64,1) both' : undefined,
    }}>
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)',
        borderRadius: 3,
      }} />
      {[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map(([v, h]) => (
        <div key={`${v}${h}`} aria-hidden className="absolute" style={{
          [v]: 4, [h]: 4, width: 3, height: 3, background: '#FDE047', opacity: 0.85,
        } as React.CSSProperties} />
      ))}
      <div className="relative flex flex-col items-center gap-3">{children}</div>
    </div>
  )
}

export function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-pixel" style={{ fontSize: 6, color: '#F0ABFC', letterSpacing: 1 }}>{label}</span>
      <span className="font-pixel" style={{ fontSize: 20, color, marginTop: 4 }}>{value}</span>
    </div>
  )
}

export function Divider() {
  return <div style={{ width: 1, height: 28, background: '#5B2178' }} />
}

/** A 24x24 pixel Eren in DJ headphones. He bops with the kick — the game
 *  writes that transform onto a wrapper imperatively rather than re-rendering
 *  this SVG sixty times a second — grins wider on a multiplier, and frets when
 *  he is down to his last heart. */
export function ErenDJ({ size, hyped, worried }: { size: number; hyped?: boolean; worried?: boolean }) {
  const eyeH = worried ? 3 : hyped ? 2 : 3
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" shapeRendering="crispEdges" style={{ imageRendering: 'pixelated' }}>
      {/* headphone band */}
      <rect x="5" y="2" width="14" height="2" fill="#22D3EE" />
      <rect x="4" y="3" width="2" height="2" fill="#22D3EE" />
      <rect x="18" y="3" width="2" height="2" fill="#22D3EE" />
      {/* ears */}
      <rect x="5" y="4" width="4" height="4" fill="#4A2E1A" />
      <rect x="15" y="4" width="4" height="4" fill="#4A2E1A" />
      <rect x="6" y="5" width="2" height="2" fill="#F472B6" />
      <rect x="16" y="5" width="2" height="2" fill="#F472B6" />
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
      <rect x="8" y="11" width="2" height={eyeH} fill="#1F2937" />
      <rect x="14" y="11" width="2" height={eyeH} fill="#1F2937" />
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
