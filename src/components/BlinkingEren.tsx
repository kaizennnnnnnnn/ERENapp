'use client'

// ─── BlinkingEren ──────────────────────────────────────────────────────────
// /erenGood.png is a flat raster — we can't animate just the eyes, so we
// overlay two tiny gray "eyelid" dots exactly where the eyes are. They're
// collapsed (scaleY 0) most of the time and briefly drop down (scaleY 1)
// every 5 s for a natural-looking blink.

import React from 'react'
import { useIsDark } from '@/hooks/useIsDark'

// Eye-overlay coordinates, all expressed as percentages of the sprite
// container. Default values are tuned to erenGood.png. Other sprites (the
// bedroom's erenSleep.png nightcap pose) override these via the `eyes` prop.
export interface EyeLayout {
  // Eyelid rectangle (drops in during blink).
  lidTop: string
  lidLeftA: string
  lidLeftB: string
  lidWidth: string
  // Eye-mask = iris bounds. Clips the glint so it can't spill onto fur.
  maskTop: string
  maskLeftA: string
  maskLeftB: string
  maskW: string
  maskH: string
  // Where the glint sits INSIDE the mask. Centered on the baked catchlight
  // in the sprite's iris, so the animated shine looks like the painted
  // catchlight coming alive.
  glintLeftA: string
  glintLeftB: string
  glintTopA: string
  glintTopB: string
  // Glint dot diameter as a share of its eye mask. The nightcap pose has
  // tighter eyes so the bedroom dials this down.
  glintW: string
}

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
  // from image coords accordingly. Default is tuned to erenGood_tail.png
  // (root at image 721/848, 584/1264 → 73.5% / 46.2% of the square box).
  tailOrigin?: string
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
  tailOrigin = '73.5% 46.2%',
  ...imgProps
}: Props) {
  const isDark = useIsDark()
  const eyes: EyeLayout = { ...DEFAULT_EYES, ...eyesOverride }
  // Drop brightness and a touch of saturation at night so the sprite
  // doesn't look weirdly lit-up against the dark room backgrounds.
  // Applied to the wrapper so the eyelid overlays darken in lockstep.
  const nightFilter = isDark ? 'brightness(0.7) saturate(0.85)' : undefined
  const lid: React.CSSProperties = {
    position: 'absolute',
    width: eyes.lidWidth,
    height: '5.5%',
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

  return (
    <div className={`relative ${className}`}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        filter: nightFilter,
        ...style,
      }}>
      {/* Breathing wrapper — gentle scaleY sway anchored at the feet so
          the upper body rises while the feet stay planted. willChange +
          backfaceVisibility force a dedicated GPU layer so the scale is
          composited smoothly (no pixel-seam lines). */}
      <div style={{
        position: 'relative',
        width: '100%', height: '100%',
        transformOrigin: 'bottom center',
        willChange: breathe ? 'transform' : undefined,
        backfaceVisibility: 'hidden',
        animation: breathe ? 'erenBreathe 4s ease-in-out infinite' : undefined,
      }}>
        {/* Tail layer — drawn first (so it sits BEHIND the body) and rotated
            about the tail root so the tip sways. Both layers are absolute and
            paint in DOM order: tail → body → eyes. */}
        {tailSrc && (
          <img src={tailSrc} alt="" aria-hidden="true" draggable={false}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain',
              imageRendering: 'pixelated',
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
            imageRendering: 'pixelated',
          }} />

        {blink && (
          <>
            {/* Eye glints — clipped to an eye-shaped mask over the iris,
                centered on the baked catchlight inside, twinkling together
                (eyes track as one) so they share one keyframe. */}
            <div style={{ ...eyeMask, left: eyes.maskLeftA, top: eyes.maskTop, width: eyes.maskW, height: eyes.maskH }}>
              <div style={{ ...glint, left: eyes.glintLeftA, top: eyes.glintTopA, animation: 'erenEyeShine 5s ease-in-out infinite' }} />
            </div>
            <div style={{ ...eyeMask, left: eyes.maskLeftB, top: eyes.maskTop, width: eyes.maskW, height: eyes.maskH }}>
              <div style={{ ...glint, left: eyes.glintLeftB, top: eyes.glintTopB, animation: 'erenEyeShine 5s ease-in-out infinite' }} />
            </div>

            {/* Both eyelids — same animation start time, no stagger. Cats
                blink with both lids together. */}
            <div style={{ ...lid, left: eyes.lidLeftA, top: eyes.lidTop, animation: 'erenBlink 6s infinite' }} />
            <div style={{ ...lid, left: eyes.lidLeftB, top: eyes.lidTop, animation: 'erenBlink 6s infinite' }} />
          </>
        )}
      </div>
    </div>
  )
}
