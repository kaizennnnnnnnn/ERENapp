'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DONUT CASE PANEL — what the machine holds, before you spend anything on it.
// ──────────────────────────────────────────────────────────────────────────
// The first version of this was a lone FREE SPIN button on an empty card: you
// couldn't see a single donut until after you'd paid, so there was nothing to
// want. This shows the whole case up front — every donut in full colour, what
// each one DOES, and whether Eren has tasted it yet.
//
// So it's three things on one surface, which is right because they're the same
// question asked three ways: what's in there, what have I got, what's it worth
// spinning for.
//
// The three gacha-exclusive donuts are shown but marked — they're part of the
// collection, so hiding them would make the counter unwinnable-looking, but the
// machine can't drop them and the card has to say so.
// ═══════════════════════════════════════════════════════════════════════════

import { useState } from 'react'
import { foodArt } from '@/lib/foodMeta'
import { DONUTS, MACHINE_DONUTS, SPIN_COST, TASTE_JOY, type DonutDef } from '@/lib/donuts'
import { DONUT_EFFECTS } from '@/lib/donutEffects'
import { playSound } from '@/lib/sounds'
import { IconCoin, IconStar, IconDonut, IconHeart } from '@/components/PixelIcons'

/** Machine stock first — that's what the spin button is offering. */
const CASE_ORDER: DonutDef[] = [
  ...MACHINE_DONUTS,
  ...DONUTS.filter(d => d.source === 'gacha'),
]
const MACHINE_IDS: ReadonlySet<string> = new Set(MACHINE_DONUTS.map(d => d.id))

/**
 * The case, cut into shelves of five.
 *
 * A flat 5-column grid of bordered tiles was reading as a spreadsheet of
 * donuts. Standing them in rows on wooden shelves — under glass, with a
 * contact shadow each — is the difference between a list and a display case,
 * and it costs nothing but how the rows are wrapped.
 */
const PER_SHELF = 5
const SHELVES: DonutDef[][] = []
for (let i = 0; i < CASE_ORDER.length; i += PER_SHELF) {
  SHELVES.push(CASE_ORDER.slice(i, i + PER_SHELF))
}

interface Props {
  tasted: ReadonlySet<string>
  coins: number
  /** undefined while the free-spin cooldown is still being read. */
  freeReady: boolean
  loaded: boolean
  busy: boolean
  /** Formatted "6H 12M" until the free spin returns. */
  freeIn: string
  onSpin: () => void
  onClose: () => void
}

export default function DonutCasePanel({
  tasted, coins, freeReady, loaded, busy, freeIn, onSpin, onClose,
}: Props) {
  // Tapping a donut swaps the footer to that donut's detail rather than opening
  // a second layer — one panel, no nesting, and the spin button never moves.
  const [picked, setPicked] = useState<DonutDef | null>(null)
  const canPay = coins >= SPIN_COST
  const spinnable = loaded && !busy && (freeReady || canPay)

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-3"
      style={{ background: 'rgba(30,14,6,0.72)' }}
      onClick={() => { playSound('ui_modal_close'); onClose() }}>
      <div className="w-full flex flex-col overflow-hidden"
        style={{
          // A DEFINITE height, not a max: the shelves are an absolutely-filled
          // scroller, so they contribute no height of their own and a
          // content-sized card would collapse to the header and the button.
          maxWidth: 340, height: '88%',
          background: 'linear-gradient(180deg, #FFF8EC 0%, #FBDFB8 100%)',
          border: '3px solid #7C4A21', borderRadius: 10,
          boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.55), 0 6px 0 rgba(60,26,4,0.5), 0 0 28px rgba(245,158,11,0.3)',
          animation: 'dcPop 0.24s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── a brass nameplate on dark wood, not a line of text
            floating on cream. The counter is the other half of the pitch, so
            it gets a chip of its own rather than trailing off the right. ── */}
        <div className="relative flex items-center justify-between px-3 py-2.5 flex-shrink-0"
          style={{
            background: 'linear-gradient(180deg, #6B3A18 0%, #48250E 100%)',
            borderBottom: '2px solid #2E1404',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
          }}>
          <span className="font-pixel inline-flex items-center gap-1.5" style={{ fontSize: 9, color: '#FBBF24', letterSpacing: 1.5, textShadow: '0 1px 0 rgba(0,0,0,0.5)' }}>
            <IconDonut size={11} />
            THE CASE
          </span>
          <span className="font-pixel inline-flex items-center gap-1" style={{
            fontSize: 6.5, color: '#FDE68A', letterSpacing: 1,
            padding: '3px 6px', borderRadius: 3,
            background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(251,191,36,0.45)',
          }}>
            <IconHeart size={8} />
            {tasted.size}/{DONUTS.length}
          </span>
        </div>

        {/* ── The case ── every donut, in colour, before you spend a coin.
            Wrapped in its own positioned box so the glass sits OVER the
            shelves and doesn't scroll away with them. ── */}
        {/* The scroller is absolutely filled rather than `h-full`: inside a flex
            column, height:100% of a flex-basis-auto parent resolves to auto, so
            it grew instead of clipping and the shelves painted over the spin
            button. */}
        <div className="relative flex-1" style={{
          minHeight: 0,
          // The case gets its own back wall, a shade deeper than the card, so
          // the shelves have something to be mounted ON.
          background: 'linear-gradient(180deg, #EBD3AE 0%, #FAEBD2 22%, #F2DCBB 100%)',
        }}>
          <div className="absolute inset-0 overflow-y-auto px-3 pt-3" style={{ scrollbarWidth: 'thin' }}>
            {SHELVES.map((shelf, row) => (
              <div key={row} style={{ marginBottom: 9 }}>
                <div className="grid grid-cols-5 gap-1 items-end">
                  {shelf.map(d => {
                    const has = tasted.has(d.id)
                    const inMachine = MACHINE_IDS.has(d.id)
                    const on = picked?.id === d.id
                    return (
                      <button key={d.id}
                        onClick={() => { playSound('ui_tap'); setPicked(on ? null : d) }}
                        className="relative flex flex-col items-center justify-end"
                        style={{ padding: '2px 0 0' }}>
                        {/* Light pooling on the one you tapped, so the pick
                            reads without boxing every donut in a border. */}
                        {on && (
                          <span className="absolute" style={{
                            left: '50%', top: '46%', width: 52, height: 52,
                            transform: 'translate(-50%, -50%)',
                            background: `radial-gradient(circle, ${d.color}66 0%, transparent 68%)`,
                          }} />
                        )}
                        {/* Always full colour — the entire point is that you can
                            see what's in the machine without paying. Tasted is a
                            badge, not a reveal. */}
                        <img src={foodArt(d.id)} alt={d.name} draggable={false}
                          className="relative"
                          style={{
                            width: '100%', aspectRatio: '1', objectFit: 'contain', display: 'block',
                            transform: on ? 'scale(1.12)' : 'scale(1)',
                            transition: 'transform 160ms cubic-bezier(0.34,1.56,0.64,1)',
                            filter: on ? 'drop-shadow(0 2px 2px rgba(90,45,15,0.5))' : 'none',
                          }} />
                        {/* Contact shadow — what makes it STAND on the shelf
                            instead of floating above it. */}
                        <span className="relative" style={{
                          width: '62%', height: 3, marginTop: -1, borderRadius: '50%',
                          background: 'radial-gradient(ellipse, rgba(90,45,15,0.42) 0%, transparent 70%)',
                        }} />
                        {has && (
                          <span className="absolute font-pixel" style={{
                            top: -2, right: 0, width: 11, height: 11, lineHeight: '11px',
                            fontSize: 6, textAlign: 'center', color: '#3A1B02',
                            background: '#FBBF24', border: '1px solid #7C2D12', borderRadius: 2,
                          }}>✓</span>
                        )}
                        {/* A rotated pip, not a stray square — the old one read
                            as a rendering artifact stuck to the corner. */}
                        {!inMachine && (
                          <span className="absolute" style={{
                            top: 0, left: 1, width: 6, height: 6,
                            background: '#A78BFA', border: '1px solid #4C1D95',
                            transform: 'rotate(45deg)',
                          }} />
                        )}
                      </button>
                    )
                  })}
                </div>
                {/* The shelf itself: a lit front edge over a dark underside,
                    then the shadow it throws down the back wall. */}
                <div style={{
                  height: 6, borderRadius: 1,
                  background: 'linear-gradient(180deg, #F0BE79 0%, #C98B48 38%, #8A5228 72%, #5E3616 100%)',
                  boxShadow: '0 3px 5px rgba(90,45,15,0.4), 0 1px 0 rgba(255,255,255,0.25) inset',
                }} />
              </div>
            ))}
            <p className="font-pixel text-center pb-2 pt-1 inline-flex items-center justify-center gap-1.5 w-full"
              style={{ fontSize: 5, color: '#A26A2E', letterSpacing: 0.8 }}>
              <span style={{ width: 5, height: 5, background: '#A78BFA', border: '1px solid #4C1D95', transform: 'rotate(45deg)', display: 'inline-block' }} />
              GACHA ONLY — THE MACHINE WON&apos;T DROP THESE
            </p>
          </div>

          {/* ── Glass ── one diagonal sweep and a shadow under the top edge.
              Pointer-events-none, so the case is still all tap target. ── */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'linear-gradient(107deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.06) 26%, transparent 42%, transparent 70%, rgba(255,255,255,0.12) 100%)',
          }} />
          <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
            height: 14, background: 'linear-gradient(180deg, rgba(74,37,14,0.3), transparent)',
          }} />
        </div>

        {/* ── Detail ── the tapped donut, or the pitch when nothing's tapped.
            Sits on the counter under the case: darker than the glass, so the
            two never read as one surface. ── */}
        <div className="px-3 pt-2.5 pb-1 flex-shrink-0" style={{
          borderTop: '2px solid #7C4A21',
          background: 'linear-gradient(180deg, #F7E3C2 0%, #EFD3AC 100%)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5)',
        }}>
          {picked ? (
            <div className="flex items-center gap-2.5" style={{ minHeight: 52 }}>
              <img src={foodArt(picked.id)} alt="" width={44} height={44} draggable={false}
                style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 2px rgba(90,45,15,0.35))' }} />
              <div className="flex-1 min-w-0">
                <p className="font-pixel" style={{ fontSize: 7, color: '#78350F', letterSpacing: 0.5, lineHeight: 1.4 }}>
                  {picked.name.toUpperCase()}
                </p>
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  <span className="font-pixel" style={{ fontSize: 5.5, padding: '2px 4px', borderRadius: 3, background: '#3A1B02', color: '#FDE68A' }}>
                    {picked.perk.label}
                  </span>
                  {/* Taste is the other half of "are these all the same?" — it
                      changes the joy he actually gets, so it's stated. */}
                  {picked.taste !== 'likes' && (
                    <span className="font-pixel" style={{
                      fontSize: 5.5, padding: '2px 4px', borderRadius: 3,
                      background: picked.taste === 'loves' ? '#FFDCE8' : '#E5E7EB',
                      color: picked.taste === 'loves' ? '#C0407A' : '#6B7280',
                      border: `1px solid ${picked.taste === 'loves' ? '#F5A8C4' : '#9CA3AF'}`,
                    }}>
                      {picked.taste === 'loves' ? `HE LOVES IT · JOY x${TASTE_JOY.loves}` : 'NOT HIS THING'}
                    </span>
                  )}
                  {/* The visible one. Worth its own chip in its own colour —
                      it's the only thing in the case you'd cross a room for. */}
                  {picked.effect && (
                    <span className="font-pixel" style={{
                      fontSize: 5.5, padding: '2px 4px', borderRadius: 3,
                      color: '#3A1B02',
                      background: DONUT_EFFECTS[picked.effect].tone,
                      border: `1px solid rgba(0,0,0,0.25)`,
                      boxShadow: `0 0 8px ${DONUT_EFFECTS[picked.effect].tone}88`,
                    }}>
                      {DONUT_EFFECTS[picked.effect].blurb.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-center" style={{ color: '#7C2D12', opacity: 0.8, minHeight: 52, lineHeight: 1.4, paddingTop: 6 }}>
              Tap any donut to see what it does.<br />
              A spin gives one of the {MACHINE_DONUTS.length} the machine holds.
            </p>
          )}
        </div>

        {/* ── Spin ── held until the cooldown read lands, so a paid spin can
            never be offered while a free one might be waiting. ── */}
        <div className="px-3 pb-3 pt-2 flex-shrink-0" style={{
          background: 'linear-gradient(180deg, #EFD3AC 0%, #E3BE8E 100%)',
        }}>
          <button onClick={onSpin} disabled={!spinnable}
            className="dcSpin w-full font-pixel text-white inline-flex items-center justify-center gap-2"
            style={{
              padding: '14px 12px', fontSize: 10, letterSpacing: 1.5,
              background: !loaded ? 'linear-gradient(180deg, #A9855F, #8A6740)'
                : freeReady ? 'linear-gradient(180deg, #4ADE80 0%, #16A34A 46%, #14532D 100%)'
                : canPay ? 'linear-gradient(180deg, #FCD34D 0%, #F59E0B 46%, #B45309 100%)'
                : 'linear-gradient(180deg, #A9855F, #8A6740)',
              color: spinnable && !freeReady ? '#3A1B02' : '#FFFFFF',
              border: `2px solid ${spinnable ? (freeReady ? '#0F3D20' : '#7C2D12') : 'rgba(90,45,15,0.5)'}`,
              borderRadius: 6,
              textShadow: spinnable && !freeReady ? 'none' : '0 1px 0 rgba(0,0,0,0.35)',
              opacity: busy ? 0.6 : 1,
              cursor: spinnable ? 'pointer' : 'not-allowed',
              ['--dcSh' as string]: spinnable ? (freeReady ? '#0B2B16' : '#5A2408') : 'rgba(60,26,4,0.35)',
            }}>
            {!loaded ? <>WARMING UP…</>
              : freeReady ? <><IconStar size={11} /> FREE SPIN</>
              : <>SPIN <IconCoin size={12} /> {SPIN_COST}</>}
          </button>
          {loaded && (
            <p className="font-pixel mt-2 text-center" style={{ fontSize: 5.5, color: '#7C4A21', letterSpacing: 1 }}>
              {freeReady ? `NEXT SPINS COST ${SPIN_COST}`
                : canPay ? `FREE SPIN IN ${freeIn}`
                : `NOT ENOUGH COINS · FREE SPIN IN ${freeIn}`}
            </p>
          )}
          <button onClick={() => { playSound('ui_modal_close'); onClose() }}
            className="font-pixel w-full mt-2 py-1.5 active:scale-95" style={{ fontSize: 8, color: '#7C4A21', letterSpacing: 1 }}>
            CLOSE
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes dcPop {
          from { transform: scale(0.9); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        /* Sinks into its own shadow rather than just nudging down — the press
           physics the reveal screen's buttons use. */
        .dcSpin {
          box-shadow: 0 4px 0 var(--dcSh), inset 0 1px 0 rgba(255,255,255,0.45);
          transition: transform 80ms ease-out, box-shadow 80ms ease-out;
        }
        .dcSpin:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--dcSh), inset 0 1px 0 rgba(255,255,255,0.45);
        }
      `}</style>
    </div>
  )
}
