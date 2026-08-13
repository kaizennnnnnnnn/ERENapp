'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DONUT MACHINE — the capsule machine standing on the bakery counter.
// ──────────────────────────────────────────────────────────────────────────
// Drawn rather than photographed: it has to sit inside a painted room without
// reading as a sticker, so it's built from the same vocabulary the rest of the
// app's HUDs use — hard 1px outlines, no blur, flat shading, and the bakery's
// own wood/pink palette. The glass dome shows three real donut plates so it is
// visibly full of the thing it dispenses.
//
// It bobs, its bulb pulses, and when a free spin is up it wears a FREE tag.
// That tag is the only thing on this page that moves without being asked, which
// is deliberate — it's what makes you walk over and tap it.
// ═══════════════════════════════════════════════════════════════════════════

import { foodArt } from '@/lib/foodMeta'
import { MACHINE_DONUTS } from '@/lib/donuts'

// Three fixed donuts behind the glass. Fixed, not random: the machine is
// furniture, and furniture that reshuffles itself every render is a distraction.
const DOME_DONUTS = ['donut', 'donut_matcha', 'donut_ube', 'donut_caramel']
  .map(id => MACHINE_DONUTS.find(d => d.id === id))
  .filter((d): d is NonNullable<typeof d> => Boolean(d))

interface Props {
  /** Free spin is available — the machine says so. */
  free: boolean
  /** Dimmed + unclickable while a spin is resolving. */
  busy: boolean
  onTap: () => void
}

export default function DonutMachine({ free, busy, onTap }: Props) {
  return (
    <button
      onClick={onTap}
      disabled={busy}
      aria-label={free ? 'Donut machine — free spin ready' : 'Donut machine'}
      className="relative block active:translate-y-[1px] transition-transform"
      style={{
        width: '100%', height: '100%', padding: 0, border: 'none',
        background: 'transparent', cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.55 : 1,
        animation: 'dmBob 3.2s ease-in-out infinite',
        WebkitTapHighlightColor: 'transparent',
      }}>

      <svg viewBox="0 0 48 64" width="100%" height="100%" shapeRendering="crispEdges"
        style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          {/* Everything in the globe is clipped to the globe, so a donut can
              never hang over the glass edge the way a plain stack would. */}
          <clipPath id="dmGlobe"><circle cx="24" cy="17" r="14" /></clipPath>
          <clipPath id="dmChute"><rect x="18" y="49" width="14" height="7" /></clipPath>
        </defs>

        {/* ── Plinth ── the machine used to sit straight on the counter with
            nothing but a shadow, which read as a sticker. A base wider than the
            cabinet gives it a footprint and a weight. */}
        <rect x="6" y="62" width="36" height="2" fill="#2E1404" opacity="0.4" />
        <rect x="5"  y="58" width="38" height="5" fill="#5E3616" />
        <rect x="5"  y="58" width="38" height="1" fill="#8A5228" />
        <rect x="5"  y="62" width="38" height="1" fill="#3A1F0A" />

        {/* ── Globe ── crispEdges turns the circle into a hard pixel disc, so
            one element gives the stepped silhouette a stack of rects would. */}
        {/* 0.82, not 0.5: at 0.5 the painted stand mixer behind the counter read
            straight through the globe and the machine looked like a decal. */}
        <circle cx="24" cy="17" r="14" fill="#DCF2F5" opacity="0.82" />
        <g clipPath="url(#dmGlobe)">
          {/* Warm light pooling in the bottom of the glass — the case is lit. */}
          <circle cx="24" cy="22" r="11" fill="#FFD9A8" opacity="0.4" />
          {DOME_DONUTS.map((d, i) => (
            <image key={d.id} href={foodArt(d.id)}
              /* Every donut's CENTRE stays within ~9 of the globe's, so none of
                 them gets sliced by the rim and looks like it's falling out. */
              x={[12, 21, 15, 25][i]} y={[6, 9, 15, 14][i]} width="12" height="12"
              preserveAspectRatio="xMidYMid meet" />
          ))}
          {/* Glass over the donuts: a bright specular sweep top-left, a soft
              shade bottom-right, and a bounce along the very bottom. */}
          <rect x="12" y="6"  width="3"  height="10" fill="#FFFFFF" opacity="0.62" />
          <rect x="16" y="4"  width="2"  height="5"  fill="#FFFFFF" opacity="0.5" />
          <rect x="10" y="25" width="28" height="7"  fill="#4E8492" opacity="0.2" />
          <rect x="14" y="28" width="20" height="2"  fill="#FFFFFF" opacity="0.22" />
        </g>
        {/* Rim, drawn last so the glass has a defined edge against the wall. */}
        <circle cx="24" cy="17" r="14" fill="none" stroke="#7FB2BC" strokeWidth="1" opacity="0.95" />

        {/* ── Collar ── brass ring. Overlaps the globe's bottom arc, which is
            what makes the globe read as SEATED in the machine, not floating.
            Four bands instead of three so the brass has a real round. */}
        <rect x="7"  y="28" width="34" height="6" fill="#D19A33" />
        <rect x="7"  y="28" width="34" height="1" fill="#FFE9A8" />
        <rect x="7"  y="29" width="34" height="1" fill="#F0C25E" />
        <rect x="7"  y="33" width="34" height="1" fill="#8A5D20" />
        {/* Rivets — the app's tell for a premium surface, at machine scale. */}
        <rect x="9"  y="30" width="1" height="2" fill="#FFF0C0" />
        <rect x="38" y="30" width="1" height="2" fill="#FFF0C0" />

        {/* ── Body ── bakery-pink cabinet, lit from the left. Four vertical
            bands do the round: highlight, face, shade, dark edge. */}
        <rect x="7"  y="34" width="34" height="24" fill="#C94E79" />
        <rect x="7"  y="34" width="4"  height="24" fill="#E87BA0" />
        <rect x="11" y="34" width="3"  height="24" fill="#D8628C" />
        <rect x="36" y="34" width="3"  height="24" fill="#A63C63" />
        <rect x="39" y="34" width="2"  height="24" fill="#812C4B" />
        <rect x="7"  y="34" width="34" height="1"  fill="#F7A3C0" />

        {/* Faceplate. Small type on purpose — at the size this renders in the
            room the word is texture, and a big one swallowed the machine. Now
            it's a brass-framed plate rather than a bare white sticker, which is
            what made the cabinet read as printed paper. */}
        <rect x="11" y="36" width="26" height="9" fill="#8A5D20" />
        <rect x="12" y="37" width="24" height="7" fill="#FFF6E4" />
        <rect x="12" y="37" width="24" height="1" fill="#FFFFFF" />
        <rect x="12" y="43" width="24" height="1" fill="#C9A582" />
        <text x="24" y="42.4" textAnchor="middle" fill="#B4436E"
          style={{ font: '600 4px "Press Start 2P", monospace' }}>
          DONUT
        </text>

        {/* Coin slot — a brass plate with an upright mouth, parked in the one
            column nothing else wants. The one detail that says "this thing
            takes money" without a word of copy. */}
        <rect x="34" y="46" width="6" height="8" fill="#8A5D20" />
        <rect x="35" y="47" width="4" height="6" fill="#D19A33" />
        <rect x="36" y="48" width="2" height="4" fill="#2A1119" />

        {/* Crank left — brass knob with a real handle stub, so it reads as a
            thing you turn rather than a bolt. */}
        <circle cx="12" cy="50" r="4" fill="#8A5D20" />
        <circle cx="12" cy="50" r="3" fill="#D19A33" />
        <rect x="11" y="47" width="2" height="4" fill="#FFE9A8" />
        <rect x="10" y="49" width="4" height="2" fill="#F0C25E" />
        <rect x="11" y="49" width="2" height="1" fill="#8A5D20" />

        {/* Delivery chute — a lip, a dark mouth, and a shadow inside it, so it
            reads as an opening you'd reach into rather than a painted square. */}
        <rect x="17" y="48" width="16" height="9" fill="#7C2B47" />
        <rect x="18" y="49" width="14" height="7" fill="#2A1119" />
        <rect x="18" y="49" width="14" height="2" fill="#150810" />
        <rect x="17" y="56" width="16" height="2" fill="#E87BA0" />
        <rect x="17" y="56" width="16" height="1" fill="#F7A3C0" />

        {/* A donut waiting in the chute — the machine is loaded, and you can
            see it is. Kept dark-edged so it doesn't fight the globe for
            attention at the size this renders. */}
        <g clipPath="url(#dmChute)">
          <image href={foodArt(DOME_DONUTS[0]?.id ?? 'donut')} x="21" y="48" width="9" height="9"
            preserveAspectRatio="xMidYMid meet" opacity="0.9" />
        </g>

        {/* Bulb on top — pulses so the machine looks powered on, on a little
            brass stem so it belongs to the machine. */}
        <rect x="23" y="3" width="2" height="2" fill="#8A5D20" />
        <rect x="22" y="0" width="4" height="3" fill="#F0B84A"
          style={{ animation: 'dmBulb 1.5s steps(1, end) infinite' }} />
        <rect x="23" y="0" width="2" height="1" fill="#FFF0C0" />
      </svg>

      {/* ── FREE tag ── the hook. Only drawn when there's actually one waiting,
          and it swings rather than fades so it reads at thumbnail size. */}
      {free && (
        <span className="font-pixel absolute"
          style={{
            top: '-6%', right: '-14%',
            padding: '3px 5px', fontSize: 6, letterSpacing: 1,
            color: '#3A1B02', background: '#FBBF24',
            border: '2px solid #7C2D12', borderRadius: 3,
            boxShadow: '2px 2px 0 rgba(60,26,4,0.45)',
            transformOrigin: 'top left',
            animation: 'dmTag 2.4s ease-in-out infinite',
          }}>
          FREE
        </span>
      )}

      <style jsx>{`
        @keyframes dmBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        @keyframes dmTag {
          0%, 62%, 100% { transform: rotate(-6deg); }
          70%           { transform: rotate(6deg); }
          78%           { transform: rotate(-4deg); }
          86%           { transform: rotate(3deg); }
        }
        /* steps(1) so the bulb blinks like a bulb instead of breathing. */
        @keyframes dmBulb {
          0%, 49%   { opacity: 1; }
          50%, 100% { opacity: 0.35; }
        }
        @media (prefers-reduced-motion: reduce) {
          button, span { animation: none !important; }
        }
      `}</style>
    </button>
  )
}
