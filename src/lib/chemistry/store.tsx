'use client'

// ChemistryStore — local SRS state for the periodic-table study system.
//
// Per-device only for now: card states, daily streak, and history live in
// localStorage. Each device tracks its own progress because the SRS is
// personal review state, not household state — porting it to Supabase
// would require a per-user table and is out of scope for phase 4.
//
// State shape kept deliberately small so the JSON round-trip is fast
// even when all 118 elements eventually live in `cards`.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { dateStr, grade, isDue, isNew, type CardState } from './srs'

const STORAGE_KEY = 'eren_chem_v1'

interface ChemistryState {
  version: number
  cards: Record<string, CardState>
  history: Record<string, number>     // YYYY-MM-DD -> reviews logged that day
  streak: { current: number; longest: number; lastStudyDate: string | null }
  decksCompleted: Record<string, number> // YYYY-MM-DD -> decks finished that day
  bestSessionStreak: number           // longest in-session correct streak ever
}

const DEFAULT_STATE: ChemistryState = {
  version: 1,
  cards: {},
  history: {},
  streak: { current: 0, longest: 0, lastStudyDate: null },
  decksCompleted: {},
  bestSessionStreak: 0,
}

function loadState(): ChemistryState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<ChemistryState>
    return { ...DEFAULT_STATE, ...parsed }
  } catch { return DEFAULT_STATE }
}

function saveState(s: ChemistryState) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }
  catch { /* quota / privacy mode — fall through */ }
}

interface StoreApi {
  hydrated: boolean
  today: string
  state: ChemistryState
  /** Record a flashcard rating for the given element card id (e.g. 'el-1'). */
  rateCard: (cardId: string, correct: boolean) => void
  /** Record that a deck was completed today + update the daily streak. */
  finishDeck: (sessionBestStreak: number) => void
  /** Number of started cards due today + earlier. */
  dueCount: number
  /** Cards never reviewed (atomic numbers / ids of NEW cards). */
  newCount: number
}

const ChemistryStoreContext = createContext<StoreApi | null>(null)

export function ChemistryStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChemistryState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)
  const [today, setToday] = useState<string>(dateStr())

  // Hydrate from localStorage on mount. Avoids the SSR/client value mismatch
  // by leaving state at DEFAULT_STATE for the first render.
  useEffect(() => {
    setState(loadState())
    setToday(dateStr())
    setHydrated(true)
  }, [])

  // Re-tick `today` when the tab becomes visible — the user may have left
  // the PWA open across midnight, and we don't want "due today" to lag.
  const onVis = useCallback(() => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'visible') setToday(dateStr())
  }, [])
  useEffect(() => {
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [onVis])

  // Persist on every change after hydration. Skipping the pre-hydrated write
  // prevents the default state from overwriting any value the user already
  // has saved.
  const wroteOnce = useRef(false)
  useEffect(() => {
    if (!hydrated) return
    if (!wroteOnce.current) { wroteOnce.current = true; return }
    saveState(state)
  }, [state, hydrated])

  const rateCard = useCallback((cardId: string, correct: boolean) => {
    setState(s => {
      const next: ChemistryState = {
        ...s,
        cards: {
          ...s.cards,
          [cardId]: grade(s.cards[cardId], correct, today),
        },
        history: {
          ...s.history,
          [today]: (s.history[today] ?? 0) + 1,
        },
      }
      return next
    })
  }, [today])

  const finishDeck = useCallback((sessionBestStreak: number) => {
    setState(s => {
      // Daily streak: bump if last study day was yesterday, reset to 1
      // otherwise. If already studied today, keep current streak as-is.
      const lastStudy = s.streak.lastStudyDate
      let current = s.streak.current
      if (lastStudy === today) {
        // Already counted today — leave the streak alone.
      } else {
        // Was yesterday → bump; otherwise restart at 1.
        const yesterday = (() => {
          const d = new Date(today + 'T00:00:00')
          d.setDate(d.getDate() - 1)
          return dateStr(d)
        })()
        current = lastStudy === yesterday ? current + 1 : 1
      }
      return {
        ...s,
        streak: {
          current,
          longest: Math.max(s.streak.longest, current),
          lastStudyDate: today,
        },
        decksCompleted: {
          ...s.decksCompleted,
          [today]: (s.decksCompleted[today] ?? 0) + 1,
        },
        bestSessionStreak: Math.max(s.bestSessionStreak, sessionBestStreak),
      }
    })
  }, [today])

  const { dueCount, newCount } = useMemo(() => {
    let due = 0
    let nu = 0
    for (const k of Object.keys(state.cards)) {
      const c = state.cards[k]
      if (isDue(c, today)) due++
      if (isNew(c)) nu++
    }
    return { dueCount: due, newCount: nu }
  }, [state.cards, today])

  const api: StoreApi = {
    hydrated,
    today,
    state,
    rateCard,
    finishDeck,
    dueCount,
    newCount,
  }

  return (
    <ChemistryStoreContext.Provider value={api}>
      {children}
    </ChemistryStoreContext.Provider>
  )
}

export function useChemistryStore(): StoreApi {
  const ctx = useContext(ChemistryStoreContext)
  if (!ctx) throw new Error('useChemistryStore must be used inside <ChemistryStoreProvider>')
  return ctx
}

/** Stable card id for an element. Matches Amina's elementCardId convention
 *  ('el-<atomicNumber>'), kept as a top-level export so the periodic-table
 *  and flashcards can both reach the same key. */
export const elementCardId = (atomicNumber: number) => `el-${atomicNumber}`
