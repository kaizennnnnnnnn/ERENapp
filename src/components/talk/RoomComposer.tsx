'use client'

// ─── RoomComposer ────────────────────────────────────────────────────────────
// The attic's bottom bar. Talk folds away into a one-line composer so
// you can say something without leaving the room and watch him answer over his
// head. The scroll button beside it opens the full transcript — same
// conversation, just all of it at once.
//
// The scroll button holds its place in both states so it never jumps out from
// under your thumb mid-morph.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useErenChatContext } from '@/contexts/ErenChatContext'
import { useErenStats } from '@/hooks/useErenStats'
import { isTooSleepy } from '@/lib/chatAllowance'
import { playSound, type SoundName } from '@/lib/sounds'
import { Card, M, MeadowIcon, PrimaryButton, RoundButton, TextField } from '@/components/meadow'
import TalkButton from './TalkButton'

// Cycled per keystroke. One tick on repeat reads as a fault rather than typing.
const TYPE_TICKS: SoundName[] = ['chat_type1', 'chat_type2', 'chat_type3']
/** Held backspace and fast typists both outrun the ear; one tick per 45ms is
 *  plenty to feel continuous without stacking into a buzz. */
const TYPE_THROTTLE_MS = 45

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
  const { sending, send, spent } = useErenChatContext()
  // The floor composer has to know about the energy gate too, or a line
  // typed down here disappears into a 429 the room never explains.
  const { stats } = useErenStats()
  const tired = spent || isTooSleepy(stats?.energy ?? 100)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const launchRef = useRef<HTMLDivElement>(null)
  const keyboard = useKeyboardInset()
  const tickIdx = useRef(0)
  const lastTick = useRef(0)

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  // He can run out mid-conversation (or the day can roll over with the
  // composer open). Put the input away rather than leave a live box that
  // the server is only going to refuse.
  useEffect(() => { if (tired) { setOpen(false); setDraft('') } }, [tired])

  const onDraftChange = useCallback((next: string) => {
    setDraft(next)
    const now = performance.now()
    if (now - lastTick.current < TYPE_THROTTLE_MS) return
    lastTick.current = now
    playSound(TYPE_TICKS[tickIdx.current++ % TYPE_TICKS.length])
  }, [])

  const close = useCallback(() => {
    playSound('ui_back')
    setOpen(false)
    setDraft('')
    requestAnimationFrame(() => launchRef.current?.querySelector('button')?.focus())
  }, [])

  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending || tired) return
    setDraft('')
    send(text)                       // owns the chat_send sound
    // Stays open: you say something else, he answers again. Closing after every
    // line would make a conversation feel like a series of separate errands.
  }, [draft, sending, tired, send])

  return (
    <div
      className="meadow-root absolute inset-x-0 z-20 flex justify-center"
      style={{ padding: '0 16px', bottom: `calc(24px + env(safe-area-inset-bottom, 0px) + ${keyboard}px)` }}
      // The host swipes rooms on horizontal touch. Without this, dragging to
      // place the caret walks you into the next room.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 w-full" style={{ maxWidth: 362, minHeight: 46 }}>
        {open && !tired ? (
          <form onSubmit={submit} aria-label="Send a message" className="flex-1 flex items-center gap-2 min-w-0">
            <span title="Stop typing" style={{ display: 'flex', flexShrink: 0 }}>
              <RoundButton surface="art" ariaLabel="Stop typing" onClick={close}>
                <MeadowIcon name="close" size={18} color={M.text} />
              </RoundButton>
            </span>

            <TextField
              size="md"
              ref={inputRef}
              aria-label="Message"
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                // Enter confirms an IME candidate before it sends the message.
                if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault()
                if (e.key === 'Escape') { e.preventDefault(); close() }
              }}
              placeholder="Say something..."
              maxLength={2000}
              enterKeyHint="send"
              style={{ flex: '1 1 0', minWidth: 0 }}
              inputStyle={{ fontSize: 16, fontWeight: 700 }}
            />

            <span title={sending ? 'Sending message' : 'Send message'} style={{ display: 'flex', flexShrink: 0 }}>
              <PrimaryButton
                type="submit"
                size="sm"
                ariaLabel={sending ? 'Sending message' : 'Send message'}
                disabled={!draft.trim() || sending}
                busy={sending}
                style={{ width: 44, padding: 0, flexShrink: 0 }}
              >
                <MeadowIcon name={sending ? 'clock' : 'send'} size={22} color="#FFFFFF" />
              </PrimaryButton>
            </span>
          </form>
        ) : (
          <div ref={launchRef} className="flex-1 min-w-0">
            {tired ? <AsleepSlab /> : <TalkButton onClick={() => { playSound('ui_tap'); setOpen(true) }} />}
          </div>
        )}

        <span title="Open the whole conversation" style={{ display: 'flex', flexShrink: 0 }}>
          <RoundButton
            surface="art"
            onClick={onOpenTranscript}
            ariaLabel="Open the whole conversation"
          >
            <MeadowIcon name="scroll" size={22} />
          </RoundButton>
        </span>
      </div>
    </div>
  )
}

/**
 * Once he's out of words, keep the transcript reachable in the same slot so
 * the bottom bar doesn't reflow — the floor should say the same thing the
 * transcript does, not silently swallow a line into a 429.
 */
function AsleepSlab() {
  return (
    <Card
      padding="0 16px"
      style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: `0 3px 0 ${M.overArtLip}` }}
    >
      <MeadowIcon name="moon" size={22} />
      <span role="status" style={{ fontSize: 16, fontWeight: 800, color: M.text2 }}>
        Fast asleep
      </span>
    </Card>
  )
}
