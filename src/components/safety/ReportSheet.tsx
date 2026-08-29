'use client'

/**
 * The report sheet — one component behind every "report this" in the app.
 *
 * Deliberately plain. Everything else in Eren is a pixel-art toy; this is the
 * screen someone opens when something has gone wrong, possibly while
 * frightened. Snap keyframes, gold rivets and Press Start 2P labels would be
 * the wrong register, so the chrome stays quiet and the copy does the work.
 *
 * Two steps: pick a reason, then confirm. The second step is not friction for
 * its own sake — it is where we say what actually happens next, so nobody
 * files a report believing it summons help it does not summon.
 */

import { useState } from 'react'
import { OBSIDIAN_BTN, Rivets } from '@/components/obsidian'
import {
  REPORT_REASONS, URGENT_REASONS, reportContent,
  type ReportReason, type ReportTarget,
} from '@/lib/reporting'

interface Props {
  target: ReportTarget
  targetId: string
  /** What the reporter is looking at, for the sheet's title. */
  what: string
  onClose: () => void
  /** Fired after a report lands, so the caller can show its own confirmation. */
  onReported?: () => void
}

export default function ReportSheet({ target, targetId, what, onClose, onReported }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [done, setDone]     = useState(false)

  async function submit() {
    if (!reason || busy) return
    setBusy(true)
    setError(null)
    const res = await reportContent({ target, targetId, reason, detail })
    setBusy(false)
    if (!res.ok) { setError(res.message); return }
    setDone(true)
    onReported?.()
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center"
         style={{ background: 'rgba(5,5,7,0.86)' }}
         role="dialog" aria-modal="true" aria-labelledby="report-title"
         onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-sm relative"
        style={{
          ...OBSIDIAN_BTN,
          maxHeight: '86svh',
          overflowY: 'auto',
          padding: 22,
          borderRadius: '12px 12px 0 0',
        }}>
        <Rivets inset={5} size={3} />

        {done ? (
          <>
            <p id="report-title" style={{ fontSize: 17, color: '#F4ECE2', fontWeight: 600, margin: '0 0 12px' }}>
              Report sent
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: '#C9BFC5', margin: '0 0 12px' }}>
              We have a copy of what you reported, so it stays with us even if
              it is deleted from the app.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.65, color: '#C9BFC5', margin: '0 0 18px' }}>
              A person will read it. If you also want this person out of your
              home right now, you can block them from your profile.
            </p>
            <button onClick={onClose} className="w-full py-3"
              style={{ ...OBSIDIAN_BTN, borderRadius: 6 }}>
              <span style={{ fontSize: 14, color: '#F4ECE2' }}>Close</span>
            </button>
          </>
        ) : (
          <>
            <p id="report-title" style={{ fontSize: 17, color: '#F4ECE2', fontWeight: 600, margin: '0 0 6px' }}>
              Report {what}
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#8A7C90', margin: '0 0 18px' }}>
              Tell us what is wrong with it. We keep a copy of the content so
              it can be reviewed even if it is deleted.
            </p>

            <div className="flex flex-col" style={{ gap: 7, marginBottom: 16 }}>
              {REPORT_REASONS.map(r => {
                const on = reason === r.code
                return (
                  <button
                    key={r.code}
                    onClick={() => setReason(r.code)}
                    className="text-left px-3 py-2.5 transition-colors"
                    style={{
                      background: on ? 'rgba(240,165,192,0.12)' : 'transparent',
                      border: `1px solid ${on ? 'rgba(240,165,192,0.55)' : 'rgba(255,255,255,0.10)'}`,
                      borderRadius: 5,
                    }}>
                    <span style={{ fontSize: 14, color: on ? '#F4ECE2' : '#C9BFC5' }}>{r.label}</span>
                  </button>
                )
              })}
            </div>

            {reason && URGENT_REASONS.includes(reason) && (
              <p style={{
                fontSize: 13, lineHeight: 1.6, color: '#FFC9C9', margin: '0 0 16px',
                padding: '10px 12px', borderRadius: 5,
                background: 'rgba(255,139,139,0.08)',
                border: '1px solid rgba(255,139,139,0.35)',
              }}>
                We review this as a priority. But we are not an emergency
                service and we do not watch the app in real time — if someone
                is in danger right now, call your local emergency number.
              </p>
            )}

            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value.slice(0, 2000))}
              placeholder="Anything else we should know? (optional)"
              rows={3}
              style={{
                width: '100%', resize: 'none',
                background: '#0B0B10',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 5, padding: 10,
                fontSize: 16, color: '#F4ECE2', outline: 'none',
                marginBottom: 16,
              }} />

            {error && (
              <p style={{ fontSize: 13, color: '#FF8B8B', margin: '0 0 12px' }}>{error}</p>
            )}

            <div className="flex" style={{ gap: 8 }}>
              <button onClick={onClose} disabled={busy} className="flex-1 py-3"
                style={{ ...OBSIDIAN_BTN, borderRadius: 6, opacity: busy ? 0.5 : 1 }}>
                <span style={{ fontSize: 14, color: '#C9BFC5' }}>Cancel</span>
              </button>
              <button onClick={submit} disabled={!reason || busy} className="flex-1 py-3"
                style={{
                  ...OBSIDIAN_BTN,
                  borderRadius: 6,
                  border: '1px solid rgba(255,139,139,0.6)',
                  opacity: (!reason || busy) ? 0.45 : 1,
                }}>
                <span style={{ fontSize: 14, color: '#FF8B8B' }}>
                  {busy ? 'Sending…' : 'Send report'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
