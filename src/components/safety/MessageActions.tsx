'use client'

/**
 * The sheet a long-press opens on a message or a note.
 *
 * Report is always here. Delete only appears on your own messages — removing
 * what the other person wrote is not tidying up, it is editing their side of a
 * shared history, and it would let an abuser erase what they said from the
 * other person's phone. The DELETE policy enforces the same rule server-side;
 * this just does not offer what the database would refuse.
 */

import { useState } from 'react'
import { OBSIDIAN_BTN, Rivets } from '@/components/obsidian'
import ReportSheet from './ReportSheet'
import type { ReportTarget } from '@/lib/reporting'

interface Props {
  target: ReportTarget
  targetId: string
  /** Noun for the sheet titles, e.g. "this message" / "this note". */
  what: string
  /** Preview of the content, so it is obvious which one is about to go. */
  preview?: string | null
  /** Omit to hide Delete — i.e. this is not the caller's own content. */
  onDelete?: () => Promise<void> | void
  onClose: () => void
}

export default function MessageActions({ target, targetId, what, preview, onDelete, onClose }: Props) {
  const [reporting, setReporting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (reporting) {
    return <ReportSheet target={target} targetId={targetId} what={what} onClose={onClose} />
  }

  async function doDelete() {
    if (busy || !onDelete) return
    setBusy(true)
    await onDelete()
    setBusy(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center"
         style={{ background: 'rgba(5,5,7,0.86)' }}
         role="dialog" aria-modal="true"
         onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-sm relative"
        style={{ ...OBSIDIAN_BTN, padding: 20, borderRadius: '12px 12px 0 0' }}>
        <Rivets inset={5} size={3} />

        {preview && (
          <p style={{
            fontSize: 13, lineHeight: 1.55, color: '#8A7C90',
            margin: '0 0 16px', padding: '9px 11px',
            background: 'rgba(255,255,255,0.04)', borderRadius: 5,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {preview}
          </p>
        )}

        {confirming ? (
          <>
            <p style={{ fontSize: 15, color: '#F4ECE2', fontWeight: 600, margin: '0 0 8px' }}>
              Delete {what}?
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#C9BFC5', margin: '0 0 18px' }}>
              It goes from your partner&apos;s app too, and it cannot be undone.
            </p>
            <div className="flex" style={{ gap: 8 }}>
              <button onClick={() => setConfirming(false)} disabled={busy}
                className="flex-1 py-3" style={{ ...OBSIDIAN_BTN, borderRadius: 6, opacity: busy ? 0.5 : 1 }}>
                <span style={{ fontSize: 14, color: '#C9BFC5' }}>Keep it</span>
              </button>
              <button onClick={doDelete} disabled={busy}
                className="flex-1 py-3"
                style={{ ...OBSIDIAN_BTN, borderRadius: 6, border: '1px solid rgba(255,139,139,0.6)', opacity: busy ? 0.5 : 1 }}>
                <span style={{ fontSize: 14, color: '#FF8B8B' }}>{busy ? 'Deleting…' : 'Delete'}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col" style={{ gap: 8 }}>
            <button onClick={() => setReporting(true)} className="w-full py-3"
              style={{ ...OBSIDIAN_BTN, borderRadius: 6 }}>
              <span style={{ fontSize: 14, color: '#F4ECE2' }}>Report {what}</span>
            </button>

            {onDelete && (
              <button onClick={() => setConfirming(true)} className="w-full py-3"
                style={{ ...OBSIDIAN_BTN, borderRadius: 6, border: '1px solid rgba(255,139,139,0.45)' }}>
                <span style={{ fontSize: 14, color: '#FF8B8B' }}>Delete {what}</span>
              </button>
            )}

            <button onClick={onClose} className="w-full py-3"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6 }}>
              <span style={{ fontSize: 14, color: '#8A7C90' }}>Cancel</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
