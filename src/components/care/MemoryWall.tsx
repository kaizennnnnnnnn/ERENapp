'use client'

// ═════════════════════════════════════════════════════════════════════════════
// MemoryWall — Phase 3 PR 7
//
// Grid of every catalogue frame for the household. Unlocked frames render in
// full colour; locked frames show as dim silhouettes with a "?" placeholder.
// Tapping any frame opens MemoryDetailModal — which decides what to show
// based on whether a memory_frames row exists.
//
// Sort order: unlocked frames first (most recent unlock at the top), then
// locked frames in catalogue order. That way new unlocks pop to the visible
// area without scrolling.
// ═════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { playSound } from '@/lib/sounds'
import MemoryFrameCanvas from '@/components/memory/MemoryFrameCanvas'
import MemoryDetailModal from '@/components/memory/MemoryDetailModal'
import { MEMORY_FRAMES, frameById, type MemoryFrame } from '@/lib/memoryCatalogue'
import type { MemoryFrameRow, ReactionEmoji } from '@/hooks/useMemoryFrames'

interface Props {
  rows: MemoryFrameRow[]
  partnerId: string | null
  onReactionChange: (frameId: string, reaction: Record<string, ReactionEmoji>) => void
}

interface CellData {
  frame: MemoryFrame
  row:   MemoryFrameRow | null
}

export default function MemoryWall({ rows, partnerId, onReactionChange }: Props) {
  const [openFrameId, setOpenFrameId] = useState<string | null>(null)

  const cells: CellData[] = useMemo(() => {
    const byId = new Map<string, MemoryFrameRow>()
    for (const r of rows) byId.set(r.frame_id, r)

    const unlocked: CellData[] = []
    const locked:   CellData[] = []
    for (const f of MEMORY_FRAMES) {
      const row = byId.get(f.id) ?? null
      if (row) unlocked.push({ frame: f, row })
      else     locked.push({ frame: f, row: null })
    }
    unlocked.sort((a, b) => (b.row!.unlocked_at).localeCompare(a.row!.unlocked_at))
    return [...unlocked, ...locked]
  }, [rows])

  const openFrame = openFrameId ? frameById(openFrameId) : null
  const openRow   = openFrameId ? (rows.find(r => r.frame_id === openFrameId) ?? null) : null

  return (
    <>
      <div
        className="grid w-full"
        style={{
          // 3 cols by default, snug enough to scale to 4 on larger phones.
          gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
          gap: 12,
          padding: '4px 2px 80px',
        }}
      >
        {cells.map(({ frame, row }) => (
          <button
            key={frame.id}
            type="button"
            aria-label={row ? frame.title : 'Locked memory'}
            onClick={() => { playSound('ui_tap'); setOpenFrameId(frame.id) }}
            className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
            style={{
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer',
              animation: 'memoryCellIn 0.35s ease-out both',
            }}
          >
            <MemoryFrameCanvas frame={frame} size={64} locked={!row} />
            <span style={{
              fontFamily: '"Press Start 2P", monospace',
              fontSize: 5,
              color: row ? '#E8DCFA' : '#5A4E70',
              textAlign: 'center',
              lineHeight: 1.4,
              maxWidth: 70,
              letterSpacing: 0.5,
            }}>{row ? frame.title.toUpperCase() : '???'}</span>
          </button>
        ))}
      </div>

      {openFrame && (
        <MemoryDetailModal
          frame={openFrame}
          row={openRow}
          partnerId={partnerId}
          onClose={() => setOpenFrameId(null)}
          onReactionChange={onReactionChange}
        />
      )}

      <style jsx global>{`
        @keyframes memoryCellIn {
          0%   { opacity: 0; transform: translateY(6px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </>
  )
}
