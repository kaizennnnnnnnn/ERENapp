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
//
// In the Meadow look, the same as the couple journal: a white page, his
// replies on soft grey, yours on leaf tint, the back circle and his notebook
// in a white header, and the leaf Send button.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { IconScroll } from '@/components/PixelIcons'
import type { ErenChatMessage } from '@/types'
import { useLongPress } from '@/hooks/useLongPress'
import ReportSheet from '@/components/safety/ReportSheet'
import { messagesLeft, sleepiness } from '@/lib/chatAllowance'
import { useCat } from '@/hooks/useCat'
import { M, MeadowIcon, Meter, PrimaryButton, RoundButton, Tag, TextField } from '@/components/meadow'

interface Props {
  messages: ErenChatMessage[]
  streaming: string
  sending: boolean
  error: string | null
  /** Header line — his real mood, or "typing…" while he's composing. */
  status: string
  myName: string
  /** True for a beat after he files a fact away; makes the notebook glow. */
  flash: boolean
  /** His energy, which is what the bar actually draws. */
  energy: number
  /** Out of energy — the gate players meet. Restorable: feed him, rest him. */
  sleepy: boolean
  /** Daily backstop reached. Rare, and only clears tomorrow. */
  spent: boolean
  onSend: (text: string) => void
  onOpenMemories: () => void
  onExit: () => void
}

export default function TalkView({
  messages, streaming, sending, error, status, myName, flash,
  energy, sleepy, spent,
  onSend, onOpenMemories, onExit,
}: Props) {
  const cat = useCat()
  // Either way he's asleep; they differ only in what wakes him.
  const asleep = sleepy || spent
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Pin to the bottom as tokens land. Layout effect, not effect — running this
  // after paint makes the view visibly jump on every streamed chunk.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streaming])

  const rows = useMemo(() => groupMessages(messages), [messages])

  // Play requires an in-app way to report generative-AI output, reachable
  // without leaving the conversation. Hold one of Eren's replies to flag it.
  // Row keys are the message id for 'msg' rows, which is what the report needs.
  const [flagging, setFlagging] = useState<string | null>(null)
  const { bind: bindHold } = useLongPress<string>(setFlagging)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    onSend(text)
  }

  return (
    <div className="meadow-root fixed inset-0 flex flex-col overflow-hidden" style={{ background: '#FFFFFF' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="relative z-10 flex items-center shrink-0"
        style={{
          gap: 10,
          padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px 12px',
          background: '#FFFFFF',
        }}
      >
        <RoundButton surface="white" size={40} ariaLabel="Leave" onClick={onExit}>
          <MeadowIcon name="chevronLeft" size={22} color={M.text} />
        </RoundButton>

        <div className="relative shrink-0 flex items-center justify-center" style={{
          width: 44, height: 44, borderRadius: 999, background: M.soft,
        }}>
          <img
            src="/erenGood.png" alt="" width={34} height={34}
            // Hi-res PNG downscaled — must render smooth. `pixelated` makes the
            // breathing scale crawl a seam line across him.
            style={{ objectFit: 'contain', imageRendering: 'auto', animation: 'erenBreathe 3.4s ease-in-out infinite' }}
          />
          <span
            className="absolute rounded-full"
            style={{
              width: 12, height: 12, right: -1, bottom: -1,
              background: asleep ? M.faint : sending ? M.coin : M.leaf,
              border: '2px solid #FFFFFF', transition: 'background 200ms',
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center" style={{ gap: 6 }}>
            <span className="truncate min-w-0" style={{ fontSize: 18, lineHeight: 1.2, fontWeight: 800, color: M.text }}>
              {cat.name}
            </span>
            {/* Play's generative-AI policy wants the disclosure ON SCREEN, not
                only in how he behaves when asked. The persona already forbids
                him denying it, but a reviewer opening an existing thread never
                asks the question — so it has to be visible without prompting.
                Muted rather than hidden: present at a glance, not a banner
                shouting over the conversation. */}
            <span title={cat.t('{name} is an AI character, not a real cat')} className="shrink-0">
              <Tag size="sm" tone="soft" caps>AI</Tag>
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: M.text2, marginTop: 1 }}>{status}</div>
        </div>

        {/* What he remembers. Glows for a beat when he's just kept something —
            the only tell, since he's told never to say that he did. */}
        <RoundButton surface="white" size={40} ariaLabel={cat.t('What {name} remembers')} onClick={onOpenMemories}
          style={{
            boxShadow: flash ? `0 0 0 3px #FFFFFF, 0 0 0 6px ${M.coin}` : 'none',
            transition: 'box-shadow 300ms',
          }}>
          <IconScroll size={20} />
        </RoundButton>
      </header>

      {/* ── How much talking he has left in him ────────────────────────────
          Its own strip under the header. It fills as he tires out, so the
          full end is the bad end: full means he's asleep. */}
      <div className="relative z-10 shrink-0 flex items-center" style={{
        gap: 10, padding: '2px 16px 12px', borderBottom: `1px solid ${M.divider}`,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: asleep ? M.danger : M.text2, flexShrink: 0 }}>
          {asleep ? 'Fast asleep' : 'Sleepy'}
        </span>
        <Meter value={asleep ? 1 : sleepiness(energy) / 100} color={M.energy} height={8}
          label="How sleepy he is" style={{ flex: '1 1 auto' }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: M.text, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {asleep ? 0 : messagesLeft(energy)} left
        </span>
      </div>

      {/* ── Transcript ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} role="log" aria-label="Messages"
          className="talk-scroll absolute inset-0 overflow-y-auto flex flex-col"
          style={{ gap: 4, padding: '12px 16px 16px' }}>

          {rows.length === 0 && !streaming && <EmptyState />}

          {rows.map((row) =>
            row.kind === 'day' ? (
              <DayMark key={row.key} label={row.label} />
            ) : (
              <Bubble
                key={row.key}
                text={row.text}
                self={row.self}
                author={row.self ? myName : cat.name}
                showAuthor={row.first}
                time={row.last ? row.time : null}
                hold={row.self ? undefined : bindHold(row.key)}
              />
            ),
          )}

          {flagging && (
            <ReportSheet
              target="ai_reply"
              targetId={flagging}
              what={cat.t('what {name} said')}
              onClose={() => setFlagging(null)}
            />
          )}

          {streaming && (
            <Bubble text={streaming} self={false} author={cat.name} showAuthor time={null} />
          )}
          {sending && !streaming && <Thinking />}

          {error && (
            <p role="alert" className="self-center" style={{
              margin: '8px 0 0', padding: '8px 14px', borderRadius: 14,
              background: M.dangerTint, color: M.danger, fontSize: 14, fontWeight: 700, textAlign: 'center',
            }}>
              {error}
            </p>
          )}
        </div>
      </div>

      {/* ── Composer ─── or, once he's spent, the reason there isn't one ── */}
      {asleep ? <AsleepPanel reason={spent ? 'spent' : 'sleepy'} /> : (
      <form
        onSubmit={submit}
        className="relative z-10 flex items-center shrink-0"
        style={{
          gap: 8,
          padding: '10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)',
          background: '#FFFFFF',
          borderTop: `1px solid ${M.divider}`,
        }}
      >
        <TextField
          size="md"
          aria-label={cat.t('Talk to {name}')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={cat.t('Talk to {name}…')}
          maxLength={2000}
          enterKeyHint="send"
          style={{ flex: '1 1 auto', minWidth: 0 }}
          // 16px: anything smaller makes iOS zoom the page on focus.
          inputStyle={{ fontSize: 16, fontWeight: 600 }}
        />
        <PrimaryButton type="submit" size="sm" disabled={!draft.trim()} busy={sending}>Send</PrimaryButton>
      </form>
      )}

      <style>{`
        /* A stock scrollbar cuts a grey strip down the page. The thread is
           short and always pinned to the bottom, so there's nothing to
           navigate with it. */
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
  if (isToday(d))     return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMMM d')
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function DayMark({ label }: { label: string }) {
  return (
    <div className="flex items-center" style={{ gap: 10, margin: '12px 0' }}>
      <div className="flex-1" style={{ height: 1, background: M.divider }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: M.label }}>{label}</span>
      <div className="flex-1" style={{ height: 1, background: M.divider }} />
    </div>
  )
}

function Bubble({ text, self, author, showAuthor, time, hold }: {
  text: string; self: boolean; author: string; showAuthor: boolean; time: string | null
  /** Long-press handlers, present only on a finished reply from Eren. */
  hold?: Record<string, unknown>
}) {
  // The corner nearest the speaker tightens on the last message of a run,
  // which gives the group a tail without drawing one.
  const tail = time !== null
  return (
    <div className={`flex flex-col ${self ? 'items-end' : 'items-start'}`}
      style={{ marginTop: showAuthor ? 10 : 0 }}>
      {showAuthor && (
        <span style={{
          fontSize: 12, fontWeight: 700, color: M.label,
          marginBottom: 4, padding: self ? '0 4px 0 0' : '0 0 0 4px',
        }}>
          {author}
        </span>
      )}

      <div {...(hold ?? {})} style={{
        ...(hold ? { userSelect: 'none' as const, WebkitTouchCallout: 'none' as const } : {}),
        maxWidth: '82%',
        fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text,
        padding: '10px 14px',
        background: self ? M.leafTint : M.soft,
        borderRadius: self
          ? `18px 18px ${tail ? 6 : 18}px 18px`
          : `18px 18px 18px ${tail ? 6 : 18}px`,
        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      }}>
        {text}
      </div>

      {time && (
        <span style={{
          fontSize: 11, fontWeight: 700, color: M.text2,
          marginTop: 4, padding: self ? '0 4px 0 0' : '0 0 0 4px',
        }}>
          {time}
        </span>
      )}
    </div>
  )
}

/** Three dots that step rather than fade. */
function Thinking() {
  return (
    <div className="flex items-center self-start" aria-label="Typing" style={{
      gap: 5, marginTop: 10, padding: '14px 16px',
      background: M.soft, borderRadius: '18px 18px 18px 6px',
    }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: 999, background: M.faint,
          animation: `erenDot 900ms steps(1,end) ${i * 300}ms infinite`,
        }} />
      ))}
    </div>
  )
}

function EmptyState() {
  const cat = useCat()
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ gap: 8, padding: '0 24px' }}>
      <img src="/erenGood.png" alt="" width={104} height={104}
        style={{ objectFit: 'contain', imageRendering: 'auto', animation: 'erenBreathe 3.4s ease-in-out infinite' }} />
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: M.text }}>
        {cat.t('{He}\'s looking at you')}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2, maxWidth: 280 }}>
        {cat.t('say something. {he}\'s been waiting all day, which is what {he} says every day.')}
      </div>

      {/* Sentence case, deliberately. The line above is the cat's lowercase
          voice; this one is the APP speaking, and reading differently is what
          stops it being taken as more of the fiction. It also names the
          long-press report, which was wired but had no affordance telling
          anyone it existed. */}
      <div style={{
        fontSize: 13, lineHeight: 1.5, fontWeight: 500, color: M.text2, maxWidth: 300,
        marginTop: 8, paddingTop: 12, borderTop: `1px solid ${M.divider}`,
      }}>
        {cat.t('{name} is an AI character — software, not a real cat. {He} invents things and can be wrong. Press and hold any of {his} replies to report one.')}
      </div>
    </div>
  )
}

/**
 * What the composer becomes once he's asleep — worn out, or done for the day.
 *
 * A replacement rather than a disabled input on purpose: a greyed-out box with
 * a dead Send button reads as the app being broken, while a sleeping cat reads
 * as the answer to a question you never had to ask.
 */
function AsleepPanel({ reason }: { reason: 'sleepy' | 'spent' }) {
  // Same trick as the bedroom — roll one of the four curled poses AFTER mount.
  // Rolling it during render would disagree with the server-rendered markup.
  const [pose, setPose] = useState(0)
  useEffect(() => { setPose(Math.floor(Math.random() * 4)) }, [])
  const cat = useCat()

  return (
    <div
      className="relative z-10 flex items-center shrink-0"
      style={{
        gap: 12,
        padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)',
        background: M.soft,
      }}
    >
      <div className="relative shrink-0">
        <img
          src={`/erenSleep${pose + 1}.png?v=2`} alt="" width={62} height={62}
          // Hi-res PNG downscaled — renders smooth, never pixelated, or the
          // breathing scale crawls a seam line down him.
          style={{
            objectFit: 'contain', imageRendering: 'auto',
            animation: 'erenBreathe 6.5s ease-in-out infinite',
          }}
        />
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden style={{
            position: 'absolute', right: -3, top: 0,
            fontSize: 12, fontWeight: 800, color: M.faint,
            animation: `erenZ 2400ms steps(4, end) ${i * 800}ms infinite`,
          }}>z</span>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 16, fontWeight: 800, color: M.text }}>
          {reason === 'sleepy' ? 'Worn out' : cat.t('{He}’s asleep')}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: M.text2, marginTop: 2 }}>
          {reason === 'sleepy'
            ? cat.t('{he} says {he}’s tired. feed {him}, or tuck {him} into bed — {he}’ll want to talk again once {he}’s rested.')
            : cat.t('{he} says {he}’s said everything {he} has today. {he}’ll have more tomorrow.')}
        </div>
      </div>
    </div>
  )
}
