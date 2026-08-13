'use client'

// ═══════════════════════════════════════════════════════════════════════════
// CARE TOAST — the line that pops up after you do something to Eren.
// ──────────────────────────────────────────────────────────────────────────
// One component for all six rooms. They each had their own copy of the same
// markup, which meant they also each had the same bug:
//
//   absolute left-1/2 -translate-x-1/2 ... animate-float
//
// `animate-float` animates `transform`, and an animation REPLACES the property
// it animates for as long as it runs. So `-translate-x-1/2` was live for one
// frame and then gone, leaving the toast pinned with its LEFT EDGE at the
// centre of the screen — and since it was `whitespace-nowrap`, the longer half
// of every message ran off the right side where you could never read it.
//
// The fix is to stop centring with a transform at all: an `inset-x-0` flex row
// does it with no transform involved, which leaves the toast free to animate
// its own however it likes. It also means a long message can WRAP instead of
// running off, so nothing is ever unreadable again.
//
// Everything else here is making it look like part of the game rather than a
// debug banner: a plated surface with the room's own accent, framed by the
// app's pips, popping in and then breathing.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  /** The line to show. */
  msg: string
  /** false paints the alert palette — the action didn't take. */
  ok?: boolean
  /** The room's accent. Border, pips and glow take it. */
  tone?: string
  /** How far down the room it sits — each room has its own clear band. */
  top?: number | string
}

export default function CareToast({ msg, ok = true, tone = '#F5C842', top = 56 }: Props) {
  const accent = ok ? tone : '#F87171'

  return (
    <div className="absolute inset-x-0 z-50 flex justify-center px-4 pointer-events-none" style={{ top }}>
      <div className="ctPlate inline-flex items-center gap-2" style={{
        maxWidth: 288,
        padding: '9px 12px',
        background: ok
          ? 'linear-gradient(180deg, #2C2542 0%, #15111F 100%)'
          : 'linear-gradient(180deg, #5E1A1A 0%, #2C0A0A 100%)',
        border: `2px solid ${accent}`,
        borderRadius: 6,
        boxShadow: `3px 3px 0 rgba(0,0,0,0.45), 0 0 18px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.14)`,
      }}>
        {/* Pips either side — the same framing the bakery ticket and the spin
            title use, so a toast reads as one of the app's plates. */}
        <span className="flex-shrink-0" style={{
          width: 5, height: 5, background: accent,
          transform: 'rotate(45deg)', boxShadow: `0 0 6px ${accent}`,
        }} />
        <span className="font-pixel text-center" style={{
          fontSize: 7, lineHeight: 1.7, letterSpacing: 0.6,
          color: ok ? '#FFF7E6' : '#FFE0E0',
          textShadow: '0 1px 0 rgba(0,0,0,0.5)',
        }}>
          {msg}
        </span>
        <span className="flex-shrink-0" style={{
          width: 5, height: 5, background: accent,
          transform: 'rotate(45deg)', boxShadow: `0 0 6px ${accent}`,
        }} />
      </div>

      <style jsx>{`
        /* Two animations on transform, the second delayed past the first, so
           they hand over cleanly instead of fighting. Safe to do here — the
           centring is the flex row's job, not this element's. */
        .ctPlate {
          animation: ctIn 240ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
                     ctBob 2.8s ease-in-out 240ms infinite;
        }
        @keyframes ctIn {
          from { transform: translateY(-9px) scale(0.9); opacity: 0; }
          to   { transform: translateY(0)    scale(1);   opacity: 1; }
        }
        @keyframes ctBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ctPlate { animation: none; }
        }
      `}</style>
    </div>
  )
}
