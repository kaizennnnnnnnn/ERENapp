'use client'

/**
 * The report sheet — one component behind every "report this" in the app.
 *
 * Deliberately plain. This is the screen someone opens when something has
 * gone wrong, possibly while frightened, so it is an ordinary Meadow sheet:
 * no cat, no sparkle, no motion beyond the sheet rising. The copy does the
 * work.
 *
 * Two steps: pick a reason, then confirm. The second step is not friction for
 * its own sake — it is where we say what actually happens next, so nobody
 * files a report believing it summons help it does not summon.
 */

import { useId, useState } from 'react'
import { CheckDisc, IconTile, M, PrimaryButton, SecondaryButton, Sheet, TINT, TYPE, FONT_ROUNDED } from '@/components/meadow'
import {
  REPORT_REASONS, URGENT_REASONS, reportContent,
  type ReportReason, type ReportTarget,
} from '@/lib/reporting'
import { useSheetExit } from './useSheetExit'

interface Props {
  target: ReportTarget
  targetId: string
  /** What the reporter is looking at, for the sheet's title. */
  what: string
  onClose: () => void
  /** Fired after a report lands, so the caller can show its own confirmation. */
  onReported?: () => void
}

const DETAIL_MAX = 2000

export default function ReportSheet({ target, targetId, what, onClose, onReported }: Props) {
  const [open, close] = useSheetExit(onClose)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [done, setDone]     = useState(false)
  const [focused, setFocused] = useState(false)
  const detailId = useId()
  const reasonsId = useId()

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

  const footer = done ? (
    <SecondaryButton size="lg" onClick={close}>Close</SecondaryButton>
  ) : (
    <div>
      {/* Here, by the button, not under the list: picked from the top of a
          long list, it would sit below the fold where nobody sees it. */}
      {reason && URGENT_REASONS.includes(reason) && (
        <p style={{
          margin: '0 0 12px', padding: '10px 14px', borderRadius: 16,
          background: M.dangerTint, fontSize: 14, lineHeight: 1.45, fontWeight: 600, color: M.text,
        }}>
          <strong>We review this as a priority.</strong>{' '}
          But we are not an emergency service and we do not watch the app in
          real time. If someone is in danger right now, call your local
          emergency number.
        </p>
      )}
      {error && (
        <p role="alert" style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.4, fontWeight: 700, color: M.danger, textAlign: 'center' }}>
          {error}
        </p>
      )}
      <PrimaryButton busy={busy} disabled={!reason} onClick={submit}>
        {busy ? 'Sending...' : 'Send report'}
      </PrimaryButton>
    </div>
  )

  return (
    <Sheet
      open={open}
      onClose={close}
      title={done ? 'Report sent' : `Report ${what}`}
      dismissible={!busy}
      footer={footer}
    >
      {done ? (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 4px' }}>
          <IconTile icon="check" size={48} bg={TINT.leaf} color={M.leaf} />
          <p style={{ margin: 0, ...TYPE.body, color: M.text }}>
            We have a copy of what you reported, so it stays with us even if
            it is deleted from the app.
          </p>
          <p style={{ margin: 0, ...TYPE.body, color: M.text }}>
            A person will read it. If you also want this person out of your
            home right now, you can block them from your profile.
          </p>
        </div>
      ) : (
        <>
          <p style={{ margin: '0 4px 16px', ...TYPE.body, color: M.text2 }}>
            Tell us what is wrong with it. We keep a copy of the content so
            it can be reviewed even if it is deleted.
          </p>

          <p id={reasonsId} style={{ margin: '0 4px 8px', ...TYPE.label, color: M.label }}>What&apos;s wrong</p>
          <div role="radiogroup" aria-labelledby={reasonsId} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {REPORT_REASONS.map(r => {
              const on = reason === r.code
              return (
                <button
                  key={r.code}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setReason(r.code)}
                  className="m-press m-focus"
                  style={{
                    width: '100%', minHeight: 52, boxSizing: 'border-box', padding: '10px 14px 10px 16px',
                    border: `2px solid ${on ? M.leaf : M.hairline}`, borderRadius: 18,
                    background: on ? M.leafTint : '#FFFFFF',
                    display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
                    fontFamily: FONT_ROUNDED, fontSize: 16, lineHeight: 1.3, fontWeight: 700,
                    color: on ? M.leafInk : M.text,
                  }}
                >
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>{r.label}</span>
                  {on && <CheckDisc />}
                </button>
              )
            })}
          </div>

          <label htmlFor={detailId} style={{ display: 'block', margin: '0 4px 8px', ...TYPE.label, color: M.label }}>
            Anything else we should know?
          </label>
          <textarea
            id={detailId}
            value={detail}
            onChange={e => setDetail(e.target.value.slice(0, DETAIL_MAX))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Optional"
            rows={3}
            className="m-input"
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'none', padding: '12px 16px',
              border: `2px solid ${focused ? M.leaf : M.hairline}`, borderRadius: 16,
              boxShadow: focused ? `0 0 0 4px ${M.leafTint}` : 'none',
              background: '#FFFFFF', color: M.text, caretColor: M.leaf, outline: 'none',
              fontFamily: FONT_ROUNDED, fontSize: 16, lineHeight: 1.45, fontWeight: 600,
            }}
          />
        </>
      )}
    </Sheet>
  )
}
