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
import { playSound } from '@/lib/sounds'
import { IconCoin, IconStar, IconDonut, IconHeart } from '@/components/PixelIcons'

/** Machine stock first — that's what the spin button is offering. */
const CASE_ORDER: DonutDef[] = [
  ...MACHINE_DONUTS,
  ...DONUTS.filter(d => d.source === 'gacha'),
]
const MACHINE_IDS: ReadonlySet<string> = new Set(MACHINE_DONUTS.map(d => d.id))

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
      <div className="w-full flex flex-col"
        style={{
          maxWidth: 340, maxHeight: '88%',
          background: 'linear-gradient(180deg, #FFF8EC 0%, #FBDFB8 100%)',
          border: '3px solid #B45309', borderRadius: 10,
          boxShadow: '0 6px 0 rgba(60,26,4,0.5), 0 0 28px rgba(245,158,11,0.3)',
          animation: 'dcPop 0.24s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── title + how much of the case he's tried ── */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
          <span className="font-pixel inline-flex items-center gap-1.5" style={{ fontSize: 9, color: '#78350F', letterSpacing: 1.5 }}>
            <IconDonut size={11} />
            THE CASE
          </span>
          <span className="font-pixel inline-flex items-center gap-1" style={{ fontSize: 7, color: '#A26A2E', letterSpacing: 1 }}>
            <IconHeart size={9} />
            TASTED {tasted.size}/{DONUTS.length}
          </span>
        </div>

        {/* ── Grid ── every donut, in colour, before you spend a coin ── */}
        <div className="overflow-y-auto px-3 flex-1" style={{ scrollbarWidth: 'thin', minHeight: 0 }}>
          <div className="grid grid-cols-5 gap-1.5 pb-2">
            {CASE_ORDER.map(d => {
              const has = tasted.has(d.id)
              const inMachine = MACHINE_IDS.has(d.id)
              const on = picked?.id === d.id
              return (
                <button key={d.id}
                  onClick={() => { playSound('ui_tap'); setPicked(on ? null : d) }}
                  className="relative flex items-center justify-center active:translate-y-[1px] transition-transform"
                  style={{
                    aspectRatio: '1', padding: 2,
                    background: on
                      ? 'rgba(180,83,9,0.22)'
                      : has ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)',
                    border: `2px solid ${on ? '#78350F' : has ? '#E0A73C' : 'rgba(120,53,15,0.22)'}`,
                    borderRadius: 5,
                  }}>
                  {/* Always full colour — the entire point is that you can see
                      what's in the machine without paying. Tasted is a badge,
                      not a reveal. */}
                  <img src={foodArt(d.id)} alt={d.name} draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  {has && (
                    <span className="absolute font-pixel" style={{
                      top: -3, right: -3, width: 11, height: 11, lineHeight: '11px',
                      fontSize: 6, textAlign: 'center', color: '#3A1B02',
                      background: '#FBBF24', border: '1px solid #7C2D12', borderRadius: 2,
                    }}>✓</span>
                  )}
                  {!inMachine && (
                    <span className="absolute" style={{
                      bottom: -2, left: -2, width: 7, height: 7,
                      background: '#A78BFA', border: '1px solid #4C1D95', borderRadius: 1,
                    }} />
                  )}
                </button>
              )
            })}
          </div>
          <p className="font-pixel text-center pb-2" style={{ fontSize: 5, color: '#A26A2E', letterSpacing: 0.8, lineHeight: 1.7 }}>
            <span style={{ color: '#7C3AED' }}>■</span> GACHA ONLY — THE MACHINE WON&apos;T DROP THESE
          </p>
        </div>

        {/* ── Detail ── the tapped donut, or the pitch when nothing's tapped ── */}
        <div className="px-3 pt-2 flex-shrink-0" style={{ borderTop: '2px solid rgba(180,83,9,0.3)' }}>
          {picked ? (
            <div className="flex items-center gap-2.5" style={{ minHeight: 52 }}>
              <img src={foodArt(picked.id)} alt="" width={44} height={44} draggable={false}
                style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }} />
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
        <div className="px-3 pb-3 pt-2 flex-shrink-0">
          <button onClick={onSpin} disabled={!spinnable}
            className="w-full font-pixel text-white inline-flex items-center justify-center gap-2 active:translate-y-[2px] transition-transform"
            style={{
              padding: '13px 12px', fontSize: 10, letterSpacing: 1.5,
              background: !loaded ? 'rgba(120,53,15,0.35)'
                : freeReady ? 'linear-gradient(135deg, #16A34A, #14532D)'
                : canPay ? 'linear-gradient(135deg, #F59E0B, #B45309)'
                : 'rgba(120,53,15,0.35)',
              border: `2px solid ${spinnable ? (freeReady ? '#14532D' : '#78350F') : 'rgba(120,53,15,0.5)'}`,
              borderRadius: 6,
              boxShadow: busy ? 'none' : '0 3px 0 rgba(0,0,0,0.35)',
              opacity: busy ? 0.6 : 1,
              cursor: spinnable ? 'pointer' : 'not-allowed',
            }}>
            {!loaded ? <>WARMING UP…</>
              : freeReady ? <><IconStar size={11} /> FREE SPIN</>
              : <>SPIN <IconCoin size={12} /> {SPIN_COST}</>}
          </button>
          {loaded && (
            <p className="font-pixel mt-2 text-center" style={{ fontSize: 5.5, color: '#8A5A2B', letterSpacing: 1 }}>
              {freeReady ? `NEXT SPINS COST ${SPIN_COST}`
                : canPay ? `FREE SPIN IN ${freeIn}`
                : `NOT ENOUGH COINS · FREE SPIN IN ${freeIn}`}
            </p>
          )}
          <button onClick={() => { playSound('ui_modal_close'); onClose() }}
            className="font-pixel w-full mt-2 active:scale-95" style={{ fontSize: 8, color: '#78350F', letterSpacing: 1 }}>
            CLOSE
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes dcPop {
          from { transform: scale(0.9); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
