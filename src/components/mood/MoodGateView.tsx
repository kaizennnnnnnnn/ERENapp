'use client'

// ═══════════════════════════════════════════════════════════════════════════
// MOOD GATE VIEW — the presentation half of the daily check-in. Pure: it
// takes state and a callback, owns no data. MoodGate.tsx keeps the Supabase
// write, the reaction pick and the timing.
//
// Composition, back to front:
//   sky (drifting clouds, sparkles, grain) → sun/moon disc → Eren →
//   speech bubble, straddling the top edge of → the mood-log plaque.
// The bubble overlapping the plaque is deliberate: it puts Eren on a plane
// in front of the card instead of stacking everything on one flat centre line.
// ═══════════════════════════════════════════════════════════════════════════

import { format } from 'date-fns'
import type { UserMood } from '@/types'
import { MOOD_CONFIGS } from '@/types'
import { MOOD_SKETCH, MOOD_THEME, MOOD_CAPTION } from '@/lib/moods'
import SketchEren, { type SketchErenState } from '@/components/SketchEren'
import MoodSky, { SkyDisc, useSkyPalette } from './MoodSky'
import MoodTile from './MoodTile'

const MOODS = Object.keys(MOOD_CONFIGS) as UserMood[]

const INK = '#3B0764'
const INK_SOFT = 'rgba(59,7,100,0.62)'
const PLAQUE_EDGE = '#4A2B6B'

// Paper fibre for the plaque — the same trick as the sky's grain, dialled
// down. Beats faking texture with another gradient.
const PAPER =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/></filter><rect width='120' height='120' filter='url(%23p)'/></svg>\")"

function GoldRivets() {
  const dot = (pos: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', width: 3, height: 3, background: '#FBBF24',
    boxShadow: '0 0 3px rgba(251,191,36,0.9)', ...pos,
  })
  return (
    <>
      <span aria-hidden style={dot({ top: 4, left: 4 })} />
      <span aria-hidden style={dot({ top: 4, right: 4 })} />
      <span aria-hidden style={dot({ bottom: 4, left: 4 })} />
      <span aria-hidden style={dot({ bottom: 4, right: 4 })} />
    </>
  )
}

/** Pixel sparkle used as a heading ornament — a shape, never a "✦" glyph. */
function Sparkle({ size = 9, delay = 0, color = '#F59E0B' }: {
  size?: number; delay?: number; color?: string
}) {
  return (
    <span aria-hidden style={{
      width: size, height: size, flexShrink: 0, background: color,
      clipPath: 'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)',
      filter: `drop-shadow(0 0 4px ${color}AA)`,
      animation: 'mgTwinkleSoft 2.4s ease-in-out infinite',
      animationDelay: `${delay}s`,
    }} />
  )
}

export interface MoodGateViewProps {
  userName: string
  greeting: string
  selected: UserMood | null
  /** Eren's pose + line once a mood is locked in. */
  reaction: { picked: SketchErenState; line: string } | null
  animating: boolean
  onSelect: (mood: UserMood) => void
}

export default function MoodGateView({
  userName, greeting, selected, reaction, animating, onSelect,
}: MoodGateViewProps) {
  const sky = useSkyPalette()
  const theme = selected ? MOOD_THEME[selected] : null

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        padding: 'calc(var(--safe-top, 0px) + 18px) 18px calc(var(--safe-bottom, 0px) + 18px)',
      }}>

      <MoodSky palette={sky} tint={animating && theme ? theme.glow : null} />

      {/* ── Eren, in front of the sun/moon ── */}
      <div className="relative flex flex-col items-center" style={{ zIndex: 3 }}>
        <SkyDisc palette={sky} />

        {/* Two nested wrappers on purpose: the idle float and the react
            scale-up both drive `transform`, and a running animation always
            beats an inline transform on the same element. */}
        <div style={{
          transform: animating ? 'scale(1.12)' : 'scale(1)',
          transition: 'transform 320ms cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <div style={{
            width: 118, height: 130,
            filter: 'drop-shadow(0 8px 10px rgba(46,12,74,0.4))',
            animation: 'mgFloat 3.4s ease-in-out infinite',
          }}>
            <SketchEren state={reaction ? reaction.picked : 'wave'} size={118} transparent noSpeech />
          </div>
        </div>

        {/* ── Speech bubble — dips over the plaque's top edge ── */}
        <div className="relative" style={{ marginTop: 2, zIndex: 4 }}>
          <div aria-hidden className="absolute left-1/2" style={{
            top: -9, marginLeft: -8, width: 0, height: 0,
            borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
            borderBottom: `10px solid ${PLAQUE_EDGE}`,
          }} />
          <div aria-hidden className="absolute left-1/2" style={{
            top: -6, marginLeft: -6, width: 0, height: 0,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderBottom: '8px solid #FFFFFF',
          }} />
          <div className="relative text-center" style={{
            padding: '9px 16px', minWidth: 208,
            background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF6FB 100%)',
            border: `2px solid ${PLAQUE_EDGE}`,
            borderRadius: 6,
            boxShadow: '3px 3px 0 rgba(45,10,70,0.45)',
          }}>
            <GoldRivets />
            {animating && reaction ? (
              <p style={{ fontSize: 12.5, fontWeight: 700, color: theme?.dark ?? INK }}>
                {reaction.line}
              </p>
            ) : (
              <p style={{ fontSize: 12.5, color: '#4A2B6B' }}>
                Good {greeting},{' '}
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                  {userName.split(' ')[0]}
                </span>!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── The mood log ── */}
      <div className="relative w-full" style={{
        maxWidth: 336, marginTop: -20, zIndex: 2,
        // Warm parchment against a cool sky — the split is what makes the
        // card read as an object sitting in front of the scene.
        background: 'linear-gradient(180deg, #FFFCF4 0%, #FDF4EC 55%, #F7E9EE 100%)',
        border: `2px solid ${PLAQUE_EDGE}`,
        borderRadius: 10,
        boxShadow: '5px 5px 0 rgba(45,10,70,0.38), 0 18px 34px rgba(30,6,52,0.3)',
        padding: '24px 12px 12px',
      }}>
        <span aria-hidden className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: PAPER, opacity: 0.05, mixBlendMode: 'multiply', borderRadius: 8,
        }} />
        <GoldRivets />

        {/* Logbook header — label left, today's date stamped right. */}
        <div className="flex items-end justify-between" style={{ marginBottom: 6 }}>
          <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.8, color: INK_SOFT }}>
            MOOD LOG
          </span>
          <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.4, color: INK_SOFT }}>
            {format(new Date(), 'EEE dd MMM').toUpperCase()}
          </span>
        </div>
        <div aria-hidden style={{
          height: 2, marginBottom: 14,
          background: `linear-gradient(90deg, ${PLAQUE_EDGE}55, ${PLAQUE_EDGE}22 60%, transparent)`,
        }} />

        <div className="flex items-center justify-center" style={{ gap: 9, marginBottom: 5 }}>
          <Sparkle size={12} color="#E8A317" />
          <h1 className="font-pixel text-center" style={{
            fontSize: 11, lineHeight: 1.65, letterSpacing: 1.4, color: INK,
            textShadow: '0 2px 0 rgba(255,255,255,0.95), 0 3px 0 rgba(91,33,182,0.16)',
          }}>
            HOW ARE<br />YOU FEELING?
          </h1>
          <Sparkle size={12} delay={0.9} color="#E8A317" />
        </div>
        <p className="text-center" style={{
          fontSize: 10.5, color: INK_SOFT, letterSpacing: 0.3, marginBottom: 14,
        }}>
          Pick your mood to enter
        </p>

        <div className="flex flex-col" style={{ gap: 9 }}>
          {MOODS.map((key, i) => (
            <MoodTile
              key={key}
              label={MOOD_CONFIGS[key].label}
              caption={MOOD_CAPTION[key]}
              sketch={MOOD_SKETCH[key]}
              theme={MOOD_THEME[key]}
              state={!selected ? 'idle' : selected === key ? 'selected' : 'dimmed'}
              index={i}
              onSelect={() => onSelect(key)}
            />
          ))}
        </div>

        <div className="flex items-center justify-center" style={{ gap: 8, marginTop: 13 }}>
          <span aria-hidden style={{ height: 2, width: 34, background: `linear-gradient(90deg, transparent, ${PLAQUE_EDGE}44)` }} />
          <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 2, color: INK_SOFT }}>
            ONCE A DAY
          </span>
          <span aria-hidden style={{ height: 2, width: 34, background: `linear-gradient(90deg, ${PLAQUE_EDGE}44, transparent)` }} />
        </div>
      </div>
    </div>
  )
}
