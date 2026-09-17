'use client'

// ─── StripEren ───────────────────────────────────────────────────────────────
// The BAKED-FRAME idle Eren: the same cat as BlinkingEren, but the tail sway
// and the blink are real drawn frames (public/anim/*.webp, baked by
// scripts/anim_tail.py and scripts/anim_blink.py) instead of a CSS rotation and
// a gradient eyelid over a flat PNG.
//
// Layer order matches BlinkingEren so the look is comparable: tail strip
// (behind) -> body PNG -> eye-band strip (over the face). Each strip's `rect`
// is a percentage of the sprite canvas, and the inner column is set to that
// canvas's exact aspect ratio, so every layer lands on the body to the pixel.
//
// The outer box stays SQUARE at `size`, exactly like BlinkingEren's, because
// PetTarget measures this box for the pet gesture and the scenes anchor to it.
// The sprite is a height-filling centred column inside it — which is where
// object-fit: contain put it before.
//
// Breathing stays CSS: a scaleY swell is a transform, it costs nothing, and
// baking it would multiply every strip's frame count for motion that already
// looks right.

import { useEffect, useState } from 'react'
import { useIsDark } from '@/hooks/useIsDark'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { ErenAnim } from '@/lib/erenAnim'
import SpriteStrip from './SpriteStrip'

interface Props {
  /** Square box side in px — same meaning as BlinkingEren's `size`. */
  size?: number
  /** Body PNG with the animated parts erased (e.g. /ErenCook_notail.png). */
  src: string
  /** Tail strip, drawn behind the body. */
  tail?: ErenAnim
  /** Eye-band strip, drawn over the face. */
  blink?: ErenAnim
  /** Sprite canvas [w, h] the strips' rects are measured against. */
  canvas: readonly [number, number]
  /** Animated eye catchlights, one entry per eye, in percent of the sprite
   *  canvas. Carried over from BlinkingEren so the baked sprite keeps the
   *  twinkle the flat one has — otherwise a side-by-side reads as "less alive"
   *  for a reason that has nothing to do with the baked frames. `left/top/w/h`
   *  is the iris box that CLIPS the shine so it can't spill onto fur;
   *  `dot*` place the shine inside that box, as percentages OF the box. */
  glints?: ReadonlyArray<{
    left: number; top: number; w: number; h: number
    dotLeft: number; dotTop: number; dotW: number
  }>
  breathe?: boolean
  breatheDur?: number
  /** Hold every strip on its resting frame (a reaction beat owns the sprite). */
  paused?: boolean
  alt?: string
}

// Same catchlight gradient BlinkingEren paints: a white core with a faint cool
// falloff, sitting on the shine the artist already drew into the iris.
const GLINT_BG =
  'radial-gradient(circle at 42% 38%, #ffffff 0%, #ffffff 30%, rgba(225,240,255,0.78) 54%, rgba(190,220,255,0) 80%)'

export default function StripEren({
  size = 210,
  src,
  tail,
  blink,
  canvas,
  glints,
  breathe = true,
  breatheDur = 4,
  paused = false,
  alt = 'Eren',
}: Props) {
  const isDark = useIsDark()
  const reduced = useReducedMotion()
  const [cw, ch] = canvas

  // Reveal body and strips together. They are separate resources, so on a
  // fresh paint the small tail strip can decode first and flash in on its own
  // — the same reason BlinkingEren preloads with decode().
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    setReady(false)
    const list = [src, tail?.src, blink?.src].filter(Boolean) as string[]
    Promise.all(list.map(s => {
      const im = new window.Image()
      im.src = s
      return im.decode().catch(() => new Promise<void>(res => { im.onload = im.onerror = () => res() }))
    })).then(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [src, tail?.src, blink?.src])

  const hold = paused || reduced

  return (
    <div style={{
      width: size,
      height: size,
      position: 'relative',
      display: 'inline-block',
      // Night dim on the wrapper so every layer darkens in lockstep.
      filter: isDark ? 'brightness(0.7) saturate(0.85)' : undefined,
      visibility: ready ? undefined : 'hidden',
    }}>
      {/* Height-filling column at the sprite's own aspect ratio, centred in
          the square box — where object-fit: contain used to put it. */}
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0, left: '50%',
        aspectRatio: `${cw} / ${ch}`,
        transform: 'translateX(-50%)',
      }}>
        {/* Breathing wrapper — scaleY swell anchored at the feet. Separate from
            the centring transform above so the two never fight. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: 'bottom center',
          willChange: breathe && !hold ? 'transform' : undefined,
          backfaceVisibility: 'hidden',
          animation: breathe && !hold ? `erenBreathe ${breatheDur}s ease-in-out infinite` : undefined,
        }}>
          {tail && <SpriteStrip anim={tail} paused={hold} />}
          <img src={src} alt={alt} draggable={false}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain',
              imageRendering: 'auto',
            }} />
          {/* Catchlights go UNDER the blink strip, so a baked lid covers the
              shine the way a closing eye would. */}
          {glints?.map((g, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${g.left}%`, top: `${g.top}%`, width: `${g.w}%`, height: `${g.h}%`,
              overflow: 'hidden', borderRadius: '50%', pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute',
                left: `${g.dotLeft}%`, top: `${g.dotTop}%`, width: `${g.dotW}%`,
                aspectRatio: '1', borderRadius: '50%',
                background: GLINT_BG,
                willChange: 'transform, opacity',
                animation: hold ? undefined : 'erenEyeShine 5s ease-in-out infinite',
              }} />
            </div>
          ))}
          {blink && <SpriteStrip anim={blink} paused={hold} />}
        </div>
      </div>
    </div>
  )
}
