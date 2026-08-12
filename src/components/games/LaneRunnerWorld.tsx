'use client'

// ═══════════════════════════════════════════════════════════════════════════
// LANE RUNNER — world art, item art, and the danger/reward language.
//
// TWO THINGS WERE WRONG.
//
// 1. You could not tell the hazards apart. Every obstacle was wrapped in the
//    same pulsing red radial aura, drawn OVER a 12x12 sprite scaled to 46px —
//    so a mouse, a vacuum, a cucumber and a dog all read as "red blob with
//    something in it". The aura was doing all the talking and the sprite none.
//    Worse, `mouse` was a hazard while `fish` was a pickup: two prey animals
//    with opposite meanings, in a game where you play a cat.
//
//    The fix is to stop shouting in red and use shape language instead.
//    Hazards are GROUNDED — bigger, opaque, standing on a painted hazard patch
//    striped onto the lane like real warning tape. Pickups FLOAT — smaller,
//    bobbing, haloed, with a shadow well beneath them. Grounded-vs-floating
//    plus size reads instantly at speed and leaves each sprite free to look
//    like the thing it actually is.
//
// 2. The map was one asphalt road forever, with one random item dropped into
//    one random lane every N milliseconds. No structure, no landmarks, nothing
//    to look forward to.
//
//    Zones fix the second half: the run travels kitchen -> garden -> street ->
//    rooftops and loops, each with its own floor, horizon and roadside. The
//    hazard roster deliberately does NOT change per zone — you learn four
//    hazards once and keep that knowledge for the whole run. Changing what
//    kills you every 30 seconds would be more confusing, not less.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'

export type Hazard = 'dog' | 'vacuum' | 'puddle' | 'cucumber' | 'roomba' | 'crow'
export type Pickup = 'coin' | 'fish' | 'mouse'
export type Variant = Hazard | Pickup

/** Everything that kills you, including the two that move. */
const ALL_HAZARDS: Hazard[] = ['dog', 'vacuum', 'puddle', 'cucumber', 'roomba', 'crow']

/** The roster the generic spawner draws from — the four that hold still.
 *
 *  Roomba and crow are deliberately NOT in it. Both change lane while they
 *  fall, so the safety proof in `isPatternSafe` (which reasons about fixed
 *  lanes per row) cannot vouch for them. They arrive only through their own
 *  authored patterns, which keep the neighbouring lanes clear so there is
 *  always somewhere to step. */
export const HAZARDS: Hazard[] = ['dog', 'vacuum', 'puddle', 'cucumber']

/** The hazards that change lane after they spawn. Callers use this to hold
 *  them back until the road ahead is empty — see the spawner. */
const MOVER_SET = new Set<string>(['roomba', 'crow'])
export function isMover(v: Variant): boolean {
  return MOVER_SET.has(v)
}

const HAZARD_SET = new Set<string>(ALL_HAZARDS)
export function isObstacle(v: Variant): v is Hazard {
  return HAZARD_SET.has(v)
}

/** Mouse sits between coin and fish. It used to be an obstacle, which fought
 *  the one instinct every player brings to a cat game. */
export const PICKUP_VALUE: Record<Pickup, number> = { coin: 1, mouse: 2, fish: 3 }

export const HAZARD_SIZE = 58
export const PICKUP_SIZE = 40

// ─── Zones ───────────────────────────────────────────────────────────────────

export type BackdropKind = 'cabinets' | 'hedge' | 'skyline' | 'rooftops'

export interface Zone {
  name: string
  sky: string
  backdrop: BackdropKind
  /** Base floor fill. */
  road: string
  /** Scrolling floor texture, offset vertically with the lane stripes so the
   *  ground reads as one surface moving at one speed. */
  roadTexture: string
  roadTextureSize: number
  laneLine: string
  gutter: string
  /** Vertical roadside detail, scrolled with the floor. */
  gutterDetail: string
  gutterDetailSize: number
  accent: string
}

export const ZONES: Zone[] = [
  {
    name: 'KITCHEN',
    sky: 'linear-gradient(180deg, #6B4F3A 0%, #8A6647 55%, #A67C52 100%)',
    backdrop: 'cabinets',
    road: 'linear-gradient(180deg, #DCE3E6 0%, #C3CDD2 70%, #A6B2B8 100%)',
    // Grout lines. Squares, so the floor reads as tile rather than as a road.
    roadTexture:
      'repeating-linear-gradient(180deg, rgba(60,75,85,0.30) 0 3px, transparent 3px 56px),' +
      'repeating-linear-gradient(90deg, rgba(60,75,85,0.22) 0 3px, transparent 3px 56px)',
    roadTextureSize: 56,
    laneLine: 'rgba(60,75,85,0.5)',
    gutter: 'linear-gradient(90deg, #5A3F2A 0%, #7A5738 100%)',
    gutterDetail: 'repeating-linear-gradient(180deg, #3E2A1B 0 4px, transparent 4px 44px)',
    gutterDetailSize: 44,
    accent: '#F5C77E',
  },
  {
    name: 'GARDEN',
    sky: 'linear-gradient(180deg, #4A9FE0 0%, #8FC9EE 55%, #CDE7C4 100%)',
    backdrop: 'hedge',
    road: 'linear-gradient(180deg, #C2A171 0%, #A8875A 70%, #8A6C42 100%)',
    roadTexture:
      'repeating-linear-gradient(180deg, rgba(70,50,25,0.16) 0 6px, transparent 6px 30px),' +
      'repeating-linear-gradient(90deg, rgba(255,240,200,0.10) 0 4px, transparent 4px 26px)',
    roadTextureSize: 30,
    laneLine: 'rgba(255,246,214,0.55)',
    gutter: 'linear-gradient(90deg, #14532D 0%, #22803F 100%)',
    gutterDetail: 'repeating-linear-gradient(180deg, #F472B6 0 5px, transparent 5px 34px)',
    gutterDetailSize: 34,
    accent: '#86EFAC',
  },
  {
    name: 'STREET',
    sky: 'linear-gradient(180deg, #2B1B58 0%, #4B2D7E 60%, #7C4A9E 100%)',
    backdrop: 'skyline',
    road: 'linear-gradient(180deg, #2A3340 0%, #1B222C 70%, #0B0F16 100%)',
    roadTexture:
      'repeating-linear-gradient(180deg, rgba(255,255,255,0.045) 0 2px, transparent 2px 22px)',
    roadTextureSize: 22,
    laneLine: '#FCD34D',
    gutter: 'linear-gradient(90deg, #4B5563 0%, #6B7280 100%)',
    gutterDetail: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.45) 0 3px, transparent 3px 40px)',
    gutterDetailSize: 40,
    accent: '#FCD34D',
  },
  {
    name: 'ROOFTOPS',
    sky: 'linear-gradient(180deg, #05081F 0%, #10123C 55%, #241355 100%)',
    backdrop: 'rooftops',
    road: 'linear-gradient(180deg, #3B3550 0%, #26223A 70%, #14121F 100%)',
    roadTexture:
      'repeating-linear-gradient(180deg, rgba(255,255,255,0.07) 0 3px, transparent 3px 18px),' +
      'repeating-linear-gradient(90deg, rgba(0,0,0,0.20) 0 3px, transparent 3px 34px)',
    roadTextureSize: 18,
    laneLine: 'rgba(196,181,253,0.75)',
    gutter: 'linear-gradient(90deg, #1F1B33 0%, #35304F 100%)',
    gutterDetail: 'repeating-linear-gradient(180deg, #6D28D9 0 4px, transparent 4px 30px)',
    gutterDetailSize: 30,
    accent: '#C4B5FD',
  },
]

/** Zone changes every this many units of DISTANCE (not score — coins are worth
 *  5 apiece and would yank the world forward every time you grabbed a run).
 *
 *  Distance accrues at speed x 0.05 per second: ~13.5/s at the opening speed
 *  rising to ~31/s once the ramp tops out. At 780 the first stretch lasts ~32s
 *  and each one after it ~25s — long enough to settle into a look and register
 *  as a place, while a long run still travels through all four.
 *
 *  The previous value was 45 SCORE, which changed the entire world every
 *  1.5-3.3 seconds. That is not scenery, it is strobing — and since each change
 *  starts a 900ms crossfade over four stacked full-screen gradient layers plus
 *  a `background` transition on the lane lines (a gradient, so it repaints
 *  rather than composites), the world was mid-dissolve roughly a third of the
 *  time. That was the stutter people felt. */
export const ZONE_EVERY = 780

// ─── Horizon backdrops ───────────────────────────────────────────────────────

function Cabinets() {
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage:
          'repeating-linear-gradient(90deg, #7A5738 0 46px, #5A3F2A 46px 50px)',
      }} />
      {/* handles */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '54%', height: 4,
        backgroundImage: 'repeating-linear-gradient(90deg, #E8C48A 0 14px, transparent 14px 50px)',
      }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: '#3E2A1B' }} />
    </>
  )
}

function Hedge() {
  return (
    <>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '78%',
        background: '#1B6B39',
        clipPath: 'polygon(0% 100%, 0% 42%, 6% 26%, 13% 44%, 20% 22%, 28% 40%, 35% 20%, 43% 38%, 50% 24%, 58% 42%, 65% 22%, 73% 40%, 80% 26%, 88% 44%, 95% 28%, 100% 44%, 100% 100%)',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%',
        background: '#14532D',
        clipPath: 'polygon(0% 100%, 0% 50%, 9% 32%, 18% 52%, 27% 30%, 36% 50%, 45% 34%, 54% 52%, 63% 32%, 72% 50%, 81% 34%, 90% 52%, 100% 36%, 100% 100%)',
      }} />
    </>
  )
}

function Skyline() {
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `repeating-linear-gradient(90deg,
          transparent 0 6px, #140A2E 6px 26px, transparent 26px 34px,
          #1E1140 34px 62px, transparent 62px 70px, #140A2E 70px 96px,
          transparent 96px 108px, #1E1140 108px 144px, transparent 144px 156px,
          #140A2E 156px 190px, transparent 190px 200px)`,
        backgroundSize: '200px 100%',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '34%', height: '52%',
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0 10px, #FCD34D 10px 13px, transparent 13px 30px),
                          repeating-linear-gradient(180deg, transparent 0 5px, rgba(0,0,0,0.9) 5px 12px)`,
        opacity: 0.75,
      }} />
    </>
  )
}

function Rooftops() {
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `repeating-linear-gradient(90deg,
          #0B0A22 0 40px, transparent 40px 48px, #16123A 48px 92px, transparent 92px 104px,
          #0B0A22 104px 160px, transparent 160px 168px)`,
        backgroundSize: '168px 100%',
      }} />
      {/* aerials */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: '40%',
        backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 30px, #2B2450 30px 32px, transparent 32px 84px)',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, top: '20%', height: '60%',
        backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 18px, rgba(196,181,253,0.55) 18px 20px, transparent 20px 66px)',
        opacity: 0.5,
      }} />
    </>
  )
}

const BACKDROPS: Record<BackdropKind, () => JSX.Element> = {
  cabinets: Cabinets,
  hedge: Hedge,
  skyline: Skyline,
  rooftops: Rooftops,
}

/** All four zones stacked and crossfaded on opacity. Swapping a gradient
 *  outright would hard-cut; opacity is the only thing that interpolates
 *  cleanly between two unrelated backgrounds. */
export const ZoneSky = memo(function ZoneSky({ zoneIndex, horizon }: { zoneIndex: number; horizon: string }) {
  return (
    <>
      {ZONES.map((z, i) => {
        const Backdrop = BACKDROPS[z.backdrop]
        return (
          <div key={z.name} aria-hidden style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: horizon,
            opacity: i === zoneIndex ? 1 : 0,
            transition: 'opacity 900ms ease',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: z.sky }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '72%' }}>
              <Backdrop />
            </div>
          </div>
        )
      })}
    </>
  )
})

// All four zones stay mounted so the opacity crossfade has something to fade
// between — but only the ACTIVE one is fed the live scroll offset. The other
// three get a frozen 0, so their props never change and memo skips them
// entirely. Before this, `scrollY` changed 60x a second and was handed to every
// zone, which re-rendered and re-styled twelve full-screen gradient layers per
// frame for eleven layers nobody could see. That was the stutter.
const ZoneRoadLayer = memo(function ZoneRoadLayer({
  zone, active, horizon, scrollY,
}: { zone: Zone; active: boolean; horizon: string; scrollY: number }) {
  return (
    <div aria-hidden style={{
      position: 'absolute', left: 0, right: 0, top: horizon, bottom: 0,
      opacity: active ? 1 : 0,
      transition: 'opacity 900ms ease',
      pointerEvents: 'none',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: zone.road }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: zone.roadTexture,
        backgroundPositionY: `${scrollY % zone.roadTextureSize}px`,
      }} />
    </div>
  )
})

export const ZoneRoad = memo(function ZoneRoad({
  zoneIndex, horizon, scrollY,
}: { zoneIndex: number; horizon: string; scrollY: number }) {
  return (
    <>
      {ZONES.map((z, i) => (
        <ZoneRoadLayer key={z.name} zone={z} active={i === zoneIndex}
          horizon={horizon} scrollY={i === zoneIndex ? scrollY : 0} />
      ))}
    </>
  )
})

const ZoneGutterLayer = memo(function ZoneGutterLayer({
  zone, active, horizon, scrollY,
}: { zone: Zone; active: boolean; horizon: string; scrollY: number }) {
  return (
    <div aria-hidden style={{
      position: 'absolute', left: 0, right: 0, top: horizon, bottom: 0,
      opacity: active ? 1 : 0,
      transition: 'opacity 900ms ease',
      pointerEvents: 'none',
    }}>
      {(['left', 'right'] as const).map(side => (
        <div key={side} style={{
          position: 'absolute', [side]: 0, top: 0, bottom: 0, width: '6%',
          background: zone.gutter,
          borderLeft: side === 'right' ? '2px solid rgba(0,0,0,0.4)' : undefined,
          borderRight: side === 'left' ? '2px solid rgba(0,0,0,0.4)' : undefined,
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: zone.gutterDetail,
            backgroundPositionY: `${scrollY % zone.gutterDetailSize}px`,
          }} />
        </div>
      ))}
    </div>
  )
})

export const ZoneGutters = memo(function ZoneGutters({
  zoneIndex, horizon, scrollY,
}: { zoneIndex: number; horizon: string; scrollY: number }) {
  return (
    <>
      {ZONES.map((z, i) => (
        <ZoneGutterLayer key={z.name} zone={z} active={i === zoneIndex}
          horizon={horizon} scrollY={i === zoneIndex ? scrollY : 0} />
      ))}
    </>
  )
})

// ─── Item art ────────────────────────────────────────────────────────────────
// 16x16 grids. At 58px a hazard cell is ~3.6px, so every feature that has to
// read — a snout, a hose, a rim of water — is at least 2 cells thick. Details
// finer than that dissolve at speed and just make the shape muddy.

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 16 16" shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated', display: 'block' }}>
      {children}
    </svg>
  )
}

function DogArt() {
  return (
    <Svg>
      {/* ears */}
      <rect x="1" y="2" width="3" height="5" fill="#4A2C12" />
      <rect x="12" y="2" width="3" height="5" fill="#4A2C12" />
      {/* head */}
      <rect x="3" y="2" width="10" height="10" fill="#2E1A0A" />
      <rect x="4" y="3" width="8" height="8" fill="#8A5A2B" />
      <rect x="4" y="3" width="8" height="2" fill="#A06B34" />
      {/* brows — the whole "angry" read lives here, so they are 2 cells tall */}
      <rect x="4" y="5" width="3" height="2" fill="#2E1A0A" />
      <rect x="9" y="5" width="3" height="2" fill="#2E1A0A" />
      {/* eyes */}
      <rect x="5" y="7" width="2" height="2" fill="#FFE14D" />
      <rect x="9" y="7" width="2" height="2" fill="#FFE14D" />
      <rect x="5" y="7" width="1" height="1" fill="#FF3B30" />
      <rect x="10" y="7" width="1" height="1" fill="#FF3B30" />
      {/* muzzle + bared teeth */}
      <rect x="5" y="10" width="6" height="4" fill="#2E1A0A" />
      <rect x="6" y="10" width="4" height="2" fill="#C98A4B" />
      <rect x="6" y="12" width="1" height="2" fill="#FFFFFF" />
      <rect x="8" y="12" width="1" height="2" fill="#FFFFFF" />
      <rect x="10" y="12" width="1" height="1" fill="#FFFFFF" />
      <rect x="7" y="11" width="2" height="1" fill="#1A0E05" />
    </Svg>
  )
}

function VacuumArt() {
  return (
    <Svg>
      {/* upright handle + hose */}
      <rect x="9" y="0" width="3" height="2" fill="#374151" />
      <rect x="10" y="2" width="2" height="6" fill="#4B5563" />
      <rect x="6" y="3" width="4" height="2" fill="#374151" />
      <rect x="6" y="5" width="2" height="4" fill="#374151" />
      {/* body */}
      <rect x="2" y="8" width="12" height="6" fill="#7F1D1D" />
      <rect x="3" y="9" width="10" height="4" fill="#DC2626" />
      <rect x="3" y="9" width="10" height="1" fill="#FCA5A5" />
      {/* dust window */}
      <rect x="5" y="10" width="4" height="3" fill="#1F2937" />
      <rect x="6" y="11" width="2" height="1" fill="#9CA3AF" />
      {/* intake mouth — the business end, pointed at the player */}
      <rect x="1" y="14" width="14" height="2" fill="#111827" />
      <rect x="2" y="14" width="12" height="1" fill="#374151" />
      <rect x="3" y="15" width="2" height="1" fill="#6B7280" />
      <rect x="7" y="15" width="2" height="1" fill="#6B7280" />
      <rect x="11" y="15" width="2" height="1" fill="#6B7280" />
    </Svg>
  )
}

function PuddleArt() {
  // Deliberately the only WIDE, FLAT hazard — silhouette alone separates it
  // from the three tall ones before any colour registers. The outline is
  // asymmetric on purpose: the first pass was a symmetric rounded lozenge with
  // a lighter top band, which read as the roof and body of a small blue car.
  return (
    <Svg>
      <rect x="3"  y="9"  width="11" height="1" fill="#1E40AF" />
      <rect x="1"  y="10" width="14" height="1" fill="#1D4ED8" />
      <rect x="0"  y="11" width="16" height="2" fill="#2563EB" />
      <rect x="2"  y="13" width="12" height="1" fill="#1D4ED8" />
      <rect x="5"  y="14" width="6"  height="1" fill="#1E3A8A" />
      {/* ripples, off-centre so nothing looks moulded */}
      <rect x="4"  y="11" width="6"  height="1" fill="#93C5FD" />
      <rect x="10" y="12" width="4"  height="1" fill="#60A5FA" />
      <rect x="2"  y="12" width="2"  height="1" fill="#7DB3FB" />
      {/* splash flecks, so it reads as wet rather than as a blue rug */}
      <rect x="2"  y="7"  width="1"  height="1" fill="#BFDBFE" />
      <rect x="13" y="7"  width="1"  height="1" fill="#BFDBFE" />
      <rect x="8"  y="6"  width="1"  height="1" fill="#DBEAFE" />
      <rect x="6"  y="8"  width="1"  height="1" fill="#93C5FD" />
      <rect x="11" y="8"  width="1"  height="1" fill="#93C5FD" />
    </Svg>
  )
}

function CucumberArt() {
  return (
    <Svg>
      <rect x="2" y="6" width="12" height="5" fill="#166534" />
      <rect x="1" y="7" width="14" height="3" fill="#166534" />
      <rect x="2" y="7" width="12" height="3" fill="#22C55E" />
      <rect x="3" y="6" width="10" height="1" fill="#86EFAC" />
      <rect x="2" y="10" width="12" height="1" fill="#14532D" />
      {/* stem ends, so it is a cucumber and not a green pill */}
      <rect x="0" y="7" width="1" height="3" fill="#14532D" />
      <rect x="15" y="7" width="1" height="3" fill="#14532D" />
      <rect x="3" y="8" width="1" height="1" fill="#BBF7D0" />
      <rect x="7" y="7" width="1" height="1" fill="#BBF7D0" />
      <rect x="11" y="9" width="1" height="1" fill="#BBF7D0" />
    </Svg>
  )
}

function CoinArt() {
  return (
    <Svg>
      <rect x="4" y="2" width="8" height="12" fill="#B45309" />
      <rect x="3" y="3" width="10" height="10" fill="#F59E0B" />
      <rect x="4" y="4" width="8" height="8" fill="#FBBF24" />
      <rect x="4" y="4" width="3" height="8" fill="#FCD34D" />
      {/* paw mark — a coin in a cat game should be a cat coin */}
      <rect x="7" y="6" width="3" height="3" fill="#92400E" />
      <rect x="6" y="5" width="1" height="1" fill="#92400E" />
      <rect x="8" y="4" width="1" height="1" fill="#92400E" />
      <rect x="10" y="5" width="1" height="1" fill="#92400E" />
    </Svg>
  )
}

function FishArt() {
  return (
    <Svg>
      <rect x="2" y="5" width="9" height="6" fill="#3A88B8" />
      <rect x="3" y="4" width="7" height="8" fill="#6BAED6" />
      <rect x="3" y="4" width="7" height="2" fill="#A0CCE5" />
      <rect x="4" y="10" width="6" height="1" fill="#2A6E96" />
      {/* tail */}
      <rect x="11" y="6" width="2" height="4" fill="#3A88B8" />
      <rect x="13" y="4" width="2" height="3" fill="#6BAED6" />
      <rect x="13" y="9" width="2" height="3" fill="#6BAED6" />
      {/* eye + gill */}
      <rect x="4" y="6" width="2" height="2" fill="#FFFFFF" />
      <rect x="4" y="7" width="1" height="1" fill="#12283A" />
      <rect x="8" y="5" width="1" height="5" fill="#A0CCE5" />
    </Svg>
  )
}

function MouseArt() {
  // Friendly, not menacing. It is prey now, and it has to look catchable.
  return (
    <Svg>
      <rect x="2" y="3" width="4" height="4" fill="#9CA3AF" />
      <rect x="3" y="4" width="2" height="2" fill="#F9A8D4" />
      <rect x="10" y="3" width="4" height="4" fill="#9CA3AF" />
      <rect x="11" y="4" width="2" height="2" fill="#F9A8D4" />
      <rect x="3" y="5" width="10" height="8" fill="#9CA3AF" />
      <rect x="4" y="6" width="8" height="6" fill="#D1D5DB" />
      <rect x="5" y="8" width="2" height="2" fill="#1F2937" />
      <rect x="9" y="8" width="2" height="2" fill="#1F2937" />
      <rect x="5" y="8" width="1" height="1" fill="#FFFFFF" />
      <rect x="9" y="8" width="1" height="1" fill="#FFFFFF" />
      <rect x="7" y="10" width="2" height="2" fill="#F472B6" />
      {/* tail */}
      <rect x="13" y="11" width="3" height="1" fill="#9CA3AF" />
      <rect x="15" y="9" width="1" height="2" fill="#9CA3AF" />
    </Svg>
  )
}

function RoombaArt() {
  // Reads as a machine rather than an animal: perfect circle, no face, one
  // amber sensor. The circle matters — every other hazard has an irregular
  // silhouette, so "the round one" is the one that slides.
  return (
    <Svg>
      <rect x="2" y="6" width="12" height="7" fill="#111827" />
      <rect x="1" y="7" width="14" height="5" fill="#111827" />
      <rect x="3" y="5" width="10" height="7" fill="#4B5563" />
      <rect x="2" y="7" width="12" height="4" fill="#4B5563" />
      <rect x="4" y="4" width="8" height="2" fill="#6B7280" />
      <rect x="5" y="3" width="6" height="1" fill="#9CA3AF" />
      {/* sensor dome — the one bright thing, findable at speed */}
      <rect x="6" y="6" width="4" height="3" fill="#0B1220" />
      <rect x="7" y="7" width="2" height="1" fill="#F59E0B" />
      {/* bumper */}
      <rect x="2" y="12" width="12" height="2" fill="#0B1220" />
      <rect x="3" y="12" width="10" height="1" fill="#374151" />
      {/* side brushes */}
      <rect x="0" y="10" width="2" height="1" fill="#FCD34D" />
      <rect x="14" y="10" width="2" height="1" fill="#FCD34D" />
      <rect x="1" y="12" width="1" height="1" fill="#FCD34D" />
      <rect x="14" y="12" width="1" height="1" fill="#FCD34D" />
    </Svg>
  )
}

function CrowArt() {
  // Two things this has to survive. First, straight horizontal wings read as a
  // plus sign rather than a bird, so they step outward and down into a swept
  // dive. Second, an actual crow is near-black and the street and rooftop
  // roads are near-black too — so this one is slate with a lit leading edge,
  // which keeps the silhouette findable on every floor in the game.
  return (
    <Svg>
      {/* wings, stepped out and down */}
      <rect x="3"  y="5" width="2" height="4" fill="#263244" />
      <rect x="1"  y="6" width="2" height="4" fill="#1B2433" />
      <rect x="0"  y="8" width="2" height="3" fill="#263244" />
      <rect x="11" y="5" width="2" height="4" fill="#263244" />
      <rect x="13" y="6" width="2" height="4" fill="#1B2433" />
      <rect x="14" y="8" width="2" height="3" fill="#263244" />
      {/* lit leading edge — the reason it reads on dark asphalt */}
      <rect x="1"  y="5" width="4" height="1" fill="#64748B" />
      <rect x="0"  y="7" width="3" height="1" fill="#4B5A73" />
      <rect x="11" y="5" width="4" height="1" fill="#64748B" />
      <rect x="13" y="7" width="3" height="1" fill="#4B5A73" />
      {/* body */}
      <rect x="5" y="5" width="6" height="7" fill="#1B2433" />
      <rect x="6" y="5" width="4" height="6" fill="#3B4A61" />
      <rect x="6" y="5" width="2" height="3" fill="#4B5A73" />
      {/* head */}
      <rect x="6" y="2" width="4" height="4" fill="#1B2433" />
      <rect x="5" y="3" width="6" height="2" fill="#263244" />
      <rect x="6" y="3" width="1" height="1" fill="#FF3B30" />
      <rect x="9" y="3" width="1" height="1" fill="#FF3B30" />
      {/* beak, aimed down the lane at you */}
      <rect x="7" y="6" width="2" height="2" fill="#F59E0B" />
      <rect x="7" y="8" width="2" height="1" fill="#B45309" />
      {/* tail */}
      <rect x="6" y="12" width="4" height="2" fill="#1B2433" />
      <rect x="7" y="14" width="2" height="2" fill="#263244" />
    </Svg>
  )
}

const ART: Record<Variant, () => JSX.Element> = {
  dog: DogArt,
  roomba: RoombaArt,
  crow: CrowArt,
  vacuum: VacuumArt,
  puddle: PuddleArt,
  cucumber: CucumberArt,
  coin: CoinArt,
  fish: FishArt,
  mouse: MouseArt,
}

// ─── Danger / reward presentation ────────────────────────────────────────────

/** Hazard tape painted on the lane under the obstacle. This is what the old
 *  red aura was trying to do, except it sits BEHIND and BELOW the sprite
 *  instead of on top of it — so the lane cell reads as dangerous while the
 *  dog still looks like a dog. */
const HazardPatch = memo(function HazardPatch({
  reduced, locked,
}: { reduced: boolean; locked?: boolean }) {
  return (
    <div style={{
      position: 'absolute', left: '2%', right: '2%', bottom: 0, height: '22%',
      borderRadius: 4,
      // A locked-on crow goes white and flickers twice as fast. It is the same
      // tape, shouting — you have stopped being able to out-wait it.
      border: `2px solid ${locked ? 'rgba(255,255,255,0.95)' : 'rgba(220,38,38,0.85)'}`,
      backgroundImage: locked
        ? 'repeating-linear-gradient(45deg, rgba(248,113,113,0.95) 0 5px, rgba(60,10,10,0.9) 5px 10px)'
        : 'repeating-linear-gradient(45deg, rgba(220,38,38,0.85) 0 5px, rgba(20,10,10,0.85) 5px 10px)',
      opacity: 0.9,
      animation: reduced ? undefined : `lr-hazard-tape ${locked ? '0.32s' : '0.9s'} ease-in-out infinite`,
    }} />
  )
})

/** Which way a roomba is sliding, called out beside it. Without this you only
 *  learn the direction by watching it move, which at 600px/s is learning it too
 *  late — the arrow is the difference between a read and a coin flip. */
const DriftArrow = memo(function DriftArrow({ drift, reduced }: { drift: -1 | 1; reduced: boolean }) {
  return (
    <div style={{
      position: 'absolute', top: '34%',
      [drift > 0 ? 'right' : 'left']: '-20%',
      width: 0, height: 0,
      borderTop: '7px solid transparent',
      borderBottom: '7px solid transparent',
      [drift > 0 ? 'borderLeft' : 'borderRight']: '10px solid rgba(252,211,77,0.95)',
      filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.55))',
      animation: reduced ? undefined : `lr-drift-${drift > 0 ? 'r' : 'l'} 0.55s ease-in-out infinite`,
      pointerEvents: 'none',
    } as React.CSSProperties} />
  )
})

export const ItemArt = memo(function ItemArt({
  variant, reduced, drift, locked,
}: { variant: Variant; reduced: boolean; drift?: -1 | 1; locked?: boolean }) {
  const Art = ART[variant]
  if (isObstacle(variant)) {
    return (
      <>
        <HazardPatch reduced={reduced} locked={locked} />
        {drift ? <DriftArrow drift={drift} reduced={reduced} /> : null}
        {/* contact shadow — grounds it. Hard-edged, no blur, per house style. */}
        <div style={{
          position: 'absolute', left: '16%', right: '16%', bottom: '15%', height: '8%',
          borderRadius: '50%', background: 'rgba(0,0,0,0.45)',
        }} />
        {/* Stands ON the tape, not in it. When the sprite's lower half overlapped
            those stripes the silhouette became unreadable — the dog's muzzle and
            the vacuum's intake are exactly the features that identify them. */}
        <div style={{ position: 'absolute', left: '8%', right: '8%', top: '-2%', bottom: '20%' }}>
          <Art />
        </div>
      </>
    )
  }
  const halo = variant === 'fish' ? '125,211,252' : variant === 'mouse' ? '196,181,253' : '252,211,77'
  return (
    <>
      {/* shadow stays on the floor while the sprite bobs above it — the gap is
          what tells you this one is floating and therefore safe */}
      <div style={{
        position: 'absolute', left: '26%', right: '26%', bottom: '-2%', height: '8%',
        borderRadius: '50%', background: 'rgba(0,0,0,0.30)',
      }} />
      <div style={{
        position: 'absolute', inset: '-6%', borderRadius: '50%',
        background: `radial-gradient(circle, rgba(${halo},0.55) 0%, rgba(${halo},0) 68%)`,
        animation: reduced ? undefined : 'lr-pickup-glow 1.1s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', inset: '8%',
        animation: reduced ? undefined : 'lr-pickup-bob 0.9s ease-in-out infinite',
        filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.4))',
      }}>
        <Art />
      </div>
    </>
  )
})
