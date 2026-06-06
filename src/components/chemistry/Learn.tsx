'use client'

// Learn — guided new-element batch. 8 brand-new elements + ~4 due reviews,
// shuffled together. Same MC flow as Review (shared SessionRunner) so
// muscle-memory transfers between the two.

import { useMemo, useState } from 'react'
import { useChemistryStore } from '@/lib/chemistry/store'
import { dateStr } from '@/lib/chemistry/srs'
import { learnBatch } from '@/lib/chemistry/questions'
import SessionRunner from './SessionRunner'

const BATCH_SIZE = 8

interface Props { onExit: () => void }

export default function Learn({ onExit }: Props) {
  const { state, hydrated } = useChemistryStore()
  const [token, setToken] = useState(0)
  const today = dateStr()
  const cards = useMemo(
    () => (hydrated ? learnBatch(state.cards, today, BATCH_SIZE) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, today, token],
  )
  return (
    <SessionRunner
      title="Learn"
      subtitle="A small batch of new elements, interleaved with a few reviews."
      cards={cards}
      typeLabel="BATCH"
      emptyTitle="You've started every element!"
      emptyBody="There are no new elements left to introduce. Switch to Review to keep them fresh."
      onRestart={() => setToken(t => t + 1)}
      onExit={onExit}
    />
  )
}
