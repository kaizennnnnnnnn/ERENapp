'use client'

// The thought cloud that floats beside the cat on the home screen: the way to
// send your partner a note or a gift through the cat.
//
// Four interaction states:
//   1. 'idle'    — one small cloud with three blinking dots and two trailing
//                  puffs leading down to the cat's head.
//   2. 'split'   — the cloud splits into three clouds side by side (note /
//                  gift / board), each with its icon on a tint and a label.
//   3. 'message' — the note composer, a Meadow sheet.
//   4. 'gift'    — the gift picker, the same sheet in its other mood.
//
// In the Meadow look: the clouds are white pieces over the room art like the
// top bar and the home row (soft round shapes, the over-art lip, no outline,
// no glow). Each one still bobs on its own.

import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useErenStats } from '@/hooks/useErenStats'
import { useCat } from '@/hooks/useCat'
import { playSound } from '@/lib/sounds'
import { FOOD_META, FOOD_ORDER } from '@/lib/foodMeta'
import FoodIcon from '@/components/care/FoodIcon'
import HudBadge from '@/components/home/HudBadge'
import {
  IconTile, MeadowIcon, PrimaryButton, Sheet, Tag, TextButton,
  FONT_ROUNDED, M, TINT, TYPE,
} from '@/components/meadow'
import type { MeadowIconName } from '@/components/PixelIcons'
import type { FoodInventory, FoodKey } from '@/types'

type Mode = 'idle' | 'split' | 'message' | 'gift'

const CLOUD_BOTTOM = '30%'
const Z_BACKDROP = 55
const Z_CLOUD = 56

const MAX_MSG = 200
/** How long "Delivered" stays before the sheet drops away by itself. */
const SENT_HOLD_MS = 1100

const IDLE_CLOUD_W = 70
// Three 88px clouds and their gaps are 284px: room to spare at 360.
const CLOUD_TAB_W = 88

// The three clouds of the split, left to right.
const TABS: { key: 'message' | 'gift' | 'board'; label: string; ariaLabel: string; icon: MeadowIconName; tint: string; color?: string }[] = [
  { key: 'message', label: 'Note', ariaLabel: 'Send a note', icon: 'envelope', tint: TINT.lilac, color: '#8E7CC3' },
  { key: 'gift', label: 'Gift', ariaLabel: 'Send a gift', icon: 'gift', tint: TINT.leaf },
  { key: 'board', label: 'Board', ariaLabel: 'Open the note board', icon: 'pin', tint: TINT.love },
]

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
  const idleRef = useRef<HTMLButtonElement>(null)
  const firstTabRef = useRef<HTMLButtonElement>(null)
  const noteId = useId()
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => { if (mode === 'message' || mode === 'gift') setShown(mode) }, [mode])

  // The split is a little menu: focus lands on its first cloud (and Escape
  // there folds it back into the one cloud, focus with it).
  useEffect(() => {
    if (mode === 'split') firstTabRef.current?.focus({ preventScroll: true })
  }, [mode])

  const partnerFirst = partner?.name?.split(' ')[0] ?? 'them'
  const myPile: FoodInventory = (user?.id && stats?.food_by_user?.[user.id]) || {}
  const giftableKeys: FoodKey[] = FOOD_ORDER.filter(k => (myPile[k] ?? 0) > 0)
  const noPartner = !partner

  function openComposer(next: 'message' | 'gift') {
    setSent(null)
    setError(null)
    setMode(next)
  }

  function closeSplit() {
    playSound('ui_modal_close')
    setMode('idle')
    timers.current.push(setTimeout(() => idleRef.current?.focus({ preventScroll: true }), 0))
  }

  function pickTab(key: 'message' | 'gift' | 'board') {
    playSound('ui_tap')
    if (key === 'board') router.push('/notes')
    else openComposer(key)
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

  // ── idle: one cloud (also what sits behind an open composer) ──────
  const unreadLabel = unreadNotes > 0
    ? `, ${unreadNotes} new ${unreadNotes === 1 ? 'note' : 'notes'} on the board`
    : ''
  const idleCloud = (
      <CloudAnchor zIndex={4}>
        <button
          ref={idleRef}
          type="button"
          onClick={() => { playSound('ui_modal_open'); setMode('split') }}
          className="m-press m-focus pointer-events-auto"
          style={{ position: 'relative', display: 'block', background: 'transparent', border: 'none', padding: 0, borderRadius: 24 }}
          aria-label={cat.t("Open {name}'s thought") + unreadLabel}
        >
          <SoftCloud width={IDLE_CLOUD_W} dots breathe="2.2s" />
          {/* Unread notes waiting on the board: the home screen's only tell
              that one arrived while the app was closed. */}
          {unreadNotes > 0 && <CloudBadge count={unreadNotes} />}
        </button>
        <TrailingPuffs />
      </CloudAnchor>
  )

  // ── split: three clouds side by side ──────────────────────────────
  const splitClouds = (
      <>
        <div
          aria-hidden
          className="fixed inset-0"
          style={{ zIndex: Z_BACKDROP, background: 'rgba(47, 43, 40, 0.18)' }}
          onClick={closeSplit}
        />

        {/* Centred while open: three clouds are too wide to hang off the idle
            cloud's 68% anchor. */}
        <CloudAnchor zIndex={Z_CLOUD} left="50%" drift={false}>
          <div
            role="group"
            aria-label={cat.t("Send something through {name}")}
            onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); closeSplit() } }}
            className="flex items-start"
            style={{ gap: 10, animation: 'tcSplitIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            {TABS.map((t, i) => (
              <CloudTab
                key={t.key}
                ref={i === 0 ? firstTabRef : undefined}
                tab={t}
                motion={TAB_MOTION[i]}
                badge={t.key === 'board' ? unreadNotes : 0}
                onPick={() => pickTab(t.key)}
              />
            ))}
          </div>
          <TrailingPuffs />
        </CloudAnchor>
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
      <CloudKeyframes />

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
// SoftCloud — a white cloud drawn from three round puffs on a rounded
// base, with the over-art lip under it.
//
// The lip is the same shapes 3px lower, painted as ONE layer (group
// opacity) so the puffs' overlaps don't darken where they meet.
// `width` sets the rendered width; height follows the 100 × 62 box.
// ────────────────────────────────────────────────────────────────────
const CLOUD_VB_W = 100
const CLOUD_VB_H = 62

function CloudShapes() {
  return (
    <>
      <rect x={6} y={28} width={88} height={30} rx={15} />
      <circle cx={30} cy={32} r={18} />
      <circle cx={55} cy={26} r={22} />
      <circle cx={77} cy={35} r={15} />
    </>
  )
}

function SoftCloud({ width, dots = false, breathe, breatheDelay }: {
  width: number
  /** The three blinking dots of the idle cloud. */
  dots?: boolean
  /** Puff-breathe period; the split clouds pass their own so they don't
   *  squash in unison. */
  breathe: string
  /** Negative delay: starts the loop already mid-cycle. */
  breatheDelay?: string
}) {
  return (
    <svg
      width={width}
      height={Math.round((width * CLOUD_VB_H) / CLOUD_VB_W)}
      viewBox={`0 0 ${CLOUD_VB_W} ${CLOUD_VB_H}`}
      aria-hidden
      className="tc-move"
      style={{
        display: 'block', overflow: 'visible',
        // The puffs breathe while the cloud drifts, so it never sits rigid.
        transformOrigin: '50% 60%',
        animation: `tcCloudBreathe ${breathe} ease-in-out infinite`,
        animationDelay: breatheDelay,
      }}
    >
      <g transform="translate(0 3)" fill={M.text} opacity={0.16}><CloudShapes /></g>
      <g fill="#FFFFFF"><CloudShapes /></g>
      {dots && [35, 50, 65].map((cx, i) => (
        <circle
          key={cx} cx={cx} cy={40} r={4.5} fill={M.text2}
          className="tc-move"
          style={{ animation: 'tcDotBlink 1.2s steps(2) infinite', animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </svg>
  )
}

// ────────────────────────────────────────────────────────────────────
// CloudTab — one of the three split clouds: a cloud with its icon on a
// tint riding on it, and a label underneath.
//
// The icon is an HTML sibling layered over the SVG rather than a child of
// it, so it stays put while the cloud breathes beneath.
// ────────────────────────────────────────────────────────────────────
const CloudTab = forwardRef<HTMLButtonElement, {
  tab: (typeof TABS)[number]
  onPick: () => void
  /** This cloud's own drift + breathe timings — see TAB_MOTION. */
  motion: TabMotion
  /** Unread count on the cloud's corner. 0 hides it. */
  badge?: number
}>(function CloudTab({ tab, onPick, motion, badge = 0 }, ref) {
  const cloudH = Math.round((CLOUD_TAB_W * CLOUD_VB_H) / CLOUD_VB_W)
  return (
    <button
      ref={ref}
      type="button"
      onClick={(e) => { e.stopPropagation(); onPick() }}
      className="m-press m-focus pointer-events-auto"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: 'transparent', border: 'none', padding: 0, borderRadius: 20,
        fontFamily: FONT_ROUNDED, cursor: 'pointer',
      }}
      aria-label={badge > 0 ? `${tab.ariaLabel}, ${badge} new` : tab.ariaLabel}
    >
      {/* The cloud floats; the label below stays put, so the row of labels
          reads as a steady base under three independent clouds. */}
      <span className="tc-move" style={{
        position: 'relative', display: 'block',
        ['--tc-lift' as string]: motion.lift,
        ['--tc-rot' as string]: motion.rot,
        animation: `tcTabFloat ${motion.float} ease-in-out infinite`,
        animationDelay: motion.floatDelay,
      }}>
        <SoftCloud width={CLOUD_TAB_W} breathe={motion.breathe} breatheDelay={motion.breatheDelay} />
        {/* Seated on the cloud's broad middle (y 38 of 62), clear of the puffs' edges. */}
        <span style={{
          position: 'absolute', left: '50%', top: Math.round(cloudH * 38 / CLOUD_VB_H),
          transform: 'translate(-50%, -50%)',
          width: 36, height: 36, borderRadius: 999, background: tab.tint,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <MeadowIcon name={tab.icon} size={22} color={tab.color} />
        </span>
        {badge > 0 && <CloudBadge count={badge} />}
      </span>
      <span style={{
        padding: '3px 11px', borderRadius: 999, background: '#FFFFFF',
        boxShadow: `0 2px 0 ${M.overArtLip}`,
        fontSize: 13, lineHeight: '18px', fontWeight: 800, color: M.text,
      }}>
        {tab.label}
      </span>
    </button>
  )
})

// The home row's count badge, seated on the cloud's right puff: that puff
// is lower than the box's top corner, where the badge would hang in the air.
function CloudBadge({ count }: { count: number }) {
  return (
    <span style={{ position: 'absolute', inset: '30% 0 0 0', pointerEvents: 'none' }}>
      <HudBadge>{count > 9 ? '9+' : count}</HudBadge>
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────
// CloudAnchor — fixed-positioned wrapper that sits the cloud just
// above the cat on the home screen.
// ────────────────────────────────────────────────────────────────────
function CloudAnchor({ children, zIndex, left = '68%', drift = true }: {
  children: React.ReactNode
  zIndex: number
  /** Horizontal anchor. Defaults to the cat's right shoulder; the open split
   *  passes 50% because three clouds are too wide to hang off-centre. */
  left?: string
  /** Drift the whole anchor. Right for the lone idle cloud; the split turns it
   *  OFF, because moving the wrapper moves all three clouds as one slab — each
   *  tab carries its own float instead. */
  drift?: boolean
}) {
  return (
    <div
      className={`meadow-root fixed pointer-events-none${drift ? ' tc-move' : ''}`}
      style={{
        bottom: CLOUD_BOTTOM,
        // Right of the cat's head: the cloud peeks out from his right side
        // rather than floating straight above him. translateX keeps the
        // element anchored to that point.
        left,
        transform: 'translateX(-50%)',
        zIndex,
        animation: drift ? 'tcDrift 2.6s ease-in-out infinite' : undefined,
      }}
    >
      {children}
    </div>
  )
}

// Two trailing puffs leading down to the cat: the comic "thinking" tell.
// Sized and spaced to bridge the gap between the cloud and the cat's head.
function TrailingPuffs() {
  const puff = (size: number): React.CSSProperties => ({
    position: 'absolute', width: size, height: size, borderRadius: 999,
    background: '#FFFFFF', boxShadow: `0 2px 0 ${M.overArtLip}`,
  })
  return (
    <>
      <div aria-hidden style={{ ...puff(12), left: '50%', bottom: -14, transform: 'translateX(-50%)' }} />
      <div aria-hidden style={{ ...puff(7), left: 'calc(50% - 15px)', bottom: -25 }} />
    </>
  )
}

// Every keyframe the clouds use, once. A plain <style>: these names are used
// from inline styles, which only resolve global keyframes (the old drift sat
// in a scoped styled-jsx block and so never ran).
function CloudKeyframes() {
  return (
    <style>{`
      @keyframes tcDrift {
        0%   { transform: translate(-50%, 0)    rotate(-1.5deg); }
        25%  { transform: translate(-48%, -5px) rotate(0.8deg); }
        50%  { transform: translate(-50%, -7px) rotate(1.5deg); }
        75%  { transform: translate(-52%, -4px) rotate(-0.6deg); }
        100% { transform: translate(-50%, 0)    rotate(-1.5deg); }
      }
      @keyframes tcSplitIn {
        0%   { transform: scale(0.4); opacity: 0; }
        60%  { transform: scale(1.08); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      /* Per-cloud bob. Amplitude and tilt come from --tc-lift / --tc-rot so
         one keyframe serves three clouds with visibly different motion. */
      @keyframes tcTabFloat {
        0%   { transform: translateY(0)              rotate(calc(var(--tc-rot) * -1)); }
        50%  { transform: translateY(var(--tc-lift)) rotate(var(--tc-rot)); }
        100% { transform: translateY(0)              rotate(calc(var(--tc-rot) * -1)); }
      }
      @keyframes tcCloudBreathe {
        0%   { transform: scale(1, 1); }
        50%  { transform: scale(1.04, 0.97); }
        100% { transform: scale(1, 1); }
      }
      @keyframes tcDotBlink {
        0%, 49%   { opacity: 0.3; }
        50%, 100% { opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        .tc-move { animation: none !important; }
      }
    `}</style>
  )
}
