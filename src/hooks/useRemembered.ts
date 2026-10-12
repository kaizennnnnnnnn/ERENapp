'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

// ─── useRemembered ───────────────────────────────────────────────────────────
// useState that this phone remembers between visits: the closet reopening on
// the room, tab and filters you left it on. A per-viewer convenience only, so
// it never matters if storage is empty, blocked or holds something stale:
//
//   * the remembered value is read AFTER mount, so the server render and the
//     first client render agree (no hydration mismatch), and only replaces the
//     default when `valid` accepts it (a room since renamed, a filter since
//     removed, falls back to the default);
//   * every read and write is wrapped, since storage can throw (private mode,
//     blocked site data) and the page must work the same without it.

export function useRemembered<T>(
  key: string,
  initial: T,
  valid: (v: unknown) => v is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial)
  // Don't write until the stored value has had its chance to load, and don't
  // write the default over it in the same pass that restores it.
  const loaded = useRef(false)
  const restoring = useRef(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw)
        // Same as the default: nothing to restore, and no re-render would
        // come to clear the flag.
        if (valid(parsed) && !Object.is(parsed, initial)) { restoring.current = true; setValue(parsed) }
      }
    } catch { /* nothing remembered; the default stands */ }
    loaded.current = true
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loaded.current) return
    if (restoring.current) { restoring.current = false; return }
    try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* not remembered this time */ }
  }, [key, value])

  return [value, setValue]
}

/** A `valid` for a value that must be one of a fixed set. */
export const oneOf = <T extends string>(...options: readonly T[]) =>
  (v: unknown): v is T => typeof v === 'string' && (options as readonly string[]).includes(v)

export const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
