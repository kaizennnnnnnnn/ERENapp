'use client'

// The bedroom's bottom action button — a dreamy, two-mood slab:
//  • TUCK IN  → a night-indigo bar with a glowing crescent-moon medallion and
//               "Zzz"s drifting up, for putting Eren to bed.
//  • WAKE UP  → a warm dawn bar with a rising-sun medallion and morning
//               sparkles, for waking him.
// Gold rivets, a glossy top highlight, and a hard drop shadow give it the same
// "premium card" cue as the reward road / HUD surfaces and the chemistry
// room's periodic-table button.
//
// Press / hover / shadow + the bob, Zzz, glow and twinkle keyframes live in
// globals.css (`.sleep-btn`, `sleepBob`, `sleepZ`, `sleepGlow`, `sleepTwinkle`).
// They're there (not in styled-jsx) for the same SWC multi-shadow `:active`
// panic reason as the home dock. The hard drop-shadow colour is themed per
// mood through the inline `--sleep-ink` custom property.

type SleepState = 'tuck' | 'tucking' | 'wake' | 'waking'

interface Props {
  state: SleepState
  onClick: () => void
  disabled?: boolean
}

const PIXEL_FONT = '"Press Start 2P", monospace'

// Two moods, two palettes. INK is the border + hard pixel drop shadow and, for
// the moon, the crescent "bite" colour — so the cut-out always matches the
// medallion fill exactly.
const NIGHT = {
  hi: '#818CF8',
  mid: '#6366F1',
  lo: '#4338CA',
  ink: '#1E1B4B',
  text: '#F5F3FF',
  rivet: '#FCD34D',
}
const DAWN = {
  hi: '#FCD34D',
  mid: '#F59E0B',
  lo: '#D97706',
  ink: '#7C2D12',
  text: '#FFF7ED',
  rivet: '#FFF1C9',
}

// Gold rivets tucked into the four inner corners.
const RIVETS = [
  { left: 6, top: 6 },
  { right: 6, top: 6 },
  { left: 6, bottom: 6 },
  { right: 6, bottom: 6 },
]

const LABEL: Record<SleepState, string> = {
  tuck: 'TUCK IN',
  tucking: 'TUCKING IN...',
  wake: 'WAKE UP',
  waking: 'WAKING UP...',
}

export default function SleepButton({ state, onClick, disabled }: Props) {
  const isNight = state === 'tuck' || state === 'tucking'
  const p = isNight ? NIGHT : DAWN

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isNight ? 'Tuck Eren into bed' : 'Wake Eren up'}
      className="sleep-btn relative w-full max-w-xs"
      style={{
        '--sleep-ink': p.ink,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 16px',
        background: `linear-gradient(180deg, ${p.hi} 0%, ${p.mid} 52%, ${p.lo} 100%)`,
        border: `3px solid ${p.ink}`,
        borderRadius: 9,
        color: p.text,
      } as React.CSSProperties}
    >
      {/* Gold rivets — premium-card corner studs */}
      {RIVETS.map((pos, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            ...pos,
            width: 3,
            height: 3,
            background: p.rivet,
            boxShadow: `1px 1px 0 ${p.ink}`,
          }}
        />
      ))}

      {/* ── Medallion (left) ── */}
      {isNight ? <MoonMedallion /> : <SunMedallion />}

      {/* ── Label (center) ── */}
      <span
        style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: PIXEL_FONT,
          fontSize: 11,
          lineHeight: 1,
          letterSpacing: 1,
          whiteSpace: 'nowrap',
          textShadow: `0 2px 0 ${p.ink}`,
        }}
      >
        {LABEL[state]}
      </span>

      {/* ── Drifting motif (right) ── */}
      {isNight ? <ZzzRise /> : <MorningSparkles />}
    </button>
  )
}

// A round night badge: deep-indigo sky, a couple of gold star pixels, and a
// crescent moon built from a cream disc with an ink "bite" disc carving it.
// Because the bite uses the same colour as the badge fill, the crescent reads
// cleanly no matter what's behind the button. Soft halo pulses behind it.
function MoonMedallion() {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 34,
        height: 34,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 3,
          borderRadius: '50%',
          boxShadow: '0 0 8px 2px rgba(196,181,253,0.55)',
          animation: 'sleepGlow 3.2s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: '#1E1B4B',
          border: '2px solid #312E81',
          boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.18)',
          overflow: 'hidden',
          animation: 'sleepBob 3s ease-in-out infinite',
        }}
      >
        {/* tiny stars in the sky */}
        <span style={{ position: 'absolute', top: 5, right: 6, width: 2, height: 2, background: '#FDE68A' }} />
        <span style={{ position: 'absolute', top: 12, right: 4, width: 1.5, height: 1.5, background: '#FDE68A', opacity: 0.8 }} />
        {/* crescent: cream disc, then an ink bite disc offset up-right */}
        <span style={{ position: 'absolute', left: 7, top: 7, width: 15, height: 15, borderRadius: '50%', background: '#FDE9A8' }} />
        <span style={{ position: 'absolute', left: 11, top: 4, width: 14, height: 14, borderRadius: '50%', background: '#1E1B4B' }} />
      </span>
    </span>
  )
}

// A round dawn badge: a glowing sun core ringed by eight rays. Soft halo pulses
// behind it.
function SunMedallion() {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 34,
        height: 34,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 3,
          borderRadius: '50%',
          boxShadow: '0 0 9px 2px rgba(253,224,138,0.7)',
          animation: 'sleepGlow 3s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 38%, #FFF3C4, #FB923C)',
          border: '2px solid #B45309',
          boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'sleepBob 3s ease-in-out infinite',
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 2,
              height: 6,
              marginLeft: -1,
              background: '#FDE68A',
              transformOrigin: 'center',
              transform: `rotate(${i * 45}deg) translateY(-11px)`,
            }}
          />
        ))}
        <span
          style={{
            position: 'relative',
            width: 15,
            height: 15,
            borderRadius: '50%',
            background: '#FFEFA8',
            boxShadow: 'inset 0 -2px 2px rgba(214,120,30,0.5)',
          }}
        />
      </span>
    </span>
  )
}

// Three "Z"s on a diagonal trail, each rising off the bed and fading out on a
// stagger — the same bedtime cue as the floating Z's over the sleeping Eren.
const ZS = [
  { size: 8, left: 0, delay: '0s' },
  { size: 11, left: 9, delay: '0.55s' },
  { size: 14, left: 19, delay: '1.1s' },
]
function ZzzRise() {
  return (
    <span
      aria-hidden
      style={{ position: 'relative', flexShrink: 0, width: 32, height: 34, display: 'inline-block' }}
    >
      {ZS.map((z, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            bottom: 0,
            left: z.left,
            fontFamily: PIXEL_FONT,
            fontWeight: 'bold',
            fontSize: z.size,
            color: '#FDE68A',
            textShadow: '0 2px 0 #1E1B4B',
            animation: `sleepZ 2.4s ease-in-out ${z.delay} infinite`,
          }}
        >
          Z
        </span>
      ))}
    </span>
  )
}

// Three four-point sparkles twinkling on a stagger — "rise and shine".
const SPARKS = [
  { top: 3, left: 5, s: 9, delay: '0s' },
  { top: 14, left: 18, s: 7, delay: '0.7s' },
  { top: 22, left: 5, s: 6, delay: '1.3s' },
]
function MorningSparkles() {
  return (
    <span
      aria-hidden
      style={{ position: 'relative', flexShrink: 0, width: 32, height: 34, display: 'inline-block' }}
    >
      {SPARKS.map((sp, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: sp.top,
            left: sp.left,
            width: sp.s,
            height: sp.s,
            animation: `sleepTwinkle 2.2s ease-in-out ${sp.delay} infinite`,
          }}
        >
          <span style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)', background: '#FFF1C9', borderRadius: 1 }} />
          <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, transform: 'translateX(-50%)', background: '#FFF1C9', borderRadius: 1 }} />
        </span>
      ))}
    </span>
  )
}
