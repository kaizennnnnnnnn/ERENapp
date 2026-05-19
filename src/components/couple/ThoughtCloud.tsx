'use client'

// Pixel-art thinking cloud that floats above Eren on the home screen.
// Drawn as a low-resolution SVG cell grid with shape-rendering: crispEdges
// so it matches the rest of the pixel UI instead of looking like a smooth
// vector bubble.
//
// Four interaction states:
//   1. 'idle'    — single small pixel cloud with three pulsing dots and two
//                  trailing puffs leading down to Eren's head.
//   2. 'split'   — the cloud splits into two side-by-side mini clouds
//                  (✉ message / 🎁 gift). Pick one.
//   3. 'message' — full message composer modal.
//   4. 'gift'    — full gift picker modal.

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useErenStats } from '@/hooks/useErenStats'
import { playSound } from '@/lib/sounds'
import type { FoodInventory, FoodKey } from '@/types'

const FOOD_META: Record<FoodKey, { name: string; color: string }> = {
  kibble: { name: 'Kibble',    color: '#F5C842' },
  fish:   { name: 'Fish',      color: '#6BAED6' },
  treat:  { name: 'Cat Treat', color: '#FF6B9D' },
  tuna:   { name: 'Tuna Can',  color: '#E8A020' },
  steak:  { name: 'Steak',     color: '#CC3333' },
  cream:  { name: 'Cream',     color: '#A78BFA' },
}

const FOOD_ORDER: FoodKey[] = ['kibble', 'fish', 'treat', 'tuna', 'steak', 'cream']

type Mode = 'idle' | 'split' | 'message' | 'gift'

const CLOUD_BOTTOM = '35%'
const Z_BACKDROP = 55
const Z_CLOUD = 56
const Z_MODAL = 61

export default function ThoughtCloud() {
  const { user, profile } = useAuth()
  const { partner, sendMessage } = useCouple()
  const { stats, giftFood } = useErenStats(profile?.household_id ?? null)

  const [mode, setMode] = useState<Mode>('idle')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const myPile: FoodInventory = (user?.id && stats?.food_by_user?.[user.id]) || {}
  const giftableKeys: FoodKey[] = FOOD_ORDER.filter(k => (myPile[k] ?? 0) > 0)
  const noPartner = !partner

  async function handleSendMessage() {
    if (!text.trim() || sending) return
    setSending(true)
    await sendMessage(text.trim(), null)
    setText('')
    setToast('Eren will deliver it')
    setSending(false)
    setTimeout(() => setMode('idle'), 700)
  }

  async function handleSendGift(key: FoodKey) {
    if (sending || !user?.id || !partner?.id) return
    setSending(true)
    const moved = await giftFood(user.id, partner.id, key)
    if (!moved) {
      setToast(`No ${FOOD_META[key].name} to give`)
      setSending(false)
      return
    }
    await sendMessage('', { key, qty: 1 })
    setToast(`Sent ${FOOD_META[key].name}`)
    setSending(false)
    setTimeout(() => setMode('idle'), 800)
  }

  // ── idle: single pixel cloud ──────────────────────────────────────
  if (mode === 'idle') {
    return (
      <CloudAnchor zIndex={4}>
        <button
          onClick={() => { playSound('ui_modal_open'); setMode('split') }}
          className="active:scale-95 transition-transform pointer-events-auto"
          style={{ background: 'transparent', border: 'none', padding: 0 }}
          aria-label="Open Eren's thought"
        >
          <PixelCloud width={64} dots />
        </button>
        <TrailingPuffs />
      </CloudAnchor>
    )
  }

  // ── split: two side-by-side mini pixel clouds ─────────────────────
  if (mode === 'split') {
    return (
      <>
        <div
          className="fixed inset-0"
          style={{ zIndex: Z_BACKDROP, background: 'rgba(0,0,0,0.18)' }}
          onClick={() => { playSound('ui_modal_close'); setMode('idle') }}
        />

        <CloudAnchor zIndex={Z_CLOUD}>
          <div
            className="flex items-center gap-2"
            style={{ animation: 'tcSplitIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); playSound('ui_tap'); setMode('message') }}
              className="active:scale-95 transition-transform pointer-events-auto"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
              aria-label="Send a message"
            >
              <PixelCloud width={58} tint="#A78BFA" glyph="MSG" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); playSound('ui_tap'); setMode('gift') }}
              className="active:scale-95 transition-transform pointer-events-auto"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
              aria-label="Send a gift"
            >
              <PixelCloud width={58} tint="#F5C842" glyph="GIFT" />
            </button>
          </div>
          <TrailingPuffs />
        </CloudAnchor>

        <style jsx global>{`
          @keyframes tcSplitIn {
            0%   { transform: scale(0.4); opacity: 0; }
            60%  { transform: scale(1.08); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </>
    )
  }

  // ── composer modals (message / gift) ──────────────────────────────
  const tint = mode === 'message' ? '#A78BFA' : '#F5C842'
  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: Z_MODAL - 1, background: 'rgba(0,0,0,0.35)' }}
        onClick={() => { playSound('ui_modal_close'); setMode('idle') }}
      />

      <div
        className="fixed left-1/2 flex flex-col items-center gap-2 px-3"
        style={{ top: '20%', transform: 'translateX(-50%)', width: 'min(92vw, 360px)', zIndex: Z_MODAL }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            width: '100%',
            background: '#FFFFFF',
            border: `3px solid ${tint}`,
            // Hard pixel-style shadow, no blur.
            boxShadow: `4px 4px 0 ${tint}AA`,
            imageRendering: 'pixelated',
          }}
        >
          {noPartner ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-gray-600">
                Invite your partner first so Eren can deliver this.
              </p>
            </div>
          ) : mode === 'message' ? (
            <div className="px-4 py-3 flex flex-col gap-2 w-full">
              <p className="font-pixel text-purple-500 text-center" style={{ fontSize: 6 }}>
                EREN WILL DELIVER THIS TO {partner?.name?.toUpperCase().split(' ')[0] ?? 'THEM'}
              </p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="thinking of you…"
                maxLength={200}
                rows={3}
                autoFocus
                className="w-full p-2 text-sm text-gray-700 resize-none focus:outline-none"
                style={{
                  background: '#FFF',
                  border: '2px dashed #E0CCFF',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() => { playSound('ui_tap'); handleSendMessage() }}
                disabled={!text.trim() || sending}
                className="self-end px-4 py-2 text-white active:translate-y-[1px] disabled:opacity-40"
                style={{
                  background: '#A78BFA',
                  border: '2px solid #7C3AED',
                  boxShadow: '0 3px 0 #5B21B6',
                  fontFamily: '"Press Start 2P"',
                  fontSize: 7,
                }}
              >
                {sending ? '...' : 'SEND'}
              </button>
            </div>
          ) : (
            <div className="px-3 py-3 flex flex-col gap-2 w-full">
              <p className="font-pixel text-amber-600 text-center" style={{ fontSize: 6 }}>
                PICK FROM YOUR FRIDGE
              </p>
              {giftableKeys.length === 0 ? (
                <p className="text-center text-xs text-gray-500 py-3">
                  Your fridge is empty. Buy something in the Kitchen first!
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {giftableKeys.map(key => {
                    const meta = FOOD_META[key]
                    const qty = myPile[key] ?? 0
                    return (
                      <button
                        key={key}
                        onClick={() => { playSound('ui_tap'); handleSendGift(key) }}
                        disabled={sending}
                        className="flex flex-col items-center gap-1 p-2 active:translate-y-[1px] disabled:opacity-50 transition-transform"
                        style={{
                          background: `${meta.color}18`,
                          border: `2px solid ${meta.color}66`,
                          boxShadow: `2px 2px 0 ${meta.color}44`,
                        }}
                      >
                        <div style={{
                          width: 18, height: 18,
                          background: meta.color,
                          border: `2px solid ${meta.color}`,
                        }} />
                        <span className="text-[10px] font-bold" style={{ color: meta.color }}>{meta.name}</span>
                        <span className="text-[9px] text-gray-500">x{qty}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {toast && (
          <div className="px-3 py-1.5 text-white font-pixel"
            style={{
              background: '#1F1F2E',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.4)',
              fontSize: 7,
            }}>
            {toast}
          </div>
        )}
      </div>
    </>
  )
}

// ────────────────────────────────────────────────────────────────────
// PixelCloud — low-res SVG cell grid rendered with crispEdges.
//
// The cloud is described as a 17 × 9 grid of cells. Each cell can be one
// of:  '.' empty, '#' outline (dark stroke), 'o' fill (white), 'D' dot
// hotspot (pulsing accent). The grid maps to SVG <rect> elements with
// shape-rendering="crispEdges" so it always scales as crisp pixels.
//
// `width` sets the rendered width in CSS pixels; height is derived from the
// grid aspect ratio. Tweaking the grid here changes every instance.
// ────────────────────────────────────────────────────────────────────
// 13 cols × 6 rows. Three narrow bumps with shared walls make each puff
// clearly read as a separate cloud lobe at small sizes. The bottom outline
// curls in by one cell per row, giving a rounded under-belly. Smaller than
// the previous 17×8 grid so the cloud sits as a delicate thought icon
// rather than a big banner over Eren.
const CLOUD_GRID: string[] = [
  '.###.###.###.',
  '#ooo#ooo#ooo#',
  '#ooooooooooo#',
  '#ooDooDooDoo#',
  '.#ooooooooo#.',
  '..#########..',
]

function PixelCloud({
  width,
  tint = '#7C3AED',
  dots = false,
  glyph,
}: {
  width: number
  tint?: string
  dots?: boolean
  glyph?: 'MSG' | 'GIFT'
}) {
  const cols = CLOUD_GRID[0].length
  const rows = CLOUD_GRID.length
  const cell = 4 // viewBox units per cell
  const w = cols * cell
  const h = rows * cell
  const height = Math.round((width * h) / w)

  // Find the dot positions (cells flagged 'D' in the grid).
  const dotCells: Array<[number, number]> = []
  if (dots) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (CLOUD_GRID[r][c] === 'D') dotCells.push([c, r])
      }
    }
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={{ display: 'block', imageRendering: 'pixelated' }}
    >
      {/* Hard pixel drop shadow — one cell offset down-right, behind fills. */}
      {CLOUD_GRID.flatMap((row, r) =>
        row.split('').map((ch, c) =>
          ch === '#' || ch === 'o' || ch === 'D' ? (
            <rect
              key={`sh-${r}-${c}`}
              x={c * cell + 2}
              y={r * cell + 2}
              width={cell}
              height={cell}
              fill="rgba(0,0,0,0.18)"
            />
          ) : null
        )
      )}

      {/* Fills (white cloud body). */}
      {CLOUD_GRID.flatMap((row, r) =>
        row.split('').map((ch, c) =>
          ch === 'o' || ch === 'D' ? (
            <rect
              key={`fl-${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell}
              height={cell}
              fill="#FFFFFF"
            />
          ) : null
        )
      )}

      {/* Outline cells. */}
      {CLOUD_GRID.flatMap((row, r) =>
        row.split('').map((ch, c) =>
          ch === '#' ? (
            <rect
              key={`ol-${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell}
              height={cell}
              fill={tint}
            />
          ) : null
        )
      )}

      {/* Three pulsing dots inside the cloud. */}
      {dots && dotCells.map(([c, r], i) => (
        <rect
          key={`dot-${i}`}
          x={c * cell}
          y={r * cell}
          width={cell}
          height={cell}
          fill={tint}
          style={{ animation: `tcDotBlink 1.2s steps(2) infinite`, animationDelay: `${i * 0.18}s` }}
        />
      ))}

      {/* Tab glyph in the centre — fits in the 2-row interior of the new
          smaller cloud. MSG = two stacked horizontal stripes (envelope/
          paper). GIFT = a small ribbon-dot above a solid present box. */}
      {glyph === 'MSG' && (
        <g fill={tint}>
          <rect x={cell * 3} y={cell * 2} width={cell * 7} height={cell} />
          <rect x={cell * 3} y={cell * 3} width={cell * 7} height={cell} />
        </g>
      )}
      {glyph === 'GIFT' && (
        <g fill={tint}>
          {/* small ribbon dot on top of the box */}
          <rect x={cell * 6} y={cell * 1} width={cell} height={cell} />
          {/* present box body */}
          <rect x={cell * 4} y={cell * 2} width={cell * 5} height={cell * 2} />
        </g>
      )}

      <style>{`
        @keyframes tcDotBlink {
          0%, 49%   { opacity: 0.25; }
          50%, 100% { opacity: 1; }
        }
      `}</style>
    </svg>
  )
}

// ────────────────────────────────────────────────────────────────────
// CloudAnchor — fixed-positioned wrapper that sits the cloud just
// above Eren on the home screen.
// ────────────────────────────────────────────────────────────────────
function CloudAnchor({ children, zIndex }: { children: React.ReactNode; zIndex: number }) {
  return (
    <div
      className="fixed pointer-events-none"
      style={{
        bottom: CLOUD_BOTTOM,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex,
        animation: 'tcDrift 3.6s ease-in-out infinite',
      }}
    >
      {children}
      <style jsx>{`
        @keyframes tcDrift {
          0%, 100% { transform: translate(-50%, 0); }
          50%      { transform: translate(-50%, -3px); }
        }
      `}</style>
    </div>
  )
}

// Two trailing pixel puffs leading down to Eren — the comic "thinking" tell.
// Sized + spaced so they bridge the gap between the cloud body and Eren's
// head, making the whole thing read as one connected illustration.
function TrailingPuffs() {
  return (
    <>
      <div
        className="absolute"
        style={{
          left: '50%',
          bottom: -10,
          transform: 'translateX(-50%)',
          width: 8, height: 8,
          background: '#FFFFFF',
          border: '2px solid #7C3AED',
          boxShadow: '1px 1px 0 rgba(0,0,0,0.18)',
          imageRendering: 'pixelated',
        }}
      />
      <div
        className="absolute"
        style={{
          left: 'calc(50% - 14px)',
          bottom: -20,
          width: 5, height: 5,
          background: '#FFFFFF',
          border: '2px solid #7C3AED',
          boxShadow: '1px 1px 0 rgba(0,0,0,0.18)',
          imageRendering: 'pixelated',
        }}
      />
    </>
  )
}
