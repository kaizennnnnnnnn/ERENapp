'use client'

// ─── "{Cat}'s journal" card ──────────────────────────────────────────────────
// The latest message as a preview bubble, and "Open journal", which opens the
// whole chat in a sheet (board A3). The page stays calm; the conversation is
// one tap away.

import { Avatar, Card, M, MeadowIcon, SecondaryButton, SectionLabel } from '@/components/meadow'
import type { JournalEntry } from './usModel'

interface Props {
  catName: string
  last: JournalEntry | null
  isSolo: boolean
  onOpen: () => void
}

export default function JournalCard({ catName, last, isSolo, onOpen }: Props) {
  return (
    <>
      <SectionLabel>{catName}&apos;s journal</SectionLabel>
      <Card padding={18}>
        {last ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <Avatar name={last.name} color={last.color} size={36} fontSize={14} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{ paddingLeft: 4, fontSize: 12, fontWeight: 700, color: M.text2 }}>
                {last.mine ? 'You' : last.name}
              </span>
              <span style={{
                padding: '12px 16px', borderRadius: '18px 18px 18px 6px', background: M.soft,
                fontSize: 15, lineHeight: 1.4, fontWeight: 700, overflowWrap: 'anywhere',
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {last.text}
              </span>
            </span>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, fontWeight: 500, color: M.text2 }}>
            {isSolo
              ? `Nothing written yet. ${catName} is listening.`
              : 'No messages yet. Write the first one.'}
          </p>
        )}
        <SecondaryButton onClick={onOpen} style={{ marginTop: 18, height: 50, fontSize: 16, gap: 6 }}>
          Open journal
          <MeadowIcon name="chevronRight" size={18} color={M.text} />
        </SecondaryButton>
      </Card>
    </>
  )
}
