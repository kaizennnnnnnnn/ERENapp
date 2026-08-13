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

/** Fast off the line, long glide, hard stop — a reel, not an ease-out. */
const REEL_EASE = 'cubic-bezier(0.08, 0.62, 0.12, 1)'

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
    if (reduced) { playSound('gacha_reveal_epic'); return }

    const vw = viewportRef.current?.clientWidth ?? 0
    // Centre the winner's cell under the marker.
    const target = winnerIndex * CELL - (vw / 2 - CELL / 2)

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

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-4"
      style={{ background: 'rgba(30,14,6,0.86)' }}>

      {/* ── Title ── */}
      <p className="font-pixel mb-3 inline-flex items-center gap-1.5"
        style={{ fontSize: 9, color: '#FDE68A', letterSpacing: 2, textShadow: '0 2px 0 rgba(0,0,0,0.5)' }}>
        <IconStar size={10} />
        {landed ? 'YOU GOT' : 'SPINNING'}
        <IconStar size={10} />
      </p>

      {/* ── Reel ── a window on the strip, with a marker at dead centre. */}
      <div className="relative w-full overflow-hidden"
        style={{
          maxWidth: 340, height: CELL + 16,
          background: 'linear-gradient(180deg, #2A1206 0%, #4A2410 50%, #2A1206 100%)',
          border: '3px solid #B45309', borderRadius: 6,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.14), 0 4px 0 rgba(0,0,0,0.45)',
        }}>
        <div ref={viewportRef} className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 flex items-center"
            style={{
              height: '100%', left: 0,
              transform: `translate3d(${-offset}px, 0, 0)`,
              transition: `transform ${SPIN_MS}ms ${REEL_EASE}`,
              willChange: 'transform',
            }}>
            {strip.map((d, i) => (
              <div key={`${d.id}-${i}`} className="flex-shrink-0 flex items-center justify-center"
                style={{ width: CELL, height: CELL }}>
                <img src={foodArt(d.id)} alt="" width={CELL - 16} height={CELL - 16}
                  draggable={false}
                  style={{ objectFit: 'contain', display: 'block' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Edge fades so donuts enter and leave rather than pop at the border. */}
        <div className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: 42, background: 'linear-gradient(90deg, #2A1206, transparent)' }} />
        <div className="absolute inset-y-0 right-0 pointer-events-none" style={{ width: 42, background: 'linear-gradient(270deg, #2A1206, transparent)' }} />

        {/* Marker — two gold pins top and bottom, no full-height line, so it
            frames the winning cell instead of drawing on top of it. */}
        <div className="absolute left-1/2 top-0 pointer-events-none"
          style={{ width: 4, height: 9, marginLeft: -2, background: '#FBBF24' }} />
        <div className="absolute left-1/2 bottom-0 pointer-events-none"
          style={{ width: 4, height: 9, marginLeft: -2, background: '#FBBF24' }} />
      </div>

      {/* ── Result ── only after the reel stops, so it can't spoil the landing. */}
      <div className="mt-4 flex flex-col items-center" style={{ minHeight: 118 }}>
        {landed && (
          <div className="flex flex-col items-center" style={{ animation: 'dsPop 420ms cubic-bezier(0.34,1.56,0.64,1)' }}>
            <p className="font-pixel text-center"
              style={{ fontSize: 11, color: '#FFF7E6', letterSpacing: 1, textShadow: `0 0 12px ${won.color}, 0 2px 0 rgba(0,0,0,0.5)` }}>
              {won.name.toUpperCase()}
            </p>
            <p className="text-[11px] mt-1.5 mb-3 text-center" style={{ color: '#F5D9B8' }}>
              {won.desc} — in your fridge
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="font-pixel active:translate-y-[1px] transition-transform"
                style={{
                  padding: '10px 16px', fontSize: 8, letterSpacing: 1.5, color: '#FDE68A',
                  background: 'rgba(74,26,10,0.9)', border: '2px solid #B45309',
                  borderRadius: 5, boxShadow: '0 3px 0 rgba(0,0,0,0.4)',
                }}>
                DONE
              </button>
              {onSpinAgain && (
                <button onClick={onSpinAgain}
                  className="font-pixel inline-flex items-center gap-1.5 active:translate-y-[1px] transition-transform"
                  style={{
                    padding: '10px 16px', fontSize: 8, letterSpacing: 1.5, color: '#FFFFFF',
                    background: 'linear-gradient(135deg, #F59E0B, #B45309)',
                    border: '2px solid #78350F', borderRadius: 5,
                    boxShadow: '0 3px 0 rgba(0,0,0,0.4)',
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
          <p className="font-pixel" style={{ fontSize: 7, color: '#E7C39A', letterSpacing: 1.5, opacity: 0.85 }}>
            {wasFree ? 'FREE SPIN' : 'GOOD LUCK'}
          </p>
        )}
      </div>

      <style jsx>{`
        @keyframes dsPop {
          0%   { transform: scale(0.7); opacity: 0; }
          60%  { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
