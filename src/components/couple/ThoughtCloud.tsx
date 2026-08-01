'use client'

// Pixel-art thinking cloud that floats above Eren on the home screen.
// Drawn as a low-resolution SVG cell grid with shape-rendering: crispEdges
// so it matches the rest of the pixel UI instead of looking like a smooth
// vector bubble.
//
// Four interaction states:
//   1. 'idle'    — single small pixel cloud with three pulsing dots and two
//                  trailing puffs leading down to Eren's head.
//   2. 'split'   — the cloud splits into three side-by-side mini clouds
//                  (note / gift / board), each carrying a pixel icon.
//   3. 'message' — full message composer modal.
//   4. 'gift'    — full gift picker modal.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useErenStats } from '@/hooks/useErenStats'
import { playSound } from '@/lib/sounds'
import { FOOD_META, FOOD_ORDER } from '@/lib/foodMeta'
import FoodIcon from '@/components/care/FoodIcon'
import { IconEnvelope, IconGift, IconClose, IconPin } from '@/components/PixelIcons'
import type { FoodInventory, FoodKey } from '@/types'

type Mode = 'idle' | 'split' | 'message' | 'gift'

const CLOUD_BOTTOM = '30%'
const Z_BACKDROP = 55
const Z_CLOUD = 56
const Z_MODAL = 61

const MSG_TINT = '#A78BFA'
const GIFT_TINT = '#F5C842'
const BOARD_TINT = '#E8A05C'
const MAX_MSG = 200

// Split-cloud width. Sized so the cloud's three full-width interior rows are
// tall enough to seat the icon WITHIN the puff — the old emoji was scaled off
// the SVG grid and burst out through the outline.
const CLOUD_TAB_W = 84
const CLOUD_TAB_ICON = 20

export default function ThoughtCloud() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { partner, sendMessage, unreadNotes } = useCouple()
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
    // viaEren=true so the partner gets the dedicated popup + the
    // "Eren has a message for you" push notification, and the row is
    // kept out of the heart-button journal list.
    await sendMessage(text.trim(), null, true)
    setText('')
    setToast('Delivered — and pinned to the board')
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
    await sendMessage('', { key, qty: 1 }, true)
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
          className="active:scale-95 transition-transform pointer-events-auto relative"
          style={{ background: 'transparent', border: 'none', padding: 0 }}
          aria-label="Open Eren's thought"
        >
          <PixelCloud width={64} dots />
          {/* Unread notes waiting on the board — the home screen's only tell
              that one arrived while the app was closed. */}
          {unreadNotes > 0 && (
            <span className="absolute flex items-center justify-center" style={{
              top: -4, right: -6, minWidth: 15, height: 15, padding: '0 3px',
              fontFamily: '"Press Start 2P"', fontSize: 5, color: '#FFF',
              background: '#FF1D5E', border: '2px solid #FFF',
              boxShadow: '0 0 5px rgba(255,29,94,0.7)', borderRadius: 6,
            }}>{unreadNotes > 9 ? '9+' : unreadNotes}</span>
          )}
        </button>
        <TrailingPuffs />
      </CloudAnchor>
    )
  }

  // ── split: three side-by-side mini pixel clouds ───────────────────
  if (mode === 'split') {
    return (
      <>
        <div
          className="fixed inset-0"
          style={{ zIndex: Z_BACKDROP, background: 'rgba(0,0,0,0.18)' }}
          onClick={() => { playSound('ui_modal_close'); setMode('idle') }}
        />

        {/* Centred while open: three 84 px tabs are 272 px wide, which would
            run off the right edge from the idle cloud's 68 % anchor. */}
        <CloudAnchor zIndex={Z_CLOUD} left="50%">
          <div
            className="flex items-start gap-2.5"
            style={{ animation: 'tcSplitIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <CloudTab
              tint={MSG_TINT} label="NOTE" ariaLabel="Send a message"
              onPick={() => setMode('message')}
            >
              <IconEnvelope size={CLOUD_TAB_ICON} />
            </CloudTab>
            <CloudTab
              tint={GIFT_TINT} label="GIFT" ariaLabel="Send a gift"
              onPick={() => setMode('gift')}
            >
              <IconGift size={CLOUD_TAB_ICON} />
            </CloudTab>
            <CloudTab
              tint={BOARD_TINT} label="BOARD" ariaLabel="Open the note board"
              badge={unreadNotes}
              onPick={() => router.push('/notes')}
            >
              <IconPin size={CLOUD_TAB_ICON} tone="#E8365D" />
            </CloudTab>
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
  const isMsg = mode === 'message'
  const tint = isMsg ? MSG_TINT : GIFT_TINT
  const partnerFirst = partner?.name?.split(' ')[0] ?? 'them'

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
        <ComposerCard
          tint={tint}
          icon={isMsg ? <IconEnvelope size={12} /> : <IconGift size={12} />}
          title={isMsg ? `A NOTE FOR ${partnerFirst.toUpperCase()}` : 'PICK FROM YOUR FRIDGE'}
          onClose={() => { playSound('ui_modal_close'); setMode('idle') }}
        >
          {noPartner ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-gray-600">
                Invite your partner first so Eren can deliver this.
              </p>
            </div>
          ) : isMsg ? (
            <div className="px-3 py-3 flex flex-col gap-2 w-full">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="thinking of you…"
                maxLength={MAX_MSG}
                rows={3}
                autoFocus
                className="w-full p-2.5 text-sm text-gray-700 resize-none focus:outline-none"
                style={{
                  // Ruled notepaper — the lines make the box read as something
                  // Eren carries, not as a form field.
                  background: 'repeating-linear-gradient(#FFFDF7 0 21px, #EFE6FA 21px 22px)',
                  border: `2px dashed ${tint}88`,
                  lineHeight: '22px',
                  fontFamily: 'inherit',
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel" style={{
                  fontSize: 6,
                  color: text.length >= MAX_MSG ? '#C0407A' : '#B0A0C0',
                }}>
                  {text.length}/{MAX_MSG}
                </span>
                <button
                  onClick={() => { playSound('ui_tap'); handleSendMessage() }}
                  disabled={!text.trim() || sending}
                  className="flex items-center gap-1.5 px-4 py-2 text-white active:translate-y-[1px] disabled:opacity-40 transition-transform"
                  style={{
                    background: tint,
                    border: '2px solid #7C3AED',
                    boxShadow: '0 3px 0 #5B21B6',
                    fontFamily: '"Press Start 2P"',
                    fontSize: 7,
                  }}
                >
                  {sending ? '...' : 'SEND'}
                </button>
              </div>
              <button
                onClick={() => { playSound('ui_tap'); router.push('/notes') }}
                className="flex items-center gap-1.5 self-start active:translate-y-[1px] transition-transform"
                style={{ background: 'transparent', border: 'none', padding: '2px 0' }}
              >
                <IconPin size={11} tone={BOARD_TINT} />
                <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1, color: '#8A7A9A' }}>
                  EVERY NOTE IS KEPT ON THE BOARD
                </span>
              </button>
            </div>
          ) : (
            <div className="px-3 py-3 flex flex-col gap-2 w-full">
              {giftableKeys.length === 0 ? (
                <p className="text-center text-xs text-gray-500 py-3">
                  Your fridge is empty. Buy something in the Kitchen first!
                </p>
              ) : (
                // Capped + scrollable: a stocked fridge runs to 50 foods, which
                // used to grow the card straight off the bottom of the screen.
                <div className="grid grid-cols-3 gap-2 overflow-y-auto"
                  style={{ maxHeight: '44vh', overscrollBehavior: 'contain' }}>
                  {giftableKeys.map(key => {
                    const meta = FOOD_META[key]
                    const qty = myPile[key] ?? 0
                    return (
                      <button
                        key={key}
                        onClick={() => { playSound('ui_tap'); handleSendGift(key) }}
                        disabled={sending}
                        className="relative flex flex-col items-center gap-1 px-1 pt-2 pb-1.5 active:translate-y-[1px] disabled:opacity-50 transition-transform"
                        style={{
                          background: '#FFFFFF',
                          // Neutral frame on purpose. Tinting it per food made
                          // the pale ones (egg, milk) look borderless next to
                          // pizza, and the kitchen already learned that a
                          // coloured surface competes with the art. The food is
                          // the only coloured thing on the card.
                          border: '2px solid #E6DCF2',
                          boxShadow: '2px 2px 0 rgba(90,70,120,0.13)',
                        }}
                      >
                        {/* The real plate, same renderer as the kitchen — a
                            gift should look like the food you're giving. */}
                        <div className="flex items-center justify-center" style={{ height: 40 }}>
                          <FoodIcon id={key} size={40} />
                        </div>
                        <span className="font-bold text-gray-700 leading-tight text-center"
                          style={{ fontSize: 10 }}>
                          {meta.name}
                        </span>
                        {/* Stock count as a corner badge — it was competing
                            with the name as a third stacked text line. Sits
                            INSIDE the card: the scroll container clips anything
                            hanging off the edge. One dark chip for every food,
                            because white-on-#F5E6C8 (egg) was invisible. */}
                        <span className="font-pixel absolute flex items-center justify-center"
                          style={{
                            top: 3, right: 3, minWidth: 14, height: 14, padding: '0 3px',
                            fontSize: 6, color: '#FFF', background: '#5A4A6A',
                          }}>
                          {qty}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </ComposerCard>

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
// 14 cols × 7 rows. Symmetric puff silhouette — bumps on BOTH the top
// and bottom edges so the shape reads as a real fluffy cloud, not as
// castle battlements with a flat base. Two top puffs + two bottom puffs
// offset against each other, plus side curls. Three dots sit on the
// widest row through the middle.
const CLOUD_GRID: string[] = [
  '....##..##....',
  '..##oo##oo##..',
  '.#oooooooooo#.',
  '#ooDoooDoooDo#',
  '.#oooooooooo#.',
  '..##oo##oo##..',
  '....##..##....',
]

function PixelCloud({
  width,
  tint = '#7C3AED',
  dots = false,
}: {
  width: number
  tint?: string
  dots?: boolean
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
      style={{
        display: 'block',
        imageRendering: 'pixelated',
        // Squash-and-stretch the silhouette itself so the cloud puffs
        // breathe instead of staying rigid while it drifts.
        transformOrigin: '50% 60%',
        animation: dots
          ? 'tcCloudBreathe 2.2s ease-in-out infinite'
          : 'tcCloudBreatheSm 2.4s ease-in-out infinite',
      }}
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

      <style>{`
        @keyframes tcDotBlink {
          0%, 49%   { opacity: 0.25; }
          50%, 100% { opacity: 1; }
        }
        @keyframes tcCloudBreathe {
          0%   { transform: scale(1, 1)         skewX(0deg); }
          25%  { transform: scale(1.06, 0.95)   skewX(-1.5deg); }
          50%  { transform: scale(1.02, 1.04)   skewX(0deg); }
          75%  { transform: scale(0.97, 1.03)   skewX(1.5deg); }
          100% { transform: scale(1, 1)         skewX(0deg); }
        }
        @keyframes tcCloudBreatheSm {
          0%   { transform: scale(1, 1)         skewX(0deg); }
          50%  { transform: scale(1.05, 0.96)   skewX(-1deg); }
          100% { transform: scale(1, 1)         skewX(0deg); }
        }
      `}</style>
    </svg>
  )
}

// ────────────────────────────────────────────────────────────────────
// CloudTab — one of the two split clouds: a pixel puff with an icon
// riding on it and a label underneath.
//
// The icon is an HTML sibling layered over the SVG rather than a child of
// it, so it stays put while the cloud breathes beneath — a pixel glyph
// smears badly if you scale it 6% at 18px.
// ────────────────────────────────────────────────────────────────────
function CloudTab({
  tint, label, ariaLabel, onPick, badge = 0, children,
}: {
  tint: string
  label: string
  ariaLabel: string
  onPick: () => void
  /** Unread count shown as a corner pip. 0 hides it. */
  badge?: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); playSound('ui_tap'); onPick() }}
      className="flex flex-col items-center gap-1 active:scale-95 transition-transform pointer-events-auto"
      style={{ background: 'transparent', border: 'none', padding: 0 }}
      aria-label={ariaLabel}
    >
      <span style={{ position: 'relative', display: 'block' }}>
        <PixelCloud width={CLOUD_TAB_W} tint={tint} />
        <span style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          {children}
        </span>
        {badge > 0 && (
          <span className="absolute flex items-center justify-center" style={{
            top: -2, right: 4, minWidth: 15, height: 15, padding: '0 3px',
            fontFamily: '"Press Start 2P"', fontSize: 5, color: '#FFF',
            background: '#FF1D5E', border: '2px solid #FFF',
            boxShadow: '0 0 5px rgba(255,29,94,0.7)', borderRadius: 6,
          }}>{badge > 9 ? '9+' : badge}</span>
        )}
      </span>
      {/* Label sits on its own chip rather than floating on the room art — a
          4-way white text-halo blurred the 6px glyphs into mush. */}
      <span className="font-pixel" style={{
        fontSize: 6, letterSpacing: 1, color: '#4A3A5A',
        background: '#FFF', padding: '2px 5px',
        border: `2px solid ${tint}`,
        boxShadow: '1px 1px 0 rgba(0,0,0,0.2)',
      }}>
        {label}
      </span>
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────
// ComposerCard — shared frame for the note and gift modals, so the two
// read as one object in two moods rather than two separate boxes.
// ────────────────────────────────────────────────────────────────────

// Gold rivet pixels at the inner corners — the app's "premium card" tell.
const RIVETS: React.CSSProperties[] = [
  { top: 3, left: 3 }, { top: 3, right: 3 }, { bottom: 3, left: 3 }, { bottom: 3, right: 3 },
]

function ComposerCard({
  tint, icon, title, onClose, children,
}: {
  tint: string
  icon: React.ReactNode
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{
      width: '100%',
      background: '#FFFDF7',
      border: `3px solid ${tint}`,
      boxShadow: `4px 4px 0 ${tint}AA`,
      position: 'relative',
      animation: 'tcCardIn 0.24s cubic-bezier(0.34,1.56,0.64,1) both',
    }}>
      {RIVETS.map((pos, i) => (
        <span key={i} style={{ position: 'absolute', width: 2, height: 2, background: '#F5C842', ...pos }} />
      ))}

      {/* Titlebar — icon + label on the left, a real close target on the
          right. Before this the only way out was tapping the backdrop. */}
      <div className="flex items-center justify-between px-2.5 py-2"
        style={{ background: `${tint}22`, borderBottom: `2px solid ${tint}55` }}>
        <span className="flex items-center gap-1.5 min-w-0">
          {icon}
          <span className="font-pixel truncate" style={{ fontSize: 6, letterSpacing: 1, color: '#4A3A5A' }}>
            {title}
          </span>
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-6 h-6 flex items-center justify-center flex-shrink-0 active:translate-y-[1px] transition-transform"
          style={{ background: '#FFF', border: `2px solid ${tint}77` }}
        >
          <IconClose size={8} />
        </button>
      </div>

      {children}

      <style jsx>{`
        @keyframes tcCardIn {
          0%   { transform: scale(0.94) translateY(6px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// CloudAnchor — fixed-positioned wrapper that sits the cloud just
// above Eren on the home screen.
// ────────────────────────────────────────────────────────────────────
function CloudAnchor({ children, zIndex, left = '68%' }: {
  children: React.ReactNode
  zIndex: number
  /** Horizontal anchor. Defaults to Eren's right shoulder; the open split
   *  passes 50% because three tabs are too wide to hang off-centre. */
  left?: string
}) {
  return (
    <div
      className="fixed pointer-events-none"
      style={{
        bottom: CLOUD_BOTTOM,
        // Shifted right of Eren's head — the cloud now peeks out from his
        // right side rather than floating directly above him. translateX
        // keeps the element anchored to that offset point.
        left,
        transform: 'translateX(-50%)',
        zIndex,
        animation: 'tcDrift 2.6s ease-in-out infinite',
      }}
    >
      {children}
      <style jsx>{`
        @keyframes tcDrift {
          0%   { transform: translate(-50%, 0)    rotate(-1.5deg); }
          25%  { transform: translate(-48%, -5px) rotate(0.8deg); }
          50%  { transform: translate(-50%, -7px) rotate(1.5deg); }
          75%  { transform: translate(-52%, -4px) rotate(-0.6deg); }
          100% { transform: translate(-50%, 0)    rotate(-1.5deg); }
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
