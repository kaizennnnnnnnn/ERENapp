'use client'

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

// Measured before paint, so a resized scene never flashes its default size.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * An element's rendered size, kept current (rotation, the desktop frame, a
 * browser toolbar that hides). `fallback` is what the first render uses: the
 * boards' 390x844 phone, so a server render and the first client render agree.
 */
export function useBoxSize(ref: RefObject<HTMLElement>, fallback: { w: number; h: number }) {
  const [size, setSize] = useState(fallback)
  useBeforePaint(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      setSize(s => (s.w === w && s.h === h ? s : { w, h }))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}
