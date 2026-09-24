'use client'

// ─── Note board card ─────────────────────────────────────────────────────────
// The whole card is the link to /notes (board A3): how many notes are kept,
// how many are new, and the three newest pinned up as paper squares. A gift
// shows the food it carried; a written note shows a heart.

import FoodIcon from '@/components/care/FoodIcon'
import { Card, IconTile, M, MeadowIcon, TINT } from '@/components/meadow'
import type { NotesInfo } from './usModel'

// The three papers and their lean, left to right, as on the board.
const PAPER = ['#FFF4C9', '#FBE3EA', '#E3F2E7'] as const
const TILT = [-5, 3, -2] as const

interface Props {
  notes: NotesInfo
  onOpen?: () => void
}

export default function NoteBoardCard({ notes, onOpen }: Props) {
  const { count, unread, preview } = notes
  const summary = count === 0 ? 'Nothing pinned yet' : `${count} ${count === 1 ? 'note' : 'notes'} kept`
  return (
    <Card
      href="/notes"
      onClick={onOpen}
      padding="16px 16px 18px 18px"
      ariaLabel={`Note board, ${summary}${unread > 0 ? `, ${unread} new` : ''}`}
      style={{ marginTop: 24 }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <IconTile icon="pin" size={48} bg={TINT.love} />
        <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 17, lineHeight: 1.2, fontWeight: 800 }}>Note board</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: M.text2 }}>{summary}</span>
        </span>
        {unread > 0 && (
          <span style={{
            flex: '0 0 auto', height: 26, boxSizing: 'border-box', padding: '0 10px', borderRadius: 999,
            background: M.love, display: 'flex', alignItems: 'center',
            fontSize: 12, fontWeight: 800, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums',
          }}>
            {unread > 9 ? '9+' : unread} new
          </span>
        )}
        <MeadowIcon name="chevronRight" size={20} color={M.faint} />
      </span>

      {preview.length > 0 && (
        <span aria-hidden style={{
          marginTop: 16, height: 88, borderRadius: 16, background: M.soft,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        }}>
          {preview.slice(0, 3).map((n, i) => (
            <span key={n.id} style={{
              position: 'relative', width: 70, height: 62, background: PAPER[i], transform: `rotate(${TILT[i]}deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {n.gift ? <FoodIcon id={n.gift} size={30} /> : <MeadowIcon name="heart" />}
              <span style={{ position: 'absolute', left: 29, top: -7 }}>
                <MeadowIcon name="pin" size={12} />
              </span>
              {n.unread && (
                <span style={{
                  position: 'absolute', right: -4, top: -4, width: 10, height: 10, boxSizing: 'border-box',
                  borderRadius: 999, border: `2px solid ${M.soft}`, background: M.love,
                }} />
              )}
            </span>
          ))}
        </span>
      )}
    </Card>
  )
}
