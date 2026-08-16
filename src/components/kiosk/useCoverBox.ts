'use client'

import { useEffect, useState } from 'react'

/**
 * Where a 768×1376 wall actually lands on screen once it's been `cover`-cropped.
 *
 * The walls fill the viewport, so on any phone the picture is wider or taller
 * than what you can see and the overflow is split evenly. Anything pinned to
 * the ART — a pan, the spit, a customer in the window — has to live in a box
 * with exactly these bounds, or it drifts off its target the moment the
 * viewport aspect changes. Children then position in plain % of the picture.
 */
export function useCoverBox(picW: number, picH: number) {
  const [box, setBox] = useState(() => compute(picW, picH))

  useEffect(() => {
    const onResize = () => setBox(compute(picW, picH))
    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [picW, picH])

  return box
}

function compute(picW: number, picH: number) {
  if (typeof window === 'undefined') return { left: 0, top: 0, width: picW, height: picH }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scale = Math.max(vw / picW, vh / picH)
  const width = picW * scale
  const height = picH * scale
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height }
}
