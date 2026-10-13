'use client'

// For a Sheet its caller mounts only while open and unmounts in onClose (the
// safety sheets, the leaderboard). A Meadow Sheet slides out over 180ms, so
// closing first lowers the sheet and only then tells the caller, or the sheet
// would vanish mid-air.

import { useEffect, useRef, useState } from 'react'

const EXIT_MS = 180

export function useSheetExit(onClose: () => void): [open: boolean, close: () => void] {
  const [open, setOpen] = useState(true)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (open) return
    const t = setTimeout(() => closeRef.current(), EXIT_MS)
    return () => clearTimeout(t)
  }, [open])
  return [open, () => setOpen(false)]
}
