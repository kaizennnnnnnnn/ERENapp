'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DONUT SPIN — the reel the machine plays before it tells you what you got.
// ──────────────────────────────────────────────────────────────────────────
// The winner is decided BEFORE the animation starts (rollDonut in the caller),
// which is the only honest way to build a reel: the strip is then laid out so
// the pre-decided donut happens to be the one under the marker when the motion
// stops. The alternative — letting the animation pick — means the result depends
// on frame timing.
//
// Layout: one long strip of cells, LOOPS full passes of the case followed by the
// winner. Travel is therefore always "every donut, several times, then yours",
// and the distance is known up front, so a single transform transition with a
// slot-machine easing does the whole thing. No rAF loop, no per-frame React.
//
// The strip is translated by a transition rather than a keyframe animation on
// purpose: a forwards-filling animation would override the inline transform and
// the reel would snap back the moment it finished.
//
// ── The landing ────────────────────────────────────────────────────────────
// Everything after the reel stops exists to answer "what did I actually win?",
// and it is staged so that ONE thing is lit at a time. The neighbours dim, a
// gold frame closes on the winning cell, and the plate underneath names the
// donut, what it does, and what he'll make of it. A reel that just stops with
// twelve donuts equally visible has told you nothing.
//
// Every colour cue on this screen — the backdrop wash, the rays, the frame's
// inner glow, the glow on the name — is the WON DONUT's own colour (see lift),
// so a mint win and a black-forest win don't look like the same screen with the
// words swapped.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { foodArt } from '@/lib/foodMeta'
import { MACHINE_DONUTS, type DonutDef } from '@/lib/donuts'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playSound } from '@/lib/sounds'
import { IconCoin, IconStar } from '@/components/PixelIcons'

const CELL = 84          // px per donut on the strip
const LOOPS = 4          // full passes of the case before the winner lands
const TAIL = 4           // cells kept beyond the winner so the window stays full
const SPIN_MS = 3400
const REEL_MAX = 340     // widest the reel window ever gets

/** Fast off the line, long glide, hard stop — a reel, not an ease-out. */
const REEL_EASE = 'cubic-bezier(0.08, 0.62, 0.12, 1)'

/** `#RRGGBB` + alpha. Every donut colour in the catalogue is a 7-char hex. */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/**
 * The donut's colour, raised to a brightness that can act as LIGHT.
 *
 * Swatches are sampled off the glaze, so the dark ones (Black Sesame #3A3A3A,
 * Black Forest #4A2C22) are nearly invisible as a glow — winning one of those
 * gave you a flat grey reveal while Matcha got a lit stage, which is exactly
 * backwards: every prize should feel like a prize.
 *
 * Scaling all three channels by the same factor raises value while holding hue
 * and saturation, so each donut keeps its own light — charcoal glows silver,
 * black forest glows warm brown. Blending toward gold instead would have made
 * every dark donut light the room identically.
 */
function lift(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const peak = Math.max(...rgb)
  if (peak >= 200 || peak === 0) return hex
  const k = 200 / peak
  return '#' + rgb.map(c => Math.round(c * k).toString(16).padStart(2, '0')).join('')
}

/**
 * Taste, as a badge on the prize rather than a sentence.
 *
 * Deliberately not TASTE_LINE: those are past-tense lines for the feeding toast
 * ("he ate it. reluctantly.") and you haven't fed him anything yet. Here the
 * taste is a property of the thing you now own.
 */
const TASTE_CHIP: Record<DonutDef['taste'], string | null> = {
  loves: 'HIS FAVOURITE',
  likes: null,           // the default — a chip saying "fine" is noise
  meh:   'NOT HIS THING',
}

interface Props {
  /** Already decided by the caller. The reel only has to arrive at it. */
  won: DonutDef
  /** True when this spin cost nothing, for the line under the title. */
  wasFree: boolean
  onClose: () => void
  /** Absent when the player can't afford / hasn't got another spin in them. */
  onSpinAgain?: () => void
  spinAgainCost: number | 'free'
}

export default function DonutSpin({ won, wasFree, onClose, onSpinAgain, spinAgainCost }: Props) {
  const reduced = useReducedMotion()
  // Someone who asked the OS for less motion still gets the donut, just not the
  // 3.4s reel — the result is the point, the tumble is the flourish.
  const [landed, setLanded] = useState(reduced)
  const [offset, setOffset] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)

  // The strip: LOOPS passes of the whole case, then the winner, then a short
  // TAIL. Each pass is shuffled independently so it reads as a tumble rather
  // than a repeating pattern — but every pass still contains every donut, which
  // is the point.
  //
  // The tail is not decoration: without it the winner is the last cell, so when
  // the reel stops the right half of the window is empty and the machine looks
  // like it ran out of donuts mid-spin.
  //
  // Built once, in a lazy initialiser, so a re-render can't reshuffle the strip
  // out from under a transition already running toward an index in it.
  const [strip] = useState<DonutDef[]>(() => {
    const shuffle = (arr: DonutDef[]) => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }
    const passes: DonutDef[] = []
    for (let i = 0; i < LOOPS; i++) passes.push(...shuffle(MACHINE_DONUTS))
    return [...passes, won, ...shuffle(MACHINE_DONUTS).slice(0, TAIL)]
  })
  const winnerIndex = strip.length - 1 - TAIL

  useEffect(() => {
    const vw = viewportRef.current?.clientWidth ?? 0
    // Centre the winner's cell under the marker.
    const target = winnerIndex * CELL - (vw / 2 - CELL / 2)

    // Reduced motion still has to ARRIVE at the winner — it just gets there in
    // one frame. Skipping this leaves the reel parked on cell 0, i.e. framing
    // and naming two different donuts.
    if (reduced) {
      setOffset(target)
      playSound('gacha_reveal_epic')
      return
    }

    // Two frames: one to paint the strip at offset 0, one to start the
    // transition. Setting both in the same frame means no transition at all.
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setOffset(target)))

    playSound('ui_modal_open')

    // Ticks on a decelerating schedule — the sound of the reel slowing down.
    // Spaced by the same easing the transform uses, so a tick lands roughly
    // when a cell crosses the marker.
    const ticks = [0.55, 0.68, 0.78, 0.85, 0.90, 0.94, 0.97, 0.99]
      .map(t => setTimeout(() => playSound('cm_tick'), SPIN_MS * t))

    const done = setTimeout(() => {
      setLanded(true)
      playSound('gacha_reveal_epic')
    }, SPIN_MS + 60)

    return () => {
      cancelAnimationFrame(raf)
      ticks.forEach(clearTimeout)
      clearTimeout(done)
    }
  }, [winnerIndex, reduced])

  const tasteChip = TASTE_CHIP[won.taste]
  const glow = lift(won.color)

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-4"
      style={{
        // Washed in the winner's own colour, so the room you're standing in
        // changes with the prize. Gradients don't interpolate, so this SNAPS
        // brighter on landing — which is what you want: it lands on the same
        // frame as the sheen, the frame pop and the chime, and reads as impact.
        background: `radial-gradient(125% 72% at 50% 42%, ${tint(glow, landed ? 0.3 : 0.12)} 0%, rgba(28,13,5,0.93) 52%, rgba(10,4,1,0.96) 100%)`,
      }}>

      {/* ── Title ── */}
      <p className="font-pixel mb-2.5 inline-flex items-center gap-1.5"
        style={{ fontSize: 9, color: '#FDE68A', letterSpacing: 2, textShadow: '0 2px 0 rgba(0,0,0,0.6)' }}>
        <IconStar size={10} />
        {landed ? 'YOU GOT' : 'SPINNING'}
        <IconStar size={10} />
      </p>

      <div className="relative flex justify-center" style={{ width: '100%', maxWidth: REEL_MAX }}>

        {/* ── Rays ── the fan behind the glass. Only once it has landed: during
            the spin the motion is the spectacle, and two moving things fight.
            Tinted, masked to a soft disc, and slow enough to read as light
            rather than as a spinning wheel. */}
        {landed && !reduced && (
          <div className="absolute pointer-events-none" aria-hidden style={{
            left: '50%', top: '50%', width: 460, height: 460, marginLeft: -230, marginTop: -230,
            // Fade-in and rotation are split across two elements: both want
            // `transform`, and one animation on a property beats the other.
            animation: 'dsRayIn 700ms ease-out both',
          }}>
            <div className="w-full h-full" style={{
              background: `repeating-conic-gradient(from 0deg, ${tint(glow, 0.15)} 0deg 5deg, transparent 5deg 16deg)`,
              WebkitMaskImage: 'radial-gradient(closest-side, #000 18%, transparent 76%)',
              maskImage: 'radial-gradient(closest-side, #000 18%, transparent 76%)',
              animation: 'dsRays 26s linear infinite',
            }} />
          </div>
        )}

        {/* ── Reel ── a window on the strip, with a marker at dead centre.
            Bronze outer edge with a gold hairline inside it (the inset ring):
            one border reads as a box, two read as a cabinet. */}
        <div className="relative w-full overflow-hidden"
          style={{
            height: CELL + 16,
            background: 'linear-gradient(180deg, #241004 0%, #4A2410 48%, #1F0D03 100%)',
            border: '3px solid #7C4A21', borderRadius: 7,
            boxShadow: `inset 0 0 0 1px rgba(251,191,36,0.7), inset 0 2px 0 rgba(255,255,255,0.1), 4px 4px 0 rgba(0,0,0,0.5), 0 0 22px ${tint(glow, landed ? 0.4 : 0.14)}`,
            transition: 'box-shadow 500ms ease-out',
          }}>

          {/* Spotlight under the centre cell — the donut sits IN light rather
              than on a flat panel. */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(circle at 50% 50%, ${tint(glow, landed ? 0.42 : 0.12)} 0%, transparent 62%)`,
            transition: 'background 450ms ease-out',
          }} />

          <div ref={viewportRef} className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 flex items-center"
              style={{
                height: '100%', left: 0,
                transform: `translate3d(${-offset}px, 0, 0)`,
                transition: reduced ? 'none' : `transform ${SPIN_MS}ms ${REEL_EASE}`,
                willChange: 'transform',
              }}>
              {strip.map((d, i) => (
                <div key={`${d.id}-${i}`} className="flex-shrink-0 flex items-center justify-center"
                  style={{ width: CELL, height: CELL }}>
                  <img src={foodArt(d.id)} alt="" width={CELL - 16} height={CELL - 16}
                    draggable={false}
                    style={{
                      objectFit: 'contain', display: 'block',
                      // The prize grows into its frame as it arrives.
                      transform: landed && i === winnerIndex ? 'scale(1.12)' : 'scale(1)',
                      transition: 'transform 420ms cubic-bezier(0.34,1.56,0.64,1)',
                    }} />
                </div>
              ))}
            </div>
          </div>

          {/* Scanlines over the glass — the same CRT treatment the app's other
              dark panels wear, so this reads as a screen and not a hole. */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)',
          }} />

          {/* Edge fades so donuts enter and leave rather than pop at the border. */}
          <div className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: 42, background: 'linear-gradient(90deg, #1F0D03, transparent)' }} />
          <div className="absolute inset-y-0 right-0 pointer-events-none" style={{ width: 42, background: 'linear-gradient(270deg, #1F0D03, transparent)' }} />

          {/* Losers dim. Two scrims rather than per-cell opacity: one hundred
              transitioning cells to darken the ninety-nine you didn't win is a
              lot of work to say "look here". */}
          {landed && (
            <>
              <div className="absolute inset-y-0 left-0 pointer-events-none" style={{
                width: `calc(50% - ${CELL / 2}px)`,
                background: 'linear-gradient(90deg, rgba(16,6,1,0.94) 0%, rgba(16,6,1,0.74) 100%)',
                animation: 'dsFade 380ms ease-out both',
              }} />
              <div className="absolute inset-y-0 right-0 pointer-events-none" style={{
                width: `calc(50% - ${CELL / 2}px)`,
                background: 'linear-gradient(270deg, rgba(16,6,1,0.94) 0%, rgba(16,6,1,0.74) 100%)',
                animation: 'dsFade 380ms ease-out both',
              }} />
            </>
          )}

          {/* The frame closing on the winner — the moment the reel stops being
              a strip of donuts and starts being one prize. */}
          {landed && (
            <div className="absolute pointer-events-none" style={{
              left: '50%', marginLeft: -(CELL / 2), top: 4, bottom: 4, width: CELL,
              border: '2px solid #FBBF24', borderRadius: 5,
              boxShadow: `0 0 14px rgba(251,191,36,0.5), inset 0 0 16px ${tint(glow, 0.4)}`,
              animation: 'dsFrame 340ms cubic-bezier(0.34,1.56,0.64,1) both',
            }} />
          )}

          {/* One sweep of light across the glass as it settles. */}
          {landed && !reduced && (
            <div className="absolute inset-y-0 pointer-events-none" style={{
              left: -110, width: 80,
              background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.3), transparent)',
              transform: 'skewX(-14deg)',
              animation: 'dsSheen 720ms ease-out 80ms both',
            }} />
          )}

          {/* Marker — chevrons biting in from top and bottom. They frame the
              winning cell instead of drawing a line down the middle of it.
              Once the gold frame closes they've done their job and would only
              be two spikes stuck through it, so they duck out of its way. */}
          <div className="absolute left-1/2 top-0 pointer-events-none" style={{
            marginLeft: -7, width: 0, height: 0,
            borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
            borderTop: '9px solid #FBBF24',
            opacity: landed ? 0.25 : 1, transition: 'opacity 300ms ease-out',
          }} />
          <div className="absolute left-1/2 bottom-0 pointer-events-none" style={{
            marginLeft: -7, width: 0, height: 0,
            borderLeft: '7px solid transparent', borderRight: '7px solid transparent',
            borderBottom: '9px solid #FBBF24',
            opacity: landed ? 0.25 : 1, transition: 'opacity 300ms ease-out',
          }} />

          {/* Gold rivets — the app's tell for a premium surface. */}
          {[0, 1, 2, 3].map(i => (
            <span key={i} className="absolute pointer-events-none" style={{
              width: 2, height: 2, background: '#FBBF24', opacity: 0.85,
              top: i < 2 ? 3 : undefined, bottom: i < 2 ? undefined : 3,
              left: i % 2 === 0 ? 3 : undefined, right: i % 2 === 0 ? undefined : 3,
            }} />
          ))}
        </div>
      </div>

      {/* ── Result ── only after the reel stops, so it can't spoil the landing.
          The height is reserved up front: the plate appearing must not shove
          the reel upward at the exact moment you're looking at it. */}
      <div className="w-full flex flex-col items-center" style={{ maxWidth: REEL_MAX, minHeight: 176 }}>
        {landed && (
          <div className="w-full flex flex-col items-center"
            style={{ animation: 'dsPop 420ms cubic-bezier(0.34,1.56,0.64,1) both' }}>

            {/* ── Prize plate ── */}
            <div className="relative w-full" style={{
              marginTop: 14, padding: '10px 12px 9px',
              background: 'linear-gradient(180deg, rgba(62,28,13,0.97) 0%, rgba(24,10,4,0.97) 100%)',
              border: '2px solid #B45309', borderRadius: 7,
              boxShadow: `4px 4px 0 rgba(0,0,0,0.5), 0 0 26px ${tint(glow, 0.26)}, inset 0 1px 0 rgba(255,255,255,0.1)`,
            }}>
              {[0, 1, 2, 3].map(i => (
                <span key={i} className="absolute" style={{
                  width: 2, height: 2, background: '#FBBF24', opacity: 0.8,
                  top: i < 2 ? 3 : undefined, bottom: i < 2 ? undefined : 3,
                  left: i % 2 === 0 ? 3 : undefined, right: i % 2 === 0 ? undefined : 3,
                }} />
              ))}

              <p className="font-pixel text-center"
                style={{ fontSize: 11, lineHeight: 1.35, color: '#FFF7E6', letterSpacing: 1, textShadow: `0 0 14px ${glow}, 0 2px 0 rgba(0,0,0,0.6)` }}>
                {won.name.toUpperCase()}
              </p>

              {/* Rule with a gold pip — the plate's spine. */}
              <div className="flex items-center justify-center gap-2 my-1.5">
                <span style={{ height: 1, width: 62, background: 'linear-gradient(90deg, transparent, #FBBF24)' }} />
                <span style={{ width: 4, height: 4, background: '#FBBF24', transform: 'rotate(45deg)' }} />
                <span style={{ height: 1, width: 62, background: 'linear-gradient(270deg, transparent, #FBBF24)' }} />
              </div>

              <p className="text-center" style={{ fontSize: 10.5, lineHeight: 1.3, color: '#F0D3B0' }}>
                {won.desc}
              </p>

              {/* What it DOES. The reason one donut is worth more than another
                  is on the plate, not buried in the fridge. */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                <span className="font-pixel" style={{
                  padding: '4px 6px', fontSize: 6, letterSpacing: 0.8, color: '#FDE68A',
                  background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.55)', borderRadius: 3,
                }}>
                  {won.perk.label}
                </span>
                {tasteChip && (
                  <span className="font-pixel" style={{
                    padding: '4px 6px', fontSize: 6, letterSpacing: 0.8,
                    color: won.taste === 'loves' ? '#FFD9E4' : '#B9AFA4',
                    background: won.taste === 'loves' ? 'rgba(245,167,192,0.14)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${won.taste === 'loves' ? 'rgba(245,167,192,0.6)' : 'rgba(255,255,255,0.2)'}`,
                    borderRadius: 3,
                  }}>
                    {tasteChip}
                  </span>
                )}
              </div>

              <p className="font-pixel text-center mt-2" style={{ fontSize: 5.5, letterSpacing: 1, color: '#C2925F' }}>
                ADDED TO YOUR FRIDGE
              </p>
            </div>

            {/* ── Buttons ── they sink into their own shadow when pressed. */}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={onClose} className="dsBtn font-pixel"
                style={{
                  padding: '10px 16px', fontSize: 8, letterSpacing: 1.5, color: '#E7C39A',
                  background: 'linear-gradient(180deg, #5A2C12 0%, #35180A 100%)',
                  border: '2px solid #8A5228', borderRadius: 5,
                  ['--dsSh' as string]: '#160902',
                  ['--dsHi' as string]: 'rgba(255,255,255,0.14)',
                }}>
                DONE
              </button>
              {onSpinAgain && (
                <button onClick={onSpinAgain} className="dsBtn font-pixel inline-flex items-center gap-1.5"
                  style={{
                    padding: '10px 16px', fontSize: 8, letterSpacing: 1.5, color: '#3A1B02',
                    background: 'linear-gradient(180deg, #FCD34D 0%, #F59E0B 46%, #C2610A 100%)',
                    border: '2px solid #7C2D12', borderRadius: 5,
                    ['--dsSh' as string]: '#4A1D06',
                    ['--dsHi' as string]: 'rgba(255,255,255,0.55)',
                  }}>
                  AGAIN
                  {spinAgainCost === 'free'
                    ? <span style={{ fontSize: 7 }}>FREE</span>
                    : <><IconCoin size={10} />{spinAgainCost}</>}
                </button>
              )}
            </div>
          </div>
        )}
        {!landed && (
          <p className="font-pixel mt-4" style={{ fontSize: 7, color: '#E7C39A', letterSpacing: 1.5, opacity: 0.85 }}>
            {wasFree ? 'FREE SPIN' : 'GOOD LUCK'}
          </p>
        )}
      </div>

      <style jsx>{`
        .dsBtn {
          box-shadow: 0 3px 0 var(--dsSh), inset 0 1px 0 var(--dsHi);
          transition: transform 80ms ease-out, box-shadow 80ms ease-out;
        }
        .dsBtn:active {
          transform: translateY(3px);
          box-shadow: 0 0 0 var(--dsSh), inset 0 1px 0 var(--dsHi);
        }
        @keyframes dsPop {
          0%   { transform: scale(0.9);  opacity: 0; }
          60%  { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes dsFrame {
          0%   { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes dsFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dsSheen {
          from { transform: translateX(0) skewX(-14deg); }
          to   { transform: translateX(560px) skewX(-14deg); }
        }
        @keyframes dsRayIn {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes dsRays {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* The one-shot pops are spectacle too — the result is already on
           screen without them. */
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
