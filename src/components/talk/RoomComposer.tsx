'use client'

// ─── RoomComposer ────────────────────────────────────────────────────────────
// The attic's bottom bar. The TALK slab folds away into a one-line composer so
// you can say something without leaving the room and watch him answer over his
// head. The scroll button beside it opens the full transcript — same
// conversation, just all of it at once.
//
// The scroll button holds its place in both states so it never jumps out from
// under your thumb mid-morph.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useErenChatContext } from '@/contexts/ErenChatContext'
import { IconScroll, IconClose } from '@/components/PixelIcons'
import TalkButton from './TalkButton'

const INK   = '#3A2210'
const PAPER = '#FFFBF1'
const AMBER = '#D9974A'

/**
 * How far the on-screen keyboard covers the bottom of the layout viewport.
 *
 * The app's viewport meta leaves `interactive-widget` at its default, so the
 * layout viewport does NOT shrink when the keyboard opens and a bottom-anchored
 * bar ends up behind it. Resolves to 0 when there's no keyboard, so this is
 * inert on desktop.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset
}

interface Props {
  onOpenTranscript: () => void
}

export default function RoomComposer({ onOpenTranscript }: Props) {
  const { sending, send } = useErenChatContext()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const keyboard = useKeyboardInset()

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    send(text)                       // owns the chat_send sound
    // Stays open: you say something else, he answers again. Closing after every
    // line would make a conversation feel like a series of separate errands.
  }, [draft, sending, send])

  return (
    <div
      className="absolute inset-x-0 z-20 flex justify-center px-6"
      style={{ bottom: `calc(24px + env(safe-area-inset-bottom, 0px) + ${keyboard}px)` }}
      // The host swipes rooms on horizontal touch. Without this, dragging to
      // place the caret walks you into the next room.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div className="flex items-stretch gap-2 w-full" style={{ maxWidth: 362 }}>
        {open ? (
          <form onSubmit={submit} className="flex-1 flex items-stretch gap-2 min-w-0">
            <button
              type="button"
              onClick={() => { setOpen(false); setDraft('') }}
              aria-label="Stop typing"
              className="shrink-0 flex items-center justify-center active:scale-90 transition-transform duration-100"
              style={{
                width: 34, borderRadius: 8,
                background: PAPER, border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}`,
              }}
            >
              <IconClose size={12} />
            </button>

            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="say something…"
              maxLength={2000}
              enterKeyHint="send"
              className="flex-1 min-w-0 outline-none"
              style={{
                fontSize: 13, color: '#4A3A2A', padding: '10px 12px',
                background: PAPER, border: `3px solid ${INK}`, borderRadius: 8,
                boxShadow: `0 3px 0 ${INK}, inset 0 2px 0 rgba(122,74,34,0.08)`,
              }}
            />

            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="shrink-0 active:scale-90 transition-transform duration-100"
              style={{
                fontFamily: '"Press Start 2P", monospace', fontSize: 8, letterSpacing: 0.5,
                color: '#FFF6E2', padding: '0 11px', borderRadius: 8,
                background: !draft.trim() || sending
                  ? '#B9A184'
                  : `linear-gradient(180deg, #F0C173 0%, ${AMBER} 55%, #B4712F 100%)`,
                border: `3px solid ${INK}`,
                boxShadow: `0 3px 0 ${INK}`,
                textShadow: `0 2px 0 ${INK}`,
                opacity: !draft.trim() || sending ? 0.65 : 1,
                transition: 'opacity 150ms',
              }}
            >
              SEND
            </button>
          </form>
        ) : (
          <div className="flex-1 min-w-0">
            <TalkButton onClick={() => setOpen(true)} />
          </div>
        )}

        <button
          type="button"
          onClick={onOpenTranscript}
          aria-label="Open the whole conversation"
          className="shrink-0 flex items-center justify-center active:scale-90 transition-transform duration-100"
          style={{
            width: 42, borderRadius: 9,
            background: 'linear-gradient(160deg, #FFF6E6 0%, #F0DDB8 100%)',
            border: `3px solid ${INK}`,
            boxShadow: `3px 3px 0 ${INK}`,
          }}
        >
          <IconScroll size={18} />
        </button>
      </div>
    </div>
  )
}
