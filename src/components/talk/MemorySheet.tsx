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
// A Meadow Sheet: each fact on a soft row with its date, and a quiet Forget
// that turns into a red "Sure?" before it does anything.
//
// Presentation only — useErenMemories owns the data and the optimistic delete.
// ═════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { playSound } from '@/lib/sounds'
import { useCat } from '@/hooks/useCat'
import { DangerButton, M, Sheet, TextButton } from '@/components/meadow'
import type { ErenChatMemory } from '@/types'

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
  const cat = useCat()

  useEffect(() => { if (!open) setArmed(null) }, [open])

  // Disarm after a moment, so a pending confirm never survives a scroll away
  // and fires on a later, unrelated tap.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 4000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <Sheet
      open={open}
      onClose={() => { playSound('ui_modal_close'); onClose() }}
      title={cat.t('What {he} remembers')}
      maxHeight="78%"
    >
      <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
        {cat.t('{He} writes these {himself} and never mentions it. Delete anything {he} got wrong.')}
      </p>

      <div className="flex flex-col" style={{ gap: 8 }}>
        {!loaded && loading && <Empty text={cat.t('Opening {his} notebook…')} />}
        {!loaded && !loading && <Empty text={cat.t('Couldn\'t read {his} notebook. Try again in a moment.')} />}
        {loaded && memories.length === 0 && (
          <Empty text={cat.t('Nothing yet. {He} keeps things once you\'ve told {him} something worth keeping.')} />
        )}

        {memories.map((m) => {
          const isArmed = armed === m.id
          return (
            <div key={m.id} className="flex items-center" style={{
              gap: 10, padding: '10px 10px 10px 14px', borderRadius: 18,
              background: isArmed ? M.dangerTint : M.soft,
              transition: 'background 140ms',
            }}>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text, overflowWrap: 'anywhere' }}>
                  {m.fact}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: M.text2, marginTop: 3 }}>
                  {format(new Date(m.created_at), 'MMM d')}
                </div>
              </div>

              {isArmed ? (
                <DangerButton size="sm" onClick={() => { playSound('chat_forget'); onForget(m.id); setArmed(null) }}
                  ariaLabel={`Forget: ${m.fact}`} style={{ height: 38, padding: '0 14px' }}>
                  Sure?
                </DangerButton>
              ) : (
                <TextButton tone="muted" size={14} onClick={() => { playSound('ui_tap'); setArmed(m.id) }}
                  ariaLabel={`Forget: ${m.fact}`}>
                  Forget
                </TextButton>
              )}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <p style={{ margin: 0, padding: '24px 16px', textAlign: 'center', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
      {text}
    </p>
  )
}
