'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type CareScene = 'feed' | 'play' | 'sleep' | 'wash' | 'vet' | 'hospital'

interface CareContextValue {
  careMode: boolean
  activeScene: CareScene | null
  isSick: boolean
  setIsSick: (v: boolean) => void
  enterCareMode: () => void
  exitCareMode: () => void
  openScene: (scene: CareScene) => void
  closeScene: () => void
}

const CareContext = createContext<CareContextValue | null>(null)

export function CareProvider({ children }: { children: ReactNode }) {
  const [careMode, setCareMode] = useState(false)
  const [activeScene, setActiveScene] = useState<CareScene | null>(null)
  const [isSick, setIsSick] = useState(false)

  return (
    <CareContext.Provider value={{
      careMode,
      activeScene,
      isSick,
      setIsSick,
      enterCareMode: () => setCareMode(true),
      exitCareMode: () => { setCareMode(false); setActiveScene(null) },
      openScene: (s) => setActiveScene(s),
      closeScene: () => setActiveScene(null),
    }}>
      {children}
    </CareContext.Provider>
  )
}

export function useCare() {
  const ctx = useContext(CareContext)
  if (!ctx) throw new Error('useCare must be used within CareProvider')
  return ctx
}
