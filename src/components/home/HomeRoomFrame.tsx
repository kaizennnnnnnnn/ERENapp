'use client'

// ─── Home room frame ─────────────────────────────────────────────────────────
// How the living room sits above the bottom nav. Two planes:
//
//   ART    the painting, full screen, exactly as before: `cover` of the whole
//          viewport. RoomWeather reproduces that same `cover` to land its
//          window cut pixel for pixel, so the art plane must stay the viewport.
//          The nav's opaque white bar hides the strip of floor under it.
//   STAGE  everything that stands in the room (Eren, his bubbles, the bowl, the
//          HUD, the swipe dots, the light switch). It ends at the nav's top
//          edge, so Eren's feet, which sit 10% up from the stage floor, land on
//          the rug instead of behind the bar.
//
// Half the things that float around Eren (wish cloud, speech bubble, battle
// plate, whisper, thought cloud, grant burst) are `position: fixed` with
// viewport percentages, tuned against his old `bottom: 10%` of the screen. The
// stage's identity transform makes it their containing block, so those
// percentages now resolve against the stage and every one of them lifts with
// Eren, in proportion, with no change to the components themselves. Sheets and
// modals that must cover the whole screen portal to <body> and are unaffected.
//
// Presentational: the page passes the pieces in.

import type { ReactNode, TouchEventHandler } from 'react'
import { NAV_HEIGHT } from '@/components/meadow/tokens'

/** The living-room painting for the time of day. Shared with the page's preload. */
export function homeRoomArt(dark: boolean): string {
  return dark ? '/HomeNight.png' : '/HomeDay.png'
}

export interface HomeRoomFrameProps {
  dark: boolean
  /** Layers aligned to the painting itself (RoomWeather). Over the art, under the stage. */
  artLayers?: ReactNode
  /** Everything that stands in the room; positioned against the stage. */
  children: ReactNode
  onTouchStart?: TouchEventHandler<HTMLDivElement>
  onTouchMove?: TouchEventHandler<HTMLDivElement>
}

export default function HomeRoomFrame({ dark, artLayers, children, onTouchStart, onTouchMove }: HomeRoomFrameProps) {
  return (
    <div className="fixed inset-0" style={{ zIndex: 0 }} onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
      {/* The painting */}
      <div className="absolute inset-0" style={{
        backgroundImage: `url(${homeRoomArt(dark)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        pointerEvents: 'none',
      }} />

      {artLayers}

      {/* The stage. z 2 keeps it over the art layers (the weather is z 0,
          the happy sparkles z 2 and earlier in the tree), matching the order
          these pieces had when they all shared the room's stacking context. */}
      <div className="absolute left-0 right-0 top-0" style={{
        bottom: NAV_HEIGHT,
        zIndex: 2,
        // Not a no-op: any transform makes this box the containing block for
        // the `position: fixed` pieces inside it (see the header). A 2D
        // identity, so no engine is forced to promote a compositing layer.
        transform: 'translate(0, 0)',
      }}>
        {children}
      </div>
    </div>
  )
}
