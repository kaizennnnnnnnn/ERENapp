'use client'

// ═══════════════════════════════════════════════════════════════════════════
// GACHA ODDS SHEET — "what are my chances", per banner.
//
// The numbers come from bannerOdds(), which folds rollItem's tier-escalation
// the same way the machine does. That matters: printing the raw RARITY_WEIGHTS
// table here would be a lie on both skin banners, which have no common items —
// their whole 60% common slice lands on rare instead.
//
// Shape: one stacked proportion bar carries the whole story at a glance, then
// four rarity plates carry the numbers. The rules are chips, not paragraphs —
// this is a thing you glance at before spending 50 coins, not something you
// read. One footnote survives as prose because it's a real gotcha: pity lives
// on the USER, not the banner, so pulls on one machine push all three.
//
// No per-rarity gauges: odds run 3%–85%, and 3% on a 12-segment SegmentMeter
// rounds to zero lit segments — an empty bar on the tier people came for.
// ═══════════════════════════════════════════════════════════════════════════

import { playSound } from '@/lib/sounds'
import type { GachaRarity } from '@/types'
import {
  bannerOdds, DUPLICATE_STARDUST, PITY_EPIC, PITY_LEGENDARY,
} from '@/lib/gacha'
import { Rivets } from '@/components/obsidian'

const GOLD = '#F5C842'
const FRAME = '#0A0612'

/** Lit-segment gradients, in the SegmentMeter idiom: hi → base → lo. */
const TIER: Record<GachaRarity, { hi: string; base: string; lo: string; glow: string }> = {
  // Muted on purpose: at 60% of the bar a bright grey drowns the jewel
  // tiers next to it, and common is the one nobody opened this for.
  common:    { hi: '#C9CED6', base: '#8E95A0', lo: '#5B626D', glow: 'rgba(170,178,190,0.4)' },
  rare:      { hi: '#DBEAFE', base: '#7FB0F7', lo: '#2F6FD0', glow: 'rgba(96,165,250,0.55)' },
  epic:      { hi: '#F3E8FF', base: '#BFA0FB', lo: '#7C3AED', glow: 'rgba(167,139,250,0.6)' },
  legendary: { hi: '#FFF6D2', base: '#F5C842', lo: '#B4700C', glow: 'rgba(245,200,66,0.7)' },
}

/** Rarity gem — a rotated pixel square, the panel's per-tier bullet. */
function Gem({ rarity }: { rarity: GachaRarity }) {
  const t = TIER[rarity]
  return (
    <span aria-hidden style={{
      width: 11, height: 11, flexShrink: 0,
      transform: 'rotate(45deg)',
      background: `linear-gradient(135deg, ${t.hi} 0%, ${t.base} 55%, ${t.lo} 100%)`,
      border: `1.5px solid ${FRAME}`,
      boxShadow: `0 0 7px ${t.glow}`,
    }} />
  )
}

/** Terse rule chip — replaces what used to be a paragraph each. */
function Chip({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between" style={{
      gap: 6, padding: '6px 7px', borderRadius: 4,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.25))',
      border: '1.5px solid rgba(245,200,66,0.28)',
      boxShadow: '2px 2px 0 rgba(0,0,0,0.45)',
    }}>
      <span className="font-pixel" style={{ fontSize: 5.5, letterSpacing: 0.8, color: 'rgba(233,222,255,0.55)' }}>{k}</span>
      <span className="font-pixel" style={{ fontSize: 6.5, letterSpacing: 0.5, color: GOLD }}>{v}</span>
    </div>
  )
}

export default function GachaOddsSheet({
  bannerId, bannerName, onClose,
}: {
  bannerId: string
  bannerName: string
  onClose: () => void
}) {
  const odds = bannerOdds(bannerId)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ zIndex: 75, background: 'rgba(5,3,12,0.82)', backdropFilter: 'blur(4px)' }}
      onClick={() => { playSound('ui_modal_close'); onClose() }}
    >
      <div
        className="relative w-full"
        style={{
          maxWidth: 296,
          background: 'radial-gradient(120% 90% at 50% 0%, #2A1B4A 0%, #160E2E 60%, #0B0717 100%)',
          border: `2px solid ${GOLD}`,
          borderRadius: 12,
          boxShadow: '0 0 22px rgba(245,200,66,0.32), 0 10px 30px rgba(0,0,0,0.6)',
          padding: '15px 14px 13px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {[['t', 'l'], ['t', 'r'], ['b', 'l'], ['b', 'r']].map(([v, h], i) => (
          <span key={i} aria-hidden className="absolute" style={{
            width: 4, height: 4, background: GOLD, boxShadow: `0 0 3px ${GOLD}`,
            top: v === 't' ? 6 : undefined, bottom: v === 'b' ? 6 : undefined,
            left: h === 'l' ? 6 : undefined, right: h === 'r' ? 6 : undefined,
          }} />
        ))}
        <span aria-hidden className="absolute inset-0 pointer-events-none" style={{
          borderRadius: 10,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.16) 3px, rgba(0,0,0,0.16) 4px)',
        }} />

        {/* ── Title ── */}
        <div className="relative text-center">
          <h2 className="font-pixel" style={{
            fontSize: 11, letterSpacing: 2, color: GOLD,
            textShadow: `2px 2px 0 ${FRAME}, 0 0 12px rgba(245,200,66,0.5)`,
          }}>
            DROP RATES
          </h2>
          <p className="font-pixel" style={{
            fontSize: 5.5, letterSpacing: 1.4, color: 'rgba(233,222,255,0.5)', marginTop: 5,
          }}>
            {bannerName.toUpperCase()}
          </p>
        </div>

        {/* ── The whole 100%, one bar. Recessed channel in the SegmentMeter
               idiom so it reads as a machine part, not a web progress bar. ── */}
        <div className="relative flex" style={{
          marginTop: 11, marginBottom: 14,
          height: 20, borderRadius: 4, overflow: 'hidden',
          border: `2px solid ${FRAME}`,
          background: '#0A0714',
          boxShadow: `0 2px 0 ${FRAME}, inset 0 2px 4px rgba(0,0,0,0.7)`,
        }}>
          {[...odds].reverse().map(o => {
            const t = TIER[o.rarity]
            return (
              <div key={o.rarity} className={o.rarity === 'legendary' ? 'odds-legend-seg' : undefined}
                style={{
                  width: `${o.chance}%`,
                  background: `linear-gradient(180deg, ${t.hi} 0%, ${t.base} 52%, ${t.lo} 100%)`,
                  borderRight: `1px solid ${FRAME}`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35)`,
                }} />
            )
          })}
        </div>

        {/* ── Rarity plates ── */}
        <div className="relative flex flex-col" style={{ gap: 5 }}>
          {odds.map(o => {
            const t = TIER[o.rarity]
            return (
              <div key={o.rarity} className="flex items-center" style={{
                gap: 9, padding: '7px 9px', borderRadius: 5,
                background: `linear-gradient(90deg, ${t.glow.replace(/[\d.]+\)$/, '0.14)')} 0%, rgba(0,0,0,0.22) 70%)`,
                border: `1.5px solid ${t.lo}`,
                boxShadow: `2px 2px 0 rgba(0,0,0,0.5)`,
              }}>
                <Gem rarity={o.rarity} />
                <span className="font-pixel flex-1" style={{
                  fontSize: 7.5, letterSpacing: 1.2, color: t.hi,
                  textShadow: `0 0 8px ${t.glow}`,
                }}>
                  {o.rarity.toUpperCase()}
                </span>
                <span className="font-pixel" style={{
                  fontSize: 5.5, letterSpacing: 0.5, color: 'rgba(233,222,255,0.42)',
                }}>
                  ×{o.items}
                </span>
                <span className="font-pixel" style={{
                  fontSize: 10, color: '#FFFFFF', minWidth: 42, textAlign: 'right',
                  textShadow: `0 0 10px ${t.glow}`,
                }}>
                  {o.chance.toFixed(o.chance < 10 ? 1 : 0)}%
                </span>
              </div>
            )
          })}
        </div>

        {/* ── Rules, as chips ── */}
        <div className="relative grid grid-cols-2" style={{ gap: 5, marginTop: 11 }}>
          <Chip k="EPIC BY" v={`${PITY_EPIC}`} />
          <Chip k="LEGEND BY" v={`${PITY_LEGENDARY}`} />
          <Chip k="10TH PULL" v="RARE+" />
          <Chip k="DUPE" v={`${DUPLICATE_STARDUST.rare}-${DUPLICATE_STARDUST.legendary} DUST`} />
        </div>

        <p className="relative text-center font-pixel" style={{
          fontSize: 5, letterSpacing: 0.8, color: 'rgba(233,222,255,0.34)',
          marginTop: 8, lineHeight: 1.6,
        }}>
          PITY COUNTS EVERY MACHINE
        </p>

        <button
          onClick={() => { playSound('ui_modal_close'); onClose() }}
          className="relative w-full font-pixel active:translate-y-[2px] transition-transform"
          style={{
            marginTop: 11, height: 32, borderRadius: 5,
            border: `2px solid ${FRAME}`,
            background: 'linear-gradient(180deg, #FFE08A 0%, #F5B73B 45%, #C77E16 100%)',
            boxShadow: `3px 3px 0 ${FRAME}, inset 0 1px 0 rgba(255,255,255,0.35)`,
            fontSize: 8, letterSpacing: 1.5, color: '#3A2606',
          }}
        >
          <Rivets inset={3} size={2} />
          GOT IT
        </button>

        <style jsx>{`
          /* A slow gleam over the legendary sliver — on a 3% segment it's the
             only thing that stops the tier you came for reading as a rounding
             error. One element, one gradient; nothing per-particle. */
          .odds-legend-seg {
            position: relative;
            background-size: 100% 100%, 220% 100%;
            animation: oddsGleam 3.2s ease-in-out infinite;
          }
          @keyframes oddsGleam {
            0%, 100% { filter: brightness(1); }
            50%      { filter: brightness(1.45); }
          }
          @media (prefers-reduced-motion: reduce) {
            .odds-legend-seg { animation: none; }
          }
        `}</style>
      </div>
    </div>
  )
}
