'use client'

// Chemistry daily-mission hook.
//
// Each study mode (Flashcards / Quiz / Match) calls this with its current
// in-session streak and "done" flag. The hook fires Eren's completeTask()
// the first time either condition lands in a given session:
//
//   • daily_chem_lesson  — first finish of any deck / quiz / match
//   • daily_chem_streak  — first time the in-session correct streak ≥ 5
//
// TaskContext deduplicates by completedIds, so re-calls within the same day
// are safe — but the per-component refs avoid the network round-trip in the
// first place.

import { useEffect, useRef } from 'react'
import { useTasks } from '@/contexts/TaskContext'

export function useChemistryMissions({ streak, done }: { streak: number; done: boolean }) {
  const { completeTask } = useTasks()
  const lessonClaimedRef = useRef(false)
  const streakClaimedRef = useRef(false)

  useEffect(() => {
    if (done && !lessonClaimedRef.current) {
      lessonClaimedRef.current = true
      void completeTask('daily_chem_lesson')
    }
  }, [done, completeTask])

  useEffect(() => {
    if (streak >= 5 && !streakClaimedRef.current) {
      streakClaimedRef.current = true
      void completeTask('daily_chem_streak')
    }
  }, [streak, completeTask])
}
