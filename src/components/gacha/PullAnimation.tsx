'use client'

import { useState, useEffect } from 'react'
import type { GachaPullResult, GachaRarity } from '@/types'
import { GACHA_FOOD_GRANT } from '@/lib/gacha'
import { playSound } from '@/lib/sounds'
import { getSkin } from '@/lib/skins'
import { useCat } from '@/hooks/useCat'
import { swapCatName } from '@/lib/catWords'
import BlinkingEren from '@/components/BlinkingEren'
import CanFx, { hasCanFx } from '@/components/care/CanFx'
import { M, MeadowIcon, PrimaryButton, RARITY_TAG, Stage, Tag, TextButton, TYPE } from '@/components/meadow'
import { STARDUST_INK } from '@/components/rewards/rewardDisplay'
import { RARITY_FILL } from './rarity'

interface Props {
  results: GachaPullResult[]
  onDone: () => void
  /** Skip the capsule-shake intro — for pulls whose opening already played (a cinematic or video). */
  skipCapsule?: boolean
  /** Which machine paid out: each has its own reveal sounds. */
  machine: 'food' | 'animal' | 'foodsuits'
}

/** Each machine's reveal voice (see gacha_* in lib/sounds.ts). */
const REVEAL_VOICE = { food: 'fizz', animal: 'skin', foodsuits: 'suit' } as const

// ═══════════════════════════════════════════════════════════════════════════
// THE REVEAL, in Meadow. What you pulled stands on the Meadow stage, the cat's
// own little hill, on a page in its rarity's tint: a cat in a costume stands
// on the hill like everywhere else he appears, a can or a donut sits on it.
// Then its tags, its name and what it does, and one button on to the next.
//
// The spectacle still tiers with rarity, in Meadow's flat way: a common gets
// the plain stage, a rare a few sparkles that wink on and off, an epic more,
// and an epic or a legendary a slow fan of flat rays behind it. No glows.
// ═══════════════════════════════════════════════════════════════════════════

const STAGE_W = 300
const STAGE_H = 300

/** The page behind the stage: the rarity's tag tint, full bleed. */
const GROUND: Record<GachaRarity, string> = {
  common: RARITY_TAG.common.bg,
  rare: RARITY_TAG.rare.bg,
  epic: RARITY_TAG.epic.bg,
  legendary: RARITY_TAG.legendary.bg,
}

/** Sparkles on the stage, [left px, top px]. Fixed, never random: this re-renders. */
const SPARKS: Record<GachaRarity, ReadonlyArray<readonly [number, number]>> = {
  common: [],
  rare: [[34, 46], [238, 64], [252, 168]],
  epic: [[30, 40], [244, 52], [22, 150], [258, 160], [138, 22]],
  legendary: [[26, 34], [246, 40], [16, 136], [264, 140], [136, 14], [70, 96], [208, 100]],
}

export default function PullAnimation({ results, onDone, skipCapsule = false, machine }: Props) {
  const [phase, setPhase] = useState<'capsule' | 'reveal'>(skipCapsule ? 'reveal' : 'capsule')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showItem, setShowItem] = useState(skipCapsule)
  const cat = useCat()

  useEffect(() => {
    if (skipCapsule) return
    // Capsule shake, then reveal
    const t = setTimeout(() => { setPhase('reveal'); setShowItem(true) }, 1200)
    return () => clearTimeout(t)
  }, [skipCapsule])

  const current = results[currentIdx]

  // Rarity-tiered reveal stinger in this machine's own voice — fires every
  // time a new item is shown, including the second-and-later items in a
  // 10-pull.
  useEffect(() => {
    if (!showItem || !current) return
    playSound(`gacha_${REVEAL_VOICE[machine]}_${current.item.rarity}`)
  }, [showItem, current?.item.rarity]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) { onDone(); return null }

  const rarity = current.item.rarity
  const skin = current.item.skinId ? getSkin(current.item.skinId) : undefined
  const itemName = swapCatName(current.item.name, cat)
  // A special-edition can brings its moving sparkles/rays (see CanFx). Found
  // through the fridge food the pull grants, never by matching the image URL.
  const fxFood = GACHA_FOOD_GRANT[current.item.id]
  const canFx = fxFood !== undefined && hasCanFx(fxFood) ? fxFood : null
  const multi = results.length > 1
  const last = currentIdx === results.length - 1

  function nextItem() {
    playSound('ui_tap')
    if (!last) {
      setShowItem(false)
      setTimeout(() => {
        setCurrentIdx(i => i + 1)
        setShowItem(true)
      }, 200)
    } else {
      onDone()
    }
  }

  // ── Capsule: the pull with no cinematic of its own, shaking open ──
  if (phase === 'capsule') {
    return (
      <div className="meadow-root fixed inset-0 z-[70] flex flex-col items-center justify-center" style={{ background: M.soft, gap: 20 }}>
        <span aria-hidden className="pull-capsule" style={{
          width: 96, height: 96, borderRadius: 999, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: `0 4px 0 ${M.softLip}`,
        }}>
          <span style={{ flex: 1, background: '#FFFFFF' }} />
          <span style={{ height: 6, background: M.text }} />
          <span style={{ flex: 1, background: STARDUST_INK }} />
        </span>
        <p role="status" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: M.text }}>Opening...</p>
        <style jsx>{`
          .pull-capsule { animation: pullCapsuleShake 0.3s steps(2, jump-none) infinite; }
          @keyframes pullCapsuleShake {
            0%   { transform: rotate(-6deg); }
            100% { transform: rotate(6deg); }
          }
          @media (prefers-reduced-motion: reduce) { .pull-capsule { animation: none; } }
        `}</style>
      </div>
    )
  }

  return (
    <div className="meadow-root fixed inset-0 z-[70] overflow-y-auto" style={{ background: GROUND[rarity] }}>
      <div className="flex flex-col mx-auto" style={{
        minHeight: '100%', maxWidth: 420, boxSizing: 'border-box',
        padding: 'calc(var(--safe-top) + 12px) 16px calc(var(--safe-bottom) + 20px)',
      }}>
        {/* ── Where you are in a ten, and the way out of it ── */}
        <div className="flex items-center justify-between" style={{ height: 44 }}>
          {multi ? (
            <span style={{ fontSize: 15, fontWeight: 800, color: M.text2, fontVariantNumeric: 'tabular-nums', paddingLeft: 4 }}>
              {currentIdx + 1} of {results.length}
            </span>
          ) : <span />}
          {multi && !last && (
            <TextButton tone="muted" onClick={() => { playSound('ui_modal_close'); onDone() }}>Skip all</TextButton>
          )}
        </div>

        {/* ── The prize. A tap anywhere here moves on too, as it always has. ── */}
        <div className="flex-1 flex flex-col items-center justify-center" onClick={nextItem}
          style={{ paddingTop: 8, cursor: 'pointer', visibility: showItem ? 'visible' : 'hidden' }}>
          <Stage width={STAGE_W} height={STAGE_H} bg="#FFFFFF" key={currentIdx}>
            {(rarity === 'epic' || rarity === 'legendary') && (
              <span aria-hidden className="pull-rays" style={{
                position: 'absolute', left: STAGE_W / 2 - 260, top: 150 - 260, width: 520, height: 520, borderRadius: 999,
                background: `repeating-conic-gradient(from 0deg, ${RARITY_FILL[rarity]}40 0deg 9deg, transparent 9deg 22deg)`,
              }} />
            )}
            {SPARKS[rarity].map(([l, t], i) => (
              <span key={i} aria-hidden className="pull-spark" style={{ position: 'absolute', left: l, top: t, animationDelay: `${(i % 4) * 0.35}s` }}>
                <MeadowIcon name="sparkle" size={rarity === 'legendary' ? 26 : 22} color={RARITY_FILL[rarity]} mono />
              </span>
            ))}

            {skin ? (
              // Gacha skins are trimmed tight, so the box's bottom is the cat's
              // feet: set it on the darker patch of the hill.
              <div className="pull-pop" style={{ position: 'absolute', left: (STAGE_W - 200) / 2, bottom: 24 }}>
                <BlinkingEren size={200} src={skin.src} tailSrc={skin.tailSrc} tailOrigin={skin.tailOrigin}
                  lidTone={skin.lidTone} coat={skin.coat} eyes={skin.eyes} alt={itemName} />
              </div>
            ) : (
              <div className="pull-pop" style={{ position: 'absolute', left: (STAGE_W - 150) / 2, bottom: 26, width: 150, height: 150 }}>
                <img src={current.item.image} alt={itemName} draggable={false}
                  style={{ width: 150, height: 150, objectFit: 'contain' }} />
                {canFx && <CanFx id={canFx} />}
              </div>
            )}
          </Stage>

          <div className="pull-info flex flex-col items-center" style={{ marginTop: 18, maxWidth: 320, textAlign: 'center' }}>
            <div className="flex items-center justify-center flex-wrap" style={{ gap: 6 }}>
              {/* White, not its tint: the page behind it is already the tint. */}
              <Tag tone={rarity} caps style={{ background: '#FFFFFF' }}>{rarity}</Tag>
              {current.isNew && <Tag tone="love">New</Tag>}
              {current.isPity && <Tag tone="amber" icon={<MeadowIcon name="star" size={16} />}>Guaranteed</Tag>}
            </div>
            <h2 style={{ ...TYPE.heading, margin: '12px 0 0', color: M.text, overflowWrap: 'anywhere' }}>{itemName}</h2>
            <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
              {cat.t(current.item.description)}
            </p>
            {current.stardustGained > 0 && (
              <span className="inline-flex items-center" style={{
                marginTop: 12, height: 36, padding: '0 14px 0 10px', gap: 6, borderRadius: 999,
                background: '#FFFFFF', fontSize: 14, fontWeight: 800, color: M.text,
              }}>
                <MeadowIcon name="sparkle" size={20} color={STARDUST_INK} />
                Already yours: +{current.stardustGained} stardust
              </span>
            )}
          </div>
        </div>

        <PrimaryButton onClick={nextItem} style={{ marginTop: 20 }}>
          {last ? 'Done' : 'Next'}
        </PrimaryButton>
      </div>

      <style jsx>{`
        /* Slow enough to read as light, not as a spinning wheel. */
        .pull-rays { animation: pullRaySpin 40s linear infinite; }
        @keyframes pullRaySpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* A spark is lit or it isn't: snap on, hold, snap off. */
        .pull-spark { animation: pullSpark 1.6s steps(1, end) infinite; }
        @keyframes pullSpark {
          0%, 40%   { opacity: 0; }
          45%, 80%  { opacity: 1; }
          85%, 100% { opacity: 0; }
        }
        .pull-pop { animation: pullPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @keyframes pullPop {
          0%   { transform: translateY(18px) scale(0.6); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .pull-info { animation: pullInfo 0.3s steps(3, end) 0.15s both; }
        @keyframes pullInfo {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pull-rays, .pull-spark, .pull-pop, .pull-info { animation: none; }
        }
      `}</style>
    </div>
  )
}
