'use client'

// ═══════════════════════════════════════════════════════════════════════════
// PIXEL EREN — the shared 20×20 arcade cat.
//
// Lifted out of ErenStackScenery so more than one game can use the same
// character. Whatever the game, this is the Eren the player recognises, so the
// sprite itself must not fork: a game wants a new reaction, it adds a POSE
// here, it does not draw its own cat.
//
// The three poses have to be readable at ~30 CSS px, which means silhouette,
// not detail: raised paws must clear the head outline entirely, and the wobble
// tilts the whole body. Recolouring the eyes alone is invisible at this size.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'

export type ErenPose =
  | 'idle'    // calm, paws tucked
  | 'cheer'   // paws up, happy arcs for eyes
  | 'wobble'  // braced wide, tilted, eyes blown
  | 'run'     // legs driving — alternate frames with `step`
  | 'leap'    // airborne, forepaws reaching
  | 'dive'    // tucked and dropping, tail up
  | 'glide'   // hanging off a glider, legs loose
  | 'dash'    // hurled forward, ears flat, eyes narrowed

const INK = '#3B2416'   // outline — the sprite sits on saturated blocks and
                        // needs a dark edge or it dissolves into them
const FUR = '#F9EDD5'
const FUR_DK = '#E4CDA6'
const EAR = '#4A2E1A'

interface Props {
  pose: ErenPose
  size?: number
  /** Eyes shut this instant. Drive it from `useErenIdle` — see the hook. */
  blink?: boolean
  /** An ear is flicking. Drops the right ear one pixel. */
  twitch?: boolean
  /** -1 / 0 / +1 — slides the eyes a pixel sideways for an idle glance. */
  glance?: number
  /**
   * Which half of the run cycle to draw. Only 'run' reads it.
   *
   * A front-facing cat can't sell a run with leg SHAPE, so the cycle is a
   * two-frame stagger — one paw forward and low, the other back and high,
   * swapped — plus a one-pixel body bob. At 30px that's the whole illusion.
   */
  step?: boolean
}

const PixelEren = memo(function PixelEren({ pose, size = 32, blink = false, twitch = false, glance = 0, step = false }: Props) {
  const cheer = pose === 'cheer'
  const wobble = pose === 'wobble'
  const run = pose === 'run'
  const leap = pose === 'leap'
  const dive = pose === 'dive'
  const glide = pose === 'glide'
  const dash = pose === 'dash'
  // A blink can't override the poses whose whole point is the eye shape.
  const shut = blink && !cheer && !wobble && !dive && !dash
  // The running poses lean into the direction of travel. Rotation, not
  // redrawn art: the silhouette is what reads at this size, and a tilt changes
  // the whole silhouette for one attribute.
  //
  // A DASH leans hardest of all — it is the only pose that has to read as
  // faster than running, and at 30px a lean is the only thing that says speed.
  // A GLIDE barely tilts: hanging off a canopy is the one airborne pose that
  // should look calm, so it reads as the opposite of a fall.
  const tilt = dash ? -18 : glide ? -2
    : run ? (step ? -3 : -5) : leap ? -8 : dive ? 10 : wobble ? -9 : 0
  const bob = run && step ? 1 : 0
  /**
   * A dive SQUASHES him, and that is not decoration.
   *
   * The runner gives a diving cat a shorter hitbox so he can pass under things
   * a standing one can't. If the art stays full height while the hitbox
   * shrinks, the player watches him sail through a pipe he visibly hit — or
   * clip one he visibly cleared. The sprite has to be the hitbox.
   */
  const squash = dive ? 0.6 : 1
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" shapeRendering="crispEdges"
      style={{
        imageRendering: 'pixelated', display: 'block',
        transform: [tilt ? `rotate(${tilt}deg)` : '', squash !== 1 ? `scaleY(${squash})` : '']
          .filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center bottom',
      }}>
      {/* tail — up and curled when cheering, flat out when scrambling */}
      {cheer
        ? <><rect x="1" y="9" width="2" height="4" fill={EAR} /><rect x="1" y="7" width="3" height="2" fill={EAR} /></>
        : dash
        // Straight out behind him and long — the tail is the speed line.
        ? <><rect x="0" y="12" width="5" height="2" fill={EAR} /><rect x="0" y="11" width="2" height="1" fill={EAR} /></>
        : glide
        // Hanging loose and low, the way a tail does when nothing is bracing.
        ? <><rect x="1" y="14" width="3" height="2" fill={EAR} /><rect x="1" y="16" width="2" height="2" fill={EAR} /></>
        : dive
        // Diving: the tail whips straight up, which is the clearest read that
        // he is going DOWN on a sprite that can't show a profile.
        ? <><rect x="1" y="6" width="2" height="6" fill={EAR} /><rect x="1" y="4" width="3" height="2" fill={EAR} /></>
        : (run || leap)
        // Streaming out flat behind him, kinked on the off-step so it whips.
        ? <><rect x="0" y={leap ? 12 : step ? 11 : 13} width="4" height="2" fill={EAR} />
           <rect x="0" y={leap ? 10 : step ? 9 : 11} width="2" height="2" fill={EAR} /></>
        : <><rect x="0" y="14" width="4" height="2" fill={EAR} /><rect x="0" y="12" width="2" height="2" fill={EAR} /></>}

      {/* raised paws (cheer) — drawn BEHIND the head, clear above the ears */}
      {cheer && (
        <>
          <rect x="2" y="2" width="3" height="5" fill={FUR} />
          <rect x="2" y="2" width="3" height="5" fill="none" stroke={INK} strokeWidth="0.6" />
          <rect x="15" y="2" width="3" height="5" fill={FUR} />
          <rect x="15" y="2" width="3" height="5" fill="none" stroke={INK} strokeWidth="0.6" />
        </>
      )}

      {/* gripping paws (glide) — straight up and INSIDE the ears, so the
          silhouette reads as hanging from something rather than cheering. The
          canopy itself is the game's to draw; the cat only holds on. */}
      {glide && (
        <>
          <rect x="6" y="0" width="3" height="6" fill={INK} />
          <rect x="6" y="1" width="2" height="4" fill={FUR} />
          <rect x="11" y="0" width="3" height="6" fill={INK} />
          <rect x="12" y="1" width="2" height="4" fill={FUR} />
        </>
      )}

      {/* body — lifts a pixel on the airborne half of the stride */}
      <g transform={bob ? `translate(0,${-bob})` : undefined}>
      <rect x="3" y="11" width="14" height="8" fill={INK} />
      <rect x="4" y="12" width="12" height="6" fill={FUR} />
      <rect x="4" y="12" width="12" height="1" fill="#FFFFFF" opacity="0.45" />
      <rect x="4" y="17" width="12" height="1" fill={FUR_DK} />
      </g>

      {/* front paws — braced wide when scrambling, tucked when calm */}
      {!cheer && (wobble
        ? <><rect x="0" y="15" width="4" height="3" fill={INK} /><rect x="16" y="15" width="4" height="3" fill={INK} />
           <rect x="1" y="16" width="3" height="1" fill={FUR} /><rect x="16" y="16" width="3" height="1" fill={FUR} /></>
        : run
        // One paw forward and planted, one trailing and lifted — swapped each
        // frame. The two-pixel height difference is what the eye reads as a
        // stride; matching heights just looks like standing.
        ? <><rect x={step ? 3 : 6} y={step ? 18 : 17} width="4" height={step ? 2 : 3} fill={INK} />
           <rect x={step ? 12 : 10} y={step ? 17 : 18} width="4" height={step ? 3 : 2} fill={INK} />
           <rect x={step ? 4 : 7} y="18" width="2" height="1" fill={FUR_DK} />
           <rect x={step ? 13 : 11} y="18" width="2" height="1" fill={FUR_DK} /></>
        : leap
        // Both forepaws reaching, hind legs tucked up under the body.
        ? <><rect x="14" y="14" width="5" height="3" fill={INK} /><rect x="15" y="15" width="3" height="1" fill={FUR} />
           <rect x="4" y="17" width="4" height="2" fill={INK} /><rect x="5" y="17" width="2" height="1" fill={FUR_DK} /></>
        : dive
        // Everything tucked tight and narrow — a falling ball of cat.
        ? <><rect x="6" y="18" width="3" height="2" fill={INK} /><rect x="11" y="18" width="3" height="2" fill={INK} /></>
        : dash
        // Forepaws punched forward, hind legs trailing — nothing under him is
        // touching ground, which is the read that separates this from a run.
        ? <><rect x="15" y="15" width="5" height="3" fill={INK} /><rect x="16" y="16" width="3" height="1" fill={FUR} />
           <rect x="2" y="17" width="5" height="2" fill={INK} /><rect x="3" y="17" width="3" height="1" fill={FUR_DK} /></>
        : glide
        // Dangling straight down and slack. Legs doing nothing is the whole
        // point of a glide.
        ? <><rect x="6" y="18" width="3" height="2" fill={INK} /><rect x="11" y="18" width="3" height="2" fill={INK} />
           <rect x="7" y="19" width="1" height="1" fill={FUR_DK} /><rect x="12" y="19" width="1" height="1" fill={FUR_DK} /></>
        : <><rect x="5" y="18" width="4" height="2" fill={INK} /><rect x="11" y="18" width="4" height="2" fill={INK} />
           <rect x="6" y="18" width="2" height="1" fill={FUR_DK} /><rect x="12" y="18" width="2" height="1" fill={FUR_DK} /></>)}

      {/* ears — the right one flicks a pixel down on a twitch.
          Dashing pins them BACK: they slide down behind the head (drawn after
          this) and out, leaving two swept nubs. A cat at speed does not run
          with its ears up, and the flattened silhouette is most of what sells
          the pose at 30px. */}
      <g transform={dash ? 'translate(-1,3)' : undefined}>
        <rect x="4" y="1" width="4" height="5" fill={INK} />
        <rect x="5" y="2" width="2" height="3" fill={EAR} />
        <rect x="5" y="3" width="1" height="2" fill="#F472B6" />
      </g>
      <g transform={dash ? 'translate(1,3)' : twitch ? 'translate(0,1)' : undefined}>
        <rect x="12" y="1" width="4" height="5" fill={INK} />
        <rect x="13" y="2" width="2" height="3" fill={EAR} />
        <rect x="14" y="3" width="1" height="2" fill="#F472B6" />
      </g>

      {/* head */}
      <rect x="3" y="4" width="14" height="9" fill={INK} />
      <rect x="4" y="5" width="12" height="7" fill={FUR} />
      <rect x="4" y="5" width="12" height="1" fill="#FFFFFF" opacity="0.5" />

      {/* eyes — happy arcs cheering, wide when scrambling, lid lines mid-blink */}
      <g transform={glance && !shut && !cheer ? `translate(${glance},0)` : undefined}>
      {shut
        ? <><rect x="6" y="9" width="2" height="1" fill={INK} /><rect x="12" y="9" width="2" height="1" fill={INK} /></>
        : cheer
        ? <><rect x="6" y="7" width="3" height="1" fill={INK} /><rect x="11" y="7" width="3" height="1" fill={INK} />
           <rect x="6" y="8" width="1" height="1" fill={INK} /><rect x="8" y="8" width="1" height="1" fill={INK} />
           <rect x="11" y="8" width="1" height="1" fill={INK} /><rect x="13" y="8" width="1" height="1" fill={INK} /></>
        : dive
        ? <><rect x="6" y="9" width="3" height="1" fill={INK} /><rect x="11" y="9" width="3" height="1" fill={INK} /></>
        : dash
        // Narrowed to a hard squint — wide round eyes read as surprised, and
        // a dash is the one moment he is not being surprised by anything.
        ? <><rect x="5" y="8" width="4" height="2" fill={INK} /><rect x="11" y="8" width="4" height="2" fill={INK} />
           <rect x="8" y="8" width="1" height="1" fill="#FFFFFF" /><rect x="14" y="8" width="1" height="1" fill="#FFFFFF" /></>
        : <><rect x="6" y="7" width="2" height={wobble || leap ? 4 : 3} fill={INK} /><rect x="12" y="7" width="2" height={wobble || leap ? 4 : 3} fill={INK} />
           <rect x="6" y="7" width="1" height="1" fill="#FFFFFF" /><rect x="12" y="7" width="1" height="1" fill="#FFFFFF" /></>}
      </g>

      {/* blush + nose */}
      <rect x="4" y="10" width="2" height="1" fill="#F9A8D4" opacity={cheer ? 0.95 : 0.6} />
      <rect x="14" y="10" width="2" height="1" fill="#F9A8D4" opacity={cheer ? 0.95 : 0.6} />
      <rect x="9" y="10" width="2" height="1" fill="#F472B6" />
    </svg>
  )
})

export default PixelEren
export { PixelEren }
