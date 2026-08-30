'use client'

// ═══════════════════════════════════════════════════════════════════════════
// DAILY VERDICT — the first thing you see after the mood check-in, once a day.
//
// It is the ceremony the daily battle never had. Yesterday ended in silence:
// the bar reset, thirty coins appeared somewhere, and neither of you was told
// anything. Now the day is read out — the final score, the trophy struck for
// it, the streak it continues — and then today's rule is handed over.
//
// Beats, in order, each waiting on the last:
//   0 panel      the case drops in
//   1 scores     both numbers count up from zero
//   2 strike     the trophy stamps in with a flash and a shockwave
//   3 prize      the trophy count and any streak bonus
//   4 today      tomorrow's — now today's — twist, and the way out
//
// A reduced-motion viewer gets every beat at once, no counting, no stamp.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import type { DailyBattleRow } from '@/lib/battleResults'
import { TROPHY_TONE, TROPHY_LABEL, type TwistDef, type TrophyTier } from '@/lib/dailyTwist'
import { OBSIDIAN_FACE, OBSIDIAN_BTN, Rivets, accentA } from '@/components/obsidian'
import {
  IconTrophyTier, IconCrown, IconSwords, IconFire, IconHeart, IconShelf,
} from '@/components/PixelIcons'
import Nameplate from '@/components/trophies/Nameplate'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playSound } from '@/lib/sounds'

interface Props {
  row: DailyBattleRow
  awarded: number
  streak: number
  yesterdayTwist: TwistDef
  todayTwist: TwistDef
  myName: string
  partnerName: string
  /** Prestige each side is wearing, if any (Trophy Shop). */
  myTitle?: string | null
  myFrame?: string | null
  partnerTitle?: string | null
  partnerFrame?: string | null
  onClose(): void
}

/** Beat timings, ms after mount. */
const BEAT = [0, 380, 1150, 1850, 2500]

const MY_PINK = { hi: '#FF8DB8', mid: '#FF6B9D', lo: '#C8265F', rgb: '255,107,157' }
const THEIR_PURPLE = { hi: '#C9B4FF', mid: '#A78BFA', lo: '#5C2FE0', rgb: '167,139,250' }

export default function DailyVerdictScreen({
  row, awarded, streak, yesterdayTwist, todayTwist, myName, partnerName,
  myTitle, myFrame, partnerTitle, partnerFrame, onClose,
}: Props) {
  const router = useRouter()
  const reduced = useReducedMotion()
  const [beat, setBeat] = useState(reduced ? 4 : 0)

  const won = row.outcome === 'win'
  const tied = row.outcome === 'tie'
  const tier = (row.trophy_tier ?? null) as TrophyTier | null

  useEffect(() => {
    if (reduced) return
    const ids = BEAT.slice(1).map((ms, i) => setTimeout(() => setBeat(i + 1), ms))
    return () => ids.forEach(clearTimeout)
  }, [reduced])

  // One sound, on the strike. Any more and a daily screen becomes a chore.
  useEffect(() => {
    if (beat === 2) playSound(won ? 'ui_modal_open' : 'ui_tap')
  }, [beat, won])

  const accent = won
    ? { hi: tier ? TROPHY_TONE[tier] : '#FFD650', glow: 'rgba(255,215,80,0.45)' }
    : tied
      ? { hi: '#D8DCE6', glow: 'rgba(200,205,220,0.32)' }
      : { hi: THEIR_PURPLE.hi, glow: 'rgba(167,139,250,0.40)' }

  const dateLabel = useMemo(() => {
    try { return format(parseISO(row.date), 'EEEE d MMM').toUpperCase() }
    catch { return row.date }
  }, [row.date])

  const headline = won
    ? (tier ? `${TROPHY_LABEL[tier]} DAY` : 'YOU WON')
    : tied ? 'DEAD EVEN' : `${partnerName.toUpperCase()} TOOK IT`

  const subline = won
    ? `You took yesterday off ${partnerName}.`
    : tied
      ? `Neither of you gave an inch.`
      : awarded > 0
        ? 'Lost by a whisker. Here, take something.'
        : 'Today is a fresh board.'

  return (
    <div className="fixed inset-0 z-[130] flex flex-col overflow-hidden" style={{
      background: `
        radial-gradient(ellipse at 50% 12%, ${accent.glow} 0%, transparent 52%),
        linear-gradient(180deg, #1A0E24 0%, #0D0616 58%, #05030A 100%)`,
    }}>
      {/* Drifting starfield — the same one the leaderboard uses, so the two
          "results" surfaces in the app feel like the same room. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:
          'radial-gradient(circle, #FBBF24 1px, transparent 1.5px),' +
          'radial-gradient(circle, #A78BFA 1px, transparent 1.5px)',
        backgroundSize: '38px 38px, 56px 56px',
        backgroundPosition: '0 0, 22px 28px',
        opacity: 0.28,
        animation: reduced ? undefined : 'dvStars 30s linear infinite',
      }} />
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.20) 3px, rgba(0,0,0,0.20) 4px)',
      }} />
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,0.62) 100%)',
      }} />

      <div className="relative flex-1 flex flex-col items-center justify-center px-5 py-5 gap-3 overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex flex-col items-center gap-1" style={{
          opacity: beat >= 0 ? 1 : 0,
          animation: reduced ? undefined : 'dvDrop 0.44s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <div className="flex items-center gap-2">
            <IconSwords size={11} />
            <span className="font-pixel" style={{
              fontSize: 7, letterSpacing: 3, color: '#9A8AA8',
            }}>YESTERDAY</span>
            <IconSwords size={11} />
          </div>
          <span className="font-pixel" style={{
            fontSize: 6, letterSpacing: 2, color: '#A092B4',
          }}>{dateLabel}</span>
        </div>

        {/* ── Scoreboard ── */}
        <div className="w-full" style={{ maxWidth: 360 }}>
          <div className="relative px-4 pt-4 pb-5" style={{
            ...OBSIDIAN_FACE,
            border: `2px solid ${accent.hi}`,
            boxShadow: `0 0 26px ${accent.glow}, 0 10px 34px rgba(0,0,0,0.65)`,
            animation: reduced ? undefined : 'dvDrop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <Rivets inset={5} size={3} />

            {/* The two blocks stand on one floor, so first and second place
                read at a glance without having to compare two numbers. Height
                is rank, not score — a 14-5 and a 40-31 should look the same
                shape, because they are the same result. */}
            <div className="relative flex items-end justify-center gap-2">
              <Podium
                name={myName} titleId={myTitle} frameId={myFrame}
                score={row.score} place={won ? 1 : tied ? 0 : 2}
                side={MY_PINK} reveal={beat >= 1} reduced={reduced}
              />
              <Podium
                name={partnerName} titleId={partnerTitle} frameId={partnerFrame}
                score={row.partner_score}
                place={row.outcome === 'loss' ? 1 : tied ? 0 : 2}
                side={THEIR_PURPLE} reveal={beat >= 1} reduced={reduced}
              />

              {/* Floor. Sits under both blocks and runs the full width so the
                  podium has ground rather than hanging in the panel. */}
              <div aria-hidden className="absolute left-0 right-0" style={{
                bottom: -2, height: 5,
                background: 'linear-gradient(180deg, #2A2233 0%, #100C18 100%)',
                borderTop: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 2px 0 rgba(0,0,0,0.6)',
              }} />
            </div>

            {/* Yesterday's rule, so the score makes sense */}
            <div className="flex justify-center mt-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1" style={{
                border: `1px solid ${yesterdayTwist.tone}55`,
                background: `${yesterdayTwist.tone}12`,
                borderRadius: 3,
              }}>
                <span className="font-pixel" style={{
                  fontSize: 5, letterSpacing: 1.5, color: yesterdayTwist.tone,
                }}>{yesterdayTwist.name}</span>
                <span style={{ fontSize: 9, color: '#8B7F9B' }}>{yesterdayTwist.blurb}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── The strike ── */}
        <div className="flex flex-col items-center gap-1.5" style={{
          minHeight: 104,
          opacity: beat >= 2 ? 1 : 0,
          transition: 'opacity 180ms ease-out',
        }}>
          {beat >= 2 && (
            <div className="relative flex items-center justify-center" style={{ width: 88, height: 82 }}>
              {/* Shockwave — one ring, once. A repeating pulse would turn a
                  moment into wallpaper. */}
              {!reduced && (
                <span aria-hidden className="absolute" style={{
                  width: 40, height: 40, borderRadius: '50%',
                  border: `2px solid ${accent.hi}`,
                  animation: 'dvShock 0.72s cubic-bezier(0.16,1,0.3,1) both',
                }} />
              )}
              <div style={{
                filter: `drop-shadow(0 0 12px ${accent.glow})`,
                animation: reduced ? undefined : 'dvStamp 0.5s cubic-bezier(0.34,1.7,0.5,1) both',
              }}>
                {won && tier
                  ? <IconTrophyTier size={78} tier={tier} />
                  : tied
                    ? <IconSwords size={62} />
                    : awarded > 0
                      ? <IconTrophyTier size={62} tier="bronze" />
                      : <IconHeart size={58} />}
              </div>
            </div>
          )}

          <p className="font-pixel text-center" style={{
            fontSize: 13, letterSpacing: 2.5, color: accent.hi,
            textShadow: `0 0 8px ${accent.glow}`,
          }}>{headline}</p>
          <p className="text-center" style={{ fontSize: 11, color: '#9A8AA8', maxWidth: 280 }}>
            {subline}
          </p>
        </div>

        {/* ── Prize ── */}
        <div className="w-full flex flex-col items-center gap-2" style={{
          maxWidth: 360,
          opacity: beat >= 3 ? 1 : 0,
          transform: beat >= 3 ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 260ms ease-out, transform 260ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          {awarded > 0 ? (
            <div className="w-full flex items-center justify-center gap-2.5 px-4 py-3 relative" style={{
              ...OBSIDIAN_BTN,
              border: `1.5px solid ${accent.hi}`,
              boxShadow: `0 0 16px ${accent.glow}, ${OBSIDIAN_BTN.boxShadow}`,
            }}>
              <Rivets inset={3} size={2} />
              <IconTrophyTier size={20} tier={tier ?? 'bronze'} />
              <span className="font-pixel" style={{
                fontSize: 15, color: accent.hi, textShadow: `0 0 6px ${accent.glow}`,
              }}>+{awarded}</span>
              <span className="font-pixel" style={{ fontSize: 7, letterSpacing: 1.5, color: '#9A8AA8' }}>
                {awarded === 1 ? 'TROPHY' : 'TROPHIES'}
              </span>
            </div>
          ) : (
            <p className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.5, color: '#6E6080' }}>
              NO TROPHY THIS TIME
            </p>
          )}

          {streak > 1 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1" style={{
              border: '1px solid rgba(255,107,61,0.5)',
              background: 'rgba(255,107,61,0.10)',
              borderRadius: 3,
            }}>
              <IconFire size={11} />
              <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.5, color: '#FF9A6B' }}>
                {streak} DAYS IN A ROW
                {streak % 3 === 0 ? ' — BONUS PAID' : ''}
              </span>
            </span>
          )}
        </div>

        {/* ── Today ── */}
        <div className="w-full flex flex-col gap-2.5" style={{
          maxWidth: 360,
          opacity: beat >= 4 ? 1 : 0,
          transform: beat >= 4 ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 300ms ease-out, transform 300ms cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div className="relative px-4 py-3" style={{
            ...OBSIDIAN_FACE,
            border: `1.5px solid ${todayTwist.tone}88`,
            boxShadow: `0 0 16px ${todayTwist.tone}33, 3px 3px 0 rgba(0,0,0,0.5)`,
          }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 2, color: '#6E6080' }}>
                TODAY&apos;S RULE
              </span>
              <div style={{ flex: 1, height: 1, background: `${todayTwist.tone}33` }} />
            </div>
            <p className="font-pixel" style={{
              fontSize: 11, letterSpacing: 2, color: todayTwist.tone,
              textShadow: `0 0 7px ${todayTwist.tone}66`, marginBottom: 4,
            }}>{todayTwist.name}</p>
            <p style={{ fontSize: 11, color: '#B4A8C4' }}>{todayTwist.blurb}</p>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => { playSound('ui_tap'); onClose(); router.push('/trophies') }}
              className="flex-1 px-3 py-3 flex items-center justify-center gap-2 relative active:translate-y-[1px] transition-transform"
              style={{
                ...OBSIDIAN_BTN,
                border: '1.5px solid #F5C842',
                boxShadow: '0 0 14px rgba(245,200,66,0.28), 3px 3px 0 rgba(0,0,0,0.55)',
              }}
            >
              <Rivets inset={3} size={2} />
              <IconShelf size={14} />
              <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, color: '#F5C842' }}>
                SHOP
              </span>
            </button>
            <button
              onClick={() => { playSound('ui_modal_close'); onClose() }}
              className="flex-1 px-3 py-3 active:translate-y-[1px] transition-transform"
              style={{ ...OBSIDIAN_BTN, border: `1px solid ${accentA(0.5)}` }}
            >
              <span className="font-pixel" style={{ fontSize: 8, letterSpacing: 1.5, color: '#D8CCE4' }}>
                LET&apos;S GO
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Plain <style> so the keyframe names stay un-hashed — inline
          `animation: '...'` references only resolve against global names. */}
      <style>{`
        @keyframes dvStars {
          from { background-position: 0 0, 22px 28px; }
          to   { background-position: 0 380px, 22px 408px; }
        }
        @keyframes dvDrop {
          0%   { opacity: 0; transform: translateY(-14px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dvStamp {
          0%   { opacity: 0; transform: scale(2.4) rotate(-14deg); }
          55%  { opacity: 1; transform: scale(0.88) rotate(3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes dvShock {
          0%   { opacity: 0.9; transform: scale(0.4); }
          100% { opacity: 0;   transform: scale(3.4); }
        }
        @keyframes dvCount {
          0%   { transform: translateY(6px); opacity: 0; }
          100% { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── One side of the board ────────────────────────────────────────────────────

function Podium({
  name, titleId, frameId, score, place, side, reveal, reduced,
}: {
  name: string
  titleId?: string | null
  frameId?: string | null
  score: number
  /** 1 first, 2 second, 0 a dead heat. Drives the block height. */
  place: 0 | 1 | 2
  side: { hi: string; mid: string; lo: string; rgb: string }
  reveal: boolean
  reduced: boolean
}) {
  const shown = useCountUp(score, reveal, reduced)
  const first = place === 1
  const height = place === 1 ? 74 : place === 2 ? 46 : 60

  return (
    <div className="flex flex-col items-center" style={{ width: 118 }}>
      {/* Crown reserves its space whether or not it is used, so the two
          columns keep the same baseline. */}
      <div style={{ height: 20 }}>
        {first && (
          <div style={{
            filter: 'drop-shadow(0 0 7px rgba(255,215,80,0.6))',
            animation: reduced ? undefined : 'dvDrop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <IconCrown size={18} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: 5 }}>
        <Nameplate name={name} titleId={titleId} frameId={frameId} size={6} tone={side.hi} />
      </div>

      {/* The block. Score sits ON it, the way a number sits on a podium. */}
      <div className="relative flex items-center justify-center" style={{
        width: 96,
        height,
        background: `linear-gradient(180deg, ${side.hi} 0%, ${side.mid} 34%, ${side.lo} 100%)`,
        borderLeft: '2px solid #14101C',
        borderRight: '2px solid #14101C',
        borderTop: '2px solid #14101C',
        boxShadow: first
          ? `0 0 18px rgba(${side.rgb},0.5), inset 0 2px 0 rgba(255,255,255,0.30), inset 0 -8px 14px rgba(0,0,0,0.35)`
          : `inset 0 2px 0 rgba(255,255,255,0.16), inset 0 -8px 14px rgba(0,0,0,0.4)`,
        opacity: reveal ? 1 : 0,
        transform: reveal ? 'scaleY(1)' : 'scaleY(0.06)',
        transformOrigin: 'bottom center',
        transition: reduced ? undefined : 'transform 640ms cubic-bezier(0.34,1.4,0.55,1), opacity 180ms',
      }}>
        {/* A sheen so the block reads as a solid object rather than a bar */}
        <span aria-hidden className="absolute inset-0" style={{
          background: 'linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.16) 50%, transparent 60%)',
        }} />
        <span className="font-pixel relative" style={{
          fontSize: 26, lineHeight: 1, color: '#FFFFFF',
          textShadow: '0 2px 0 rgba(0,0,0,0.45), 0 0 10px rgba(0,0,0,0.35)',
          animation: reduced || !reveal ? undefined : 'dvCount 0.3s ease-out both',
        }}>{shown}</span>
      </div>
    </div>
  )
}

/** Ticks a number up to `target` once `run` flips true. */
function useCountUp(target: number, run: boolean, reduced: boolean): number {
  const [n, setN] = useState(reduced ? target : 0)
  useEffect(() => {
    if (!run) return
    if (reduced || target <= 0) { setN(target); return }
    // Fixed total duration rather than a fixed per-step delay: a 3-point day
    // and a 30-point day should both take about half a second.
    const steps = Math.min(target, 30)
    const stepMs = 520 / steps
    let i = 0
    const id = setInterval(() => {
      i++
      setN(Math.round((i / steps) * target))
      if (i >= steps) clearInterval(id)
    }, stepMs)
    return () => clearInterval(id)
  }, [run, target, reduced])
  return n
}
