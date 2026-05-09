'use client'

// ═══════════════════════════════════════════════════════════════════════════
// AppFrame — thin black frame around the viewport, themed with the active
// accent color. Sits below the StatsHeader (z-30) so the header still
// closes the top edge, but visible on top of every page/scene below it.
// ═══════════════════════════════════════════════════════════════════════════
import { accentA } from './obsidian'

export default function AppFrame() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none"
      // z-50 → above scene host (z-40) and rewards page (z-40), below the
      // StatsHeader (z-60) so the header itself becomes the visual top edge.
      style={{ zIndex: 50 }}
    >
      {/* Top edge — sits behind the StatsHeader when it's visible; visible
          on subpages that hide it (profile, gacha, etc.). */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: 'linear-gradient(180deg, #0a0a0c 0%, rgba(10,10,12,0.9) 100%)',
        boxShadow: `inset 0 -1px 0 ${accentA(0.4)}`,
      }} />
      {/* Left edge */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 4,
        background: 'linear-gradient(90deg, #0a0a0c 0%, rgba(10,10,12,0.9) 100%)',
        boxShadow: `inset -1px 0 0 ${accentA(0.4)}`,
      }} />
      {/* Right edge */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, right: 0, width: 4,
        background: 'linear-gradient(90deg, rgba(10,10,12,0.9) 0%, #0a0a0c 100%)',
        boxShadow: `inset 1px 0 0 ${accentA(0.4)}`,
      }} />
      {/* Bottom edge — slightly thicker to feel like a console base. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 6,
        background: 'linear-gradient(180deg, rgba(10,10,12,0.9) 0%, #0a0a0c 100%)',
        boxShadow: `inset 0 1px 0 ${accentA(0.4)}`,
        paddingBottom: 'var(--safe-bottom)',
      }} />

      {/* Corner rivets (4) — pinned to the very edges. The top two get
          covered when the StatsHeader is up; visible on subpages. */}
      {[
        { top: 3, left: 3 },
        { top: 3, right: 3 },
        { bottom: 3, left: 3 },
        { bottom: 3, right: 3 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute',
          ...pos,
          width: 3, height: 3,
          background: `radial-gradient(circle at 30% 30%, var(--accent-hi), var(--accent) 60%, var(--accent-lo))`,
          boxShadow: `0 0 4px ${accentA(0.7)}`,
        }} />
      ))}
    </div>
  )
}
