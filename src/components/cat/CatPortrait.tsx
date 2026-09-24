'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { isClassicLook } from '@/lib/catIdentity'
import {
  CAT_ASPECT, CAT_CANVAS, CAT_CROP, drawLook, loadCatMaterial, lookKey, idle,
  type CatMaterial, type RecolourSpec,
} from '@/lib/catRecolour'

// ─── CatPortrait ─────────────────────────────────────────────────────────────
// A household's cat, standing, drawn live from the material maps into a
// canvas: the same framing the Meadow boards used for every cat (the cat fills
// the box, feet on the bottom edge, head centre at 43% of the width, W = H x
// 0.742). A classic look (isClassicLook) is the painting itself; any other
// look shows nothing until the maps have loaded — never classic Eren as a
// stand-in, which would read as the wrong cat.
//
// Every portrait on screen shares one decoded material, and small ones share a
// cache of finished thumbnails, so the builder's litter of 17 opens instantly
// the second time.

let materialReady: CatMaterial | null = null

/**
 * The material, once loaded (null until then). Loads after mount, off first
 * paint, and only while `enabled`: a classic cat is drawn from its PNG, and
 * the maps cost ~317KB and several megabytes of decoded pixels that such a
 * portrait would never use.
 */
export function useCatMaterial(enabled: boolean): { material: CatMaterial | null; failed: boolean } {
  const [material, setMaterial] = useState<CatMaterial | null>(materialReady)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!enabled) return
    // Another portrait may have finished the load while this one was
    // disabled, after this one's state was seeded; pick it up.
    if (materialReady) { setMaterial(materialReady); return }
    let live = true
    loadCatMaterial().then(
      m => { materialReady = m; if (live) setMaterial(m) },
      (err: unknown) => { console.error('[CatPortrait] material failed', err); if (live) setFailed(true) },
    )
    return () => { live = false }
  }, [enabled])
  return { material, failed }
}

// Finished thumbnails, keyed by look + device-pixel size. A handful of KB each.
const thumbs = new Map<string, HTMLCanvasElement>()
const THUMB_LIMIT = 64

// Small portraits are painted one per idle slot rather than all in the commit
// that mounts them: the litter mounts 17 at once, and 17 recolours in one
// frame is a visible hitch on a phone.
const queue: Array<() => void> = []
let draining = false
function enqueue(job: () => void): void {
  queue.push(job)
  if (draining) return
  draining = true
  const drain = async () => {
    while (queue.length) {
      await idle(100)
      const start = performance.now()
      // A few per slot: each is ~2-4ms on a phone.
      while (queue.length && performance.now() - start < 8) queue.shift()!()
    }
    draining = false
  }
  void drain()
}

interface Props {
  look: RecolourSpec | null | undefined
  /** CSS width in px. Height follows the cat's aspect unless given. */
  width: number
  height?: number
  /** 'thumb' paints the half-size map: use it below ~120px wide. */
  quality?: 'full' | 'thumb'
  alt?: string
  className?: string
  style?: CSSProperties
}

export default function CatPortrait({ look, width, height, quality = 'full', alt, className, style }: Props) {
  const h = height ?? Math.round(width / CAT_ASPECT)
  const ref = useRef<HTMLCanvasElement>(null)
  const classic = isClassicLook(look)
  const { material } = useCatMaterial(!classic)
  const key = look && !classic ? lookKey(look) : 'classic'
  // The look object may be re-created on every parent render; the key is its
  // identity, so the draw effect follows the key and reads the latest look.
  const lookRef = useRef(look)
  lookRef.current = look

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !material) return
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const pw = Math.round(width * dpr), ph = Math.round(h * dpr)
    if (canvas.width !== pw) canvas.width = pw
    if (canvas.height !== ph) canvas.height = ph
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const thumbKey = `${key}@${pw}x${ph}`
    const cached = quality === 'thumb' ? thumbs.get(thumbKey) : undefined
    if (cached) {
      ctx.clearRect(0, 0, pw, ph)
      ctx.drawImage(cached, 0, 0)
      return
    }
    let live = true
    const paint = () => {
      if (!live) return
      drawLook(material, lookRef.current, ctx, pw, ph, quality)
      if (quality === 'thumb') {
        const copy = document.createElement('canvas')
        copy.width = pw
        copy.height = ph
        copy.getContext('2d')?.drawImage(canvas, 0, 0)
        if (thumbs.size >= THUMB_LIMIT) thumbs.delete(thumbs.keys().next().value as string)
        thumbs.set(thumbKey, copy)
      }
    }
    // A big preview repaints on every tap in the builder, and must feel
    // instant, so it paints now. Thumbnails queue.
    if (quality === 'full') paint()
    else enqueue(paint)
    return () => { live = false }
  }, [material, key, width, h, quality])

  // No look, or the "Eren Classic" coat's colours, means classic Eren, and
  // classic Eren is the painting itself. The coat as a recolour has cooler
  // whites and far paler ears and tail than the art, so painting it here drew
  // a different cat on Me, Settings, Us and the builder than the one in the
  // room (Home makes the same isClassicLook test). Same crop box as drawLook,
  // so the two are interchangeable.
  if (classic) {
    const s = width / CAT_CROP.w
    return (
      <div role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
        className={className}
        style={{ position: 'relative', overflow: 'hidden', width, height: h, ...style }}>
        <img src="/erenGood.png" alt="" draggable={false}
          style={{ position: 'absolute', left: -CAT_CROP.x * s, top: -CAT_CROP.y * s,
            width: CAT_CANVAS.w * s, height: CAT_CANVAS.h * s, maxWidth: 'none' }} />
      </div>
    )
  }

  return (
    <canvas
      ref={ref}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={className}
      style={{ display: 'block', width, height: h, ...style }}
    />
  )
}
