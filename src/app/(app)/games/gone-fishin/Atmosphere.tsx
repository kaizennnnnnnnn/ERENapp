'use client'

// ═══════════════════════════════════════════════════════════════════════════
// Atmosphere — the living underwater backdrop for GONE FISHIN'.
// Pure decoration (pointer-events:none): drifting god-rays, a caustic shimmer,
// and a column of rising bubbles. Positions are fixed (no Math.random) so
// server and client render identically — no hydration churn. `reduced`
// freezes everything for prefers-reduced-motion.
// ═══════════════════════════════════════════════════════════════════════════

// hand-placed so the bubbles feel scattered, not gridded
const BUBBLES = [
  { x: 8,  s: 5, d: 7.5, delay: 0,   drift: 10 },
  { x: 19, s: 8, d: 9.5, delay: 2.2, drift: -14 },
  { x: 31, s: 4, d: 6.5, delay: 4.1, drift: 8 },
  { x: 44, s: 6, d: 8.5, delay: 1.1, drift: -10 },
  { x: 57, s: 9, d: 10.5, delay: 3.4, drift: 16 },
  { x: 68, s: 5, d: 7.0, delay: 5.2, drift: -8 },
  { x: 79, s: 7, d: 9.0, delay: 0.7, drift: 12 },
  { x: 90, s: 4, d: 6.0, delay: 2.9, drift: -12 },
  { x: 14, s: 6, d: 8.0, delay: 6.0, drift: 9 },
  { x: 50, s: 5, d: 7.8, delay: 4.7, drift: -6 },
  { x: 84, s: 8, d: 10.0, delay: 1.8, drift: 14 },
]

const RAYS = [
  { left: '12%', w: 70,  rot: 14,  o: 0.06, d: 13 },
  { left: '38%', w: 110, rot: 10,  o: 0.05, d: 17, delay: 4 },
  { left: '64%', w: 60,  rot: 18,  o: 0.07, d: 11, delay: 2 },
  { left: '82%', w: 90,  rot: 8,   o: 0.04, d: 15, delay: 6 },
]

export default function Atmosphere({ reduced }: { reduced: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* god-rays from the surface */}
      {RAYS.map((r, i) => (
        <div key={`ray${i}`} style={{
          position: 'absolute', top: -40, left: r.left, width: r.w, height: '130%',
          background: `linear-gradient(180deg, rgba(186,230,253,${r.o}) 0%, rgba(186,230,253,0) 78%)`,
          transform: `rotate(${r.rot}deg)`, transformOrigin: 'top center',
          animation: reduced ? undefined : `gfRay ${r.d}s ease-in-out ${r.delay ?? 0}s infinite`,
          filter: 'blur(2px)',
        }} />
      ))}

      {/* caustic shimmer bands */}
      <div className="absolute inset-0" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 22px, rgba(186,230,253,0.05) 22px, rgba(186,230,253,0.05) 24px)',
        animation: reduced ? undefined : 'gfCaustic 9s linear infinite',
      }} />

      {/* deep floor vignette */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: '34%', background: 'linear-gradient(180deg, rgba(2,12,22,0) 0%, rgba(2,12,22,0.55) 100%)' }} />

      {/* rising bubbles */}
      {BUBBLES.map((b, i) => (
        <div key={`bub${i}`} style={{
          position: 'absolute', left: `${b.x}%`, bottom: -12, width: b.s, height: b.s, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75), rgba(186,230,253,0.18) 70%, rgba(186,230,253,0) 100%)',
          border: '1px solid rgba(224,242,254,0.35)',
          // CSS var feeds horizontal drift into the keyframe
          ['--drift' as string]: `${b.drift}px`,
          animation: reduced ? undefined : `gfBubble ${b.d}s ease-in ${b.delay}s infinite`,
          opacity: reduced ? 0.4 : 0,
        }} />
      ))}
    </div>
  )
}
