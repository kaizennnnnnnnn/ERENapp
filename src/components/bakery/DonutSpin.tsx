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
// and it is staged so that ONE thing is lit at a time. The neighbours fade, a
// leaf frame closes on the winning cell, and the card underneath names the
// donut, what it does, and what he'll make of it. A reel that just stops with
// twelve donuts equally visible has told you nothing.
//
// Meadow: a warm flat page, the reel a white window with a lip, the card white.
// The one colour cue is the WON DONUT's own (see lift): the flat rays that open
// behind the reel when it lands, so a mint win and a black-forest win don't
// look like the same screen with the words swapped.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { foodArt } from '@/lib/foodMeta'
import { MACHINE_DONUTS, type DonutDef } from '@/lib/donuts'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'
import { M, MeadowIcon, PrimaryButton, SecondaryButton, Tag, TINT, TYPE } from '@/components/meadow'
import { titleCase } from './words'

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
  loves: '{His} favourite',
  likes: null,           // the default — a chip saying "fine" is noise
  meh:   'Not {his} thing',
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
  const cat = useCat()
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
      playSound('gacha_donut')
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
      playSound('gacha_donut')
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
    <div className="meadow-root absolute inset-0 z-50 flex flex-col items-center justify-center px-4"
      style={{ background: TINT.amber }}>

      {/* ── Title ── */}
      <h2 style={{ ...TYPE.heading, margin: 0, color: M.text }}>{landed ? 'You got' : 'Spinning...'}</h2>
      <p style={{ margin: '4px 0 18px', fontSize: 15, fontWeight: 600, color: M.text2, visibility: landed ? 'hidden' : 'visible' }}>
        {wasFree ? 'A free spin' : 'Good luck'}
      </p>

      <div className="relative flex justify-center" style={{ width: '100%', maxWidth: REEL_MAX }}>

        {/* ── Rays ── flat stripes in the won donut's colour, behind the reel.
            Only once it has landed: during the spin the motion is the
            spectacle, and two moving things fight. */}
        {landed && !reduced && (
          <div className="absolute pointer-events-none" aria-hidden style={{
            left: '50%', top: '50%', width: 440, height: 440, marginLeft: -220, marginTop: -220,
            animation: 'dsRayIn 700ms ease-out both',
          }}>
            <div className="w-full h-full" style={{
              borderRadius: 999,
              background: `repeating-conic-gradient(from 0deg, ${tint(glow, 0.3)} 0deg 6deg, transparent 6deg 16deg)`,
              WebkitMaskImage: 'radial-gradient(closest-side, #000 30%, transparent 100%)',
              maskImage: 'radial-gradient(closest-side, #000 30%, transparent 100%)',
              animation: 'dsRays 26s linear infinite',
            }} />
          </div>
        )}

        {/* ── Reel ── a white window on the strip, the marker at dead centre. */}
        <div className="relative w-full overflow-hidden" style={{
          height: CELL + 16, borderRadius: 24, background: '#FFFFFF', boxShadow: `0 4px 0 ${M.softLip}`,
        }}>
          {/* The strip fades out at both ends, so donuts enter and leave
              rather than pop at the edge. */}
          <div ref={viewportRef} className="absolute inset-0 overflow-hidden" style={{
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 44px, #000 calc(100% - 44px), transparent 100%)',
            maskImage: 'linear-gradient(90deg, transparent 0, #000 44px, #000 calc(100% - 44px), transparent 100%)',
          }}>
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
                      transform: landed && i === winnerIndex ? 'scale(1.12)' : 'scale(1)',
                      transition: 'transform 420ms cubic-bezier(0.34,1.56,0.64,1)',
                    }} />
                </div>
              ))}
            </div>
          </div>

          {/* The others fade back, so the one in the frame is the one you see. */}
          {landed && (
            <>
              <div className="absolute inset-y-0 left-0 pointer-events-none" style={{
                width: `calc(50% - ${CELL / 2}px)`, background: 'rgba(255,255,255,0.72)', animation: 'dsFade 300ms steps(3, end) both',
              }} />
              <div className="absolute inset-y-0 right-0 pointer-events-none" style={{
                width: `calc(50% - ${CELL / 2}px)`, background: 'rgba(255,255,255,0.72)', animation: 'dsFade 300ms steps(3, end) both',
              }} />
              <div className="absolute pointer-events-none" style={{
                left: '50%', marginLeft: -(CELL / 2), top: 6, bottom: 6, width: CELL,
                border: `3px solid ${M.leaf}`, borderRadius: 18,
                animation: 'dsFrame 340ms cubic-bezier(0.34,1.56,0.64,1) both',
              }} />
            </>
          )}

          {/* Marker: two leaf notches biting in from top and bottom. Once the
              frame closes they've done their job, so they step back. */}
          {(['top', 'bottom'] as const).map(edge => (
            <div key={edge} className="absolute left-1/2 pointer-events-none" style={{
              [edge]: 0, marginLeft: -8, width: 0, height: 0,
              borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
              [edge === 'top' ? 'borderTop' : 'borderBottom']: `10px solid ${M.leaf}`,
              opacity: landed ? 0 : 1, transition: 'opacity 200ms steps(2, end)',
            }} />
          ))}
        </div>
      </div>

      {/* ── Result ── only after the reel stops, so it can't spoil the landing.
          The height is reserved up front: the card appearing must not shove
          the reel upward at the exact moment you're looking at it. */}
      <div className="w-full flex flex-col items-center" style={{ maxWidth: REEL_MAX, minHeight: 236 }}>
        {landed && (
          <div className="w-full flex flex-col" style={{ animation: 'dsPop 420ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div className="flex flex-col items-center" style={{
              marginTop: 18, padding: '16px 16px 14px', borderRadius: 22, background: '#FFFFFF', textAlign: 'center',
            }}>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, lineHeight: 1.2, color: M.text }}>{won.name}</p>
              <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 500, color: M.text2 }}>{won.desc}</p>
              {/* What it DOES: the reason one donut is worth more than another
                  is on the card, not buried in the fridge. */}
              <div className="flex flex-wrap justify-center" style={{ gap: 6, marginTop: 10 }}>
                <Tag tone="leaf" icon={<MeadowIcon name="star" size={16} />}>{titleCase(won.perk.label)}</Tag>
                {tasteChip && <Tag tone={won.taste === 'loves' ? 'epic' : 'soft'}>{cat.t(tasteChip)}</Tag>}
              </div>
              <p className="flex items-center" style={{ margin: '10px 0 0', gap: 5, fontSize: 13, fontWeight: 700, color: M.text2 }}>
                <MeadowIcon name="check" size={16} color={M.leaf} />
                Added to your fridge
              </p>
            </div>

            <div className="flex" style={{ gap: 10, marginTop: 14 }}>
              <SecondaryButton onClick={onClose} full={false} style={{ flex: '1 1 0' }}>Done</SecondaryButton>
              {onSpinAgain && (
                <PrimaryButton onClick={onSpinAgain} full={false} style={{ flex: '1 1 0' }}>
                  <span className="inline-flex items-center" style={{ gap: 6 }}>
                    Again
                    {spinAgainCost === 'free'
                      ? <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>free</span>
                      : <><MeadowIcon name="coin" size={20} />{spinAgainCost}</>}
                  </span>
                </PrimaryButton>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes dsPop {
          0%   { transform: scale(0.9);  opacity: 0; }
          60%  { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes dsFrame {
          0%   { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes dsFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dsRayIn {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes dsRays {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
