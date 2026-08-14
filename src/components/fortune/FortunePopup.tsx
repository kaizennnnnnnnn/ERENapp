'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FortuneGiftDef } from '@/types'
import { RARITY_COLORS } from '@/lib/gacha'
import { useFortune } from '@/hooks/useFortune'
import { playSound } from '@/lib/sounds'
import SketchEren, { SKETCH_EREN_STATES, type SketchErenState } from '@/components/SketchEren'
import {
  IconCoinBag, IconCapsule, IconCrown, IconSparkles, IconGem, IconTicket,
  IconPaw, IconYarn, IconStar, IconMoon, IconFish, IconFeather, IconBell, IconGift,
} from '@/components/PixelIcons'

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
// the same expressive set as the Serbian-lesson cards. Skip the down/cross
// moods so the gift never opens on a sad or angry face.
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

// ────────────────────────────────────────────────────────────────────
// PixelStarFrame — chunky 4-corner star markers around the revealed
// item. Pure decoration, anchored absolutely so it scales with parent.
// ────────────────────────────────────────────────────────────────────
function PixelStarFrame({ color }: { color: string }) {
  const corners = [
    { top: -8, left: -8 },
    { top: -8, right: -8 },
    { bottom: -8, left: -8 },
    { bottom: -8, right: -8 },
  ]
  return (
    <>
      {corners.map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            width: 16, height: 16,
            animation: `fpStarTwinkle 1.4s steps(2) infinite`,
            animationDelay: `${i * 0.2}s`,
            pointerEvents: 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges">
            <rect x="6" y="0" width="4" height="4" fill={color} />
            <rect x="0" y="6" width="4" height="4" fill={color} />
            <rect x="12" y="6" width="4" height="4" fill={color} />
            <rect x="6" y="12" width="4" height="4" fill={color} />
            <rect x="6" y="6" width="4" height="4" fill="#FFFBEB" />
          </svg>
        </div>
      ))}
    </>
  )
}

export default function FortunePopup({ onClose }: Props) {
  const { canClaim, claiming, claimFortune } = useFortune()
  const [gift, setGift] = useState<FortuneGiftDef | null>(null)
  const [phase, setPhase] = useState<'intro' | 'shake' | 'opening' | 'reveal'>('intro')
  const dailyEren = useMemo(giftErenForToday, [])
  const bagRef = useRef<HTMLDivElement>(null)

  // Countdown to the next gift, refreshed every minute while the popup is open.
  const [untilNext, setUntilNext] = useState(timeUntilMidnight)
  useEffect(() => {
    const t = setInterval(() => setUntilNext(timeUntilMidnight()), 60_000)
    return () => clearInterval(t)
  }, [])

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

  async function handleClaim() {
    if (!canClaim || claiming) return
    setPhase('shake')
    const start = Date.now()
    const result = await claimFortune()
    if (!result) {
      // Claim aborted (Supabase outage — the hook restored canClaim and wrote
      // nothing). Drop back to the intro screen so the OPEN GIFT button
      // reappears; staying on 'shake' would trap the user on an overlay
      // with no controls.
      setPhase('intro')
      return
    }
    setGift(result)
    // Hold the shake for at least 600ms so the anticipation reads even when
    // the network call returns instantly. Then lid pops, then full reveal.
    const elapsed = Date.now() - start
    const remaining = Math.max(0, 600 - elapsed)
    setTimeout(() => { playSound('gift_open'); setPhase('opening') }, remaining)
    setTimeout(() => setPhase('reveal'),  remaining + 700)
  }

  const colors = gift ? RARITY_COLORS[gift.rarity] : null
  // Stardust gifts wear the same rainbow treatment as the gacha/closet balances:
  // a hue-cycling icon + flowing rainbow gradient name, so "star fragments" read
  // identically wherever they appear. (.sparkle-hue / .stardust-rainbow live in globals.css.)
  const isStardust = !!gift?.stardustValue

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-xs mx-auto flex flex-col items-center gap-4 px-6">

        {/* Intro — Eren + idle pixel gift box + CTA */}
        {phase === 'intro' && (
          <>
            {/* Warm lantern glow behind the box. The scrim used to be flat
                black, which left the gift sitting on nothing; this pools light
                on the centrepiece so the eye lands there first. */}
            <div aria-hidden className="fp-lantern" />

            <div style={{ animation: 'fpFloat 2s ease-in-out infinite' }}>
              <SketchEren state={dailyEren} size={120} transparent noSpeech />
            </div>

            <div className="relative">
              <PixelGiftBox size={88} animation="idle" />
              {/* Four pixel sparkles orbiting the box on staggered blinks. */}
              {([
                { delay: '0s',   pos: { top: -6,    left: -10 } },
                { delay: '0.7s', pos: { top: 4,     right: -12 } },
                { delay: '1.3s', pos: { bottom: -4, left: 6 } },
                { delay: '1.9s', pos: { bottom: 8,  right: -6 } },
              ] as const).map(s => (
                <span key={s.delay} aria-hidden className="fp-spark"
                  style={{ ...s.pos, animationDelay: s.delay }} />
              ))}
            </div>

            {/* Title plaque — now wears the app's premium-card treatment
                (bevel + gold corner rivets) instead of a flat bordered rect. */}
            <div className="fp-plaque relative px-4 py-2.5 text-center">
              <span aria-hidden className="fp-rivet" style={{ top: 3, left: 3 }} />
              <span aria-hidden className="fp-rivet" style={{ top: 3, right: 3 }} />
              <span aria-hidden className="fp-rivet" style={{ bottom: 3, left: 3 }} />
              <span aria-hidden className="fp-rivet" style={{ bottom: 3, right: 3 }} />
              <p className="font-pixel fp-plaque-title mb-1.5" style={{ fontSize: 8 }}>DAILY FORTUNE</p>
              <p className="font-pixel text-white/65" style={{ fontSize: 6, letterSpacing: 0.5 }}>
                {canClaim ? 'EREN HAS A GIFT FOR YOU' : 'EREN IS WRAPPING THE NEXT ONE'}
              </p>
            </div>

            {canClaim ? (
              <button onClick={() => { playSound('ui_tap'); handleClaim() }}
                disabled={claiming}
                className="fp-open w-full relative">
                <span aria-hidden className="fp-open-shine" />
                <span className="fp-open-label">
                  <IconGift size={18} />
                  OPEN GIFT
                </span>
              </button>
            ) : (
              /* Was a bare line of 40%-white text. Now it answers the only
                 question you actually have here: when do I get the next one. */
              <div className="fp-wait w-full text-center py-3">
                <p className="font-pixel text-white/45 mb-1.5" style={{ fontSize: 7, letterSpacing: 1 }}>
                  CLAIMED FOR TODAY
                </p>
                <p className="font-pixel fp-wait-clock" style={{ fontSize: 8 }}>
                  NEXT GIFT IN {untilNext.h}H {untilNext.m}M
                </p>
              </div>
            )}

            <button onClick={() => { playSound('ui_modal_close'); onClose() }}
              className="font-pixel text-white/35 active:text-white/60 transition-colors"
              style={{ fontSize: 7, letterSpacing: 1.5, padding: '10px 24px' }}>
              CLOSE
            </button>
          </>
        )}

        {/* Shake — anticipation. The box rattles in place. */}
        {phase === 'shake' && (
          <div className="flex flex-col items-center gap-4">
            <PixelGiftBox size={128} animation="shake" />
            <p className="font-pixel text-amber-300"
              style={{ fontSize: 7, animation: 'fpFloat 0.45s ease-in-out infinite' }}>
              SHAKE SHAKE...
            </p>
          </div>
        )}

        {/* Opening — lid flies off, sparkles burst, body jolts. */}
        {phase === 'opening' && (
          <div className="flex flex-col items-center gap-4">
            <PixelGiftBox size={128} animation="opening" />
            <p className="font-pixel text-amber-300" style={{ fontSize: 7 }}>POP!</p>
          </div>
        )}

        {/* Reveal — pixel-framed item with corner sparkles. */}
        {phase === 'reveal' && gift && colors && (
          <button onClick={closeReveal}
            className="flex flex-col items-center gap-4 active:scale-95 transition-transform">
            <div className="relative flex items-center justify-center"
              style={{
                width: 120, height: 120,
                animation: 'fpRevealIn 0.55s cubic-bezier(0.34, 1.6, 0.55, 1) both',
              }}>
              <PixelStarFrame color={colors.border} />
              <div
                ref={bagRef}
                style={{
                  width: 96, height: 96,
                  background: colors.bg,
                  border: `3px solid ${colors.border}`,
                  boxShadow: `4px 4px 0 ${colors.border}AA`,
                  imageRendering: 'pixelated',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'fpRevealPulse 1.6s ease-in-out infinite',
                }}>
                {isStardust ? (
                  <span className="sparkle-hue"><FortuneIcon iconKey={gift.icon} size={58} /></span>
                ) : (
                  <FortuneIcon iconKey={gift.icon} size={58} />
                )}
              </div>
            </div>
            <div className="text-center"
              style={{
                background: '#1F1F2E',
                border: `2px solid ${colors.border}`,
                boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                padding: '8px 12px',
                imageRendering: 'pixelated',
              }}>
              <p className={`font-pixel mb-1 ${isStardust ? 'stardust-rainbow' : 'text-white'}`} style={{ fontSize: 9 }}>{gift.name}</p>
              <p className="font-pixel mb-1"
                style={{ fontSize: 6, color: colors.text === '#6B7280' ? '#9CA3AF' : colors.text }}>
                {gift.rarity.toUpperCase()}
              </p>
              <p className="text-xs text-white/60">{gift.description}</p>
            </div>
            <p className="font-pixel text-white/30" style={{ fontSize: 6 }}>TAP TO CLOSE</p>
          </button>
        )}
      </div>

      <style>{`
        /* ── Intro atmosphere ── */
        .fp-lantern {
          position: absolute;
          left: 50%; top: 50%;
          width: 420px; height: 420px;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle,
            rgba(245, 200, 66, 0.16) 0%,
            rgba(217, 119, 6, 0.07) 42%,
            transparent 70%);
          pointer-events: none;
          animation: fpLantern 4.5s ease-in-out infinite;
        }
        @keyframes fpLantern {
          0%, 100% { opacity: 0.75; transform: translate(-50%, -50%) scale(1);    }
          50%      { opacity: 1;    transform: translate(-50%, -50%) scale(1.06); }
        }
        .fp-spark {
          position: absolute;
          width: 3px; height: 3px;
          background: #FFE9A8;
          box-shadow: 0 0 5px rgba(255, 220, 120, 0.9);
          opacity: 0;
          pointer-events: none;
          animation: fpSpark 2.6s steps(1, end) infinite;
        }
        /* Steps, not a fade — a pixel sparkle pops on and off, it doesn't
           dissolve. Same rule the water-drop keyframes follow. */
        @keyframes fpSpark {
          0%, 74%  { opacity: 0; transform: scale(1); }
          78%      { opacity: 1; transform: scale(1.6); }
          86%      { opacity: 1; transform: scale(1); }
          92%, 100%{ opacity: 0; transform: scale(1); }
        }

        /* ── Title plaque ── */
        .fp-plaque {
          background: linear-gradient(180deg, #2A2438 0%, #16121F 100%);
          border: 2px solid #F5C842;
          box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.55),
                      inset 0 1px 0 rgba(255, 232, 160, 0.22),
                      inset 0 -2px 0 rgba(0, 0, 0, 0.5);
        }
        .fp-plaque-title {
          color: #FFD86B;
          letter-spacing: 1.5px;
          text-shadow: 0 0 7px rgba(245, 200, 66, 0.5);
        }
        .fp-rivet {
          position: absolute;
          width: 2px; height: 2px;
          background: #FFE9A8;
          box-shadow: 0 0 3px rgba(245, 200, 66, 0.8);
          pointer-events: none;
        }

        /* ── OPEN GIFT ──
           Was a flat #D97706 slab with a plain border. Now a struck-gold
           pixel button: gradient face, hard bevel, hard drop (no blur), a
           slow shine sweep to pull the eye, and a real press that drives
           the face down onto its own shadow. */
        .fp-open {
          padding: 14px 16px;
          background: linear-gradient(180deg, #FFD86B 0%, #F5A623 45%, #D97706 100%);
          border: 3px solid #6F3D08;
          box-shadow: 0 5px 0 #6F2E08,
                      inset 0 2px 0 rgba(255, 245, 200, 0.75),
                      inset 0 -3px 0 rgba(146, 64, 14, 0.55),
                      0 0 20px rgba(245, 166, 35, 0.35);
          image-rendering: pixelated;
          overflow: hidden;
          transition: transform 60ms steps(2, end), box-shadow 60ms steps(2, end);
          animation: fpOpenBreathe 2.4s ease-in-out infinite;
        }
        .fp-open:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: 0 1px 0 #6F2E08,
                      inset 0 2px 0 rgba(255, 245, 200, 0.5),
                      inset 0 -2px 0 rgba(146, 64, 14, 0.6),
                      0 0 14px rgba(245, 166, 35, 0.3);
          animation: none;
        }
        .fp-open:disabled { opacity: 0.65; animation: none; }
        .fp-open-label {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          font-family: "Press Start 2P";
          font-size: 10px;
          letter-spacing: 1.5px;
          color: #45210A;
          text-shadow: 0 1px 0 rgba(255, 240, 190, 0.55);
        }
        .fp-open-shine {
          position: absolute;
          top: 0; bottom: 0; left: -40%;
          width: 34%;
          background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.55), transparent);
          animation: fpOpenShine 3.2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes fpOpenShine {
          0%, 62%  { left: -40%; }
          88%, 100%{ left: 108%; }
        }
        @keyframes fpOpenBreathe {
          0%, 100% { filter: brightness(1);    }
          50%      { filter: brightness(1.09); }
        }

        /* ── Already-claimed panel ── */
        .fp-wait {
          background: linear-gradient(180deg, rgba(42, 36, 56, 0.7) 0%, rgba(16, 14, 24, 0.8) 100%);
          border: 2px solid rgba(245, 200, 66, 0.28);
          box-shadow: inset 0 1px 0 rgba(255, 232, 160, 0.1);
        }
        .fp-wait-clock {
          color: #F5C842;
          letter-spacing: 1.5px;
          text-shadow: 0 0 8px rgba(245, 200, 66, 0.4);
        }

        @media (prefers-reduced-motion: reduce) {
          .fp-lantern, .fp-spark, .fp-open, .fp-open-shine { animation: none; }
          .fp-spark { opacity: 0.9; }
        }

        @keyframes fpFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
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
        @keyframes fpRevealPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.03); }
        }
        @keyframes fpStarTwinkle {
          0%, 49%   { opacity: 0.35; transform: scale(0.7); }
          50%, 100% { opacity: 1;    transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
