'use client'

// ═════════════════════════════════════════════════════════════════════════════
// /notes — the Note Board.
//
// Everything Eren has ever carried between the two of us, pinned and kept
// forever: ThoughtCloud notes, food gifts, and one-tap nudges. Before this
// page they surfaced once through ErenMessagePopup and were gone, and a live
// one briefly leaked into the heart-button chat (see useCouple's realtime
// handler, which now returns before it can).
//
// Reached from the cloud's BOARD tab, from /couple, and directly from the note
// push — so the exit navigates home explicitly rather than going back.
// ═════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { useCare } from '@/contexts/CareContext'
import { usePageReady } from '@/hooks/usePageReady'
import { playSound } from '@/lib/sounds'
import NoteBoard from '@/components/couple/NoteBoard'
import PageLoader from '@/components/PageLoader'

export default function NotesPage() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { notes, markNotesRead, deleteMessage, partner, loading } = useCouple()
  const { setHideStats } = useCare()

  useEffect(() => {
    setHideStats(true)
    return () => setHideStats(false)
  }, [setHideStats])

  // Opening the board reads it — and re-marks when a note lands while it's
  // open, so the badge can't come back with the note already on screen.
  useEffect(() => { markNotesRead() }, [notes.length, markNotesRead])

  usePageReady(!loading)

  function exit() {
    playSound('ui_swipe_room')
    // The board is opened cold by the note push (sw.js → openWindow/navigate),
    // which lands here with no in-app history — router.back() would no-op and
    // both exit buttons would look dead. Replace, so the device back gesture
    // doesn't bounce straight back in either.
    router.replace('/home')
  }

  if (loading) return <PageLoader label="OPENING THE BOARD" />

  return (
    <NoteBoard
      notes={notes}
      myId={user?.id}
      myHeart={profile?.heart}
      myName={profile?.name?.split(' ')[0] ?? 'You'}
      partnerName={partner?.name?.split(' ')[0] ?? 'Them'}
      onExit={exit}
      onDeleteNote={deleteMessage}
    />
  )
}
