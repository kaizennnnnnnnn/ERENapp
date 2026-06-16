'use client'

// The bath room's "SQUEAKY CLEAN!" finish chip — the wash counterpart to the
// vet's result banner. A minty success slab that springs in with a glossy soap-
// bubble medallion (bobbing over a soft glow), a few bubbles drifting up the
// right edge, and celebratory sparkle twinkles — the "ting!" of a freshly
// washed cat. Mint-green bridges the success-green to the bathroom's cyan; the
// bubbles tie it back to the tub.
//
// The cleanPop / bubbleRise keyframes live in globals.css; the medallion reuses
// the shared sleepBob / sleepGlow / sleepTwinkle motion primitives.

const PIXEL_FONT = '"Press Start 2P", monospace'

const GREEN = { hi: '#5FE0A0', mid: '#38C77C', lo: '#25A862', ink: '#157A42', shadow: '#0C5E33', text: '#ECFFF4' }

export default function SqueakyCleanBanner() {
  return (
    <div
      className="relative w-full max-w-xs pointer-events-auto"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '10px 14px',
        background: `linear-gradient(180deg, ${GREEN.hi} 0%, ${GREEN.mid} 55%, ${GREEN.lo} 100%)`,
        border: `2px solid ${GREEN.ink}`,
        borderRadius: 9,
        boxShadow: `0 4px 0 ${GREEN.shadow}, 0 7px 12px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.45)`,
        color: GREEN.text,
        animation: 'cleanPop 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      {/* Celebratory corner twinkles */}
      <Twinkle style={{ top: -3, left: 12, animationDelay: '0s' }} />
      <Twinkle style={{ top: -3, right: 14, animationDelay: '0.6s' }} />

      <BubbleBadge />

      <span
        style={{
          fontFamily: PIXEL_FONT,
          fontSize: 9,
          letterSpacing: 1,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          textShadow: `0 2px 0 ${GREEN.shadow}`,
        }}
      >
        SQUEAKY CLEAN!
      </span>

      <RisingBubbles />
    </div>
  )
}

// White-cyan disc cradling a glossy soap bubble, bobbing over a soft halo.
function BubbleBadge() {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 26,
        height: 26,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 1,
          borderRadius: '50%',
          boxShadow: '0 0 8px 2px rgba(170,225,250,0.7)',
          animation: 'sleepGlow 3s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 35%, #FFFFFF, #DDF4FF)',
          border: `2px solid ${GREEN.lo}`,
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'sleepBob 3s ease-in-out infinite',
        }}
      >
        {/* glossy soap bubble with a bright catch-light */}
        <span
          style={{
            position: 'relative',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #CFEFFF 55%, #A9E0FA 100%)',
            border: '1.5px solid rgba(120,200,240,0.85)',
            boxShadow: 'inset 0 -2px 2px rgba(120,190,230,0.35)',
          }}
        >
          <span style={{ position: 'absolute', top: 2.5, left: 3, width: 3.5, height: 3.5, borderRadius: '50%', background: 'rgba(255,255,255,0.95)' }} />
        </span>
      </span>
    </span>
  )
}

// A few soap bubbles drifting up and popping out, staggered.
const BUBBLES = [
  { size: 6, left: 2, delay: '0s' },
  { size: 4, left: 9, delay: '0.7s' },
  { size: 5, left: 15, delay: '1.3s' },
]
function RisingBubbles() {
  return (
    <span aria-hidden style={{ position: 'relative', flexShrink: 0, width: 22, height: 26 }}>
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            bottom: 0,
            left: b.left,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95), rgba(200,238,255,0.5) 60%, rgba(160,220,250,0.2) 100%)',
            border: '1px solid rgba(255,255,255,0.7)',
            animation: `bubbleRise 2.2s ease-in-out ${b.delay} infinite`,
          }}
        />
      ))}
    </span>
  )
}

// A small four-point twinkle (reusing the shared sparkle motion).
function Twinkle({ style }: { style: React.CSSProperties }) {
  const arm: React.CSSProperties = { position: 'absolute', background: '#EAFBFF', borderRadius: 0.5 }
  return (
    <span
      aria-hidden
      style={{ position: 'absolute', width: 7, height: 7, animation: 'sleepTwinkle 1.8s ease-in-out infinite', ...style }}
    >
      <span style={{ ...arm, top: '50%', left: 0, right: 0, height: 1.5, transform: 'translateY(-50%)' }} />
      <span style={{ ...arm, left: '50%', top: 0, bottom: 0, width: 1.5, transform: 'translateX(-50%)' }} />
    </span>
  )
}
