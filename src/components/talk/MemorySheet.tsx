'use client'

// ═════════════════════════════════════════════════════════════════════════════
// MemorySheet — everything Eren has quietly kept about you, and a way to
// take it back.
//
// He decides what to save and is told never to mention that he did. That's
// the right behaviour for the character and the wrong behaviour for trust:
// without this sheet a fact he got wrong rides in every prompt forever with
// no way to reach it. So the list is his handwriting, and the delete is yours.
//
// Presentation only — useErenMemories owns the data and the optimistic delete.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { playSound } from '@/lib/sounds'
import { IconClose } from '@/components/PixelIcons'
import type { ErenChatMemory } from '@/types'

const PAPER = '#FFFBF1'
const INK   = '#4A3A2A'
const EDGE  = '#D8C3A0'

interface Props {
  open: boolean
  memories: ErenChatMemory[]
  loading: boolean
  loaded: boolean
  onForget: (id: string) => void
  onClose: () => void
}

export default function MemorySheet({ open, memories, loading, loaded, onForget, onClose }: Props) {
  // Two-step delete. These are the only durable record of things you told him;
  // a single mis-tap shouldn't be able to erase one silently.
  const [armed, setArmed] = useState<string | null>(null)

  useEffect(() => { if (!open) setArmed(null) }, [open])

  // Disarm on any outside tap, so a pending confirm never survives a scroll
  // away and fires on a later, unrelated tap.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 4000)
    return () => clearTimeout(t)
  }, [armed])

  if (!open) return null

  return (
    <div
      // `fixed`, not `absolute` — as a sibling of the chat surface there is no
      // positioned ancestor to inset against, and the header (z-10 inside a
      // fixed root) otherwise stays undimmed while the transcript darkens.
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      style={{ background: 'rgba(58,38,18,0.45)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col"
        style={{
          maxHeight: '78%',
          background: 'linear-gradient(180deg, #FFF6E6 0%, #F6E4C6 100%)',
          borderTop: '3px solid #C9A87A',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          boxShadow: '0 -4px 0 rgba(122,74,34,0.2)',
          animation: 'memSheetUp 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div style={{ width: 40, height: 4, borderRadius: 3, background: '#C9A87A' }} />
        </div>

        <header className="flex items-center gap-2 px-4 pb-3 pt-1">
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: '"Press Start 2P"', fontSize: 9, color: '#5A3212', letterSpacing: 0.4 }}>
              WHAT HE REMEMBERS
            </div>
            <div style={{ fontSize: 10.5, color: '#9A7444', marginTop: 4, lineHeight: 1.5 }}>
              he writes these himself and never mentions it. delete anything he got wrong.
            </div>
          </div>
          <button
            onClick={() => { playSound('ui_modal_close'); onClose() }}
            aria-label="Close"
            className="active:scale-90 transition-transform duration-100 shrink-0 flex items-center justify-center"
            style={{
              width: 32, height: 32, borderRadius: 9,
              background: PAPER, border: `2px solid ${EDGE}`, boxShadow: '0 2px 0 #B79B6E',
            }}
          >
            <IconClose size={13} />
          </button>
        </header>

        <div className="overflow-y-auto px-4 pb-5 flex flex-col gap-2">
          {!loaded && loading && (
            <Empty text="opening his notebook…" />
          )}

          {!loaded && !loading && (
            <Empty text="couldn't read his notebook. try again in a moment." />
          )}

          {loaded && memories.length === 0 && (
            <Empty text="nothing yet. he keeps things once you've told him something worth keeping." />
          )}

          {memories.map((m) => {
            const isArmed = armed === m.id
            return (
              <div
                key={m.id}
                className="flex items-start gap-2.5"
                style={{
                  background: isArmed ? '#FFECEC' : PAPER,
                  border: `2px solid ${isArmed ? '#E8A0A0' : EDGE}`,
                  borderRadius: 10,
                  boxShadow: `2px 2px 0 ${isArmed ? 'rgba(160,48,48,0.22)' : 'rgba(122,74,34,0.16)'}`,
                  padding: '10px 11px',
                  transition: 'background 140ms, border-color 140ms',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, color: INK, wordBreak: 'break-word' }}>
                    {m.fact}
                  </div>
                  <div style={{ fontFamily: '"Press Start 2P"', fontSize: 6, color: '#B79B6E', marginTop: 6 }}>
                    {format(new Date(m.created_at), 'MMM d').toUpperCase()}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (isArmed) {
                      playSound('chat_forget')
                      onForget(m.id)
                      setArmed(null)
                    } else {
                      playSound('ui_tap')
                      setArmed(m.id)
                    }
                  }}
                  className="active:scale-90 transition-transform duration-100 shrink-0"
                  style={{
                    fontFamily: '"Press Start 2P"', fontSize: 6,
                    color: isArmed ? '#FFF3F3' : '#A8814E',
                    background: isArmed ? '#C33' : 'transparent',
                    border: `2px solid ${isArmed ? '#8B1A1A' : EDGE}`,
                    borderRadius: 7, padding: '7px 8px',
                    boxShadow: isArmed ? '0 2px 0 #8B1A1A' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isArmed ? 'SURE?' : 'FORGET'}
                </button>
              </div>
            )
          })}
        </div>

        <style>{`
          @keyframes memSheetUp {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div
      className="text-center px-6 py-8"
      style={{ fontSize: 12, color: '#9A7444', lineHeight: 1.65 }}
    >
      {text}
    </div>
  )
}
