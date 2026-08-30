'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE CASE — everything you have ever won, behind glass.
//
// It used to be the shop's own panel chrome with a picture of a shelf inside
// it and three count chips underneath, which read as a form field, not as a
// prize cabinet. This is a cabinet: a mitred wood carcass, a lamp in the top
// of it, glass with two reflections across the front, and a brass plaque
// screwed to the bottom rail with the tally engraved into it.
//
// Everything in it is derived from `counts`, which is derived from the day
// history — the shelf can never disagree with the record.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { TROPHY_TONE, TROPHY_LABEL, type TrophyTier } from '@/lib/dailyTwist'
import { IconFire } from '@/components/PixelIcons'
import DecorArt, { type TrophyCounts } from './DecorArt'
import TrophyCup from './TrophyCup'

const TIERS: TrophyTier[] = ['gold', 'silver', 'bronze']

export default memo(function TrophyCase({
  counts, loading, streak,
}: {
  counts: TrophyCounts
  loading: boolean
  /** Days won in a row, shown only when it is worth bragging about. */
  streak?: number
}) {
  const total = counts.bronze + counts.silver + counts.gold
  const best: TrophyTier | null =
    counts.gold > 0 ? 'gold' : counts.silver > 0 ? 'silver' : counts.bronze > 0 ? 'bronze' : null

  return (
    <div className="relative" style={{
      // Carcass: a dark hardwood with a lit top edge and a shadowed bottom.
      background: 'linear-gradient(180deg, #4A2E17 0%, #2E1B0D 6%, #24160B 94%, #120A05 100%)',
      border: '2px solid #100904',
      borderRadius: 5,
      boxShadow: [
        'inset 0 1px 0 rgba(255,214,160,0.28)',
        'inset 0 -2px 0 rgba(0,0,0,0.7)',
        '0 6px 18px rgba(0,0,0,0.65)',
        '0 0 22px rgba(245,200,66,0.13)',
      ].join(','),
      padding: 7,
    }}>
      {/* brass corner brackets */}
      {[['t', 'l'], ['t', 'r'], ['b', 'l'], ['b', 'r']].map(([v, h]) => (
        <span key={`${v}${h}`} aria-hidden className="absolute" style={{
          width: 9, height: 9,
          top: v === 't' ? 3 : undefined, bottom: v === 'b' ? 3 : undefined,
          left: h === 'l' ? 3 : undefined, right: h === 'r' ? 3 : undefined,
          borderTop: v === 't' ? '2px solid #C89A3E' : undefined,
          borderBottom: v === 'b' ? '2px solid #C89A3E' : undefined,
          borderLeft: h === 'l' ? '2px solid #C89A3E' : undefined,
          borderRight: h === 'r' ? '2px solid #C89A3E' : undefined,
        }} />
      ))}

      {/* ── The lit interior ── */}
      <div className="relative overflow-hidden" style={{
        background: 'radial-gradient(120% 80% at 50% -10%, #2A1B36 0%, #140C1C 55%, #08050C 100%)',
        border: '2px solid #0A0508',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.85)',
        borderRadius: 2,
        padding: '12px 10px 10px',
      }}>
        {/* the lamp in the roof of the case */}
        <span aria-hidden className="absolute left-1/2 -translate-x-1/2" style={{
          top: -1, width: '46%', height: 3,
          background: 'linear-gradient(90deg, transparent, #FFE9A8, transparent)',
          boxShadow: '0 0 12px rgba(255,214,120,0.75)',
        }} />
        <span aria-hidden className="absolute left-0 right-0" style={{
          top: 0, height: '58%',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,214,120,0.16) 0%, transparent 72%)',
        }} />

        {best ? (
          <div className="mx-auto" style={{ maxWidth: 250 }}>
            <DecorArt art="trophy_shelf" counts={counts} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2" style={{ padding: '10px 0 14px' }}>
            <span style={{ opacity: 0.22, filter: 'grayscale(1)' }}>
              <TrophyCup tier="silver" size={52} shine={false} />
            </span>
            <p className="font-pixel text-center" style={{
              fontSize: 6, letterSpacing: 1.5, color: '#6E6080',
            }}>{loading ? 'COUNTING' : 'THE SHELF IS EMPTY'}</p>
          </div>
        )}

        {/* ── Glass ── */}
        <span aria-hidden className="absolute inset-0 pointer-events-none" style={{
          background: `
            linear-gradient(104deg, transparent 12%, rgba(255,255,255,0.055) 17%, transparent 24%),
            linear-gradient(104deg, transparent 32%, rgba(255,255,255,0.035) 35%, transparent 40%),
            linear-gradient(180deg, rgba(190,215,255,0.055) 0%, transparent 30%)`,
        }} />
      </div>

      {/* ── Brass plaque ── */}
      <div className="relative flex items-center justify-center mt-2" style={{
        gap: 10,
        padding: '5px 8px',
        background: 'linear-gradient(180deg, #E4BB63 0%, #B8873A 42%, #8A6222 100%)',
        border: '1px solid #5C3F12',
        borderRadius: 2,
        boxShadow: 'inset 0 1px 0 rgba(255,246,214,0.7), inset 0 -1px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.5)',
      }}>
        {/* the two screws holding it on */}
        {[6, -6].map(x => (
          <span key={x} aria-hidden className="absolute" style={{
            [x > 0 ? 'left' : 'right']: Math.abs(x), top: '50%', marginTop: -2,
            width: 4, height: 4, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #FFF0C4, #7A5312)',
          } as React.CSSProperties} />
        ))}

        {TIERS.map(t => (
          <span key={t} className="flex items-center" style={{ gap: 3 }}>
            <TrophyCup tier={t} size={13} shine={false} />
            <span className="font-pixel" style={{
              fontSize: 8, color: '#3A2606',
              // Engraved: a dark glyph with a light edge under it.
              textShadow: '0 1px 0 rgba(255,241,199,0.55)',
            }}>{counts[t]}</span>
          </span>
        ))}

        <span className="font-pixel" style={{
          fontSize: 5, letterSpacing: 1, color: '#4A3208',
          textShadow: '0 1px 0 rgba(255,241,199,0.5)',
        }}>
          {loading ? 'COUNTING' : total === 0 ? 'WIN A DAY' : `${total} DAY${total === 1 ? '' : 'S'} WON`}
        </span>
      </div>

      {/* ── Streak ribbon, only when it means something ── */}
      {!!streak && streak > 1 && (
        <div className="flex justify-center" style={{ marginTop: 6 }}>
          <span className="inline-flex items-center gap-1 px-2 py-0.5" style={{
            background: 'linear-gradient(180deg, #FF8A3D 0%, #C43A0C 100%)',
            border: '1.5px solid #5A1A02',
            borderRadius: 2,
            boxShadow: '0 2px 0 rgba(0,0,0,0.5), 0 0 10px rgba(255,107,61,0.4)',
          }}>
            <IconFire size={10} />
            <span className="font-pixel" style={{
              fontSize: 6, letterSpacing: 1, color: '#FFE9D2',
            }}>{streak} IN A ROW</span>
          </span>
        </div>
      )}

      {best && (
        <p className="text-center text-[10px]" style={{ color: '#8B7F9B', marginTop: 8 }}>
          Best so far: {TROPHY_LABEL[best].toLowerCase()}
          <span style={{ color: TROPHY_TONE[best] }}> ●</span>
        </p>
      )}
    </div>
  )
})
