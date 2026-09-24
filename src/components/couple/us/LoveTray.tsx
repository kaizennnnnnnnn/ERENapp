'use client'

// ─── The love tray ───────────────────────────────────────────────────────────
// Four one-tap gestures (the NUDGE_DEFS). A tap sends straight away, no picker
// in between; the tile then keeps a leaf ring and a check for the rest of the
// visit. Nudges are meant to be spammable, so a sent tile still sends again.

import type { ReactNode } from 'react'
import { CheckDisc, FONT_ROUNDED, M, MeadowIcon, SectionLabel, type MeadowIconName } from '@/components/meadow'
import type { LoveTrayState, NudgeId } from './usModel'

const TRAY: ReadonlyArray<{ id: NudgeId; icon: MeadowIconName; label: ReactNode; words: string }> = [
  { id: 'loveyou', icon: 'heart', label: 'I love you', words: 'I love you' },
  { id: 'kiss', icon: 'lips', label: 'Kiss', words: 'a kiss' },
  { id: 'miss', icon: 'loveLetter', label: 'Miss you', words: 'miss you' },
  { id: 'think', icon: 'thought', label: <>Thinking<br />of you</>, words: 'thinking of you' },
]

interface Props {
  partnerName: string
  tray: LoveTrayState
  onSend: (id: NudgeId) => void
}

export default function LoveTray({ partnerName, tray, onSend }: Props) {
  const lastSent = TRAY.filter(t => tray.sent[t.id]).map(t => t.words)
  return (
    <>
      <SectionLabel>Send love</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {TRAY.map(t => {
          const on = !!tray.sent[t.id]
          const busy = tray.busy === t.id
          return (
            <button
              key={t.id}
              type="button"
              aria-label={`Send ${t.words} to ${partnerName}`}
              aria-busy={busy || undefined}
              onClick={() => { if (!busy) onSend(t.id) }}
              className="m-press m-focus"
              style={{
                position: 'relative', height: 112, padding: '0 4px', border: 0, borderRadius: 20,
                background: '#FFFFFF', boxShadow: on ? `0 0 0 2px ${M.leaf}` : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontFamily: FONT_ROUNDED, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
              }}
            >
              <MeadowIcon name={t.icon} size={36} />
              <span style={{
                minHeight: 30, display: 'flex', alignItems: 'center', textAlign: 'center',
                fontSize: 12, lineHeight: 1.25, fontWeight: 800, color: M.text,
              }}>
                {t.label}
              </span>
              {on && <CheckDisc corner style={{ right: -6, top: -6 }} />}
            </button>
          )
        })}
      </div>
      {/* Screen readers hear what went; the check says it to everyone else. */}
      <p role="status" className="sr-only">
        {lastSent.length > 0 ? `Sent ${lastSent.join(', ')} to ${partnerName}` : ''}
      </p>
      {tray.error?.from === 'tray' && (
        <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 700, color: M.danger, textAlign: 'center' }}>
          {tray.error.message}
        </p>
      )}
    </>
  )
}
