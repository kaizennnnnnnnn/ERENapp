'use client'

// ─── The journal, opened ─────────────────────────────────────────────────────
// The full household chat in a Meadow sheet: every message oldest to newest,
// the compose row pinned at the bottom, the view kept at the newest message.
// Hold a message to report it, or to delete one of your own; the page passes
// that sheet in as `overlay`, and it renders INSIDE this sheet on purpose: the
// sheet keeps focus within itself, so an actions sheet mounted anywhere else
// would lose every tap and keystroke back to the journal.

import { format } from 'date-fns'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Avatar, M, PrimaryButton, Sheet, TextField } from '@/components/meadow'
import { useLongPress } from '@/hooks/useLongPress'
import type { JournalEntry } from './usModel'

const MESSAGE_MAX = 500

/** The sheet's scrolling body: the nearest ancestor that scrolls. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null
  while (p && getComputedStyle(p).overflowY !== 'auto') p = p.parentElement
  return p
}

interface Props {
  open: boolean
  onClose: () => void
  catName: string
  /** Oldest first. */
  messages: JournalEntry[]
  isSolo: boolean
  partnerName: string | null
  /** Resolves true once the message is saved; false keeps the draft. */
  onSend: (text: string) => Promise<boolean>
  /** A message was held: the page opens its actions sheet. */
  onHold: (id: string) => void
  /** The message-actions sheet, when open. */
  overlay?: ReactNode
  /** A failed write (a send or a delete), said under the compose row. */
  error?: string | null
}

export default function JournalSheet({
  open, onClose, catName, messages, isSolo, partnerName, onSend, onHold, overlay, error,
}: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const { bind: bindHold } = useLongPress<string>(onHold)

  const scrollToEnd = useCallback(() => {
    const body = scrollParent(listRef.current)
    if (body) body.scrollTop = body.scrollHeight
  }, [])
  // The list mounts a frame after `open` (the sheet portals in after mount),
  // so the ref callback catches the first paint and the effect every new message.
  const setListRef = useCallback((el: HTMLDivElement | null) => {
    listRef.current = el
    if (el) requestAnimationFrame(scrollToEnd)
  }, [scrollToEnd])
  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(scrollToEnd)
    return () => cancelAnimationFrame(raf)
  }, [open, messages.length, scrollToEnd])

  const canSend = draft.trim().length > 0 && !sending
  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!canSend) return
    setSending(true)
    try {
      // Cleared only once the message exists. A failed send used to wipe the
      // draft anyway, so a long message was simply gone; now it stays in the
      // field to send again, with the page's error above it.
      if (await onSend(draft)) setDraft('')
    } finally {
      setSending(false)
    }
  }

  const helper = isSolo
    ? `${catName} keeps the journal. Whoever joins your home reads it too.`
    : `${catName} will deliver your message to ${partnerName ?? 'your partner'}.`

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${catName}'s journal`}
      bodyStyle={{ minHeight: 'min(520px, calc(100dvh - 260px))' }}
      footer={
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 13, lineHeight: 1.4, fontWeight: 700, color: M.danger }}>{error}</p>
          )}
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, fontWeight: 700, color: M.text2 }}>{helper}</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <TextField
              size="md"
              aria-label={isSolo ? 'Write in the journal' : `Write to ${partnerName ?? 'your partner'}`}
              placeholder={isSolo ? 'Write something...' : 'Write a message...'}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              maxLength={MESSAGE_MAX}
              enterKeyHint="send"
              style={{ flex: '1 1 auto', minWidth: 0 }}
              inputStyle={{ fontSize: 16, fontWeight: 700 }}
            />
            <PrimaryButton type="submit" size="sm" disabled={!draft.trim()} busy={sending}>Send</PrimaryButton>
          </div>
        </form>
      }
    >
      <div ref={setListRef} role="log" aria-label="Messages"
        style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 4 }}>
        {messages.length === 0 && (
          <p style={{ margin: '24px 0', textAlign: 'center', fontSize: 15, fontWeight: 500, color: M.text2 }}>
            {isSolo ? `Nothing written yet. ${catName} is listening.` : 'No messages yet. Write the first one.'}
          </p>
        )}
        {messages.map(m => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            flexDirection: m.mine ? 'row-reverse' : 'row',
          }}>
            {!m.mine && <Avatar name={m.name} color={m.color} size={32} fontSize={13} />}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: m.mine ? 'flex-end' : 'flex-start', gap: 4, maxWidth: '78%', minWidth: 0 }}>
              {/* Focusable so a keyboard can reach report / delete too: Enter
                  or Space does what a hold does. */}
              <div {...bindHold(m.id)} tabIndex={0} role="button" aria-haspopup="dialog" className="m-focus"
                aria-label={`${m.mine ? 'You' : m.name}: ${m.text}. Press Enter to report${m.mine ? ' or delete' : ''}.`}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHold(m.id) }
                }}
                style={{
                padding: '10px 14px',
                borderRadius: m.mine ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                background: m.mine ? M.leafTint : M.soft,
                fontSize: 15, lineHeight: 1.4, fontWeight: 500, color: M.text, overflowWrap: 'anywhere',
                // Without these a hold raises the OS selection menu over the
                // actions sheet it just opened.
                userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
              }}>
                {m.text}
              </div>
              <span style={{ padding: '0 4px', fontSize: 11, fontWeight: 700, color: M.text2 }}>
                {format(new Date(m.at), 'MMM d, h:mm a')}
              </span>
            </div>
          </div>
        ))}
        {messages.length > 0 && (
          <p style={{ margin: '4px 0 0', textAlign: 'center', fontSize: 12, fontWeight: 700, color: M.text2 }}>
            Hold a message to report or delete it
          </p>
        )}
      </div>
      {overlay}
    </Sheet>
  )
}
