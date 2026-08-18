'use client'

import { useState, useEffect } from 'react'
import type { GachaPullResult } from '@/types'
import { RARITY_COLORS } from '@/lib/gacha'
import { playSound } from '@/lib/sounds'
import { getSkin } from '@/lib/skins'
import SkinPodium from './SkinPodium'

interface Props {
  results: GachaPullResult[]
  onDone: () => void
  /** Skip the capsule-shake intro — for pulls whose opening already played (rainbow video). */
  skipCapsule?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// The non-skin reveal used to be a 79px picture inside a 90px pastel square:
// you pulled a legendary and got a thumbnail in a box. Skins already had
// SkinPodium doing the work, so cans, foods and donuts were the only drops
// that looked like a list item.
//
// They're presented now instead: the thing floats big over a fan of light,
// standing on a lit disc with a shadow under it. Nothing frames it — the
// object IS the frame, which is why it can afford to be twice the size.
//
// The spectacle tiers with rarity the same way SkinPodium's plinths do, so a
// common still reads as a common at a glance.
// ═══════════════════════════════════════════════════════════════════════════

// Sized to the ART, not to taste. Every food/can/donut PNG is a 128px canvas
// whose content is clamped to 124px (normalize_food_art.py MAX_SIDE), so 172px
// was a 1.34x upscale and the cans visibly went soft. 136 renders the content
// at ~132px — a 1.06x upscale nobody can see — and is still 72% bigger than the
// 79px box this replaced. Going bigger needs 2x source art, which exists for
// only two of the ten cans.
const ITEM_PX = 136

interface RevealTier {
  /** Rays behind the item. Commons don't get them. */
  rays: boolean
  /** Fixed sparkle positions — [left%, top%]. Never random: this re-renders. */
  sparks: readonly (readonly [number, number])[]
  /** How wide the light pool behind the item spreads. */
  pool: number
}

const REVEAL: Record<GachaPullResult['item']['rarity'], RevealTier> = {
  common: { rays: false, pool: 200, sparks: [] },
  rare: {
    rays: true, pool: 240,
    sparks: [[14, 24], [82, 18], [8, 62], [88, 56], [50, 8], [30, 84]],
  },
  epic: {
    rays: true, pool: 270,
    sparks: [[10, 20], [86, 14], [4, 56], [92, 50], [48, 6], [18, 78],
             [82, 74], [54, 88], [34, 34], [68, 30]],
  },
  legendary: {
    rays: true, pool: 300,
    sparks: [[8, 14], [88, 10], [2, 48], [94, 44], [50, 2], [14, 74],
             [88, 70], [50, 92], [26, 32], [76, 28], [38, 62], [66, 58],
             [20, 46], [84, 42], [44, 20], [58, 20]],
  },
}

export default function PullAnimation({ results, onDone, skipCapsule = false }: Props) {
  const [phase, setPhase] = useState<'capsule' | 'reveal' | 'done'>(skipCapsule ? 'reveal' : 'capsule')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showItem, setShowItem] = useState(skipCapsule)

  useEffect(() => {
    if (skipCapsule) return
    // Capsule shake, then reveal
    const t = setTimeout(() => { setPhase('reveal'); setShowItem(true) }, 1200)
    return () => clearTimeout(t)
  }, [skipCapsule])

  const current = results[currentIdx]

  // Rarity-tiered reveal stinger — fires every time a new item is shown,
  // including the second-and-later items in a 10-pull. Falls back to
  // ui_notification_ping for tiers whose files haven't been generated yet.
  useEffect(() => {
    if (!showItem || !current) return
    const map = {
      common:    'gacha_reveal_common',
      rare:      'gacha_reveal_rare',
      epic:      'gacha_reveal_epic',
      legendary: 'gacha_reveal_legendary',
    } as const
    playSound(map[current.item.rarity])
  }, [showItem, current?.item.rarity]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) { onDone(); return null }

  const colors  = RARITY_COLORS[current.item.rarity]
  const tier    = REVEAL[current.item.rarity]
  const skinDef = current.item.skinId ? getSkin(current.item.skinId) : undefined

  function nextItem() {
    if (currentIdx < results.length - 1) {
      setShowItem(false)
      setTimeout(() => {
        setCurrentIdx(i => i + 1)
        setShowItem(true)
      }, 200)
    } else {
      onDone()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>

      {/* Capsule phase */}
      {phase === 'capsule' && (
        <div className="flex flex-col items-center gap-4">
          <div style={{
            width: 80, height: 100, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
            background: `linear-gradient(135deg, ${colors.bg}, white)`,
            border: `3px solid ${colors.border}`,
            boxShadow: `0 0 30px ${colors.glow}, 0 0 60px ${colors.glow}`,
            animation: 'capsuleShake 0.15s ease-in-out infinite',
          }} />
          <p className="font-pixel text-white/60" style={{ fontSize: 7 }}>OPENING...</p>
        </div>
      )}

      {/* Reveal phase */}
      {phase === 'reveal' && showItem && (
        <button onClick={() => { playSound('ui_tap'); nextItem() }}
          className={`flex flex-col items-center active:scale-95 transition-transform w-full ${skinDef ? 'gap-3 max-w-sm px-3' : 'gap-4 max-w-xs px-6'}`}>
          {/* Skin podium or standard rarity sticker */}
          {skinDef ? (
            <div style={{ animation: 'itemBounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
              <SkinPodium skin={skinDef} rarity={current.item.rarity} />
            </div>
          ) : (
            <div className="relative flex items-center justify-center"
              style={{ width: ITEM_PX + 40, height: ITEM_PX + 56 }}>

              {/* Fan of light. Rare and up only — a common with rays behind it
                  is a common pretending. */}
              {tier.rays && (
                <div className="pullRays absolute pointer-events-none" style={{
                  width: tier.pool, height: tier.pool,
                  background: `repeating-conic-gradient(from 0deg, ${colors.glow} 0deg 4deg, transparent 4deg 14deg)`,
                  WebkitMaskImage: 'radial-gradient(closest-side, #000 12%, transparent 72%)',
                  maskImage: 'radial-gradient(closest-side, #000 12%, transparent 72%)',
                }} />
              )}

              {/* The pool it stands in. */}
              <div className="pullPool absolute rounded-full pointer-events-none" style={{
                width: tier.pool * 0.78, height: tier.pool * 0.78,
                background: `radial-gradient(circle, ${colors.glow} 0%, transparent 68%)`,
              }} />

              {tier.sparks.map(([l, t], i) => (
                <span key={i} className="pullSpark absolute pointer-events-none" style={{
                  left: `${l}%`, top: `${t}%`,
                  width: 5, height: 5, background: '#FFFFFF',
                  boxShadow: `0 0 7px ${colors.border}`,
                  transform: 'rotate(45deg)',
                  animationDelay: `${(i % 6) * 0.28}s`,
                }} />
              ))}

              {/* The prize itself — no box. It carries its own shadow so it
                  reads as an object sitting in light, not a sticker. */}
              <img src={current.item.image} alt={current.item.name} draggable={false}
                className="relative"
                style={{
                  width: ITEM_PX, height: ITEM_PX, objectFit: 'contain',
                  imageRendering: 'auto',
                  marginBottom: 14,
                  filter: `drop-shadow(0 6px 10px rgba(0,0,0,0.55)) drop-shadow(0 0 16px ${colors.glow})`,
                  animation: 'itemBounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                }} />

              {/* Pedestal — a lit disc plus the shadow the item casts onto it.
                  Two ellipses is all it takes to put a floating cut-out on the
                  ground. */}
              <div className="absolute pointer-events-none" style={{
                bottom: 22, left: '50%', transform: 'translateX(-50%)',
                width: ITEM_PX * 0.62, height: 13, borderRadius: '50%',
                background: `radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 72%)`,
              }} />
              <div className="pullDisc absolute pointer-events-none" style={{
                bottom: 12, left: '50%', transform: 'translateX(-50%)',
                width: ITEM_PX * 0.86, height: 18, borderRadius: '50%',
                background: `radial-gradient(ellipse at 50% 30%, ${colors.border} 0%, ${colors.glow} 45%, transparent 74%)`,
              }} />
            </div>
          )}

          {/* Item info */}
          <div className="text-center" style={{ animation: 'fadeUp 0.4s ease-out 0.2s both' }}>
            {current.isNew && (
              <span className="font-pixel px-2 py-0.5 mb-2 inline-block" style={{
                fontSize: 7, color: '#FBBF24', background: 'rgba(251,191,36,0.15)',
                borderRadius: 4, border: '1px solid rgba(251,191,36,0.4)',
              }}>NEW!</span>
            )}
            <p className="font-pixel text-white mb-1.5" style={{
              fontSize: 12, lineHeight: 1.4, letterSpacing: 0.5,
              textShadow: `0 0 14px ${colors.glow}, 0 2px 0 rgba(0,0,0,0.6)`,
            }}>
              {current.item.name}
            </p>
            {/* Rarity as a plate rather than a loose word — it's the number you
                actually pulled for, and pastel text on black was the weakest
                thing on the screen. */}
            <span className="font-pixel inline-flex items-center gap-1.5 mb-2" style={{
              fontSize: 7, letterSpacing: 1.5,
              padding: '4px 9px', borderRadius: 4,
              color: colors.border,
              background: `${colors.border}22`,
              border: `1px solid ${colors.border}`,
              boxShadow: `0 0 12px ${colors.glow}`,
            }}>
              <span style={{ width: 4, height: 4, background: colors.border, transform: 'rotate(45deg)' }} />
              {current.item.rarity.toUpperCase()}
              <span style={{ width: 4, height: 4, background: colors.border, transform: 'rotate(45deg)' }} />
            </span>
            <p className="text-xs text-white/55" style={{ lineHeight: 1.45 }}>{current.item.description}</p>

            {current.stardustGained > 0 && (
              <div className="flex flex-col items-center mt-2 gap-0.5">
                <span className="font-pixel" style={{ fontSize: 5, color: 'rgba(255,255,255,0.35)', letterSpacing: 2 }}>DUPLICATE</span>
                <span className="pull-stardust-rainbow font-pixel" style={{ fontSize: 9 }}>
                  ✦ +{current.stardustGained} STARDUST ✦
                </span>
              </div>
            )}
            {current.isPity && (
              <p className="font-pixel text-amber-300 mt-1" style={{ fontSize: 6 }}>PITY BONUS!</p>
            )}
          </div>

          {/* Counter */}
          {results.length > 1 && (
            <p className="font-pixel text-white/40" style={{ fontSize: 6 }}>
              {currentIdx + 1} / {results.length} — TAP TO CONTINUE
            </p>
          )}
          {results.length === 1 && (
            <p className="font-pixel text-white/40" style={{ fontSize: 6 }}>TAP TO CLOSE</p>
          )}
        </button>
      )}

      {/* Skip button for multi-pull */}
      {phase === 'reveal' && results.length > 1 && currentIdx < results.length - 1 && (
        <button onClick={() => { playSound('ui_modal_close'); onDone() }}
          className="absolute bottom-8 font-pixel text-white/30 active:text-white/60"
          style={{ fontSize: 6 }}>
          SKIP ALL
        </button>
      )}

      <style jsx>{`
        /* Slow enough to read as light rather than a spinning wheel. */
        .pullRays { animation: pullRaySpin 24s linear infinite; }
        @keyframes pullRaySpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .pullPool { animation: pullPoolBreathe 2s ease-in-out infinite; }
        @keyframes pullPoolBreathe {
          0%, 100% { opacity: 0.65; transform: scale(0.94); }
          50%      { opacity: 1;    transform: scale(1.06); }
        }
        /* Winks on and off — a spark is lit or it isn't. Lit for ~38% of the
           cycle: at 24% a six-spark rare had barely one alight at any instant
           and the whole tier read as unsparkled. */
        .pullSpark { animation: pullSparkle 1.7s steps(1, end) infinite; }
        @keyframes pullSparkle {
          0%, 38%   { opacity: 0; transform: rotate(45deg) scale(0.3); }
          44%, 76%  { opacity: 1; transform: rotate(45deg) scale(1); }
          82%, 100% { opacity: 0; transform: rotate(45deg) scale(0.3); }
        }
        .pullDisc { animation: pullDiscBreathe 2s ease-in-out infinite; }
        @keyframes pullDiscBreathe {
          0%, 100% { opacity: 0.75; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pullRays, .pullPool, .pullSpark, .pullDisc { animation: none; }
        }
        @keyframes capsuleShake {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes itemBounceIn {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pull-stardust-rainbow {
          background: linear-gradient(90deg,
            #ff6b6b 0%, #ffb347 16%, #fff700 33%,
            #87ff57 50%, #57c8ff 66%, #c87cff 83%, #ff6b6b 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: pullStardustFlow 1.8s linear infinite;
        }
        @keyframes pullStardustFlow {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  )
}
