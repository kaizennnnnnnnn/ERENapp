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
// the rarity plates carry the numbers. Rules are chips, not paragraphs — this
// is a thing you glance at before spending 50 coins, not something you read.
// One footnote survives as prose because it's a real gotcha: pity lives on the
// USER, not the banner, so pulls on one machine push all three.
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
import SketchEren from '@/components/SketchEren'

const GOLD = '#F5C842'
const FRAME = '#0A0612'

/** Lit-segment gradients, in the SegmentMeter idiom: hi → base → lo. */
const TIER: Record<GachaRarity, { hi: string; base: string; lo: string; glow: string; stars: number }> = {
  // Muted on purpose: at 60% of the bar a bright grey drowns the jewel
  // tiers next to it, and common is the one nobody opened this for.
  common:    { hi: '#C9CED6', base: '#8E95A0', lo: '#5B626D', glow: 'rgba(170,178,190,0.4)',  stars: 1 },
  rare:      { hi: '#DBEAFE', base: '#7FB0F7', lo: '#2F6FD0', glow: 'rgba(96,165,250,0.55)',  stars: 2 },
  epic:      { hi: '#F3E8FF', base: '#BFA0FB', lo: '#7C3AED', glow: 'rgba(167,139,250,0.6)',  stars: 3 },
  legendary: { hi: '#FFF6D2', base: '#F5C842', lo: '#B4700C', glow: 'rgba(245,200,66,0.7)',   stars: 4 },
}

const STAR_CLIP =
  'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'

/**
 * Star rating, one per tier rank. Replaces the rotated squares that used to
 * sit here: a cube reads as a bullet, and every row got the same one, so the
 * hierarchy the panel is ABOUT was carried only by the colour. One-to-four
 * stars is the gacha language everyone already reads, and it makes the rows
 * differ in weight the way the tiers do.
 */
function Stars({ rarity }: { rarity: GachaRarity }) {
  const t = TIER[rarity]
  return (
    <span aria-hidden className="flex items-center flex-shrink-0" style={{ gap: 1.5, width: 40 }}>
      {Array.from({ length: t.stars }, (_, i) => (
        <span key={i} className="odds-star" style={{
          width: 8, height: 8,
          background: `linear-gradient(180deg, ${t.hi} 0%, ${t.base} 60%, ${t.lo} 100%)`,
          clipPath: STAR_CLIP,
          filter: `drop-shadow(0 0 3px ${t.glow})`,
          animationDelay: `${i * 0.22}s`,
        }} />
      ))}
    </span>
  )
}

/** Terse rule chip — replaces what used to be a paragraph each. */
function Chip({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between" style={{
      gap: 6, padding: '6px 7px', borderRadius: 4,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.25))',
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
      <div className="odds-pop relative w-full" style={{ maxWidth: 296 }} onClick={e => e.stopPropagation()}>

        {/* Eren peeks over the top edge. He sits BEHIND the panel, so its own
            background crops him at the shoulders — the panel reads as
            something he's holding up rather than a dialog that happens to
            have a cat sticker on it. Offset from centre so the composition
            isn't another perfectly symmetrical stack. */}
        <div aria-hidden className="odds-peek absolute" style={{
          top: -54, right: 16, zIndex: 0,
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))',
        }}>
          <SketchEren state="wow" size={92} transparent noSpeech />
        </div>

        <div
          className="relative"
          style={{
            zIndex: 1,
            background: 'radial-gradient(120% 90% at 50% 0%, #33215C 0%, #1B1136 58%, #0D0819 100%)',
            border: `2px solid ${GOLD}`,
            borderRadius: 12,
            boxShadow: '0 0 24px rgba(245,200,66,0.34), 0 10px 30px rgba(0,0,0,0.6)',
            padding: '15px 14px 13px',
          }}
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
                 idiom so it reads as a machine part, not a web progress bar.
                 The inner wrapper wipes open on mount — one clip-path on one
                 element, rather than animating four widths. ── */}
          <div className="relative" style={{
            marginTop: 11, marginBottom: 14,
            height: 20, borderRadius: 4, overflow: 'hidden',
            border: `2px solid ${FRAME}`,
            background: '#0A0714',
            boxShadow: `0 2px 0 ${FRAME}, inset 0 2px 4px rgba(0,0,0,0.7)`,
          }}>
            <div className="odds-wipe flex" style={{ height: '100%' }}>
              {[...odds].reverse().map(o => {
                const t = TIER[o.rarity]
                return (
                  <div key={o.rarity} className={o.rarity === 'legendary' ? 'odds-legend-seg' : undefined}
                    style={{
                      width: `${o.chance}%`,
                      background: `linear-gradient(180deg, ${t.hi} 0%, ${t.base} 52%, ${t.lo} 100%)`,
                      borderRight: `1px solid ${FRAME}`,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                    }} />
                )
              })}
            </div>
          </div>

          {/* ── Rarity plates ── */}
          <div className="relative flex flex-col" style={{ gap: 5 }}>
            {odds.map((o, i) => {
              const t = TIER[o.rarity]
              return (
                <div key={o.rarity} className="odds-plate flex items-center" style={{
                  gap: 8, padding: '7px 9px', borderRadius: 5,
                  background: `linear-gradient(90deg, ${t.glow.replace(/[\d.]+\)$/, '0.20)')} 0%, rgba(0,0,0,0.18) 72%)`,
                  border: `1.5px solid ${t.lo}`,
                  boxShadow: `2px 2px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)`,
                  animationDelay: `${120 + i * 70}ms`,
                }}>
                  <Stars rarity={o.rarity} />
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
        </div>

        <style jsx>{`
          /* Entrance. The panel only ever appears on a tap, so this plays at
             exactly the moment anyone is looking at it. 'backwards', never
             'both' — a forwards-filling animation keeps winning over the
             inline styles underneath it. */
          .odds-pop {
            animation: oddsPop 260ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
          }
          @keyframes oddsPop {
            from { opacity: 0; transform: scale(0.9) translateY(10px); }
            to   { opacity: 1; transform: scale(1)   translateY(0); }
          }
          .odds-peek {
            animation: oddsPeek 300ms cubic-bezier(0.34, 1.8, 0.64, 1) 80ms backwards,
                       oddsBob 3.4s ease-in-out 400ms infinite;
          }
          @keyframes oddsPeek {
            from { opacity: 0; transform: translateY(22px) scale(0.8); }
            to   { opacity: 1; transform: translateY(0)    scale(1); }
          }
          @keyframes oddsBob {
            0%, 100% { transform: translateY(0)    rotate(0deg); }
            50%      { transform: translateY(-4px) rotate(-2deg); }
          }
          .odds-wipe {
            animation: oddsWipe 620ms cubic-bezier(0.16, 1, 0.3, 1) 140ms backwards;
          }
          @keyframes oddsWipe {
            from { clip-path: inset(0 100% 0 0); }
            to   { clip-path: inset(0 0 0 0); }
          }
          .odds-plate {
            animation: oddsPlateIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
          }
          @keyframes oddsPlateIn {
            from { opacity: 0; transform: translateX(-10px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          /* The stars keep breathing after everything else settles — it's the
             only thing standing between this and a static table. */
          .odds-star {
            animation: oddsStarTwinkle 2.4s ease-in-out infinite;
          }
          @keyframes oddsStarTwinkle {
            0%, 100% { opacity: 0.68; transform: scale(0.86); }
            50%      { opacity: 1;    transform: scale(1.12); }
          }
          /* A slow gleam over the legendary sliver — on a 3% segment it's the
             only thing that stops the tier you came for reading as a rounding
             error. One element, one filter; nothing per-particle. */
          .odds-legend-seg {
            animation: oddsGleam 3.2s ease-in-out infinite;
          }
          @keyframes oddsGleam {
            0%, 100% { filter: brightness(1); }
            50%      { filter: brightness(1.5); }
          }
          @media (prefers-reduced-motion: reduce) {
            .odds-pop, .odds-peek, .odds-wipe, .odds-plate,
            .odds-star, .odds-legend-seg { animation: none; }
          }
        `}</style>
      </div>
    </div>
  )
}
