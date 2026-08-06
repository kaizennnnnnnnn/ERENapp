'use client'

// ═════════════════════════════════════════════════════════════════════════════
// /talk — texting Eren.
//
// A private thread per person: RLS scopes every row to its owner, so this page
// never has to think about who's looking. That privacy is also why Eren's
// remembered facts are per-user — a shared brain would let him repeat one
// person's secret into the other's thread.
//
// Visually this is the note-board's paper, not the dark game panel: it's a
// conversation, not a leaderboard. Eren speaks on cream, you speak in your own
// ink (brown or pink, the household's fixed convention from nudges.ts).
// ═════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCare } from '@/contexts/CareContext'
import { useErenChat } from '@/hooks/useErenChat'
import { usePageReady } from '@/hooks/usePageReady'
import { isBrownSender } from '@/lib/nudges'
import { playSound } from '@/lib/sounds'
import { IconDoor } from '@/components/PixelIcons'
import PageLoader from '@/components/PageLoader'

const BROWN = { ink: '#7A4A22', paper: '#FFF3E2', edge: '#C07A3A', shadow: '#5A3212' }
const PINK  = { ink: '#B03A6E', paper: '#FFEDF5', edge: '#FF6B9D', shadow: '#7A1638' }
const EREN  = { ink: '#4A3A2A', paper: '#FFFBF1', edge: '#E2CFAE', shadow: '#B79B6E' }

export default function TalkPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { setHideStats } = useCare()
  const { messages, streaming, sending, loading, error, send } = useErenChat()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  usePageReady(!loading)

  // Pin to the bottom as tokens land. Layout effect, not effect — doing this
  // after paint makes the view visibly jump on every streamed chunk.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streaming])

  const mine = isBrownSender(true, user?.email) ? BROWN : PINK
  const firstName = profile?.name?.split(' ')[0] ?? 'You'

  function exit() {
    playSound('ui_swipe_room')
    // Reachable from a push notification, which lands with no in-app history —
    // back() would no-op and the door would look dead. Replace instead.
    router.replace('/home')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    playSound('ui_tap')
    send(text)
  }

  if (loading) return <PageLoader label="FINDING EREN" />

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#F3E7D2' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="flex items-center gap-3 px-4 shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingBottom: 12,
          background: 'linear-gradient(180deg, #FFF6E6 0%, #F6E4C6 100%)',
          borderBottom: '3px solid #C9A87A',
          boxShadow: '0 3px 0 rgba(122,74,34,0.18)',
        }}
      >
        <div
          className="relative shrink-0 flex items-center justify-center"
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#FFFBF1', border: '2px solid #C9A87A',
            boxShadow: '2px 2px 0 #A8814E',
          }}
        >
          <img
            src="/erenGood.png" alt="" width={30} height={30}
            style={{ objectFit: 'contain', imageRendering: 'auto' }}
          />
          <span
            className="absolute rounded-full"
            style={{ width: 8, height: 8, right: -2, bottom: -2, background: '#4ADE80', border: '2px solid #FFF6E6' }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div style={{ fontFamily: '"Press Start 2P"', fontSize: 10, color: '#5A3212', letterSpacing: 0.5 }}>
            EREN
          </div>
          <div style={{ fontSize: 10, color: '#9A7444', marginTop: 3 }}>
            {sending ? 'typing…' : 'awake. mostly.'}
          </div>
        </div>

        <button
          onClick={exit}
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">

        {messages.length === 0 && !streaming && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <img
              src="/erenGood.png" alt="" width={92} height={92}
              style={{ objectFit: 'contain', opacity: 0.9 }}
            />
            <div style={{ fontFamily: '"Press Start 2P"', fontSize: 8, color: '#A8814E', lineHeight: 1.8 }}>
              HE&apos;S LOOKING AT YOU
            </div>
            <div style={{ fontSize: 12, color: '#9A7444', lineHeight: 1.6 }}>
              say something. he&apos;s been waiting all day,
              which is what he says every day.
            </div>
          </div>
        )}

        {messages.map((m) => (
          <Bubble
            key={m.id}
            text={m.content}
            self={m.role === 'user'}
            skin={m.role === 'user' ? mine : EREN}
            author={m.role === 'user' ? firstName : 'Eren'}
          />
        ))}

        {streaming && <Bubble text={streaming} self={false} skin={EREN} author="Eren" />}
        {sending && !streaming && <Thinking />}

        {error && (
          <div
            className="self-center px-3 py-2"
            style={{
              fontFamily: '"Press Start 2P"', fontSize: 7, color: '#A03030',
              background: '#FFE8E8', border: '2px solid #E8A0A0', borderRadius: 8,
              boxShadow: '2px 2px 0 rgba(160,48,48,0.25)',
            }}
          >
            {error.toUpperCase()}
          </div>
        )}
      </div>

      {/* ── Composer ───────────────────────────────────────────────────── */}
      <form
        onSubmit={submit}
        className="flex items-end gap-2 px-3 shrink-0"
        style={{
          paddingTop: 10,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
          background: 'linear-gradient(180deg, #F6E4C6 0%, #EEDAB6 100%)',
          borderTop: '3px solid #C9A87A',
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
            fontSize: 13, color: mine.ink, padding: '11px 13px',
            background: '#FFFBF1', border: `2px solid ${mine.edge}`, borderRadius: 10,
            boxShadow: `inset 0 2px 0 rgba(122,74,34,0.06)`,
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
              : `linear-gradient(160deg, ${mine.edge} 0%, ${mine.ink} 100%)`,
            border: `2px solid ${mine.shadow}`,
            boxShadow: `0 3px 0 ${mine.shadow}`,
            opacity: !draft.trim() || sending ? 0.6 : 1,
          }}
        >
          SEND
        </button>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface Skin { ink: string; paper: string; edge: string; shadow: string }

function Bubble({ text, self, skin, author }: {
  text: string; self: boolean; skin: Skin; author: string
}) {
  return (
    <div className={`flex flex-col ${self ? 'items-end' : 'items-start'} gap-1`} style={{ maxWidth: '100%' }}>
      <span
        style={{
          fontFamily: '"Press Start 2P"', fontSize: 6, color: skin.edge,
          letterSpacing: 0.4, paddingLeft: self ? 0 : 4, paddingRight: self ? 4 : 0,
        }}
      >
        {author.toUpperCase()}
      </span>
      <div
        style={{
          maxWidth: '82%',
          fontSize: 13.5, lineHeight: 1.55, color: skin.ink,
          padding: '10px 13px',
          background: skin.paper,
          border: `2px solid ${skin.edge}`,
          // Hard shadow, no blur — house style.
          boxShadow: `3px 3px 0 ${skin.shadow}33`,
          borderRadius: 12,
          borderBottomRightRadius: self ? 3 : 12,
          borderBottomLeftRadius:  self ? 12 : 3,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  )
}

/** Three pixel dots that step rather than fade — snap keyframes, house style. */
function Thinking() {
  return (
    <div className="flex items-center gap-1.5 self-start px-3 py-2.5"
      style={{
        background: EREN.paper, border: `2px solid ${EREN.edge}`, borderRadius: 12,
        borderBottomLeftRadius: 3, boxShadow: `3px 3px 0 ${EREN.shadow}33`,
      }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5, height: 5, background: EREN.edge,
            animation: `erenDot 900ms steps(1,end) ${i * 300}ms infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes erenDot {
          0%, 32%  { opacity: 1;   transform: translateY(-2px); }
          33%, 100%{ opacity: 0.3; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
