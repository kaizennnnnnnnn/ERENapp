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

const INK = '#3B2416'   // outline — the sprite sits on saturated blocks and
                        // needs a dark edge or it dissolves into them
const FUR = '#F9EDD5'
const FUR_DK = '#E4CDA6'
const EAR = '#4A2E1A'

const PixelEren = memo(function PixelEren({ pose, size = 32 }: { pose: ErenPose; size?: number }) {
  const cheer = pose === 'cheer'
  const wobble = pose === 'wobble'
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" shapeRendering="crispEdges"
      style={{
        imageRendering: 'pixelated', display: 'block',
        transform: wobble ? 'rotate(-9deg)' : undefined,
        transformOrigin: 'center bottom',
      }}>
      {/* tail — up and curled when cheering, flat out when scrambling */}
      {cheer
        ? <><rect x="1" y="9" width="2" height="4" fill={EAR} /><rect x="1" y="7" width="3" height="2" fill={EAR} /></>
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

      {/* body */}
      <rect x="3" y="11" width="14" height="8" fill={INK} />
      <rect x="4" y="12" width="12" height="6" fill={FUR} />
      <rect x="4" y="12" width="12" height="1" fill="#FFFFFF" opacity="0.45" />
      <rect x="4" y="17" width="12" height="1" fill={FUR_DK} />

      {/* front paws — braced wide when scrambling, tucked when calm */}
      {!cheer && (wobble
        ? <><rect x="0" y="15" width="4" height="3" fill={INK} /><rect x="16" y="15" width="4" height="3" fill={INK} />
           <rect x="1" y="16" width="3" height="1" fill={FUR} /><rect x="16" y="16" width="3" height="1" fill={FUR} /></>
        : <><rect x="5" y="18" width="4" height="2" fill={INK} /><rect x="11" y="18" width="4" height="2" fill={INK} />
           <rect x="6" y="18" width="2" height="1" fill={FUR_DK} /><rect x="12" y="18" width="2" height="1" fill={FUR_DK} /></>)}

      {/* ears */}
      <rect x="4" y="1" width="4" height="5" fill={INK} />
      <rect x="12" y="1" width="4" height="5" fill={INK} />
      <rect x="5" y="2" width="2" height="3" fill={EAR} />
      <rect x="13" y="2" width="2" height="3" fill={EAR} />
      <rect x="5" y="3" width="1" height="2" fill="#F472B6" />
      <rect x="14" y="3" width="1" height="2" fill="#F472B6" />

      {/* head */}
      <rect x="3" y="4" width="14" height="9" fill={INK} />
      <rect x="4" y="5" width="12" height="7" fill={FUR} />
      <rect x="4" y="5" width="12" height="1" fill="#FFFFFF" opacity="0.5" />

      {/* eyes — happy arcs cheering, wide when scrambling */}
      {cheer
        ? <><rect x="6" y="7" width="3" height="1" fill={INK} /><rect x="11" y="7" width="3" height="1" fill={INK} />
           <rect x="6" y="8" width="1" height="1" fill={INK} /><rect x="8" y="8" width="1" height="1" fill={INK} />
           <rect x="11" y="8" width="1" height="1" fill={INK} /><rect x="13" y="8" width="1" height="1" fill={INK} /></>
        : <><rect x="6" y="7" width="2" height={wobble ? 4 : 3} fill={INK} /><rect x="12" y="7" width="2" height={wobble ? 4 : 3} fill={INK} />
           <rect x="6" y="7" width="1" height="1" fill="#FFFFFF" /><rect x="12" y="7" width="1" height="1" fill="#FFFFFF" /></>}

      {/* blush + nose */}
      <rect x="4" y="10" width="2" height="1" fill="#F9A8D4" opacity={cheer ? 0.95 : 0.6} />
      <rect x="14" y="10" width="2" height="1" fill="#F9A8D4" opacity={cheer ? 0.95 : 0.6} />
      <rect x="9" y="10" width="2" height="1" fill="#F472B6" />
    </svg>
  )
})

export default PixelEren
export { PixelEren }
