'use client'

// ═══════════════════════════════════════════════════════════════════════════
// ROOM WEATHER — the sky the household set for this room, in its window.
//
// One layer, mounted once by CareSceneHost, reading the shared eren_stats map.
// It replaces RoomDecor, which hung bought props on the walls; a prop is a
// sticker on somebody else's painting, and a window is a hole the painter
// already left.
//
// HOW IT STAYS INSIDE THE GLASS. Not by clipping. The room art is drawn with
// `background-size: cover`, so this layer rebuilds that exact rectangle with a
// pure-CSS cover box (min-width/min-height 100% at the picture's own aspect —
// the same trick FeedScene uses to pin steam to the kettle spout). Inside it:
//
//   1. the effect, filling the window's bounding box
//   2. the window itself, cut straight out of the room art with only the SKY
//      made transparent (scripts/build_window_frames.py), drawn back on top
//
// So the mullions, the sash, the curtains, the plant on the sill and the wall
// around it are the original pixels, sitting in front of the weather. The
// weather is behind the glass by construction and there is no mask to get
// wrong — the failure mode of a bad cut is a raindrop hidden behind a curtain,
// never a raindrop on the wallpaper.
//
// The effect box is a `container-type: size` element, which is what lets every
// effect size its particles in `cqi`/`cqh`. The kitchen window is ~66px across
// on a phone and the lab's is nearly three times that; one raindrop written in
// px cannot serve both.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useErenStats } from '@/hooks/useErenStats'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { ROOM_WINDOWS } from '@/lib/roomWindows'
import { weatherDef, type WeatherId } from '@/lib/weather'
import WeatherFx from './WeatherFx'

export default memo(function RoomWeather({ room, dark, z = 0 }: {
  room: string
  /** The scene is showing its night art, so the cut must come from that. */
  dark?: boolean
  /**
   * Stacking level inside the room that mounts it. Zero on purpose, and it
   * matters: a positive z-index would paint this above every prop in the room
   * that has no z-index of its own, and since the layer redraws the window's
   * own pixels, anything standing in front of the glass would vanish behind a
   * copy of it. At zero it sorts by document order, so mounting it directly
   * after the wallpaper puts it over the wall and under everything else.
   */
  z?: number
}) {
  const { profile } = useAuth()
  const { stats } = useErenStats(profile?.household_id ?? null)
  const reduced = useReducedMotion()

  const win = ROOM_WINDOWS[room]
  const id = (stats?.room_weather as Record<string, string> | null | undefined)?.[room]
  const def = weatherDef(id)

  // `clear` is the absence of a layer, not a layer.
  if (!win || !def || def.id === 'clear') return null
  const cut = dark ? win.night : win.day
  if (!cut) return null

  const box = {
    left: `${win.box.l * 100}%`,
    top: `${win.box.t * 100}%`,
    width: `${win.box.w * 100}%`,
    height: `${win.box.h * 100}%`,
  }

  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: z }}>
      {/* The room picture's own rectangle, reproduced from `cover`. */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        minWidth: '100%', minHeight: '100%',
        aspectRatio: `${win.art.w} / ${win.art.h}`,
      }}>
        <div style={{
          position: 'absolute', ...box,
          overflow: 'hidden',
          containerType: 'size',
        }}>
          <WeatherFx id={def.id as WeatherId} still={reduced} />
        </div>

        <img src={cut} alt="" draggable={false} style={{
          position: 'absolute', ...box,
          // Matches how the room art itself is scaled, so the cut lands pixel
          // for pixel on the painting it came from.
          imageRendering: 'auto',
        }} />
      </div>
    </div>
  )
})
