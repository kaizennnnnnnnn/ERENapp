'use client'

// ═════════════════════════════════════════════════════════════════════════════
// The Note Board surface — a cork board of pinned paper notes.
//
// Two kinds of row only: notes we wrote each other, and food we sent. One-tap
// nudges are filtered out upstream (useCouple) — they're a gesture that pops
// once, not something to keep.
//
// Pure presentation: it takes the rows and who's looking, and owns none of the
// data. /notes wires it up; keeping it separate is also what makes the board
// renderable outside the auth gate for visual checks.
// ═════════════════════════════════════════════════════════════════════════════

import { format, isToday, isYesterday } from 'date-fns'
import { isBrownSender } from '@/lib/nudges'
import { FOOD_META } from '@/lib/foodMeta'
import FoodIcon from '@/components/care/FoodIcon'
import { IconPin, IconDoor, IconGift } from '@/components/PixelIcons'
import type { JournalMessage } from '@/types'

// One ink per partner, from the household's fixed brown/pink convention.
interface Ink {
  pin: string; pinDark: string; ink: string
  paper: string; rule: string; edge: string
}
const BROWN: Ink = {
  pin: '#C07A3A', pinDark: '#5A3212', ink: '#7A4A22',
  paper: '#FFFBF1', rule: '#EDE1CA', edge: 'rgba(122,74,34,0.30)',
}
const PINK: Ink = {
  pin: '#FF6B9D', pinDark: '#7A1638', ink: '#B03A6E',
  paper: '#FFF8FC', rule: '#F8E5EF', edge: 'rgba(176,58,110,0.26)',
}

const WOOD: React.CSSProperties = {
  background: 'linear-gradient(180deg, #7A4B22 0%, #59320F 100%)',
  border: '2px solid #3B1F06',
  boxShadow: '2px 2px 0 rgba(40,22,4,0.55), inset 0 1px 0 rgba(255,214,160,0.25)',
  borderRadius: 4,
  cursor: 'pointer',
}

// Deterministic lean, hashed off the row id — a re-render must not reshuffle
// the board, and Math.random() in a render body would do exactly that.
function tilt(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((((h % 5) + 5) % 5) - 2) * 1.05
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return 'TODAY'
  if (isYesterday(d)) return 'YESTERDAY'
  return format(d, 'MMMM d, yyyy').toUpperCase()
}

interface Props {
  notes: JournalMessage[]
  myId: string | undefined
  myHeart: string | null | undefined
  myName: string
  partnerName: string
  onExit: () => void
}

export default function NoteBoard({ notes, myId, myHeart, myName, partnerName, onExit }: Props) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{
      background: 'linear-gradient(180deg, #CBA372 0%, #B98A56 55%, #9E6F3B 100%)',
    }}>
      {/* Cork grain — two offset speckle grids so the pattern never reads as
          a regular dot screen, plus a vignette to sink the edges. */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: [
          'radial-gradient(circle at 1px 1px, rgba(92,56,20,0.30) 1px, transparent 0)',
          'radial-gradient(circle at 2px 3px, rgba(255,230,190,0.22) 1px, transparent 0)',
        ].join(','),
        backgroundSize: '7px 7px, 11px 13px',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 28%, transparent 38%, rgba(56,32,8,0.5) 100%)',
      }} />
      {/* Wooden frame around the whole board */}
      <div className="absolute inset-0 pointer-events-none" style={{
        boxShadow: [
          'inset 0 0 0 6px #7A4B22',
          'inset 0 0 0 8px #4E2C0F',
          'inset 0 0 22px rgba(40,22,4,0.55)',
        ].join(','),
      }} />

      {/* ── Top bar ── */}
      <div className="relative flex items-center justify-between px-4" style={{
        zIndex: 5, paddingTop: 'calc(var(--safe-top, 0px) + 16px)',
      }}>
        <button type="button" onClick={onExit} aria-label="Leave the note board"
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ ...WOOD, width: 36, height: 36 }}>
          <span className="font-pixel" style={{ fontSize: 10, color: '#FFE2BC', lineHeight: 1 }}>&lt;</span>
        </button>

        {/* Plaque */}
        <div className="flex flex-col items-center px-4 py-2" style={{
          background: 'linear-gradient(180deg, #6B3F1B 0%, #43230A 100%)',
          border: '2px solid #2E1705',
          boxShadow: '3px 3px 0 rgba(40,22,4,0.5), inset 0 1px 0 rgba(255,214,160,0.22)',
          borderRadius: 3,
        }}>
          <span className="font-pixel" style={{
            fontSize: 9, letterSpacing: 2, color: '#F5C842',
            textShadow: '0 0 8px rgba(245,200,66,0.45)',
          }}>NOTE BOARD</span>
          <span className="font-pixel" style={{ fontSize: 5, letterSpacing: 1, color: '#D9A863', marginTop: 5 }}>
            {notes.length === 0 ? 'NOTHING PINNED YET' : `${notes.length} PINNED · KEPT FOREVER`}
          </span>
        </div>

        <div style={{ width: 36 }} />
      </div>

      {/* ── The board ── */}
      <div className="relative flex-1 overflow-y-auto" style={{ zIndex: 2 }}>
        <div className="mx-auto" style={{ maxWidth: 440, padding: '22px 18px 90px' }}>
          {notes.length === 0 ? (
            <div className="flex flex-col items-center gap-3" style={{ paddingTop: 56 }}>
              <div style={{ opacity: 0.75 }}><IconPin size={34} tone="#8A5A2A" dark="#3B1F06" /></div>
              <p className="font-pixel text-center" style={{ fontSize: 8, letterSpacing: 1.5, color: '#4E2C0F' }}>
                NOTHING PINNED YET
              </p>
              <p className="text-center" style={{ fontSize: 12, color: '#5E3C18', maxWidth: 232, lineHeight: 1.6 }}>
                Tap Eren&apos;s thought cloud on the home screen and send a note.
                Everything he delivers ends up here.
              </p>
            </div>
          ) : notes.map((m, i) => {
            const prev = i > 0 ? notes[i - 1] : null
            const sameDay = prev
              && format(new Date(prev.created_at), 'yyyy-MM-dd') === format(new Date(m.created_at), 'yyyy-MM-dd')
            const mine = m.sender_id === myId
            return (
              <div key={m.id}>
                {!sameDay && (
                  <div className="flex items-center gap-2 mb-3" style={{ marginTop: i === 0 ? 0 : 22 }}>
                    <span className="font-pixel px-2 py-1" style={{
                      fontSize: 5, letterSpacing: 1.5, color: '#FFE2BC',
                      background: 'rgba(62,34,10,0.75)',
                      border: '1px solid rgba(255,214,160,0.25)',
                    }}>{dayLabel(m.created_at)}</span>
                    <span style={{ flex: 1, height: 1, background: 'rgba(62,34,10,0.4)' }} />
                  </div>
                )}
                <PinnedNote
                  m={m}
                  ink={isBrownSender(mine, myHeart) ? BROWN : PINK}
                  name={mine ? myName : partnerName}
                  index={i}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Exit pill — the board scrolls long, so the way out is at both ends. */}
      <button type="button" onClick={onExit} aria-label="Leave the note board"
        className="absolute flex items-center gap-2 active:scale-95 transition-transform"
        style={{
          ...WOOD,
          left: '50%', bottom: 'calc(var(--safe-bottom, 0px) + 16px)',
          transform: 'translateX(-50%)',
          padding: '8px 14px', zIndex: 5,
        }}>
        <IconDoor size={14} />
        <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1.5, color: '#FFE2BC' }}>EXIT</span>
      </button>

      <style jsx global>{`
        @keyframes nbPinIn {
          0%   { transform: translateY(-10px) scale(0.94); opacity: 0; }
          100% { transform: none; opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nb-note-in { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// One pinned note — a written note, or a food gift, on the same paper.
//
// The lean and the drop-in live on separate elements: animating `transform`
// on the leaning element would have to re-state the rotation in every
// keyframe, and any future tweak to tilt() would silently desync them.
// ────────────────────────────────────────────────────────────────────────────
function PinnedNote({ m, ink, name, index }: {
  m: JournalMessage
  ink: Ink
  name: string
  index: number
}) {
  const gift = m.gift_item && FOOD_META[m.gift_item.key] ? m.gift_item : null

  return (
    <div className="nb-note-in" style={{
      marginBottom: 20,
      // Stagger the first screenful only — past that it's just latency.
      animation: `nbPinIn 0.34s cubic-bezier(0.34,1.56,0.64,1) ${Math.min(index, 6) * 0.045}s both`,
    }}>
      <div className="relative" style={{ transform: `rotate(${tilt(m.id)}deg)` }}>
        {/* Paper */}
        <div style={{
          background: `repeating-linear-gradient(${ink.paper} 0 20px, ${ink.rule} 20px 21px)`,
          border: `2px solid ${ink.edge}`,
          boxShadow: '4px 5px 0 rgba(62,34,10,0.30)',
          padding: '24px 14px 10px',
        }}>
          {gift ? (
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 flex items-center justify-center" style={{
                width: 52, height: 52,
                background: 'rgba(255,255,255,0.6)',
                border: `2px dashed ${ink.edge}`,
              }}>
                <FoodIcon id={gift.key} size={42} />
              </div>
              <div className="min-w-0">
                <p className="font-pixel flex items-center gap-1.5" style={{ fontSize: 6, letterSpacing: 1, color: ink.ink }}>
                  <IconGift size={12} /> A GIFT
                </p>
                <p style={{ fontSize: 13, color: '#3A2A1C', marginTop: 6 }}>
                  {gift.qty > 1 ? `${gift.qty} × ` : ''}{FOOD_META[gift.key].name}
                </p>
              </div>
            </div>
          ) : (
            <p style={{
              fontSize: 13, lineHeight: '21px', color: '#3A2A1C', wordBreak: 'break-word',
            }}>
              {m.message}
            </p>
          )}

          {/* Signature line */}
          <div className="flex items-center justify-between gap-2" style={{ marginTop: 12 }}>
            <span className="font-pixel" style={{ fontSize: 6, letterSpacing: 1, color: ink.ink }}>
              {name.toUpperCase()}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(58,42,28,0.5)' }}>
              {format(new Date(m.created_at), 'h:mm a')}
            </span>
          </div>
        </div>

        {/* Pin, punched through the top of the paper in the sender's colour. */}
        <div className="absolute" style={{ top: -12, left: '50%', transform: 'translateX(-50%)' }}>
          <IconPin size={24} tone={ink.pin} dark={ink.pinDark} />
        </div>
      </div>
    </div>
  )
}
