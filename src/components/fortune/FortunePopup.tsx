'use client'

import { useState } from 'react'
import type { FortuneGiftDef } from '@/types'
import { RARITY_COLORS } from '@/lib/gacha'
import { useFortune } from '@/hooks/useFortune'
import { playSound } from '@/lib/sounds'

interface Props {
  onClose: () => void
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

  async function handleClaim() {
    if (!canClaim || claiming) return
    setPhase('shake')
    const start = Date.now()
    const result = await claimFortune()
    if (!result) return
    setGift(result)
    // Hold the shake for at least 600ms so the anticipation reads even when
    // the network call returns instantly. Then lid pops, then full reveal.
    const elapsed = Date.now() - start
    const remaining = Math.max(0, 600 - elapsed)
    setTimeout(() => setPhase('opening'), remaining)
    setTimeout(() => setPhase('reveal'),  remaining + 700)
  }

  const colors = gift ? RARITY_COLORS[gift.rarity] : null

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-xs mx-auto flex flex-col items-center gap-4 px-6">

        {/* Intro — Eren + idle pixel gift box + CTA */}
        {phase === 'intro' && (
          <>
            <div style={{ animation: 'fpFloat 2s ease-in-out infinite' }}>
              <img src="/erenGood.png" alt="Eren" draggable={false}
                style={{ width: 120, height: 120, objectFit: 'contain', imageRendering: 'pixelated' }} />
            </div>
            <PixelGiftBox size={88} animation="idle" />
            <div className="px-3 py-2 text-center"
              style={{
                background: '#1F1F2E',
                border: '2px solid #F5C842',
                boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                imageRendering: 'pixelated',
              }}>
              <p className="font-pixel text-amber-300 mb-1" style={{ fontSize: 8 }}>DAILY FORTUNE</p>
              <p className="font-pixel text-white/70" style={{ fontSize: 6 }}>EREN HAS A GIFT!</p>
            </div>
            {canClaim ? (
              <button onClick={() => { playSound('ui_tap'); handleClaim() }}
                className="w-full py-3 text-white active:translate-y-[2px] transition-transform"
                style={{
                  background: '#D97706',
                  border: '3px solid #92400E',
                  boxShadow: '0 4px 0 #6F2E08',
                  fontFamily: '"Press Start 2P"',
                  fontSize: 8,
                  imageRendering: 'pixelated',
                }}>
                OPEN GIFT
              </button>
            ) : (
              <p className="font-pixel text-white/40" style={{ fontSize: 7 }}>ALREADY CLAIMED TODAY</p>
            )}
            <button onClick={() => { playSound('ui_modal_close'); onClose() }}
              className="font-pixel text-white/30" style={{ fontSize: 6 }}>CLOSE</button>
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
          <button onClick={() => { playSound('ui_modal_close'); onClose() }}
            className="flex flex-col items-center gap-4 active:scale-95 transition-transform">
            <div className="relative flex items-center justify-center"
              style={{
                width: 120, height: 120,
                animation: 'fpRevealIn 0.55s cubic-bezier(0.34, 1.6, 0.55, 1) both',
              }}>
              <PixelStarFrame color={colors.border} />
              <div
                style={{
                  width: 96, height: 96,
                  background: colors.bg,
                  border: `3px solid ${colors.border}`,
                  boxShadow: `4px 4px 0 ${colors.border}AA`,
                  imageRendering: 'pixelated',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'fpRevealPulse 1.6s ease-in-out infinite',
                }}>
                <span style={{ fontSize: 44 }}>{gift.icon}</span>
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
              <p className="font-pixel text-white mb-1" style={{ fontSize: 9 }}>{gift.name}</p>
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
