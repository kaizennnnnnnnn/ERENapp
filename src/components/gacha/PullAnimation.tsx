'use client'

import { useState, useEffect, useRef } from 'react'
import type { GachaPullResult } from '@/types'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'
import { swapCatName } from '@/lib/catWords'
import { M, MeadowIcon, PrimaryButton, Tag, TextButton, TYPE } from '@/components/meadow'
import { STARDUST_INK } from '@/components/rewards/rewardDisplay'
import { GACHA_REVEAL_THEMES } from '@/lib/gachaPresentation'
import GachaRewardStage from './GachaRewardStage'

interface Props {
  results: GachaPullResult[]
  onDone: () => void
  /** Skip the capsule-shake intro — for pulls whose opening already played (a cinematic or video). */
  skipCapsule?: boolean
  /** Which machine paid out: each has its own reveal sounds. */
  machine: 'food' | 'animal' | 'foodsuits' | 'creatures'
}

/** Each machine's reveal voice (see gacha_* in lib/sounds.ts). */
const REVEAL_VOICE = { food: 'fizz', animal: 'skin', foodsuits: 'suit', creatures: 'skin' } as const

export default function PullAnimation({ results, onDone, skipCapsule = false, machine }: Props) {
  const [phase, setPhase] = useState<'capsule' | 'reveal'>(skipCapsule ? 'reveal' : 'capsule')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showItem, setShowItem] = useState(skipCapsule)
  const cat = useCat()
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advancing = useRef(false)
  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }, [])

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

  useEffect(() => { if (!current) onDone() }, [current, onDone])
  if (!current) return null

  const rarity = current.item.rarity
  const itemName = swapCatName(current.item.name, cat)
  const multi = results.length > 1
  const last = currentIdx === results.length - 1

  function nextItem() {
    if (advancing.current) return
    advancing.current = true
    playSound('ui_tap')
    if (!last) {
      setShowItem(false)
      advanceTimer.current = setTimeout(() => {
        setCurrentIdx(i => i + 1)
        setShowItem(true)
        advancing.current = false
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
        <style>{`
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
    <div className="meadow-root fixed inset-0 z-[70] overflow-y-auto" style={{ background: GACHA_REVEAL_THEMES[machine].ground }}>
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
          <GachaRewardStage key={currentIdx} item={current.item} machine={machine} name={itemName} />

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

      <style>{`
        .pull-info { animation: pullInfo 0.25s ease-out both; }
        @keyframes pullInfo {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pull-info { animation: none; }
        }
      `}</style>
    </div>
  )
}
