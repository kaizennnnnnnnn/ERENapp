'use client'

// ═══════════════════════════════════════════════════════════════════════════
// THE RECEIPT — what the night came to.
// ──────────────────────────────────────────────────────────────────────────
// The shift used to end with a number in the corner vanishing as you stepped
// through the door. This is the send-off: the till roll, printed, with the
// grade at the bottom and a space to leave a note for whoever works next.
//
// It's the only way out of the kiosk, which is deliberate — closing up should
// be a thing you did, not a thing that happened.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react'
import { IconCoin } from '@/components/PixelIcons'
import { playSound } from '@/lib/sounds'
import { GRADE_COLOR, GRADE_WORD } from './kioskEconomy'
import type { ShiftReport as Report } from './useKioskShift'

interface Props {
  report: Report
  /** Why nothing was paid, when nothing was. */
  practiceReason: string | null
  /** Notes can only be left on a shift that made it into the book. */
  canNote: boolean
  onSaveNote: (note: string) => void
  onDone: () => void
}

const PAPER = '#F1E6D2'
const INK = '#3B2A1D'
const FADED = '#8A7460'

/** The torn edge, top and bottom. */
function Serration({ flip }: { flip?: boolean }) {
  return (
    <div aria-hidden style={{
      height: 8,
      background: `repeating-conic-gradient(${PAPER} 0% 25%, transparent 0% 50%) 0 0 / 12px 16px`,
      transform: flip ? 'scaleY(-1)' : undefined,
    }} />
  )
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="font-pixel" style={{
      display: 'flex', alignItems: 'baseline', gap: 6,
      fontSize: 6.5, letterSpacing: 0.5, color: dim ? FADED : INK,
    }}>
      <span>{label}</span>
      {/* Dot leaders, the way a till roll runs the price out to the edge. */}
      <span aria-hidden style={{
        flex: '1 1 auto', height: 1, marginBottom: 2,
        borderBottom: `1px dotted ${dim ? FADED : 'rgba(59,42,29,0.4)'}`,
      }} />
      <span>{value}</span>
    </div>
  )
}

export default function ShiftReport({ report, practiceReason, canNote, onSaveNote, onDone }: Props) {
  const { takings: t, grade, coins, rained, early, unlock } = report
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => { playSound('kiosk_shutter') }, [])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-5"
      style={{ background: 'rgba(4,3,4,0.86)', backdropFilter: 'blur(3px)' }}>
      <div style={{
        width: '100%', maxWidth: 300,
        filter: 'drop-shadow(4px 6px 0 rgba(0,0,0,0.55))',
        animation: 'kioskReceiptIn 520ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>
        <Serration />
        <div style={{ background: PAPER, padding: '14px 16px 16px' }}>
          {/* ── header ── */}
          <div className="font-pixel" style={{
            textAlign: 'center', fontSize: 8, letterSpacing: 2, color: INK,
          }}>
            SHUTTERS DOWN
          </div>
          <div className="font-pixel" style={{
            textAlign: 'center', fontSize: 5.5, letterSpacing: 1, color: FADED, marginTop: 5,
          }}>
            {early ? 'CLOSED EARLY' : 'WORKED THE WHOLE NIGHT'}{rained ? ' · IN THE RAIN' : ''}
          </div>

          <div style={{ height: 1, background: 'rgba(59,42,29,0.25)', margin: '12px 0 10px' }} />

          {/* ── the night ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label="SERVED" value={`${t.served}`} />
            {t.wrong > 0 && <Row label="HANDED BACK" value={`${t.wrong}`} />}
            {t.walked > 0 && <Row label="WALKED OFF" value={`${t.walked}`} />}
            {t.bestStreak > 1 && <Row label="BEST RUN" value={`${t.bestStreak}`} />}
            {t.missedCalls > 0 && <Row label="MISSED CALLS" value={`${t.missedCalls}`} dim />}
          </div>

          <div style={{ height: 1, background: 'rgba(59,42,29,0.25)', margin: '10px 0' }} />

          {/* ── the money ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label="BASE" value={`${t.base}`} />
            <Row label="TIPS" value={`${t.tips}`} dim={t.tips === 0} />
            {early && t.tips === 0 && (
              <div className="font-pixel" style={{ fontSize: 5.5, lineHeight: 1.7, color: FADED }}>
                you left before the street emptied — the tips stayed in the till
              </div>
            )}
          </div>

          <div style={{
            marginTop: 12, padding: '9px 10px',
            background: coins > 0 ? 'rgba(59,42,29,0.08)' : 'rgba(59,42,29,0.05)',
            border: `2px solid ${coins > 0 ? 'rgba(59,42,29,0.35)' : 'rgba(59,42,29,0.18)'}`,
            borderRadius: 4,
          }}>
            <div className="font-pixel" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 8, letterSpacing: 1, color: INK,
            }}>
              <span>TOOK HOME</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <IconCoin size={12} />{coins}
              </span>
            </div>
            {practiceReason && (
              <div className="font-pixel" style={{
                fontSize: 5.5, lineHeight: 1.7, color: FADED, marginTop: 6,
              }}>
                {practiceReason}
              </div>
            )}
          </div>

          {/* ── the grade ── */}
          <div style={{
            marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <span className="font-pixel" style={{
              fontSize: 26, lineHeight: 1, color: GRADE_COLOR[grade],
              textShadow: '1px 1px 0 rgba(59,42,29,0.22)',
              animation: 'kioskGradeIn 620ms cubic-bezier(0.16, 1, 0.3, 1) 260ms both',
            }}>
              {grade}
            </span>
            <span className="font-pixel" style={{ fontSize: 6.5, letterSpacing: 0.5, color: INK }}>
              {GRADE_WORD[grade]}
            </span>
          </div>

          {unlock && (
            <div className="font-pixel" style={{
              marginTop: 12, padding: '8px 9px',
              fontSize: 6, lineHeight: 1.8, letterSpacing: 0.5,
              color: INK, background: 'rgba(212,160,60,0.22)',
              border: '2px dashed rgba(59,42,29,0.4)', borderRadius: 4,
              animation: 'kioskGradeIn 520ms cubic-bezier(0.16, 1, 0.3, 1) 620ms both',
            }}>
              NEW ON THE MENU — {unlock.label}
              <div style={{ color: FADED, marginTop: 5 }}>{unlock.blurb}</div>
            </div>
          )}

          {/* ── the note ── */}
          {canNote && (
            <div style={{ marginTop: 14 }}>
              <div className="font-pixel" style={{ fontSize: 5.5, letterSpacing: 1, color: FADED }}>
                LEAVE A NOTE AT THE TILL
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <input
                  value={note}
                  onChange={e => { setNote(e.target.value); setSaved(false) }}
                  maxLength={60}
                  placeholder="ran out of onion. sorry."
                  aria-label="A note for whoever works next"
                  className="font-pixel"
                  style={{
                    flex: '1 1 auto', minWidth: 0,
                    fontSize: 6, letterSpacing: 0.3, color: INK,
                    background: 'transparent', border: 0,
                    borderBottom: `1px solid rgba(59,42,29,0.4)`,
                    padding: '4px 2px', outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => { if (note.trim()) { onSaveNote(note.trim()); setSaved(true); playSound('ui_select') } }}
                  disabled={!note.trim() || saved}
                  className="font-pixel active:translate-y-[1px] transition-transform"
                  style={{
                    flex: '0 0 auto',
                    fontSize: 6, letterSpacing: 1,
                    color: saved ? FADED : PAPER,
                    background: saved ? 'transparent' : INK,
                    border: `2px solid ${INK}`, borderRadius: 4,
                    padding: '5px 7px 4px',
                  }}>
                  {saved ? 'PINNED' : 'PIN'}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => { playSound('ui_back'); onDone() }}
            className="font-pixel active:translate-y-[2px] transition-transform"
            style={{
              marginTop: 16, width: '100%',
              fontSize: 7.5, letterSpacing: 1.5, color: '#3A1B08',
              background: '#F59C45',
              padding: '11px 12px 10px',
              border: '3px solid #5A2E12', borderRadius: 4,
              boxShadow: '0 3px 0 #DC772A',
            }}>
            OUT INTO THE STREET
          </button>
        </div>
        <Serration flip />
      </div>
    </div>
  )
}
