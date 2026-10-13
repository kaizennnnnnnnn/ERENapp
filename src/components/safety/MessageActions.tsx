'use client'

/**
 * The sheet a long-press opens on a message or a note.
 *
 * Report is always here. Delete only appears on your own messages — removing
 * what the other person wrote is not tidying up, it is editing their side of a
 * shared history, and it would let an abuser erase what they said from the
 * other person's phone. The DELETE policy enforces the same rule server-side;
 * this just does not offer what the database would refuse.
 *
 * A Meadow sheet: the message quoted on a soft bubble so it is obvious which
 * one is about to go, then the two actions as rows. Delete asks once more, in
 * the same sheet, with the red button.
 */

import { useState } from 'react'
import { DangerButton, ListGroup, ListRow, M, SecondaryButton, Sheet, TYPE } from '@/components/meadow'
import ReportSheet from './ReportSheet'
import { useSheetExit } from './useSheetExit'
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

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function MessageActions({ target, targetId, what, preview, onDelete, onClose }: Props) {
  const [open, close] = useSheetExit(onClose)
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
    close()
  }

  const footer = confirming ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <DangerButton size="lg" busy={busy} onClick={doDelete}>{busy ? 'Deleting...' : 'Delete'}</DangerButton>
      <SecondaryButton size="lg" disabled={busy} onClick={() => setConfirming(false)}>Keep it</SecondaryButton>
    </div>
  ) : undefined

  return (
    <Sheet
      open={open}
      onClose={close}
      title={confirming ? `Delete ${what}?` : capitalise(what)}
      dismissible={!busy}
      footer={footer}
    >
      {preview && (
        <p style={{
          margin: '0 0 16px', padding: '12px 16px', borderRadius: 20, background: M.soft,
          ...TYPE.body, color: M.text2, overflowWrap: 'anywhere',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {preview}
        </p>
      )}

      {confirming ? (
        <p style={{ margin: '0 4px 4px', ...TYPE.body, color: M.text }}>
          It goes from your partner&apos;s app too, and it cannot be undone.
        </p>
      ) : (
        <ListGroup style={{ boxShadow: `inset 0 0 0 2px ${M.hairline}` }}>
          <ListRow icon="flag" label={`Report ${what}`} onClick={() => setReporting(true)} />
          {onDelete && (
            <ListRow icon="trash" label={`Delete ${what}`} destructive chevron={false} onClick={() => setConfirming(true)} />
          )}
        </ListGroup>
      )}
    </Sheet>
  )
}
