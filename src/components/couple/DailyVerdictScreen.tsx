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
//   2 strike     the trophy stamps in with a shockwave
//   3 prize      the trophy count and any streak bonus
//   4 today      tomorrow's — now today's — twist, and the way out
//
// A reduced-motion viewer gets every beat at once, no counting, no stamp.
//
// In the Meadow look: a flat ground that says how the day went (warm for a
// win, cool for a draw, rose when the other one took it), white cards, and
// each person's podium in their own household colour (profiles.heart). The
// trophy cups and any prestige plates someone bought stay the art they are.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import type { DailyBattleRow } from '@/lib/battleResults'
import { TROPHY_TONE, TROPHY_LABEL, type TwistDef, type TwistId, type TrophyTier } from '@/lib/dailyTwist'
import { IconSwords } from '@/components/PixelIcons'
import { prestigeDef } from '@/lib/trophyShop'
import { FramePlate, TitlePlate } from '@/components/trophies/prestigeArt'
import TrophyCup from '@/components/trophies/TrophyCup'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { playSound } from '@/lib/sounds'
import { inkOn } from '@/lib/contrastInk'
import {
  Card, IconTile, MeadowIcon, PrimaryButton, SecondaryButton, Tag,
  GROUND, M, PERSON, TINT, TYPE, personColor, type MeadowIconName,
} from '@/components/meadow'

type Heart = 'brown_heart' | 'pink_heart' | 'sparkle'

interface Props {
  row: DailyBattleRow
  awarded: number
  streak: number
  yesterdayTwist: TwistDef
  todayTwist: TwistDef
  myName: string
  partnerName: string
  /** Each side's household colour (profiles.heart). A household of one plays
   *  the cat, 'sparkle'. Missing on the partner: the other of the two. */
  myHeart?: Heart | null
  partnerHeart?: Heart | null
  /** Prestige each side is wearing, if any (Trophy Shop). */
  myTitle?: string | null
  myFrame?: string | null
  partnerTitle?: string | null
  partnerFrame?: string | null
  onClose(): void
}

/** Beat timings, ms after mount. */
const BEAT = [0, 380, 1150, 1850, 2500]

/** Each twist's icon and tint, for the rule chip and the rule card. `color`
 *  recolours an icon whose own colour would say the wrong thing (the plus is
 *  drawn leaf green, "add"; on nurse day it is a red cross). */
const TWIST_LOOK: Record<TwistId, { icon: MeadowIconName; tint: string; color?: string }> = {
  bath_day:   { icon: 'drop',    tint: TINT.sky },
  feast:      { icon: 'bowl',    tint: TINT.orange },
  playday:    { icon: 'paw',     tint: TINT.love },
  nap_day:    { icon: 'moon',    tint: TINT.lilac },
  nurse:      { icon: 'plus',    tint: TINT.danger, color: M.danger },
  double:     { icon: 'sparkle', tint: TINT.amber },
  full_house: { icon: 'star',    tint: TINT.amber },
  sprint:     { icon: 'bolt',    tint: TINT.orange },
}

/** "NURSE DAY" -> "Nurse day": the twist names are written for the pixel HUD. */
function sentence(caps: string): string {
  return caps.charAt(0) + caps.slice(1).toLowerCase()
}

export default function DailyVerdictScreen({
  row, awarded, streak, yesterdayTwist, todayTwist, myName, partnerName,
  myHeart, partnerHeart, myTitle, myFrame, partnerTitle, partnerFrame, onClose,
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

  const myColor = personColor(myHeart)
  const partnerColor = partnerHeart
    ? personColor(partnerHeart)
    : myHeart === 'brown_heart' ? PERSON.pink : PERSON.brown

  // The ground says how it went; the shockwave ring is the trophy's metal.
  const ground = won ? GROUND.me : tied ? GROUND.settings : GROUND.us
  const ring = won ? (tier ? TROPHY_TONE[tier] : M.coin) : tied ? M.faint : M.love

  const dateLabel = useMemo(() => {
    try { return format(parseISO(row.date), 'EEEE d MMMM') }
    catch { return row.date }
  }, [row.date])

  const headline = won
    ? (tier ? `${sentence(TROPHY_LABEL[tier])} day` : 'You won')
    : tied ? 'Dead even' : `${partnerName} took it`

  const subline = won
    ? `You took yesterday off ${partnerName}.`
    : tied
      ? `Neither of you gave an inch.`
      : awarded > 0
        ? 'Lost by a whisker. Here, take something.'
        : 'Today is a fresh board.'

  const yesterdayLook = TWIST_LOOK[yesterdayTwist.id]
  const todayLook = TWIST_LOOK[todayTwist.id]

  return (
    <div role="dialog" aria-modal="true" aria-label="Yesterday's result"
      className="meadow-root fixed inset-0 z-[130] flex flex-col overflow-hidden"
      style={{ background: ground, color: M.text }}>

      {/* Scrolls when a short phone can't hold it all; auto margins centre it
          when it can. */}
      <div className="relative flex-1 flex flex-col overflow-y-auto" style={{
        padding: 'calc(var(--safe-top) + 20px) 16px calc(20px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div className="w-full flex flex-col items-center" style={{ maxWidth: 360, margin: 'auto', gap: 14 }}>

          {/* ── Header ── */}
          <div className="flex flex-col items-center" style={{
            gap: 2,
            animation: reduced ? undefined : 'dvDrop 0.44s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <span style={{ ...TYPE.label, color: M.label }}>Yesterday</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: M.text2 }}>{dateLabel}</span>
          </div>

          {/* ── Scoreboard ── */}
          <Card padding="16px 14px 16px" style={{
            width: '100%',
            animation: reduced ? undefined : 'dvDrop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            {/* The two blocks stand on one floor, so first and second place
                read at a glance without having to compare two numbers. Height
                is rank, not score — a 14-5 and a 40-31 should look the same
                shape, because they are the same result. */}
            <div className="relative flex items-end justify-center" style={{ gap: 14, paddingBottom: 4 }}>
              <Podium
                name={myName} titleId={myTitle} frameId={myFrame}
                score={row.score} place={won ? 1 : tied ? 0 : 2}
                color={myColor} reveal={beat >= 1} reduced={reduced}
              />
              <Podium
                name={partnerName} titleId={partnerTitle} frameId={partnerFrame}
                score={row.partner_score}
                place={row.outcome === 'loss' ? 1 : tied ? 0 : 2}
                color={partnerColor} reveal={beat >= 1} reduced={reduced}
              />
              {/* The floor both blocks stand on. */}
              <div aria-hidden className="absolute" style={{
                left: 6, right: 6, bottom: 0, height: 4, borderRadius: 999, background: M.hairline,
              }} />
            </div>

            {/* Yesterday's rule, so the score makes sense */}
            <div className="flex justify-center" style={{ marginTop: 14 }}>
              <span className="inline-flex items-center" style={{
                gap: 8, maxWidth: '100%', boxSizing: 'border-box', padding: '6px 12px 6px 8px',
                borderRadius: 999, background: yesterdayLook.tint,
              }}>
                <MeadowIcon name={yesterdayLook.icon} size={16} color={yesterdayLook.color} />
                <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>{sentence(yesterdayTwist.name)}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: M.text2 }}>{yesterdayTwist.blurb}</span>
              </span>
            </div>
          </Card>

          {/* ── The strike ── */}
          <div className="flex flex-col items-center" style={{
            gap: 4, minHeight: 150,
            opacity: beat >= 2 ? 1 : 0,
            transition: 'opacity 180ms ease-out',
          }}>
            {beat >= 2 && (
              <div className="relative flex items-center justify-center" style={{ width: 96, height: 90 }}>
                {/* Shockwave — one ring, once. A repeating pulse would turn a
                    moment into wallpaper. */}
                {!reduced && (
                  <span aria-hidden className="absolute" style={{
                    width: 44, height: 44, borderRadius: '50%',
                    border: `3px solid ${ring}`,
                    animation: 'dvShock 0.72s cubic-bezier(0.16,1,0.3,1) both',
                  }} />
                )}
                <div style={{ animation: reduced ? undefined : 'dvStamp 0.5s cubic-bezier(0.34,1.7,0.5,1) both' }}>
                  {won && tier
                    ? <TrophyCup size={86} tier={tier} sparkle={tier === 'gold'} />
                    : tied
                      ? <IconSwords size={62} />
                      : awarded > 0
                        ? <TrophyCup size={66} tier="bronze" />
                        : <MeadowIcon name="heart" size={60} />}
                </div>
              </div>
            )}

            <p style={{
              ...TYPE.title, margin: 0, textAlign: 'center', color: M.text,
              // A solo player's other podium is the cat, named up to 24 letters.
              maxWidth: '100%', overflowWrap: 'anywhere',
            }}>{headline}</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: M.text2, textAlign: 'center', maxWidth: 280 }}>
              {subline}
            </p>
          </div>

          {/* ── Prize ── */}
          <div className="w-full flex flex-col items-center" style={{
            gap: 10,
            opacity: beat >= 3 ? 1 : 0,
            transform: beat >= 3 ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 260ms ease-out, transform 260ms cubic-bezier(0.16,1,0.3,1)',
          }}>
            {awarded > 0 ? (
              <Card padding="12px 18px" style={{ width: '100%' }}>
                <div className="flex items-center justify-center" style={{ gap: 10 }}>
                  <TrophyCup size={30} tier={tier ?? 'bronze'} shine={false} />
                  <span style={{ fontSize: 26, color: M.text, ...TYPE.number }}>+{awarded}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: M.text2 }}>
                    {awarded === 1 ? 'trophy' : 'trophies'}
                  </span>
                </div>
              </Card>
            ) : (
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: M.text2 }}>No trophy this time</p>
            )}

            {streak > 1 && (
              <Tag tone="amber" icon={<MeadowIcon name="flame" size={16} />}>
                {streak} days in a row{streak % 3 === 0 ? ' · bonus paid' : ''}
              </Tag>
            )}
          </div>

          {/* ── Today ── */}
          <div className="w-full flex flex-col" style={{
            gap: 12,
            opacity: beat >= 4 ? 1 : 0,
            transform: beat >= 4 ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 300ms ease-out, transform 300ms cubic-bezier(0.16,1,0.3,1)',
          }}>
            <Card padding="14px 18px 16px" style={{ width: '100%' }}>
              <div style={{ ...TYPE.label, color: M.label, marginBottom: 10 }}>Today&apos;s rule</div>
              <div className="flex items-center" style={{ gap: 14 }}>
                <IconTile icon={todayLook.icon} size={48} bg={todayLook.tint} iconSize={28} color={todayLook.color} />
                <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{sentence(todayTwist.name)}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.35, fontWeight: 500, color: M.text2 }}>{todayTwist.blurb}</span>
                </div>
              </div>
            </Card>

            <div className="flex" style={{ gap: 12 }}>
              <SecondaryButton size="md" full style={{ flex: '1 1 0' }}
                icon={<MeadowIcon name="trophy" size={20} />}
                onClick={() => { playSound('ui_tap'); onClose(); router.push('/trophies') }}>
                Shop
              </SecondaryButton>
              <PrimaryButton size="md" full style={{ flex: '1 1 0' }}
                onClick={() => { playSound('ui_modal_close'); onClose() }}>
                Let&apos;s go
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>

      {/* Plain <style> so the keyframe names stay un-hashed — inline
          `animation: '...'` references only resolve against global names. */}
      <style>{`
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

// ── A name on the podium ─────────────────────────────────────────────────────
// Plain Meadow text, unless its owner bought prestige in the Trophy Shop: a
// frame replaces the name with its plate, a title hangs under it. Those keep
// the shop's own art — what you buy is exactly what you saw.

function PodiumName({ name, titleId, frameId }: { name: string; titleId?: string | null; frameId?: string | null }) {
  const title = prestigeDef(titleId)
  const frame = prestigeDef(frameId)
  return (
    <span className="inline-flex flex-col items-center" style={{ gap: 4, maxWidth: '100%' }}>
      {frame?.slot === 'frame' ? (
        <FramePlate tone={frame.value} name={name} scale={6} />
      ) : (
        <span style={{
          fontSize: 15, fontWeight: 800, color: M.text, whiteSpace: 'nowrap',
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</span>
      )}
      {title?.slot === 'title' && (
        <TitlePlate value={title.value} focus={title.focus} scale={5} glory={title.rarity === 'legendary'} />
      )}
    </span>
  )
}

// ── One side of the board ────────────────────────────────────────────────────

function Podium({
  name, titleId, frameId, score, place, color, reveal, reduced,
}: {
  name: string
  titleId?: string | null
  frameId?: string | null
  score: number
  /** 1 first, 2 second, 0 a dead heat. Drives the block height. */
  place: 0 | 1 | 2
  /** The person's household colour. */
  color: string
  reveal: boolean
  reduced: boolean
}) {
  const shown = useCountUp(score, reveal, reduced)
  const first = place === 1
  const height = place === 1 ? 92 : place === 2 ? 58 : 76

  return (
    <div className="flex flex-col items-center" style={{ width: 128, minWidth: 0 }}>
      {/* Crown reserves its space whether or not it is used, so the two
          columns keep the same baseline. */}
      <div style={{ height: 28 }}>
        {first && (
          <div style={{ animation: reduced ? undefined : 'dvDrop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <MeadowIcon name="crown" size={24} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: 8, maxWidth: '100%' }}>
        <PodiumName name={name} titleId={titleId} frameId={frameId} />
      </div>

      {/* The block. Score sits ON it, the way a number sits on a podium. */}
      <div className="relative flex items-center justify-center" style={{
        width: 100,
        height,
        background: color,
        borderRadius: '16px 16px 0 0',
        opacity: reveal ? 1 : 0,
        transform: reveal ? 'scaleY(1)' : 'scaleY(0.06)',
        transformOrigin: 'bottom center',
        transition: reduced ? undefined : 'transform 640ms cubic-bezier(0.34,1.4,0.55,1), opacity 180ms',
      }}>
        <span className="relative" style={{
          fontSize: 34, lineHeight: 1, color: inkOn(color), ...TYPE.number,
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
