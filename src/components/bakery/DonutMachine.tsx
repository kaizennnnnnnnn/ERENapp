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
const DOME_DONUTS = ['donut', 'donut_matcha', 'donut_ube']
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
          <clipPath id="dmGlobe"><circle cx="24" cy="18" r="14" /></clipPath>
          <clipPath id="dmChute"><rect x="21" y="49" width="15" height="8" /></clipPath>
        </defs>

        {/* Contact shadow — a hard slab, no blur, so it reads as pixel art
            standing on the counter rather than a CSS drop shadow. */}
        <rect x="7" y="61" width="34" height="3" fill="#3A1B08" opacity="0.42" />
        <rect x="5" y="59" width="38" height="3" fill="#6B3218" />
        <rect x="5" y="59" width="38" height="1" fill="#8A4520" />

        {/* ── Globe ── crispEdges turns the circle into a hard pixel disc, so
            one element gives the stepped silhouette a stack of rects would. */}
        {/* 0.72, not 0.5: at 0.5 the painted stand mixer behind the counter read
            straight through the globe and the machine looked like a decal. */}
        <circle cx="24" cy="18" r="14" fill="#CDE9EE" opacity="0.72" />
        <g clipPath="url(#dmGlobe)">
          {DOME_DONUTS.map((d, i) => (
            <image key={d.id} href={foodArt(d.id)}
              x={[13, 23, 18][i]} y={[8, 12, 19][i]} width="12" height="12"
              preserveAspectRatio="xMidYMid meet" />
          ))}
          {/* Glass over the donuts: a bright sweep top-left, shade bottom-right. */}
          <rect x="13" y="7"  width="3"  height="9"  fill="#FFFFFF" opacity="0.5" />
          <rect x="17" y="6"  width="2"  height="4"  fill="#FFFFFF" opacity="0.4" />
          <rect x="10" y="24" width="28" height="8"  fill="#5E93A0" opacity="0.22" />
        </g>
        {/* Rim, drawn last so the glass has a defined edge against the wall. */}
        <circle cx="24" cy="18" r="14" fill="none" stroke="#8FBEC6" strokeWidth="1" opacity="0.9" />

        {/* ── Collar ── brass ring. Overlaps the globe's bottom arc, which is
            what makes the globe read as SEATED in the machine, not floating. */}
        <rect x="8"  y="29" width="32" height="5" fill="#E0A73C" />
        <rect x="8"  y="29" width="32" height="1" fill="#FBD98A" />
        <rect x="8"  y="33" width="32" height="1" fill="#96682A" />

        {/* ── Body ── bakery-pink cabinet */}
        <rect x="7"  y="34" width="34" height="26" fill="#D45C86" />
        <rect x="7"  y="34" width="34" height="1"  fill="#F191B2" />
        <rect x="7"  y="34" width="2"  height="26" fill="#E87BA0" />
        <rect x="39" y="34" width="2"  height="26" fill="#9E3A5E" />

        {/* Faceplate decal. Small type on purpose — at the size this renders in
            the room the word is texture, and a big one swallowed the machine.
            The pink stripe under it echoes the shop's wainscot so the cabinet
            looks like it was bought for this room rather than dropped into it. */}
        <rect x="12" y="37" width="24" height="8" fill="#FCE9D6" />
        <rect x="12" y="37" width="24" height="1" fill="#FFFFFF" />
        <rect x="12" y="44" width="24" height="1" fill="#C39C7E" />
        <text x="24" y="42.9" textAnchor="middle" fill="#B4436E"
          style={{ font: '600 4px "Press Start 2P", monospace' }}>
          DONUT
        </text>
        <rect x="9"  y="46" width="30" height="1" fill="#F191B2" opacity="0.6" />

        {/* Crank left, delivery chute right. The chute gets a lip and a shadow
            so it reads as an opening you'd reach into, not a painted rectangle. */}
        <circle cx="13" cy="52" r="4" fill="#96682A" />
        <circle cx="13" cy="52" r="4" fill="none" stroke="#FBD98A" strokeWidth="1" />
        <rect x="12" y="49" width="2" height="4" fill="#FBD98A" />
        <rect x="11" y="51" width="4" height="2" fill="#E0A73C" />
        <rect x="20" y="48" width="17" height="10" fill="#7C2B47" />
        <rect x="21" y="49" width="15" height="8"  fill="#2A1119" />
        <rect x="21" y="49" width="15" height="2"  fill="#150810" />
        <rect x="20" y="57" width="17" height="1"  fill="#E87BA0" />

        {/* A donut waiting in the chute — the machine is loaded, and you can
            see it is. Kept dark-edged so it doesn't fight the globe for
            attention at the size this renders. */}
        <g clipPath="url(#dmChute)">
          <image href={foodArt(DOME_DONUTS[0]?.id ?? 'donut')} x="24" y="49" width="9" height="9"
            preserveAspectRatio="xMidYMid meet" opacity="0.85" />
        </g>

        {/* Bulb on top — pulses so the machine looks powered on */}
        <rect x="22" y="1" width="4" height="3" fill="#F0B84A"
          style={{ animation: 'dmBulb 1.5s steps(1, end) infinite' }} />
        <rect x="23" y="0" width="2" height="1" fill="#FBD98A" />
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
