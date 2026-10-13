'use client'

// ─── The daily fortune ───────────────────────────────────────────────────────
// Once a calendar day the cat has a gift for you. A Meadow card over the room:
// today's cat (a different cheerful SketchEren each day) behind the pixel gift
// box on a warm stage, "Daily fortune", and the one leaf button to open it.
// The box rattles while the claim runs, its lid flies off in a burst of
// sparkles, and the gift comes up on its rarity's tint with the leaf button
// to collect it. Already opened today, the card says when the next one comes.
//
// The box and its animation stay pixel art: they are the gift, not the frame.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FortuneGiftDef } from '@/types'
import { useFortune } from '@/hooks/useFortune'
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'
import SketchEren, { SKETCH_EREN_STATES, type SketchErenState } from '@/components/SketchEren'
import {
  IconCoinBag, IconCapsule, IconCrown, IconSparkles, IconGem, IconTicket,
  IconPaw, IconYarn, IconStar, IconMoon, IconFish, IconFeather, IconBell, IconGift,
} from '@/components/PixelIcons'
import {
  MeadowIcon, PrimaryButton, SecondaryButton, Tag, TextButton,
  M, RARITY_TAG, TINT, TYPE,
} from '@/components/meadow'

// Each fortune gift's `icon` key resolves to a pixel-art <Icon*/> — no emojis.
const FORTUNE_ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  coinBag:   IconCoinBag,
  coinChest: IconCapsule,
  crown:     IconCrown,
  stardust:  IconSparkles,
  gem:       IconGem,
  ticket:    IconTicket,
  paw:       IconPaw,
  yarn:      IconYarn,
  star:      IconStar,
  moon:      IconMoon,
  fish:      IconFish,
  feather:   IconFeather,
  bell:      IconBell,
}

function FortuneIcon({ iconKey, size }: { iconKey: string; size: number }) {
  const Icon = FORTUNE_ICON_MAP[iconKey] ?? IconGift
  return <Icon size={size} />
}

interface Props {
  onClose: () => void
}

// The daily gift is greeted by a different cheerful Eren each day, drawn from
// the full SketchEren set. Skip the down/cross moods so the gift never opens
// on a sad or angry face.
const SKIP_GIFT_STATES = new Set<SketchErenState>([
  'sad', 'angry', 'cry', 'sick', 'tired', 'yawn', 'sleeping', 'confused', 'shrug',
  'scared', 'dizzy', 'facepalm', 'cold', 'sneeze',
])
const GIFT_EREN_STATES = SKETCH_EREN_STATES.filter(s => !SKIP_GIFT_STATES.has(s))

// Stable per calendar day (reopening shows the same one) but pseudo-random
// across days, so it feels fresh each morning.
// canClaimFortune() unlocks on a new CALENDAR day, so the wait is exactly the
// time left until local midnight — worth showing, since "already claimed" on
// its own leaves you guessing when to come back.
function timeUntilMidnight(): { h: number; m: number } {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const mins = Math.max(0, Math.round((midnight.getTime() - now.getTime()) / 60000))
  return { h: Math.floor(mins / 60), m: mins % 60 }
}

function giftErenForToday(): SketchErenState {
  const d = new Date()
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return GIFT_EREN_STATES[Math.abs(h) % GIFT_EREN_STATES.length]
}

// ────────────────────────────────────────────────────────────────────
// PIXEL GIFT BOX — drawn as a low-res SVG cell grid (same approach as
// PixelCloud) so the daily-fortune sequence matches the rest of the UI.
// The box is split into a LID (rows 0-8: bow + ribbon + top half) and
// a BODY (rows 9-12). During the opening animation the lid flies off
// while the body stays put and pixel sparkles burst from the seam.
// ────────────────────────────────────────────────────────────────────

const BOX_LID_GRID: string[] = [
  '.....##.....',
  '....####....',
  '..########..',
  '..#oo##oo#..',
  '..#oo##oo#..',
  '...##rr##...',
  '############',
  '#oooorroooo#',
  '############',
]

const BOX_BODY_GRID: string[] = [
  '#oooorroooo#',
  '#oooorroooo#',
  '#oooorroooo#',
  '############',
]

const PALETTE = {
  outline: '#3D2817',
  body:    '#F5C842',
  ribbon:  '#C0392B',
  shadow:  'rgba(0,0,0,0.25)',
}

function GridLayer({ grid, cell }: { grid: string[]; cell: number }) {
  const cols = grid[0].length
  const rows = grid.length
  const shadow: React.ReactNode[] = []
  const body:   React.ReactNode[] = []
  const ribbon: React.ReactNode[] = []
  const outline: React.ReactNode[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c]
      if (ch === '.') continue
      const key = `${r}-${c}`
      shadow.push(
        <rect key={`s${key}`} x={c * cell + 2} y={r * cell + 2}
          width={cell} height={cell} fill={PALETTE.shadow} />
      )
      if (ch === 'o') {
        body.push(<rect key={`b${key}`} x={c * cell} y={r * cell}
          width={cell} height={cell} fill={PALETTE.body} />)
      } else if (ch === 'r') {
        ribbon.push(<rect key={`r${key}`} x={c * cell} y={r * cell}
          width={cell} height={cell} fill={PALETTE.ribbon} />)
      } else if (ch === '#') {
        outline.push(<rect key={`o${key}`} x={c * cell} y={r * cell}
          width={cell} height={cell} fill={PALETTE.outline} />)
      }
    }
  }
  return <>{shadow}{body}{ribbon}{outline}</>
}

function PixelGiftBox({
  size,
  animation,
}: {
  size: number
  animation: 'idle' | 'shake' | 'opening'
}) {
  const cell = 4
  const cols = BOX_LID_GRID[0].length
  const lidRows = BOX_LID_GRID.length
  const bodyRows = BOX_BODY_GRID.length
  const totalRows = lidRows + bodyRows
  const vbW = cols * cell
  const vbLidH = lidRows * cell
  const vbBodyH = bodyRows * cell
  // Scale CSS sizes off the SVG viewBox so the lid/body align perfectly.
  const scale = size / vbW
  const renderedLidH = Math.round(vbLidH * scale)
  const renderedBodyH = Math.round(vbBodyH * scale)
  const wrapperH = renderedLidH + renderedBodyH

  const wrapperAnim =
    animation === 'shake' ? 'fpBoxShake 0.16s steps(2) infinite' :
    animation === 'idle'  ? 'fpBoxIdle 1.8s ease-in-out infinite' :
    'none'

  return (
    <div style={{
      position: 'relative',
      width: size,
      height: wrapperH,
      animation: wrapperAnim,
      transformOrigin: '50% 80%',
    }}>
      {/* Lid (top half + bow) — flies off during the opening phase. */}
      <svg
        width={size} height={renderedLidH}
        viewBox={`0 0 ${vbW} ${vbLidH}`}
        shapeRendering="crispEdges"
        style={{
          position: 'absolute', top: 0, left: 0,
          imageRendering: 'pixelated',
          animation: animation === 'opening'
            ? 'fpLidFly 0.7s cubic-bezier(0.34, 1.4, 0.55, 1) forwards'
            : undefined,
          transformOrigin: '30% 100%',
        }}
      >
        <GridLayer grid={BOX_LID_GRID} cell={cell} />
      </svg>

      {/* Body (bottom half) — stays put. */}
      <svg
        width={size} height={renderedBodyH}
        viewBox={`0 0 ${vbW} ${vbBodyH}`}
        shapeRendering="crispEdges"
        style={{
          position: 'absolute',
          top: renderedLidH,
          left: 0,
          imageRendering: 'pixelated',
          animation: animation === 'opening'
            ? 'fpBodyJolt 0.5s ease-out'
            : undefined,
        }}
      >
        <GridLayer grid={BOX_BODY_GRID} cell={cell} />
      </svg>

      {/* Burst of pixel sparkles — only during opening. */}
      {animation === 'opening' && <PixelSparkles size={size} />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// PixelSparkles — 8 chunky pixel-plus sprites radiate from the box
// centre on the opening phase. Each one rides its own CSS custom
// property to a unique destination so they spray outward in a fan.
// ────────────────────────────────────────────────────────────────────
function PixelSparkles({ size, scatter = 1, accent = '#FFD700' }: {
  size: number
  scatter?: number
  accent?: string
}) {
  const N = 8
  const radius = size * 0.6 * scatter
  const sparks = Array.from({ length: N }, (_, i) => {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2
    return {
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
      delay: i * 30,
      large: i % 2 === 0,
    }
  })
  return (
    <>
      {sparks.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: s.large ? 14 : 10,
            height: s.large ? 14 : 10,
            transform: 'translate(-50%, -50%) scale(0)',
            animation: `fpSparkBurst 0.75s ease-out ${s.delay}ms forwards`,
            ['--tx' as string]: `${s.dx}px`,
            ['--ty' as string]: `${s.dy}px`,
            pointerEvents: 'none',
          } as React.CSSProperties}
        >
          <svg width="100%" height="100%" viewBox="0 0 14 14" shapeRendering="crispEdges">
            <rect x="5" y="0" width="4" height="4" fill={accent} />
            <rect x="0" y="5" width="4" height="4" fill={accent} />
            <rect x="10" y="5" width="4" height="4" fill={accent} />
            <rect x="5" y="10" width="4" height="4" fill={accent} />
            <rect x="5" y="5" width="4" height="4" fill="#FFFBEB" />
          </svg>
        </div>
      ))}
    </>
  )
}

type Phase = 'intro' | 'shake' | 'opening' | 'reveal'

const RARITY_WORD: Record<FortuneGiftDef['rarity'], string> = {
  common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary',
}

export default function FortunePopup({ onClose }: Props) {
  const { canClaim, claiming, claimFortune } = useFortune()
  const cat = useCat()
  const [gift, setGift] = useState<FortuneGiftDef | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [failed, setFailed] = useState(false)
  const dailyEren = useMemo(giftErenForToday, [])
  const bagRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Countdown to the next gift, refreshed every minute while the popup is open.
  const [untilNext, setUntilNext] = useState(timeUntilMidnight)
  useEffect(() => {
    const t = setInterval(() => setUntilNext(timeUntilMidnight()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Focus the card so a screen reader lands on it and Escape reaches it.
  useEffect(() => { dialogRef.current?.focus({ preventScroll: true }) }, [])

  // Closing a coin reward showers coins from the revealed bag into the top-right
  // counter. We measure the bag BEFORE unmounting and hand its centre + the coin
  // amount to the HUD (StatsHeader) via `eren:coin-burst`; the count scales with
  // the amount, so a 50-coin Heavy Coin Bag rains far more than a 10-coin pouch.
  function closeReveal() {
    playSound('ui_modal_close')
    if (gift?.coinValue && bagRef.current) {
      const r = bagRef.current.getBoundingClientRect()
      window.dispatchEvent(new CustomEvent('eren:coin-burst', {
        detail: { x: r.left + r.width / 2, y: r.top + r.height / 2, amount: gift.coinValue },
      }))
    }
    onClose()
  }

  // The way out from wherever you are: nothing while the box is opening (the
  // gift is already yours by then and is about to be shown).
  function dismiss() {
    if (phase === 'reveal') return closeReveal()
    if (phase !== 'intro') return
    playSound('ui_modal_close')
    onClose()
  }

  async function handleClaim() {
    if (!canClaim || claiming) return
    playSound('ui_tap')
    setFailed(false)
    setPhase('shake')
    const start = Date.now()
    const result = await claimFortune()
    if (!result) {
      // Claim aborted (Supabase outage: the hook restored canClaim and wrote
      // nothing). Back to the intro with the button, and say so; staying on
      // 'shake' would trap the user on a card with no controls.
      setPhase('intro')
      setFailed(true)
      return
    }
    setGift(result)
    // Hold the shake for at least 600ms so the anticipation reads even when
    // the network call returns instantly. Then lid pops, then full reveal.
    const remaining = Math.max(0, 600 - (Date.now() - start))
    timers.current.push(setTimeout(() => { playSound('gift_open'); setPhase('opening') }, remaining))
    timers.current.push(setTimeout(() => setPhase('reveal'), remaining + 700))
  }

  const tint = gift ? RARITY_TAG[gift.rarity] : null

  return (
    <div
      className="meadow-root"
      onClick={dismiss}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); dismiss() } }}
      style={{
        position: 'fixed', inset: 0, zIndex: 70, padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(47, 43, 40, 0.36)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340, boxSizing: 'border-box', borderRadius: 28, background: '#FFFFFF',
          padding: '20px 20px 18px', textAlign: 'center', outline: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          animation: 'fpCardIn 0.26s cubic-bezier(0.34, 1.4, 0.64, 1) both',
        }}
      >
        {phase === 'reveal' && gift && tint ? (
          <>
            {/* The gift on its rarity's tint. */}
            <div
              ref={bagRef}
              style={{
                width: 132, height: 132, borderRadius: 32, background: tint.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'fpRevealIn 0.55s cubic-bezier(0.34, 1.6, 0.55, 1) both',
              }}
            >
              {gift.stardustValue ? (
                <span className="sparkle-hue"><FortuneIcon iconKey={gift.icon} size={68} /></span>
              ) : (
                <FortuneIcon iconKey={gift.icon} size={68} />
              )}
            </div>
            <h2 id={titleId} style={{ margin: '18px 0 0', fontSize: 24, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>
              {cat.t(gift.name)}
            </h2>
            <Tag tone={gift.rarity} caps size="sm" style={{ marginTop: 8 }}>{RARITY_WORD[gift.rarity]}</Tag>
            <p style={{ margin: '10px 0 0', ...TYPE.body, color: M.text2 }}>{cat.t(gift.description)}</p>
            <PrimaryButton onClick={closeReveal} style={{ marginTop: 20 }}
              icon={gift.coinValue ? <MeadowIcon name="coin" size={20} /> : undefined}>
              {gift.coinValue ? `Collect ${gift.coinValue} coins` : gift.stardustValue || gift.gachaTickets ? 'Collect' : 'Keep it'}
            </PrimaryButton>
          </>
        ) : (
          <>
            {/* The warm stage: today's cat behind the box. While the claim runs
                the cat steps aside and the box takes the middle. */}
            <div style={{
              position: 'relative', width: '100%', boxSizing: 'border-box', borderRadius: 22,
              background: TINT.amber, padding: phase === 'intro' ? '10px 0 18px' : '34px 0 30px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              {phase === 'intro' ? (
                <>
                  <div className="fp-loop" style={{ animation: 'fpFloat 2s ease-in-out infinite' }}>
                    <SketchEren state={dailyEren} size={112} transparent noSpeech />
                  </div>
                  <div style={{ marginTop: -4 }}>
                    <PixelGiftBox size={76} animation="idle" />
                  </div>
                  <MeadowIcon name="sparkle" size={16} className="fp-loop"
                    style={{ position: 'absolute', top: 16, left: 20, animation: 'fpTwinkle 1.6s steps(2) infinite' }} />
                  <MeadowIcon name="sparkle" size={12} className="fp-loop"
                    style={{ position: 'absolute', bottom: 30, right: 26, animation: 'fpTwinkle 1.6s steps(2) 0.8s infinite' }} />
                </>
              ) : (
                <PixelGiftBox size={112} animation={phase === 'shake' ? 'shake' : 'opening'} />
              )}
            </div>

            <h2 id={titleId} style={{ margin: '16px 0 0', fontSize: 24, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.01em' }}>
              {phase === 'shake' ? 'Shake, shake...' : phase === 'opening' ? 'Pop!' : 'Daily fortune'}
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
              {phase !== 'intro'
                ? 'Opening your gift'
                : cat.t(canClaim ? '{name} has a gift for you.' : '{name} is wrapping the next one.')}
            </p>

            {phase === 'intro' && (canClaim ? (
              <>
                {failed && (
                  <p role="alert" style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.danger }}>
                    The gift didn&apos;t open. Check your connection and try again.
                  </p>
                )}
                <PrimaryButton onClick={handleClaim} busy={claiming} style={{ marginTop: 18 }}
                  icon={<MeadowIcon name="gift" size={20} color="#FFFFFF" mono />}>
                  Open gift
                </PrimaryButton>
                <TextButton tone="muted" onClick={dismiss} style={{ marginTop: 4 }}>Not now</TextButton>
              </>
            ) : (
              <>
                {/* Answers the only question left: when is the next one. */}
                <div style={{
                  marginTop: 16, width: '100%', boxSizing: 'border-box', padding: '12px 16px',
                  borderRadius: 20, background: M.soft,
                }}>
                  <span style={{ ...TYPE.label, color: M.label, display: 'block' }}>Claimed for today</span>
                  <span style={{ display: 'block', marginTop: 4, fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    Next gift in {untilNext.h}h {untilNext.m}m
                  </span>
                </div>
                <SecondaryButton size="lg" onClick={dismiss} style={{ marginTop: 16 }}>Close</SecondaryButton>
              </>
            ))}
          </>
        )}
      </div>

      {/* A plain <style>, not styled-jsx: these names are used from inline
          styles, which only resolve global keyframes. */}
      <style>{`
        @keyframes fpCardIn {
          0%   { transform: scale(0.94) translateY(8px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes fpFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @keyframes fpTwinkle {
          0%, 49%   { opacity: 0.25; transform: scale(0.7); }
          50%, 100% { opacity: 1;    transform: scale(1); }
        }
        @keyframes fpBoxIdle {
          0%, 100% { transform: translateY(0)   rotate(-1.5deg); }
          50%      { transform: translateY(-3px) rotate(1.5deg); }
        }
        @keyframes fpBoxShake {
          0%   { transform: translate(-3px, 0) rotate(-5deg); }
          50%  { transform: translate(3px, -1px) rotate(5deg); }
          100% { transform: translate(-3px, 0) rotate(-5deg); }
        }
        @keyframes fpLidFly {
          0%   { transform: translate(0, 0)        rotate(0deg);   opacity: 1; }
          25%  { transform: translate(-2px, -18px) rotate(-12deg); opacity: 1; }
          60%  { transform: translate(-10px, -42px) rotate(-32deg); opacity: 1; }
          100% { transform: translate(-26px, -78px) rotate(-58deg); opacity: 0; }
        }
        @keyframes fpBodyJolt {
          0%   { transform: translateY(0); }
          20%  { transform: translateY(4px); }
          60%  { transform: translateY(-2px); }
          100% { transform: translateY(0); }
        }
        @keyframes fpSparkBurst {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          15%  { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          55%  { transform: translate(
                   calc(-50% + var(--tx) * 0.7),
                   calc(-50% + var(--ty) * 0.7)
                 ) scale(1.3); opacity: 1; }
          100% { transform: translate(
                   calc(-50% + var(--tx)),
                   calc(-50% + var(--ty))
                 ) scale(0); opacity: 0; }
        }
        @keyframes fpRevealIn {
          0%   { transform: translateY(28px) scale(0.4); opacity: 0; }
          55%  { transform: translateY(-6px) scale(1.12); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fp-loop { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
