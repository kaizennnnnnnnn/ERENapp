'use client'

// ═════════════════════════════════════════════════════════════════════════════
// TalkView — the whole /talk surface, as pure presentation.
//
// It takes the transcript and who's looking, and owns none of the data. /talk
// wires it up; keeping it separate is also what makes the chat renderable
// outside the auth gate for visual checks (same reason NoteBoard is split).
//
// Messages GROUP by sender and by day, which is the difference between this
// reading like a chat and reading like a log: a name stamped above every single
// "prrrr" turns four one-word replies into four separate events.
// ═════════════════════════════════════════════════════════════════════════════

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { IconDoor, IconScroll } from '@/components/PixelIcons'
import type { ErenChatMessage } from '@/types'

// `label` is separate from `edge` on purpose. A border colour that reads well
// as a 2px outline is far too light as 6px text — reusing edge for the name
// made "EREN" almost invisible next to a perfectly legible "JOVAN".
export interface Skin { ink: string; paper: string; edge: string; shadow: string; label: string }

export const BROWN: Skin = { ink: '#7A4A22', paper: '#FFF1DC', edge: '#C07A3A', shadow: '#5A3212', label: '#A6642C' }
export const PINK:  Skin = { ink: '#B03A6E', paper: '#FFEBF4', edge: '#FF6B9D', shadow: '#7A1638', label: '#D4548A' }
export const EREN:  Skin = { ink: '#4A3A2A', paper: '#FFFBF1', edge: '#D3BE96', shadow: '#B79B6E', label: '#A8814E' }

interface Props {
  messages: ErenChatMessage[]
  streaming: string
  sending: boolean
  error: string | null
  /** Header line — his real mood, or "typing…" while he's composing. */
  status: string
  myName: string
  mySkin: Skin
  /** True for a beat after he files a fact away; makes the notebook glow. */
  flash: boolean
  onSend: (text: string) => void
  onOpenMemories: () => void
  onExit: () => void
}

export default function TalkView({
  messages, streaming, sending, error, status, myName, mySkin, flash,
  onSend, onOpenMemories, onExit,
}: Props) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Pin to the bottom as tokens land. Layout effect, not effect — running this
  // after paint makes the view visibly jump on every streamed chunk.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streaming])

  const rows = useMemo(() => groupMessages(messages), [messages])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    onSend(text)
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: '#EFE0C6' }}>

      {/* Paper grain + a warm corner vignette — cheap atmosphere that stops the
          flat fill reading as an empty div. ONE axis only: crossing two
          repeating gradients moirés into a visible woven grid at these
          periods, which reads as a rendering bug rather than as paper. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, rgba(122,74,34,0.018) 0 1px, transparent 1px 4px)',
      }} />
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 28%, transparent 40%, rgba(96,60,24,0.17) 100%)',
      }} />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="relative z-10 flex items-center gap-3 px-4 shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingBottom: 12,
          background: 'linear-gradient(180deg, #FFF6E6 0%, #F4E1C0 100%)',
          borderBottom: '3px solid #C9A87A',
          boxShadow: '0 3px 0 rgba(122,74,34,0.18)',
        }}
      >
        <div
          className="relative shrink-0 flex items-center justify-center"
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'radial-gradient(circle at 50% 38%, #FFFDF6 0%, #F6E7CC 100%)',
            border: '2px solid #C9A87A', boxShadow: '2px 2px 0 #A8814E',
          }}
        >
          <img
            src="/erenGood.png" alt="" width={34} height={34}
            // Hi-res PNG downscaled — must render smooth. `pixelated` makes the
            // breathing scale crawl a seam line across him.
            style={{ objectFit: 'contain', imageRendering: 'auto', animation: 'erenBreathe 3.4s ease-in-out infinite' }}
          />
          <span
            className="absolute rounded-full"
            style={{
              width: 9, height: 9, right: -2, bottom: -2,
              background: sending ? '#F5C842' : '#4ADE80',
              border: '2px solid #FFF6E6', transition: 'background 200ms',
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div style={{ fontFamily: '"Press Start 2P"', fontSize: 10, color: '#5A3212', letterSpacing: 0.5 }}>
            EREN
          </div>
          <div style={{ fontSize: 10.5, color: '#9A7444', marginTop: 4 }}>{status}</div>
        </div>

        {/* What he remembers. Glows for a beat when he's just kept something —
            the only tell, since he's told never to say that he did. */}
        <button
          onClick={onOpenMemories}
          aria-label="What Eren remembers"
          className="active:scale-90 transition-transform duration-100 shrink-0 flex items-center justify-center"
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(160deg, #FFF6E6 0%, #F0DDB8 100%)',
            border: '2px solid #C9A87A',
            boxShadow: flash
              ? '0 3px 0 #A8814E, 0 0 0 3px rgba(255,214,120,0.85), 0 0 14px 3px rgba(255,196,66,0.7)'
              : '0 3px 0 #A8814E',
            transition: 'box-shadow 300ms',
          }}
        >
          <IconScroll size={17} />
        </button>

        <button
          onClick={onExit}
          aria-label="Leave"
          className="active:scale-90 transition-transform duration-100 shrink-0 flex items-center justify-center"
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(160deg, #FFF3D0 0%, #FFE090 100%)',
            border: '2px solid #F5C842', boxShadow: '0 3px 0 #D4920E',
          }}
        >
          <IconDoor size={18} />
        </button>
      </header>

      {/* ── Transcript ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} className="talk-scroll absolute inset-0 overflow-y-auto px-4 py-4 flex flex-col gap-1">

          {rows.length === 0 && !streaming && <EmptyState />}

          {rows.map((row) =>
            row.kind === 'day' ? (
              <DayMark key={row.key} label={row.label} />
            ) : (
              <Bubble
                key={row.key}
                text={row.text}
                self={row.self}
                skin={row.self ? mySkin : EREN}
                author={row.self ? myName : 'Eren'}
                showAuthor={row.first}
                time={row.last ? row.time : null}
              />
            ),
          )}

          {streaming && (
            <Bubble text={streaming} self={false} skin={EREN} author="Eren" showAuthor time={null} />
          )}
          {sending && !streaming && <Thinking />}

          {error && (
            <div className="self-center mt-2 px-3 py-2" style={{
              fontFamily: '"Press Start 2P"', fontSize: 7, color: '#A03030',
              background: '#FFE8E8', border: '2px solid #E8A0A0', borderRadius: 8,
              boxShadow: '2px 2px 0 rgba(160,48,48,0.25)',
            }}>
              {error.toUpperCase()}
            </div>
          )}
        </div>

        {/* Top fade, so scrolled messages dissolve into the header instead of
            sliding under a hard edge. */}
        <div aria-hidden className="absolute top-0 left-0 right-0 h-6 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, #EFE0C6 0%, transparent 100%)' }} />
      </div>

      {/* ── Composer ───────────────────────────────────────────────────── */}
      <form
        onSubmit={submit}
        className="relative z-10 flex items-end gap-2 px-3 shrink-0"
        style={{
          paddingTop: 10,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
          background: 'linear-gradient(180deg, #F4E1C0 0%, #E9D3AC 100%)',
          borderTop: '3px solid #C9A87A',
          boxShadow: '0 -3px 0 rgba(122,74,34,0.12)',
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="talk to eren…"
          maxLength={2000}
          enterKeyHint="send"
          className="flex-1 min-w-0 outline-none"
          style={{
            fontSize: 13, color: mySkin.ink, padding: '11px 13px',
            background: '#FFFBF1', border: `2px solid ${mySkin.edge}`, borderRadius: 10,
            boxShadow: 'inset 0 2px 0 rgba(122,74,34,0.07)',
          }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="active:scale-90 transition-transform duration-100 shrink-0"
          style={{
            fontFamily: '"Press Start 2P"', fontSize: 8, color: '#FFF8EC',
            padding: '13px 14px', borderRadius: 10,
            background: sending || !draft.trim()
              ? '#C9B294'
              : `linear-gradient(160deg, ${mySkin.edge} 0%, ${mySkin.ink} 100%)`,
            border: `2px solid ${mySkin.shadow}`,
            boxShadow: `0 3px 0 ${mySkin.shadow}`,
            opacity: !draft.trim() || sending ? 0.6 : 1,
            transition: 'opacity 150ms',
          }}
        >
          SEND
        </button>
      </form>

      <style>{`
        /* A stock scrollbar cuts a grey strip down the paper and undoes the
           whole surface. The thread is short and always pinned to the bottom,
           so there's nothing to navigate with it. */
        .talk-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .talk-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
        @keyframes erenBreathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.05); }
        }
        @keyframes erenDot {
          0%, 32%   { opacity: 1;   transform: translateY(-2px); }
          33%, 100% { opacity: 0.3; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Grouping ────────────────────────────────────────────────────────────────

type Row =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; text: string; self: boolean; first: boolean; last: boolean; time: string }

/**
 * Flattens the transcript into day marks plus messages tagged with their
 * position in a same-sender run. `first` drives the author label, `last` drives
 * the timestamp — so a burst of four "prrrr"s reads as one turn with one name
 * and one clock, instead of four stamped events.
 */
function groupMessages(messages: ErenChatMessage[]): Row[] {
  const rows: Row[] = []
  let lastDay = ''

  messages.forEach((m, i) => {
    const d = new Date(m.created_at)
    const day = d.toDateString()
    if (day !== lastDay) {
      rows.push({ kind: 'day', key: `day-${day}-${m.id}`, label: dayLabel(d) })
      lastDay = day
    }

    const prev = messages[i - 1]
    const next = messages[i + 1]
    const sameAsPrev = !!prev && prev.role === m.role && new Date(prev.created_at).toDateString() === day
    const sameAsNext = !!next && next.role === m.role && new Date(next.created_at).toDateString() === day

    rows.push({
      kind:  'msg',
      key:   m.id,
      text:  m.content,
      self:  m.role === 'user',
      first: !sameAsPrev,
      last:  !sameAsNext,
      time:  format(d, 'HH:mm'),
    })
  })

  return rows
}

function dayLabel(d: Date): string {
  if (isToday(d))     return 'TODAY'
  if (isYesterday(d)) return 'YESTERDAY'
  return format(d, 'MMMM d').toUpperCase()
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function DayMark({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 my-3 px-2">
      <div className="flex-1" style={{ height: 2, background: 'rgba(122,74,34,0.16)' }} />
      <span style={{ fontFamily: '"Press Start 2P"', fontSize: 6, color: '#A8814E', letterSpacing: 0.6 }}>
        {label}
      </span>
      <div className="flex-1" style={{ height: 2, background: 'rgba(122,74,34,0.16)' }} />
    </div>
  )
}

function Bubble({ text, self, skin, author, showAuthor, time }: {
  text: string; self: boolean; skin: Skin; author: string; showAuthor: boolean; time: string | null
}) {
  return (
    <div className={`flex flex-col ${self ? 'items-end' : 'items-start'}`}
      style={{ marginTop: showAuthor ? 8 : 2 }}>
      {showAuthor && (
        <span style={{
          fontFamily: '"Press Start 2P"', fontSize: 6, color: skin.label, letterSpacing: 0.4,
          marginBottom: 4, paddingLeft: self ? 0 : 3, paddingRight: self ? 3 : 0,
        }}>
          {author.toUpperCase()}
        </span>
      )}

      <div style={{
        maxWidth: '82%',
        fontSize: 13.5, lineHeight: 1.55, color: skin.ink,
        padding: '10px 13px',
        background: skin.paper,
        border: `2px solid ${skin.edge}`,
        // Hard shadow, no blur — house style. The inset highlight is what
        // stops the bubble reading as a flat rectangle on flat paper.
        boxShadow: `3px 3px 0 ${skin.shadow}30, inset 0 1px 0 rgba(255,255,255,0.85)`,
        borderRadius: 13,
        // The corner nearest the speaker squares off on the last message of a
        // run, which gives the group a tail without drawing one.
        borderBottomRightRadius: self && time !== null ? 3 : 13,
        borderBottomLeftRadius: !self && time !== null ? 3 : 13,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {text}
      </div>

      {time && (
        <span style={{
          fontFamily: '"Press Start 2P"', fontSize: 6, color: '#A8814E', opacity: 0.85,
          marginTop: 5, paddingLeft: self ? 0 : 4, paddingRight: self ? 4 : 0,
        }}>
          {time}
        </span>
      )}
    </div>
  )
}

/** Three pixel dots that step rather than fade — snap keyframes, house style. */
function Thinking() {
  return (
    <div className="flex items-center gap-1.5 self-start px-3 py-2.5" style={{
      marginTop: 8,
      background: EREN.paper, border: `2px solid ${EREN.edge}`, borderRadius: 13,
      borderBottomLeftRadius: 3, boxShadow: `3px 3px 0 ${EREN.shadow}30`,
    }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 5, height: 5, background: EREN.edge,
          animation: `erenDot 900ms steps(1,end) ${i * 300}ms infinite`,
        }} />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
      <img src="/erenGood.png" alt="" width={104} height={104}
        style={{ objectFit: 'contain', imageRendering: 'auto', animation: 'erenBreathe 3.4s ease-in-out infinite' }} />
      <div style={{ fontFamily: '"Press Start 2P"', fontSize: 8, color: '#A8814E', lineHeight: 1.8 }}>
        HE&apos;S LOOKING AT YOU
      </div>
      <div style={{ fontSize: 12, color: '#9A7444', lineHeight: 1.65, maxWidth: 260 }}>
        say something. he&apos;s been waiting all day, which is what he says every day.
      </div>
    </div>
  )
}
