'use client'

// ─── BlinkingEren ──────────────────────────────────────────────────────────
// /erenGood.png is a flat raster — we can't animate just the eyes, so we
// overlay two tiny gray "eyelid" dots exactly where the eyes are. They're
// collapsed (scaleY 0) most of the time and briefly drop down (scaleY 1)
// every 5 s for a natural-looking blink.

import React, { useEffect, useState } from 'react'
import { useIsDark } from '@/hooks/useIsDark'
import type { EyeLayout } from '@/types'

// Eye-overlay coordinates, all expressed as percentages of the sprite
// container. Default values are tuned to erenGood.png. Other sprites (the
// bedroom's erenSleep.png nightcap pose, gacha skins) override these via the
// `eyes` prop. The EyeLayout shape lives in @/types so the skins catalogue
// and the asset pipeline can share it; field docs:
//   lid*   — eyelid rectangle that drops in during a blink
//   mask*  — iris bounds; clips the glint so it can't spill onto fur
//   glint* — where the shine sits INSIDE the mask (centered on the catchlight)
//   glintW — glint diameter as a share of its eye mask
//   sleepyLidW/H — closed-eye coverage as multipliers of the iris mask
export type { EyeLayout }

// Default eye-glint gloss — a white catchlight with a faint cool-blue falloff.
// Sprites wearing tinted eyewear (e.g. the chemistry goggles) override this so
// the shine reads as a reflection on the lens instead of a stray white dot.
const DEFAULT_GLINT =
  'radial-gradient(circle at 42% 38%, #ffffff 0%, #ffffff 30%, rgba(225,240,255,0.78) 54%, rgba(190,220,255,0) 80%)'

const DEFAULT_EYES: EyeLayout = {
  lidTop:    '32.5%',
  lidLeftA:  '38%',
  lidLeftB:  '54%',
  lidWidth:  '7%',
  maskTop:   '32.8%',
  maskLeftA: '39.3%',
  maskLeftB: '53.8%',
  maskW:     '5.7%',
  maskH:     '5.4%',
  glintLeftA: '49.4%',
  glintLeftB: '10.3%',
  glintTopA:  '2.9%',
  glintTopB:  '3.3%',
  glintW:     '39%',
  sleepyLidW: 1.18,
  sleepyLidH: 1.06,
}

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  // Box side length. A number is treated as px; a string is used verbatim as a
  // CSS length (e.g. '64vw') so the sprite can scale responsively. The eye
  // overlays are percentages of the box, so they hold at any size.
  size?: number | string
  className?: string
  // Subtle idle breathing sway. On by default so Eren feels alive in every
  // room; pass false where a perfectly static sprite is wanted.
  breathe?: boolean
  // Sticker image. Defaults to the everyday `/erenGood.png` used in most
  // rooms. The bedroom passes `/erenSleep.png` so the cat looks tucked in
  // at night.
  src?: string
  // Toggle the blink + glint overlays entirely. Default true.
  blink?: boolean
  // Per-sprite eye-position overrides. Any field omitted falls back to the
  // erenGood.png defaults above. The bedroom passes a partial override
  // because erenSleep.png puts the eyes lower and closer together.
  eyes?: Partial<EyeLayout>
  // Eyelid color for the blink. Default gray suits the bare-eye sprites; the
  // chemistry sprite passes a goggle-blue so the blink reads as the eye
  // closing behind the tinted lens rather than a gray bar on the glass.
  lidColor?: string
  // Full CSS background for the eye glint. Defaults to a white catchlight; the
  // chemistry sprite passes a cool blue-white so the shine looks like a
  // reflection on the blue goggle glass.
  glintBackground?: string
  // Optional separate tail layer for a lazy tail sway. When set, this image is
  // drawn BEHIND the main sprite and rotated by the erenTailWiggle keyframe so
  // only the tail moves. Pair it with a tail-erased body in `src` — the home
  // page uses src=/erenGood_notail.png + tailSrc=/erenGood_tail.png — so the
  // baked-in tail doesn't ghost statically under the moving one.
  tailSrc?: string
  // transform-origin for the tail layer = the tail's root, in BOX coordinates.
  // The box is square so a portrait sprite is letterboxed; this is converted
  // from image coords accordingly. Default is tuned to erenGood_tail.png: the
  // root is at the BOTTOM where the tail meets the hip (image ~659/1005), not
  // the thin tip up top — so the base stays glued and the tip swings. In box
  // coords that's 68.6% / 79.5% of the square box. (The small in-swing pull
  // that keeps the base connected rides inside the erenTailWiggle keyframe, so
  // the resting pose isn't nudged into the body.)
  tailOrigin?: string
  // Optional separate HEAD layer for live head motion (bob to a food bowl,
  // lean into a pet, track the play ball). Same split-layer trick as the tail:
  // pass a head-only PNG here and a head-ERASED body in `src` (e.g.
  // src=/erenGood_body.png + headSrc=/erenGood_head.png). The head img AND the
  // eye overlays render inside one wrapper pivoted at the neck, so the eyes
  // ride the head when it rotates. Rotations are clamped (≤7°) by the caller
  // so the fur-colored neck plug under the chin never uncovers.
  headSrc?: string
  // transform-origin for the head layer = the neck pivot, in BOX coordinates.
  // Produced by scripts/split_eren_head.js alongside the split PNGs.
  headOrigin?: string
  // Imperative handle on the head wrapper so a 60fps loop (PlayScene's ball
  // rAF) can write `transform` directly without a React render per frame.
  headRef?: React.Ref<HTMLDivElement>
  // CSS `animation` shorthand applied to the head wrapper for declarative
  // reaction beats (head dive, lean). Ignored when headSrc is absent.
  headAnimation?: string
  // Hold both eyelids shut (sleep settle, medicine grimace). Overrides the
  // blink keyframe so the eyes stay closed for the duration the caller renders
  // this true. No effect when blink is false (eyes already painted shut).
  lidsClosed?: boolean
  // Use the detailed "peaceful sleep" closed eye instead of the plain gray
  // lid. Renders a narrow fur-toned lid (melts into the mask), a faint
  // moonlit dome highlight, and a soft downward lash seam — the way the
  // asleep poses draw shut eyes. Bedroom tuck-in only; the vet grimace keeps
  // the plain lid. No effect unless lidsClosed is also true.
  sleepyLids?: boolean
  // Breathing period in seconds. Default 4; sleep slows it to ~6.5 so the
  // tucked-in cat breathes visibly slower.
  breatheDur?: number
}

export default function BlinkingEren({
  size = 200,
  className = '',
  style,
  alt = 'Eren',
  breathe = true,
  src = '/erenGood.png',
  blink = true,
  eyes: eyesOverride,
  lidColor = '#6B6B6B',
  glintBackground = DEFAULT_GLINT,
  tailSrc,
  tailOrigin = '68.6% 79.5%',
  headSrc,
  headOrigin = '50% 50%',
  headRef,
  headAnimation,
  lidsClosed = false,
  sleepyLids = false,
  breatheDur = 4,
  ...imgProps
}: Props) {
  const isDark = useIsDark()
  const eyes: EyeLayout = { ...DEFAULT_EYES, ...eyesOverride }
  // Hold the sprite hidden until BOTH the body and the (optional) tail layer
  // have decoded, then reveal them together. They're separate <img>s, so on a
  // fresh paint (e.g. swiping into a room) the smaller tail can decode and
  // paint a frame before the body — making the tail flash in on its own. The
  // decode() preload (same trick the home loader uses) guarantees both are
  // ready before we flip the wrapper visible.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    setReady(false)
    const list = [src, tailSrc, headSrc].filter(Boolean) as string[]
    Promise.all(list.map(s => {
      const im = new window.Image()
      im.src = s
      return im.decode().catch(() => new Promise<void>(res => { im.onload = im.onerror = () => res() }))
    })).then(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [src, tailSrc, headSrc])
  // Drop brightness and a touch of saturation at night so the sprite
  // doesn't look weirdly lit-up against the dark room backgrounds.
  // Applied to the wrapper so the eyelid overlays darken in lockstep.
  const nightFilter = isDark ? 'brightness(0.7) saturate(0.85)' : undefined
  const lid: React.CSSProperties = {
    position: 'absolute',
    width: eyes.lidWidth,
    height: eyes.lidHeight ?? '5.5%',
    background: lidColor,
    borderRadius: 1,
    transform: 'scaleY(0)',
    transformOrigin: 'top',
    pointerEvents: 'none',
  }
  // Eye-shaped clip mask — sits over each iris so the glint's twinkle can
  // never spill onto the eyelid or fur. Ellipse-rounded to follow the eye.
  const eyeMask: React.CSSProperties = {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: '50%',
    pointerEvents: 'none',
  }
  // Animated eye glint — sits directly on top of the catchlight already
  // painted into the sprite and twinkles in place (erenEyeShine) so it looks
  // like that existing shine coming alive rather than a second dot. Sized as
  // a share of its eye mask; aspect-ratio keeps it circular. Clipped by the
  // mask, so it stays inside the eye. Rendered before the eyelids so a blink
  // paints over it.
  const glint: React.CSSProperties = {
    position: 'absolute',
    width: eyes.glintW,
    aspectRatio: '1',
    borderRadius: '50%',
    background: glintBackground,
    willChange: 'transform, opacity',
  }

  // Held-closed eye — an eye-SHAPED lid that follows the iris contour, not the
  // squarish blink rectangle (which reads as two flat blocks when held shut
  // for sleep / grimace). Built from the per-sprite iris mask, scaled up a
  // touch so it fully covers the eye opening, and gently flattened toward an
  // almond with a soft crease shadow at the bottom so it reads as a closed lid.
  // 1.5× the iris box (centered on it) so it fully covers the painted iris —
  // the tuned mask hugs the catchlight and is a touch narrower than the whole
  // eye, so a smaller lid let a sliver of iris peek at the outer corners.
  const closedEye = (left: string): React.CSSProperties => ({
    position: 'absolute',
    left: `calc(${left} - ${eyes.maskW} * 0.25)`,
    top: `calc(${eyes.maskTop} - ${eyes.maskH} * 0.1)`,
    width: `calc(${eyes.maskW} * 1.5)`,
    height: `calc(${eyes.maskH} * 1.2)`,
    background: `linear-gradient(180deg, ${lidColor} 0%, ${lidColor} 55%, rgba(0,0,0,0.28) 100%)`,
    borderRadius: '50%',
    pointerEvents: 'none',
  })

  // Peaceful "asleep" closed eye (sleepyLids). Three thin layers over the
  // iris: a narrow fur-toned lid that melts into the dark mask (so the painted
  // open eye is hidden but no gray blob remains), a faint dome highlight
  // catching the moonlight, and a soft downward lash seam — matching how the
  // curled asleep poses paint shut eyes. Narrower than `closedEye` so it
  // doesn't spill onto the white forehead blaze between the eyes.
  const SLEEPY_W = eyes.sleepyLidW ?? 1.18, SLEEPY_H = eyes.sleepyLidH ?? 1.06
  const sleepyClosedEye = (left: string) => (
    <div style={{
      position: 'absolute',
      left:   `calc(${left} - ${eyes.maskW} * ${(SLEEPY_W - 1) / 2})`,
      top:    `calc(${eyes.maskTop} - ${eyes.maskH} * ${(SLEEPY_H - 1) / 2})`,
      width:  `calc(${eyes.maskW} * ${SLEEPY_W})`,
      height: `calc(${eyes.maskH} * ${SLEEPY_H})`,
      pointerEvents: 'none',
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50% 50% 48% 48%',
        background: 'linear-gradient(180deg, #5b5049 0%, #473d36 60%, #382f29 100%)' }} />
      <div style={{ position: 'absolute', left: '16%', right: '16%', top: '10%', height: '30%',
        borderRadius: '50%', background: 'linear-gradient(180deg, rgba(255,250,245,0.18), rgba(255,250,245,0))' }} />
      <div style={{ position: 'absolute', left: '7%', right: '7%', top: '26%', bottom: '24%',
        borderBottom: '2px solid #161108', borderRadius: '0 0 60% 60%' }} />
    </div>
  )

  // Eye overlays — extracted so they can render either over the static body or
  // inside the head wrapper (so the eyes ride a rotating head layer).
  const eyeOverlays = blink ? (
    <>
      {/* Eye glints — clipped to an eye-shaped mask over the iris, centered on
          the baked catchlight inside, twinkling together (eyes track as one)
          so they share one keyframe. Hidden once the lids are held shut. */}
      {!lidsClosed && <>
        <div style={{ ...eyeMask, left: eyes.maskLeftA, top: eyes.maskTop, width: eyes.maskW, height: eyes.maskH }}>
          <div style={{ ...glint, left: eyes.glintLeftA, top: eyes.glintTopA, animation: 'erenEyeShine 5s ease-in-out infinite' }} />
        </div>
        <div style={{ ...eyeMask, left: eyes.maskLeftB, top: eyes.maskTop, width: eyes.maskW, height: eyes.maskH }}>
          <div style={{ ...glint, left: eyes.glintLeftB, top: eyes.glintTopB, animation: 'erenEyeShine 5s ease-in-out infinite' }} />
        </div>
      </>}

      {lidsClosed ? (
        // Eye-shaped closed lids over each eye — detailed sleepy lids in the
        // bedroom, plain gray lids elsewhere (vet grimace).
        sleepyLids ? (
          <>
            {sleepyClosedEye(eyes.maskLeftA)}
            {sleepyClosedEye(eyes.maskLeftB)}
          </>
        ) : (
          <>
            <div style={closedEye(eyes.maskLeftA)} />
            <div style={closedEye(eyes.maskLeftB)} />
          </>
        )
      ) : (
        // Blink lids — same start time, no stagger. Cats blink both together.
        <>
          <div style={{ ...lid, left: eyes.lidLeftA, top: eyes.lidTop, animation: 'erenBlink 6s infinite' }} />
          <div style={{ ...lid, left: eyes.lidLeftB, top: eyes.lidTop, animation: 'erenBlink 6s infinite' }} />
        </>
      )}
    </>
  ) : null

  return (
    <div className={`relative ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        filter: nightFilter,
        ...style,
      }}>
      {/* Breathing wrapper — a gentle scaleY swell from the feet (erenBreathe).
          The sprite <img>s render with SMOOTH downscaling (imageRendering:auto),
          NOT nearest-neighbour: these are hi-res PNGs shrunk ~6x, so "pixelated"
          only aliased them and made the breathing scale crawl a seam line up and
          down (worst on dark/flat skins). Smooth resampling = a clean breath.
          willChange + backfaceVisibility keep it on its own GPU layer. */}
      <div style={{
        position: 'relative',
        width: '100%', height: '100%',
        transformOrigin: 'bottom center',
        willChange: breathe ? 'transform' : undefined,
        backfaceVisibility: 'hidden',
        animation: breathe ? `erenBreathe ${breatheDur}s ease-in-out infinite` : undefined,
        // Reveal body + tail + head together once all have decoded (see `ready`).
        visibility: ready ? undefined : 'hidden',
      }}>
        {/* Tail layer — drawn first (so it sits BEHIND the body) and rotated
            about the tail root so the tip sways. All layers are absolute and
            paint in DOM order: tail → body → head (+ eyes). */}
        {tailSrc && (
          <img src={tailSrc} alt="" aria-hidden="true" draggable={false}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain',
              imageRendering: 'auto',
              transformOrigin: tailOrigin,
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              animation: 'erenTailWiggle 3.4s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
        )}
        <img src={src} alt={alt} draggable={false}
          {...imgProps}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain',
            imageRendering: 'auto',
          }} />

        {headSrc ? (
          // Head wrapper — the head img AND the eye overlays live inside one
          // element pivoted at the neck, so the eyes ride the head when it
          // rotates/leans. headRef lets a 60fps loop write transform directly.
          <div ref={headRef} style={{
            position: 'absolute', inset: 0,
            transformOrigin: headOrigin,
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            animation: headAnimation,
            pointerEvents: 'none',
          }}>
            <img src={headSrc} alt="" aria-hidden="true" draggable={false}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'contain',
                imageRendering: 'auto',
              }} />
            {eyeOverlays}
          </div>
        ) : eyeOverlays}
      </div>
    </div>
  )
}
