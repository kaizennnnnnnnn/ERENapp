'use client'

import { useEffect, useState } from 'react'
import { PageSkeleton } from './LoadingSkeleton'

/** CSS backgrounds have no load event. Watch the same URL without blocking controls. */
export default function ArtworkSkeleton({ src, path }: { src: string; path: string }) {
  const [settled, setSettled] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const image = new Image()
    const finish = () => { if (!cancelled) setSettled(src) }
    image.onload = () => { void (image.decode?.() ?? Promise.resolve()).catch(() => {}).then(finish) }
    // An image error must not strand the player behind an indefinite loader.
    image.onerror = finish
    image.src = src
    if (image.complete && image.naturalWidth > 0) image.onload(new Event('load'))
    return () => { cancelled = true; image.onload = null; image.onerror = null }
  }, [src])
  if (settled === src) return null
  return <div style={{ position: 'absolute', inset: 0, zIndex: 16, pointerEvents: 'none' }}>
    <PageSkeleton path={path} embedded />
  </div>
}
