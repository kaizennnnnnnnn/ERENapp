'use client'

// ─── ChewingEren ─────────────────────────────────────────────────────────────
// The head-down eating pose: one of four stickers, picked at random per meal,
// with a gentle chew bob over it. Shared by every room where Eren eats
// something — the kitchen (a bowl of food) and the vet (a lolipop).
//
// The measurements live here rather than in a scene because they belong to the
// ART, not to the room. EAT_NOSE_X is where each pose's muzzle sits, and any
// prop that should look like it's being eaten anchors there; copying those
// numbers into a second scene would mean re-measuring both the day the poses
// get redrawn.

import PoseSprite from './PoseSprite'
import { preloadImages } from '@/lib/preloadImages'

/** Cache-buster for the pose art — bump when the PNGs are regenerated. */
const V = '2'
const POSE_COUNT = 4

export const eatPoseSrc = (idx: number) => `/erenEat${idx + 1}.png?v=${V}`

/** Which head-down pose this meal uses. */
export const pickEatPose = () => Math.floor(Math.random() * POSE_COUNT)

/** Warm all four, so the poof that masks the swap reveals a decoded bitmap
 *  rather than a blank frame. Call once on scene mount. */
export function preloadEatPoses(): void {
  preloadImages(Array.from({ length: POSE_COUNT }, (_, i) => eatPoseSrc(i)))
}

// Where Eren's nose/mouth sits in each pose, as a % of the trimmed sprite's
// WIDTH. The crouch poses include his tail trailing right, so his face is LEFT
// of the sprite centre — bowls, lolipops, crumbs and sound-words anchor here,
// not at the container centre, or they'd land under his body.
// (measured by scripts/measure_eat_nose.py)
export const EAT_NOSE_X = [32.7, 31.3, 30.6, 40.1]

/** On-screen width that keeps his body at the usual ~150px across rooms. */
export const EAT_WIDTH = 140

interface Props {
  /** Which pose (0–3), from pickEatPose(). */
  idx: number
  /** On-screen width in px. Defaults to EAT_WIDTH. */
  width?: number
}

export default function ChewingEren({ idx, width = EAT_WIDTH }: Props) {
  // The bob carries the munching, so the sprite's own breathing is off — two
  // vertical motions at once just read as a wobble.
  return (
    <div style={{ animation: 'erenChew 440ms ease-in-out infinite' }}>
      <PoseSprite src={eatPoseSrc(idx)} width={width} breathe={false} />
    </div>
  )
}
