'use client'

// ─── ErenSpeechBubble ────────────────────────────────────────────────────────
// What he says, over his head, when you talk to him from the attic floor
// instead of opening the transcript.
//
// It shows his reply as it streams and then holds it on a visible countdown —
// the hook clears `streaming` the moment the turn commits, so the last streamed
// text is kept here. Without that the reply would vanish on the same frame it
// finished, which is exactly when you start reading it.
//
// The countdown can be pinned. A reply that disappears on a timer while you're
// still reading is the whole reason the bar is visible in the first place: if
// you can see it running you can see it's about to go, and stop it.
//
// Everything said here is in the transcript too; this is a view of the reply,
// not a second place it lives.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useErenChatContext } from '@/contexts/ErenChatContext'
import { playSound } from '@/lib/sounds'
import { IconPin } from '@/components/PixelIcons'
import PixelPoof from '@/components/PixelPoof'

const LINGER = 7000

const PAPER  = '#FFFBF1'
const EDGE   = '#D3BE96'
const INK    = '#4A3A2A'
const SHADOW = 'rgba(122,74,34,0.28)'
const TRACK  = 'rgba(122,74,34,0.16)'
const FILL   = '#D9974A'
const FROZEN = '#B9A184'
const BAD_PAPER = '#FFECEC'
const BAD_EDGE  = '#E8A0A0'
const BAD_INK   = '#A03030'

interface Shown { text: string; thinking: boolean; bad: boolean }
interface Poof { w: number; h: number }

export default function ErenSpeechBubble() {
  const { sending, streaming, error } = useErenChatContext()
  const [shown, setShown] = useState<Shown | null>(null)
  const [pinned, setPinned] = useState(false)
  const [poof, setPoof] = useState<Poof | null>(null)

  // The reply as it accumulates. A ref, not state — it exists to survive the
  // frame where `streaming` is reset, not to drive a render of its own.
  const live = useRef('')

  const boxRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Countdown state. The bar is written straight to the DOM from a rAF loop
  // rather than animated: a CSS animation on an element that appears while the
  // screen is otherwise static may never get a start time (the same trap that
  // once left this bubble stuck at opacity 0), and a 100ms React interval would
  // re-render the whole bubble seventy times per reply for one bar.
  const deadline  = useRef(0)
  const remaining = useRef(LINGER)
  const raf       = useRef<number | null>(null)

  const stopClock = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current)
    raf.current = null
  }, [])

  /** Puff it away: freeze its footprint, swap in the cloud, then drop it. */
  const dismiss = useCallback(() => {
    stopClock()
    const r = boxRef.current?.getBoundingClientRect()
    playSound('chat_poof')
    setPoof({ w: Math.round(r?.width ?? 120), h: Math.round(r?.height ?? 48) })
    setShown(null)
    setPinned(false)
    live.current = ''
  }, [stopClock])

  const tick = useCallback(() => {
    const left = deadline.current - performance.now()
    remaining.current = Math.max(0, left)
    const bar = barRef.current
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, left / LINGER)) * 100}%`
    if (left <= 0) { dismiss(); return }
    raf.current = requestAnimationFrame(tick)
  }, [dismiss])

  const startClock = useCallback((ms: number) => {
    stopClock()
    remaining.current = ms
    deadline.current = performance.now() + ms
    raf.current = requestAnimationFrame(tick)
  }, [stopClock, tick])

  // He's been asked something. No countdown yet — he hasn't said anything to
  // run one on.
  useEffect(() => {
    if (!sending) return
    stopClock()
    setPoof(null)
    setPinned(false)
    live.current = ''
    setShown({ text: '', thinking: true, bad: false })
  }, [sending, stopClock])

  // He's answering.
  useEffect(() => {
    if (!streaming) return
    live.current = streaming
    setShown({ text: streaming, thinking: false, bad: false })
  }, [streaming])

  // He's finished — hold the last thing he said, and start the clock.
  useEffect(() => {
    if (sending) return
    const text = error || live.current
    if (!text) return
    setShown({ text, thinking: false, bad: !!error })
    startClock(LINGER)
  }, [sending, error, startClock])

  useEffect(() => stopClock, [stopClock])

  function togglePin(e: React.MouseEvent) {
    e.stopPropagation()          // don't let the tap dismiss the bubble
    if (pinned) {
      playSound('ui_tap')
      setPinned(false)
      startClock(remaining.current)   // resumes where it stopped, not from full
    } else {
      playSound('chat_pin')
      setPinned(true)
      stopClock()
    }
  }

  if (poof) {
    return (
      <div style={{ position: 'relative', width: poof.w, height: poof.h, pointerEvents: 'none' }}>
        <PixelPoof
          size={Math.min(Math.max(poof.w * 0.9, 96), 150)}
          onDone={() => setPoof(null)}
        />
      </div>
    )
  }

  if (!shown) return null

  const paper = shown.bad ? BAD_PAPER : PAPER
  const edge  = shown.bad ? BAD_EDGE  : EDGE
  const ink   = shown.bad ? BAD_INK   : INK
  // Nothing to count down while he's still thinking — there's no reply to keep.
  const showClock = !shown.thinking

  return (
    <div
      ref={boxRef}
      onClick={dismiss}
      style={{
        pointerEvents: 'auto',
        // Capped well short of the room's width. Allowed to fill it, a two-line
        // reply becomes a banner across the attic instead of something a cat is
        // saying, and the tail stops reading as attached to anything.
        maxWidth: 'min(80%, 270px)',
        minWidth: showClock ? 132 : undefined,
        background: paper,
        border: `3px solid ${edge}`,
        borderRadius: 13,
        // Hard shadow, no blur — house style.
        boxShadow: `3px 3px 0 ${SHADOW}, inset 0 1px 0 rgba(255,255,255,0.9)`,
        padding: shown.thinking ? '11px 14px' : '10px 12px 8px',
        position: 'relative',
        animation: 'erenSayIn 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        transformOrigin: 'bottom center',
      }}
    >
      {shown.thinking ? (
        <span className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: 5, height: 5, background: EDGE,
              animation: `erenSayDot 900ms steps(1,end) ${i * 300}ms infinite`,
            }} />
          ))}
        </span>
      ) : (
        <span style={{
          display: 'block',
          fontSize: 13, lineHeight: 1.5, color: ink,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          ...(shown.bad ? { fontFamily: '"Press Start 2P"', fontSize: 7, lineHeight: 1.8 } : null),
        }}>
          {shown.bad ? shown.text.toUpperCase() : shown.text}
        </span>
      )}

      {/* ── How long you've got, and the catch that stops it ── */}
      {showClock && (
        <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
          <div style={{ flex: 1, height: 4, background: TRACK, borderRadius: 2, overflow: 'hidden' }}>
            <div
              ref={barRef}
              style={{
                width: '100%', height: '100%',
                background: pinned ? FROZEN : FILL,
                // No transition: the rAF loop writes a fresh width every frame,
                // and easing between them would lag the real deadline.
              }}
            />
          </div>

          <button
            type="button"
            onClick={togglePin}
            aria-label={pinned ? 'Let it go' : 'Keep this up'}
            aria-pressed={pinned}
            className="shrink-0 flex items-center justify-center active:scale-90 transition-transform duration-100"
            style={{
              width: 20, height: 20, borderRadius: 5,
              background: pinned ? '#F0C173' : 'transparent',
              border: `2px solid ${pinned ? '#8A5A22' : EDGE}`,
              opacity: pinned ? 1 : 0.75,
            }}
          >
            <IconPin size={10} />
          </button>
        </div>
      )}

      {/* Tail — a square straddling the bottom edge, turned 45°. Only its two
          outward faces carry the border; its paper covers the slice of the
          bubble's own bottom border it sits on, so the outline reads as one
          continuous shape rather than a bubble with a badge stuck under it. */}
      <span aria-hidden style={{
        position: 'absolute', left: '50%', bottom: -7, marginLeft: -7,
        width: 14, height: 14, background: paper,
        borderRight: `3px solid ${edge}`, borderBottom: `3px solid ${edge}`,
        transform: 'rotate(45deg)',
      }} />
    </div>
  )
}
