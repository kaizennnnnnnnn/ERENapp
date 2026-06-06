'use client'

// Review — Leitner SRS driver. Pulls every card whose due-date has passed
// and pumps it through the shared SessionRunner. Empty state when nothing
// is due (the "all caught up" path).

import { useEffect, useMemo, useState } from 'react'
import { useChemistryStore } from '@/lib/chemistry/store'
import { dateStr } from '@/lib/chemistry/srs'
import { dueQueue } from '@/lib/chemistry/questions'
import SessionRunner from './SessionRunner'

interface Props { onExit: () => void }

export default function Review({ onExit }: Props) {
  const { state, hydrated } = useChemistryStore()
  // Bump on Retry to regenerate the queue without going back to dashboard.
  const [token, setToken] = useState(0)
  const today = dateStr()
  const cards = useMemo(
    () => (hydrated ? dueQueue(state.cards, today) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, today, token],
  )
  // Re-fetch when the window comes back into focus — overnight rollover
  // can add new due cards without us re-mounting.
  useEffect(() => {
    function onVis() { if (document.visibilityState === 'visible') setToken(t => t + 1) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  return (
    <SessionRunner
      title="Review"
      subtitle="Your due cards, interleaved — the spaced-repetition daily driver."
      cards={cards}
      typeLabel="SRS"
      emptyTitle="You're all caught up"
      emptyBody="Nothing is due today. Start a Learn batch to add new elements, or come back tomorrow."
      onRestart={() => setToken(t => t + 1)}
      onExit={onExit}
    />
  )
}
