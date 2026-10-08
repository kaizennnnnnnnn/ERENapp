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
//   3. 'message' — the note composer, a Meadow sheet.
//   4. 'gift'    — the gift picker, the same sheet in its other mood.
//
// The clouds are pixel art on the room painting and stay that way; the two
// composers are ordinary app screens, so they're Meadow sheets like Send Eren.

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useErenStats } from '@/hooks/useErenStats'
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'
import { FOOD_META, FOOD_ORDER } from '@/lib/foodMeta'
import FoodIcon from '@/components/care/FoodIcon'
import { IconEnvelope, IconGift, IconPin } from '@/components/PixelIcons'
import {
  IconTile, MeadowIcon, PrimaryButton, Sheet, Tag, TextButton,
  FONT_ROUNDED, M, TINT, TYPE,
} from '@/components/meadow'
import type { FoodInventory, FoodKey } from '@/types'

type Mode = 'idle' | 'split' | 'message' | 'gift'

const CLOUD_BOTTOM = '30%'
const Z_BACKDROP = 55
const Z_CLOUD = 56

const MSG_TINT = '#A78BFA'
const GIFT_TINT = '#F5C842'
const BOARD_TINT = '#E8A05C'
const MAX_MSG = 200
/** How long "Delivered" stays before the sheet drops away by itself. */
const SENT_HOLD_MS = 1100

// Split-cloud width. Sized so the cloud's three full-width interior rows are
// tall enough to seat the icon WITHIN the puff — the old emoji was scaled off
// the SVG grid and burst out through the outline.
const CLOUD_TAB_W = 84
const CLOUD_TAB_ICON = 20

// Per-cloud motion. All three used to inherit ONE drift animation from the
// shared anchor and one breathe period, so the row rose and fell as a single
// rigid slab. Each now bobs on its own: the periods are deliberately not
// multiples of each other, so they drift in and out of phase instead of
// re-syncing every few seconds,
// and the negative delays mean they start already scattered rather than lining
// up on the first frame.
interface TabMotion {
  float: string; floatDelay: string
  lift: string; rot: string
  breathe: string; breatheDelay: string
}
const TAB_MOTION: TabMotion[] = [
  { float: '2.3s', floatDelay: '-0.4s', lift: '-7px', rot: '1.6deg',  breathe: '2.1s', breatheDelay: '-0.9s' },
  { float: '3.1s', floatDelay: '-1.7s', lift: '-4px', rot: '-1.1deg', breathe: '2.7s', breatheDelay: '-0.2s' },
  { float: '2.7s', floatDelay: '-1.1s', lift: '-6px', rot: '2.1deg',  breathe: '2.4s', breatheDelay: '-1.5s' },
]

export default function ThoughtCloud() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { partner, isSolo, sendMessage, unreadNotes } = useCouple()
  const { stats, giftFood } = useErenStats(profile?.household_id ?? null)
  const cat = useCat()

  const [mode, setMode] = useState<Mode>('idle')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  // After a send: the line that says it landed, in place of the form.
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  // The sheet keeps showing the composer it opened with while it slides away.
  const [shown, setShown] = useState<'message' | 'gift'>('message')
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const noteId = useId()
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => { if (mode === 'message' || mode === 'gift') setShown(mode) }, [mode])

  const partnerFirst = partner?.name?.split(' ')[0] ?? 'them'
  const myPile: FoodInventory = (user?.id && stats?.food_by_user?.[user.id]) || {}
  const giftableKeys: FoodKey[] = FOOD_ORDER.filter(k => (myPile[k] ?? 0) > 0)
  const noPartner = !partner

  function openComposer(next: 'message' | 'gift') {
    setSent(null)
    setError(null)
    setMode(next)
  }

  function closeComposer() {
    playSound('ui_modal_close')
    setMode('idle')
  }

  // Say it landed, then let the sheet go by itself.
  function landed(line: string) {
    setSent(line)
    playSound('quest_complete')
    timers.current.push(setTimeout(() => setMode('idle'), SENT_HOLD_MS))
  }

  async function handleSendMessage() {
    if (!text.trim() || sending) return
    playSound('ui_tap')
    setSending(true)
    setError(null)
    // viaEren=true so the partner gets the dedicated popup + the
    // "Eren has a message for you" push notification, and the row is
    // kept out of the heart-button journal list.
    const ok = await sendMessage(text.trim(), null, true)
    setSending(false)
    // A failed send keeps the words: it used to clear them and say
    // "Delivered" whatever happened.
    if (!ok) { setError("That didn't send. Check your connection and try again."); return }
    setText('')
    landed('Delivered, and pinned to the board')
  }

  async function handleSendGift(key: FoodKey) {
    if (sending || !user?.id || !partner?.id) return
    playSound('ui_tap')
    setSending(true)
    setError(null)
    const moved = await giftFood(user.id, partner.id, key)
    if (!moved) {
      setError(`There's no ${FOOD_META[key].name} left to give.`)
      setSending(false)
      return
    }
    const noted = await sendMessage('', { key, qty: 1 }, true)
    setSending(false)
    landed(noted
      ? `${FOOD_META[key].name} is on its way to ${partnerFirst}`
      : `${FOOD_META[key].name} went to ${partnerFirst}'s fridge`)
  }

  // ── Nothing behind it for a household of one ──────────────────────
  // All three tabs are dead solo. NOTE and GIFT both land on "Invite your
  // partner first so Eren can deliver this", and BOARD opens /notes, which
  // 77d444b established can never hold anything alone — this component is the
  // only thing that writes to it, and it refuses. The idle badge counts unread
  // notes, which is permanently zero for the same reason.
  //
  // So it is a button floating over Eren on the main screen whose every path
  // is a refusal. Hidden, not repointed: 77d444b removed the /couple entry to
  // the same board for the same reason and left this one, the primary one,
  // still there.
  //
  // `isSolo`, not `!partner` — partner is null while loading and null if the
  // read 503s, and the cloud vanishing for a beat on every launch would be a
  // worse bug than the one being fixed.
  if (isSolo) return null

  // ── idle: single pixel cloud (also what sits behind an open composer) ──
  const idleCloud = (
      <CloudAnchor zIndex={4}>
        <button
          onClick={() => { playSound('ui_modal_open'); setMode('split') }}
          className="active:scale-95 transition-transform pointer-events-auto relative"
          style={{ background: 'transparent', border: 'none', padding: 0 }}
          aria-label={cat.t("Open {name}'s thought")}
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

  // ── split: three side-by-side mini pixel clouds ───────────────────
  const splitClouds = (
      <>
        <div
          className="fixed inset-0"
          style={{ zIndex: Z_BACKDROP, background: 'rgba(0,0,0,0.18)' }}
          onClick={() => { playSound('ui_modal_close'); setMode('idle') }}
        />

        {/* Centred while open: three 84 px tabs are 272 px wide, which would
            run off the right edge from the idle cloud's 68 % anchor. */}
        <CloudAnchor zIndex={Z_CLOUD} left="50%" drift={false}>
          <div
            className="flex items-start gap-2.5"
            style={{ animation: 'tcSplitIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <CloudTab
              tint={MSG_TINT} label="NOTE" ariaLabel="Send a message"
              motion={TAB_MOTION[0]}
              onPick={() => openComposer('message')}
            >
              <IconEnvelope size={CLOUD_TAB_ICON} />
            </CloudTab>
            <CloudTab
              tint={GIFT_TINT} label="GIFT" ariaLabel="Send a gift"
              motion={TAB_MOTION[1]}
              onPick={() => openComposer('gift')}
            >
              <IconGift size={CLOUD_TAB_ICON} />
            </CloudTab>
            <CloudTab
              tint={BOARD_TINT} label="BOARD" ariaLabel="Open the note board"
              motion={TAB_MOTION[2]}
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
          /* Per-cloud bob. Amplitude and tilt come from --tc-lift / --tc-rot so
             one keyframe can serve three clouds with visibly different motion. */
          @keyframes tcTabFloat {
            0%   { transform: translateY(0)               rotate(calc(var(--tc-rot) * -1)); }
            50%  { transform: translateY(var(--tc-lift))  rotate(var(--tc-rot)); }
            100% { transform: translateY(0)               rotate(calc(var(--tc-rot) * -1)); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes tcTabFloat { 0%, 100% { transform: none; } }
          }
        `}</style>
      </>
  )

  // ── composer sheet (note / gift) ──────────────────────────────────
  const isMsg = shown === 'message'
  const open = mode === 'message' || mode === 'gift'
  const atMax = text.length >= MAX_MSG

  const footer = sent || noPartner ? undefined : isMsg ? (
    <div>
      {error && <p role="alert" style={ERROR}>{error}</p>}
      <PrimaryButton busy={sending} disabled={!text.trim()} onClick={handleSendMessage}
        icon={<MeadowIcon name="envelope" size={20} color="#FFFFFF" mono />}>
        {sending ? 'Sending...' : 'Send note'}
      </PrimaryButton>
    </div>
  ) : error ? <p role="alert" style={{ ...ERROR, margin: 0 }}>{error}</p> : undefined

  return (
    <>
      {mode === 'split' ? splitClouds : idleCloud}

      <Sheet
        open={open}
        onClose={closeComposer}
        title={isMsg ? `A note for ${partnerFirst}` : `A gift for ${partnerFirst}`}
        dismissible={!sending}
        initialFocus={isMsg && !noPartner ? noteRef : undefined}
        footer={footer}
      >
        {sent ? (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 4px 12px' }}>
            <IconTile icon="check" size={48} bg={TINT.leaf} color={M.leaf} />
            <span style={{ fontSize: 17, fontWeight: 800, color: M.text }}>{sent}</span>
          </div>
        ) : noPartner ? (
          <p style={{ margin: '4px 4px 12px', ...TYPE.body, color: M.text2 }}>
            {cat.t('Invite your partner first so {name} can deliver this.')}
          </p>
        ) : isMsg ? (
          <div style={{ margin: '4px 4px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label htmlFor={noteId} className="sr-only">Your note</label>
            <textarea
              ref={noteRef}
              id={noteId}
              value={text}
              onChange={e => { setText(e.target.value); if (error) setError(null) }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Thinking of you"
              maxLength={MAX_MSG}
              rows={4}
              className="m-input"
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'none', padding: '14px 16px',
                border: `2px solid ${focused ? M.leaf : M.hairline}`, borderRadius: 16,
                boxShadow: focused ? `0 0 0 4px ${M.leafTint}` : 'none',
                background: '#FFFFFF', color: M.text, caretColor: M.leaf, outline: 'none',
                fontFamily: FONT_ROUNDED, fontSize: 17, lineHeight: 1.45, fontWeight: 600,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {/* Where every note ends up, and the way there. */}
              <TextButton tone="muted" size={14} chevron
                icon={<MeadowIcon name="pin" size={18} />}
                onClick={() => { playSound('ui_tap'); router.push('/notes') }}
                style={{ padding: '0 4px 0 0', gap: 6 }}>
                Every note is kept on the board
              </TextButton>
              <span aria-live="polite" style={{
                flexShrink: 0, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                color: atMax ? M.danger : M.faint,
              }}>
                {text.length}/{MAX_MSG}
              </span>
            </div>
          </div>
        ) : giftableKeys.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 12px 16px', textAlign: 'center' }}>
            <IconTile icon="bowl" size={60} bg={TINT.orange} />
            <p style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 800 }}>Your fridge is empty</p>
            <p style={{ margin: 0, ...TYPE.body, color: M.text2 }}>Buy something in the Kitchen first.</p>
          </div>
        ) : (
          <>
            <p style={{ margin: '0 4px 14px', fontSize: 15, fontWeight: 600, color: M.text2 }}>
              Pick something from your fridge. It goes to {partnerFirst}&apos;s.
            </p>
            <div role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, margin: '0 4px' }}>
              {giftableKeys.map(key => {
                const name = FOOD_META[key].name
                const qty = myPile[key] ?? 0
                return (
                  <div key={key} role="listitem">
                    <button
                      type="button"
                      onClick={() => handleSendGift(key)}
                      disabled={sending}
                      aria-label={`Give ${name}. You have ${qty}.`}
                      className="m-press m-focus"
                      style={{
                        position: 'relative', width: '100%', boxSizing: 'border-box',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        padding: '12px 6px 10px', borderRadius: 18, border: `2px solid ${M.hairline}`,
                        background: '#FFFFFF', fontFamily: FONT_ROUNDED, color: M.text,
                        cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.5 : 1,
                      }}
                    >
                      {/* The real plate, same as the Kitchen: a gift should look
                          like the food you're giving. */}
                      <FoodIcon id={key} size={44} />
                      <span style={{
                        fontSize: 13, lineHeight: 1.25, fontWeight: 700, textAlign: 'center',
                        overflowWrap: 'anywhere',
                      }}>
                        {name}
                      </span>
                      <Tag size="sm" style={{ position: 'absolute', top: 6, right: 6, fontVariantNumeric: 'tabular-nums' }}>
                        {qty}
                      </Tag>
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Sheet>
    </>
  )
}

const ERROR: React.CSSProperties = {
  margin: '0 0 12px', fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.danger, textAlign: 'center',
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
  breathe,
  breatheDelay,
}: {
  width: number
  tint?: string
  dots?: boolean
  /** Override the puff-breathe period. Split tabs pass their own so the three
   *  clouds don't squash in unison. */
  breathe?: string
  /** Negative delay — starts the loop already mid-cycle instead of letting all
   *  three fall into step at t=0. */
  breatheDelay?: string
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
          : `tcCloudBreatheSm ${breathe ?? '2.4s'} ease-in-out infinite`,
        animationDelay: breatheDelay,
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
  tint, label, ariaLabel, onPick, motion, badge = 0, children,
}: {
  tint: string
  label: string
  ariaLabel: string
  onPick: () => void
  /** This cloud's own drift + breathe timings — see TAB_MOTION. */
  motion: TabMotion
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
      {/* The cloud floats; the label chip below stays put, so the row of
          labels reads as a stable base under three independent puffs. */}
      <span style={{
        position: 'relative', display: 'block',
        ['--tc-lift' as string]: motion.lift,
        ['--tc-rot' as string]: motion.rot,
        animation: `tcTabFloat ${motion.float} ease-in-out infinite`,
        animationDelay: motion.floatDelay,
      }}>
        <PixelCloud width={CLOUD_TAB_W} tint={tint}
          breathe={motion.breathe} breatheDelay={motion.breatheDelay} />
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
// CloudAnchor — fixed-positioned wrapper that sits the cloud just
// above Eren on the home screen.
// ────────────────────────────────────────────────────────────────────
function CloudAnchor({ children, zIndex, left = '68%', drift = true }: {
  children: React.ReactNode
  zIndex: number
  /** Horizontal anchor. Defaults to Eren's right shoulder; the open split
   *  passes 50% because three tabs are too wide to hang off-centre. */
  left?: string
  /** Drift the whole anchor. Right for the lone idle cloud; the split turns it
   *  OFF, because moving the wrapper moves all three clouds as one slab — each
   *  tab carries its own float instead. */
  drift?: boolean
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
        animation: drift ? 'tcDrift 2.6s ease-in-out infinite' : undefined,
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
