'use client'

// ═══════════════════════════════════════════════════════════════════════════
// EREN EFFECT AURA — what a special donut leaves on him.
// ──────────────────────────────────────────────────────────────────────────
// Mounted inside ErenIdleLayer, which is the one wrapper every room already
// puts around Eren — so one edit there lights him up in the kitchen, the
// bedroom, the bathroom, the vet, the playroom, the bakery and on the home
// screen, with no per-room plumbing.
//
// All four effects are compositor-only (transform / opacity), because this runs
// for ten minutes straight on top of a room that is already animating.
// ═══════════════════════════════════════════════════════════════════════════

import { DONUT_EFFECTS, type DonutEffectId } from '@/lib/donutEffects'

interface Props {
  effect: DonutEffectId
}

/** Fixed, not random: this re-renders for ten minutes and must not reshuffle. */
const DRIPS = [
  { left: '22%', delay: '0s',   dur: '2.6s' },
  { left: '41%', delay: '0.8s', dur: '3.1s' },
  { left: '58%', delay: '1.5s', dur: '2.4s' },
  { left: '74%', delay: '0.4s', dur: '2.9s' },
]

const SPARKS = [
  { left: '12%', top: '30%', delay: '0s'   },
  { left: '84%', top: '24%', delay: '0.5s' },
  { left: '30%', top: '12%', delay: '1.1s' },
  { left: '70%', top: '58%', delay: '1.6s' },
  { left: '6%',  top: '62%', delay: '2.1s' },
  { left: '92%', top: '48%', delay: '0.9s' },
]

const CONFETTI = [
  { left: '10%', delay: '0s',   dur: '2.2s', color: '#E31E5A' },
  { left: '26%', delay: '0.6s', dur: '2.7s', color: '#F5C842' },
  { left: '44%', delay: '1.2s', dur: '2.0s', color: '#5BE81E' },
  { left: '60%', delay: '0.3s', dur: '2.5s', color: '#5BA3D9' },
  { left: '78%', delay: '1.6s', dur: '2.3s', color: '#B65CF0' },
  { left: '92%', delay: '0.9s', dur: '2.8s', color: '#FF8FB0' },
]

const SPEED_LINES = [
  { top: '38%', delay: '0s',   width: 26 },
  { top: '52%', delay: '0.2s', width: 34 },
  { top: '66%', delay: '0.1s', width: 22 },
]

export default function ErenEffectAura({ effect }: Props) {
  const def = DONUT_EFFECTS[effect]
  if (!def) return null
  const tone = def.tone

  return (
    <div className="absolute pointer-events-none" style={{ inset: '-18%', zIndex: 0 }} aria-hidden>

      {/* The wash behind him — every effect gets one, in its own colour, so
          even at a glance from across the room you can tell he's on something. */}
      <div className="eaWash" style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 50% 58%, ${tone}55 0%, ${tone}22 38%, transparent 68%)`,
      }} />

      {effect === 'glow' && DRIPS.map((d, i) => (
        <span key={i} className="eaDrip" style={{
          position: 'absolute', left: d.left, top: '46%',
          width: 3, height: 5, borderRadius: '0 0 2px 2px',
          background: tone, boxShadow: `0 0 5px ${tone}`,
          animationDelay: d.delay, animationDuration: d.dur,
        }} />
      ))}

      {effect === 'gilded' && SPARKS.map((s, i) => (
        <span key={i} className="eaSpark" style={{
          position: 'absolute', left: s.left, top: s.top,
          width: 4, height: 4, background: '#FFF0C0',
          boxShadow: `0 0 6px ${tone}`,
          transform: 'rotate(45deg)',
          animationDelay: s.delay,
        }} />
      ))}

      {effect === 'confetti' && CONFETTI.map((c, i) => (
        <span key={i} className="eaConfetti" style={{
          position: 'absolute', left: c.left, top: '14%',
          width: 4, height: 4, background: c.color,
          animationDelay: c.delay, animationDuration: c.dur,
        }} />
      ))}

      {effect === 'zoomies' && (
        <>
          {SPEED_LINES.map((l, i) => (
            <span key={`l${i}`} className="eaDashL" style={{
              position: 'absolute', left: 0, top: l.top,
              width: l.width, height: 2, background: tone,
              boxShadow: `0 0 4px ${tone}`, animationDelay: l.delay,
            }} />
          ))}
          {SPEED_LINES.map((l, i) => (
            <span key={`r${i}`} className="eaDashR" style={{
              position: 'absolute', right: 0, top: l.top,
              width: l.width, height: 2, background: tone,
              boxShadow: `0 0 4px ${tone}`, animationDelay: l.delay,
            }} />
          ))}
        </>
      )}

      <style jsx>{`
        .eaWash { animation: eaBreathe 2.4s ease-in-out infinite; }
        @keyframes eaBreathe {
          0%, 100% { opacity: 0.55; transform: scale(0.96); }
          50%      { opacity: 1;    transform: scale(1.04); }
        }
        /* Slime runs down and thins out. */
        .eaDrip { animation: eaDrip linear infinite; }
        @keyframes eaDrip {
          0%   { transform: translateY(0)    scaleY(0.6); opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translateY(46px) scaleY(1.5); opacity: 0; }
        }
        /* Gold winks rather than fades — a spark is on or it isn't. */
        .eaSpark { animation: eaSpark 1.8s steps(1, end) infinite; }
        @keyframes eaSpark {
          0%, 44%   { opacity: 0; transform: rotate(45deg) scale(0.4); }
          50%, 68%  { opacity: 1; transform: rotate(45deg) scale(1); }
          74%, 100% { opacity: 0; transform: rotate(45deg) scale(0.4); }
        }
        .eaConfetti { animation: eaFall linear infinite; }
        @keyframes eaFall {
          0%   { transform: translateY(-6px) rotate(0deg);   opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateY(74px) rotate(540deg); opacity: 0; }
        }
        /* Speed lines streak INWARD, so he reads as the thing that's moving. */
        .eaDashL { animation: eaDashL 0.55s ease-out infinite; }
        .eaDashR { animation: eaDashR 0.55s ease-out infinite; }
        @keyframes eaDashL {
          0%   { transform: translateX(-14px); opacity: 0; }
          40%  { opacity: 0.9; }
          100% { transform: translateX(16px);  opacity: 0; }
        }
        @keyframes eaDashR {
          0%   { transform: translateX(14px);  opacity: 0; }
          40%  { opacity: 0.9; }
          100% { transform: translateX(-16px); opacity: 0; }
        }
        /* The wash stays — it's the STATE, not the spectacle. The particles go. */
        @media (prefers-reduced-motion: reduce) {
          .eaWash { animation: none; opacity: 0.8; }
          .eaDrip, .eaSpark, .eaConfetti, .eaDashL, .eaDashR { display: none; }
        }
      `}</style>
    </div>
  )
}
