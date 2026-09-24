'use client'

// ─── The Us page, drawn ──────────────────────────────────────────────────────
// Presentational: everything arrives as plain props, so the real page and the
// preview route render the same thing. Order follows board A3:
//
//   Us ........................ (A)(J)
//   Together for N days          (+ the cozy countdown, when it's on)
//   {Partner} today + "Send some love"
//   Send love (the four-tile tray)
//   Note board
//   Care battle this week (+ season strip)
//   {Cat}'s journal
//
// A household of one keeps what still means something alone: the day count
// (with the cat), the battle (the cat holds the other seat) and the journal.
// Partner-only pieces go, rather than sit there empty.

import type { ReactNode } from 'react'
import { Avatar, Card, GROUND, M, MeadowPage, SecondaryButton } from '@/components/meadow'
import type { UserMood } from '@/types'
import CareBattleCard from './CareBattleCard'
import JournalCard from './JournalCard'
import LoveTray from './LoveTray'
import NoteBoardCard from './NoteBoardCard'
import PartnerTodayCard from './PartnerTodayCard'
import TogetherCard from './TogetherCard'
import type {
  BattleInfo, JournalEntry, LoveTrayState, MoodDay, NotesInfo, NudgeId, TogetherInfo, UsCat, UsPerson,
} from './usModel'

export interface UsViewProps {
  me: UsPerson
  /** Null solo, and while a failed read leaves the partner unknown. */
  partner: UsPerson | null
  isSolo: boolean
  cat: UsCat
  /** The second avatar in the title row: the partner, or the cat when solo. */
  companion: UsPerson | null
  together: TogetherInfo | null
  /** Slot under the hero: the cozy countdown (renders nothing outside its window). */
  countdown?: ReactNode
  partnerMood: UserMood | null
  partnerWeek: MoodDay[]
  tray: LoveTrayState
  onSendLove: () => void
  onSendNudge: (id: NudgeId) => void
  notes: NotesInfo
  onOpenNotes?: () => void
  battle: BattleInfo | null
  reset: { days: number; hours: number } | null
  lastMessage: JournalEntry | null
  onOpenJournal: () => void
  /** The partner read failed: a note and a retry instead of half a page. */
  loadError?: { onRetry: () => void } | null
}

export default function UsView(p: UsViewProps) {
  const pair = p.companion ? `${p.me.name} and ${p.companion.name}` : p.me.name
  return (
    <MeadowPage
      ground="us"
      title="Us"
      action={
        <span role="img" aria-label={pair} style={{ display: 'flex', paddingRight: 4 }}>
          <Avatar name={p.me.name} color={p.me.color} size={38} ring={GROUND.us} fontSize={15} />
          {p.companion && (
            <Avatar name={p.companion.name} color={p.companion.color} size={38} ring={GROUND.us} fontSize={15}
              style={{ marginLeft: -10 }} />
          )}
        </span>
      }
    >
      {p.loadError && <LoadErrorCard onRetry={p.loadError.onRetry} />}
      {p.together && <TogetherCard together={p.together} cat={p.cat} isSolo={p.isSolo} />}
      {p.countdown}

      {p.partner && (
        <>
          <PartnerTodayCard partner={p.partner} mood={p.partnerMood} week={p.partnerWeek}
            tray={p.tray} onSendLove={p.onSendLove} />
          <LoveTray partnerName={p.partner.name} tray={p.tray} onSend={p.onSendNudge} />
          <NoteBoardCard notes={p.notes} onOpen={p.onOpenNotes} />
        </>
      )}

      {p.battle && <CareBattleCard battle={p.battle} reset={p.reset} />}

      <JournalCard catName={p.cat.name} last={p.lastMessage} isSolo={p.isSolo} onOpen={p.onOpenJournal} />
    </MeadowPage>
  )
}

function LoadErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card padding={18} style={{ marginTop: 18 }}>
      <p role="alert" style={{ margin: 0, fontSize: 15, lineHeight: 1.45, fontWeight: 700, color: M.text2 }}>
        Part of this page didn&apos;t load. Check your connection and try again.
      </p>
      <SecondaryButton size="sm" onClick={onRetry} style={{ marginTop: 14 }}>Try again</SecondaryButton>
    </Card>
  )
}
