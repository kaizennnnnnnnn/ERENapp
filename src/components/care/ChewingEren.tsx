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
import SpriteStrip from './SpriteStrip'
import { EREN_ANIM, type ErenAnim } from '@/lib/erenAnim'
import { useIsDark } from '@/hooks/useIsDark'
import { preloadImages } from '@/lib/preloadImages'

/** Cache-buster for the pose art — bump when the PNGs are regenerated. */
const V = '2'
const POSE_COUNT = 4

export const eatPoseSrc = (idx: number) => `/erenEat${idx + 1}.png?v=${V}`

// Baked chew cycles, one per pose (scripts/anim_eat.py). Same four poses, but
// the jaw, head, ears and tail are drawn moving instead of the whole sticker
// being nudged 2px by erenChew.
const EAT_STRIPS: ErenAnim[] = [EREN_ANIM.eat1, EREN_ANIM.eat2, EREN_ANIM.eat3, EREN_ANIM.eat4]

/** Which head-down pose this meal uses. */
export const pickEatPose = () => Math.floor(Math.random() * POSE_COUNT)

/** Warm all four, so the poof that masks the swap reveals a decoded bitmap
 *  rather than a blank frame. Call once on scene mount. Pass `baked` to warm
 *  the frame strips instead of the flat stickers. */
export function preloadEatPoses(baked = false): void {
  preloadImages(baked
    ? EAT_STRIPS.map(a => a.src)
    : Array.from({ length: POSE_COUNT }, (_, i) => eatPoseSrc(i)))
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
  /** Play the BAKED chew frames instead of bobbing the flat sticker. */
  baked?: boolean
}

export default function ChewingEren({ idx, width = EAT_WIDTH, baked = false }: Props) {
  if (baked) return <BakedChew anim={EAT_STRIPS[idx]} width={width} />
  // The bob carries the munching, so the sprite's own breathing is off — two
  // vertical motions at once just read as a wobble.
  return (
    <div style={{ animation: 'erenChew 440ms ease-in-out infinite' }}>
      <PoseSprite src={eatPoseSrc(idx)} width={width} breathe={false} />
    </div>
  )
}

// Baked cycle. No erenChew bob and no breathing: both are drawn into the
// frames, and stacking a CSS motion on top would fight them. The wrapper is
// the pose's own aspect ratio so the strip's full-canvas rect maps exactly,
// and it carries the rooms' night-dim the way PoseSprite does.
function BakedChew({ anim, width }: { anim: ErenAnim; width: number }) {
  const isDark = useIsDark()
  const [cw, ch] = anim.canvas
  return (
    <div style={{
      width,
      aspectRatio: `${cw} / ${ch}`,
      position: 'relative',
      filter: isDark ? 'brightness(0.7) saturate(0.85)' : undefined,
    }}>
      <SpriteStrip anim={anim} />
    </div>
  )
}
