'use client'

// ═════════════════════════════════════════════════════════════════════════════
// MemoryWall — the Hallway's pictures
//
// Two groups, in the Meadow cards the other pages use: "On the wall", every
// memory the household has, newest first, each a framed picture with its name
// under it; then "Still to find", the rest as plain locked tiles in catalogue
// order. Any tile opens MemoryDetailSheet, which decides what to show from
// whether a memory_frames row exists.
//
// A household of one isn't shown the partner-only frames as locked: they were
// never theirs to find. Any it already holds stay on the wall.
// ═════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { playSound } from '@/lib/sounds'
import MemoryFrameCanvas from '@/components/memory/MemoryFrameCanvas'
import MemoryDetailSheet from '@/components/memory/MemoryDetailSheet'
import { MEMORY_FRAMES, frameById, needsPartner, type MemoryFrame } from '@/lib/memoryCatalogue'
import type { MemoryFrameRow, ReactionEmoji } from '@/hooks/useMemoryFrames'
import { useCat } from '@/hooks/useCat'
import { Card, SectionLabel, M } from '@/components/meadow'

interface Props {
  rows: MemoryFrameRow[]
  partnerId: string | null
  partnerName: string | null
  /** Household of one: the nine partner-only frames are not shown as locked. */
  isSolo?: boolean
  onReactionChange: (frameId: string, reaction: Record<string, ReactionEmoji>) => void
}

interface Held { frame: MemoryFrame; row: MemoryFrameRow }

export default function MemoryWall({ rows, partnerId, partnerName, isSolo, onReactionChange }: Props) {
  // `openId` is what's open; `shownId` outlives it so the sheet can close
  // with its picture still in it.
  const [openId, setOpenId] = useState<string | null>(null)
  const [shownId, setShownId] = useState<string | null>(null)
  const cat = useCat()

  const { held, toFind } = useMemo(() => {
    const byId = new Map<string, MemoryFrameRow>()
    for (const r of rows) byId.set(r.frame_id, r)

    const held: Held[] = []
    const toFind: MemoryFrame[] = []
    for (const f of MEMORY_FRAMES) {
      const row = byId.get(f.id)
      if (row) held.push({ frame: f, row })
      else if (!isSolo || !needsPartner(f)) toFind.push(f)
    }
    held.sort((a, b) => b.row.unlocked_at.localeCompare(a.row.unlocked_at))
    return { held, toFind }
  }, [rows, isSolo])

  function open(id: string) {
    playSound('ui_tap')
    setOpenId(id)
    setShownId(id)
  }

  const shownFrame = shownId ? frameById(shownId) ?? null : null
  const shownRow = shownId ? rows.find(r => r.frame_id === shownId) ?? null : null

  return (
    <>
      <SectionLabel trailing={String(held.length)}>On the wall</SectionLabel>
      <Card padding="18px 6px 16px">
        {held.length === 0 ? (
          <p style={{ margin: 0, padding: '6px 12px', fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2, textAlign: 'center' }}>
            {cat.t('Nothing here yet. Your first days with {name} will hang here as they happen.')}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', rowGap: 16, columnGap: 2 }}>
            {held.map(({ frame }) => {
              const title = cat.t(frame.title)
              return (
                <button
                  key={frame.id}
                  type="button"
                  aria-label={title}
                  onClick={() => open(frame.id)}
                  className="m-press m-focus"
                  style={{
                    minWidth: 0, padding: '2px 0', border: 0, background: 'transparent', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    fontFamily: 'inherit', color: M.text,
                  }}
                >
                  <MemoryFrameCanvas frame={frame} size={64} />
                  <span style={{
                    maxWidth: '100%', fontSize: 12, lineHeight: 1.25, fontWeight: 800, letterSpacing: '-0.01em',
                    // A word too long for a narrow phone's column hyphenates
                    // rather than breaking at any letter ("Anniversar / y").
                    textAlign: 'center', overflowWrap: 'break-word', hyphens: 'auto',
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{title}</span>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {toFind.length > 0 && (
        <>
          <SectionLabel trailing={String(toFind.length)}>Still to find</SectionLabel>
          <Card padding="16px 14px">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10, justifyItems: 'center' }}>
              {toFind.map(frame => (
                <button
                  key={frame.id}
                  type="button"
                  aria-label="Memory still to find"
                  onClick={() => open(frame.id)}
                  className="m-press m-focus"
                  style={{ padding: 0, border: 0, background: 'transparent', borderRadius: 14, cursor: 'pointer', lineHeight: 0 }}
                >
                  <MemoryFrameCanvas frame={frame} size={52} locked />
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      <MemoryDetailSheet
        open={openId !== null}
        frame={shownFrame}
        row={shownRow}
        partnerId={partnerId}
        partnerName={partnerName}
        onClose={() => { playSound('ui_modal_close'); setOpenId(null) }}
        onReactionChange={onReactionChange}
      />
    </>
  )
}
