'use client'

// ─── ErenSpeechBubble ────────────────────────────────────────────────────────
// What he says, over his head, when you talk to him from the attic floor
// instead of opening the transcript.
//
// It shows his reply as it streams and then holds it for a few seconds — the
// hook clears `streaming` the moment the turn commits, so the last streamed
// text is kept here. Without that the reply would vanish on the same frame it
// finished, which is exactly when you start reading it.
//
// Everything said here is in the transcript too; this is a view of the reply,
// not a second place it lives.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useErenChatContext } from '@/contexts/ErenChatContext'

const LINGER = 7000

const PAPER  = '#FFFBF1'
const EDGE   = '#D3BE96'
const INK    = '#4A3A2A'
const SHADOW = 'rgba(122,74,34,0.28)'
const BAD_PAPER = '#FFECEC'
const BAD_EDGE  = '#E8A0A0'
const BAD_INK   = '#A03030'

interface Shown { text: string; thinking: boolean; bad: boolean }

export default function ErenSpeechBubble() {
  const { sending, streaming, error } = useErenChatContext()
  const [shown, setShown] = useState<Shown | null>(null)

  // The reply as it accumulates. A ref, not state — it exists to survive the
  // frame where `streaming` is reset, not to drive a render of its own.
  const live = useRef('')
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelHide = useCallback(() => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
  }, [])

  // He's been asked something.
  useEffect(() => {
    if (!sending) return
    cancelHide()
    live.current = ''
    setShown({ text: '', thinking: true, bad: false })
  }, [sending, cancelHide])

  // He's answering.
  useEffect(() => {
    if (!streaming) return
    live.current = streaming
    setShown({ text: streaming, thinking: false, bad: false })
  }, [streaming])

  // He's finished — hold the last thing he said, then let it go.
  useEffect(() => {
    if (sending) return
    const text = error || live.current
    if (!text) return
    cancelHide()
    setShown({ text, thinking: false, bad: !!error })
    hideTimer.current = setTimeout(() => { setShown(null); live.current = '' }, LINGER)
  }, [sending, error, cancelHide])

  useEffect(() => cancelHide, [cancelHide])

  if (!shown) return null

  const paper = shown.bad ? BAD_PAPER : PAPER
  const edge  = shown.bad ? BAD_EDGE  : EDGE
  const ink   = shown.bad ? BAD_INK   : INK

  return (
    <div
      onClick={() => { cancelHide(); setShown(null) }}
      style={{
        pointerEvents: 'auto',
        // Capped well short of the room's width. Allowed to fill it, a two-line
        // reply becomes a banner across the attic instead of something a cat is
        // saying, and the tail stops reading as attached to anything.
        maxWidth: 'min(80%, 270px)',
        background: paper,
        border: `3px solid ${edge}`,
        borderRadius: 13,
        // Hard shadow, no blur — house style.
        boxShadow: `3px 3px 0 ${SHADOW}, inset 0 1px 0 rgba(255,255,255,0.9)`,
        padding: shown.thinking ? '11px 14px' : '10px 13px',
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
