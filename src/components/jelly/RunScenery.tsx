'use client'

// ═══════════════════════════════════════════════════════════════════════════
// JELLY RUN — the scenery.
//
// Everything here is STATIC art. Nothing in this file knows the game is
// running: the page owns one rAF loop and moves these pieces by writing
// transforms to refs, so none of this re-renders during a run.
//
// The world is the parlour's stores in cross-section — a lit upper floor of
// shelving you run along, and a dark preserve cellar underneath that you drop
// into. Keeping the two halves visually opposite (warm and lit vs cold and
// dim) is what makes falling through a gap read as going SOMEWHERE rather
// than as clipping through the floor.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import {
  INK, CREAM, CREAM_DIM, WALL, WALL_STRIPE, WALL_DEEP,
  WOOD, WOOD_DK, WOOD_LT, CASE_IN, CASE_IN_LT, BERRY, BERRY_DK, BRASS, BRASS_LT, BRASS_DK,
} from './parlourTheme'

/** One terrain column. The whole world grid is measured in these. */
export const TILE = 44

/** How tall a floor slab is drawn. */
export const FLOOR_H = 14

// ─── Depth ─────────────────────────────────────────────────────────────────

/**
 * Mixes a colour toward the wall.
 *
 * In this art style a hard INK outline is what says "this is solid, you can
 * stand on it". So background dressing gets NO outline and is washed toward
 * the wall colour instead — atmospheric perspective doing the job an outline
 * would do badly. Without this the parallax shelving read as a ledge the
 * player could land on, which in a runner is a lie you pay for.
 */
function recede(hex: string, t: number): string {
  const a = parseInt(hex.slice(1), 16)
  const b = parseInt(WALL.slice(1), 16)
  const mix = (sh: number) => {
    const ca = (a >> sh) & 255, cb = (b >> sh) & 255
    return Math.round(ca + (cb - ca) * t)
  }
  return `rgb(${mix(16)}, ${mix(8)}, ${mix(0)})`
}

// ─── Back wall ─────────────────────────────────────────────────────────────

export const BackWall = memo(function BackWall({ upperY }: { upperY: number }) {
  return (
    <>
      {/* Lit upper half — the parlour's striped wall. Deliberately low
          contrast: the player is reading a silhouette moving at 500px/s, and a
          busy backdrop is what makes a runner feel noisy instead of fast. */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
        height: upperY,
        background: `linear-gradient(180deg, ${WALL} 0%, ${WALL_STRIPE} 62%, ${WALL_DEEP} 100%)`,
      }} />
      {/* The wallpaper's actual stripes. Fixed rather than scrolling: a moving
          repeating pattern at this pitch strobes against the frame rate. */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
        height: upperY, opacity: 0.5,
        background: `repeating-linear-gradient(90deg, transparent 0 22px, ${WALL_DEEP} 22px 44px)`,
        maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 78%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 78%, transparent 100%)',
      }} />
      {/* Ceiling. The upper floor sits low on a tall phone, so without this the
          top third is blank wall and the room reads as unfinished rather than
          as a room. */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
        height: 34,
        background: `linear-gradient(180deg, ${recede(WOOD_DK, 0.5)} 0%, ${recede(WOOD, 0.55)} 62%, ${recede(WOOD_DK, 0.62)} 100%)`,
      }} />
      <div className="absolute inset-x-0 pointer-events-none" style={{
        top: 34, height: 5, background: recede(WOOD_DK, 0.35), opacity: 0.8,
      }} />
      {/* Cellar — cold and dark, so the drop reads as a different place */}
      <div className="absolute inset-x-0 pointer-events-none" style={{
        top: upperY, bottom: 0,
        background: `linear-gradient(180deg, ${CASE_IN_LT} 0%, ${CASE_IN} 55%, #1B1017 100%)`,
      }} />
      <div className="absolute inset-x-0 pointer-events-none" style={{
        top: upperY - 2, height: 3, background: INK, opacity: 0.85,
      }} />
    </>
  )
})

/**
 * Far shelving that slides by slower than the floor. Placed by the loop.
 *
 * `depth` is how far back it sits: 0 is the near band, 1 the far one. It
 * drives colour only — nothing here is ever solid.
 */
export const WallShelf = memo(function WallShelf({ depth = 0 }: { depth?: number }) {
  const t = 0.42 + depth * 0.26
  const jar = (c: string) => recede(c, t + 0.06)
  return (
    <div style={{ width: 120, height: 22, position: 'absolute', willChange: 'transform' }}>
      <div style={{ position: 'absolute', inset: 0, background: recede(WOOD, t), borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: recede(WOOD_LT, t) }} />
      {[10, 44, 78].map(x => (
        <div key={x} style={{
          position: 'absolute', left: x, top: -11, width: 16, height: 13,
          background: jar(x === 44 ? BERRY : BRASS), borderRadius: 3,
        }} />
      ))}
    </div>
  )
})

/** A pendant lamp on the ceiling. Pure dressing, and washed out to say so. */
export const CeilingLamp = memo(function CeilingLamp({ depth = 0 }: { depth?: number }) {
  const t = 0.34 + depth * 0.22
  return (
    <div style={{ width: 34, height: 60, position: 'absolute', willChange: 'transform' }}>
      <div style={{ position: 'absolute', left: 16, top: 0, width: 2, height: 26, background: recede(WOOD_DK, t) }} />
      <div style={{
        position: 'absolute', left: 3, top: 24, width: 28, height: 14,
        background: recede(BRASS_DK, t), borderRadius: '14px 14px 3px 3px',
      }} />
      <div style={{
        position: 'absolute', left: 9, top: 36, width: 16, height: 9,
        background: recede(BRASS_LT, t * 0.5), borderRadius: '0 0 8px 8px',
      }} />
      {/* The light it throws. Sits under everything, so it can never be read
          as a surface. */}
      <div style={{
        position: 'absolute', left: -13, top: 40, width: 60, height: 84,
        background: `radial-gradient(ellipse at 50% 0%, rgba(255,226,160,${0.3 - depth * 0.14}) 0%, rgba(255,226,160,0) 72%)`,
      }} />
    </div>
  )
})

// ─── Floors ────────────────────────────────────────────────────────────────

/**
 * One tile of the run-along floor.
 *
 * It gets a dark underside because in the cellar you see this same slab FROM
 * BELOW — down there it is the ceiling, and a slab with no underside reads as
 * a floating line.
 */
export const FloorTile = memo(function FloorTile({ w }: { w: number }) {
  return (
    <div style={{ width: w, height: FLOOR_H, position: 'absolute', willChange: 'transform' }}>
      <div style={{ position: 'absolute', inset: 0, background: WOOD, borderLeft: `1px solid ${WOOD_DK}` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: WOOD_LT }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, background: CREAM_DIM, opacity: 0.5 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: INK, opacity: 0.9 }} />
    </div>
  )
})

/** The cellar's own floor — stone, colder, and always continuous. */
export const CellarTile = memo(function CellarTile({ w }: { w: number }) {
  return (
    <div style={{ width: w, height: FLOOR_H, position: 'absolute', willChange: 'transform' }}>
      <div style={{ position: 'absolute', inset: 0, background: '#3A2A33', borderLeft: '1px solid #241820' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: '#584250' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1, background: '#7A6070' }} />
    </div>
  )
})

// ─── Obstacles ─────────────────────────────────────────────────────────────

/**
 * A crate of preserves. Grounded, so you jump it — and a DASH smashes it.
 *
 * Grounded-versus-hanging is the only thing separating the two hazards, so the
 * silhouettes have to say which from across the screen: a crate is wide and
 * sits on the line, a pipe is thin and hangs off the ceiling. (Same rule the
 * lane runner's hazards follow.)
 */
export const Crate = memo(function Crate({ w, h }: { w: number; h: number }) {
  return (
    <div style={{ width: w, height: h, position: 'absolute', willChange: 'transform' }}>
      <div style={{ position: 'absolute', inset: 0, background: WOOD, border: `2px solid ${INK}`, borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 2, right: 2, top: 2, height: 2, background: WOOD_LT }} />
      <div style={{ position: 'absolute', left: '50%', top: 3, bottom: 3, width: 2, marginLeft: -1, background: WOOD_DK }} />
      <div style={{ position: 'absolute', left: 3, right: 3, top: '50%', height: 2, marginTop: -1, background: WOOD_DK }} />
      <div style={{ position: 'absolute', left: '50%', marginLeft: -5, top: -7, width: 10, height: 7, background: BERRY, border: `2px solid ${INK}`, borderRadius: '3px 3px 0 0' }} />
    </div>
  )
})

/**
 * A lit syrup burner. Touch it and the run is OVER.
 *
 * The run has two classes of hazard and the player has to tell them apart in
 * the fraction of a second before contact, so they are separated on the one
 * channel that is read fastest: COLOUR. Everything that merely slows you is
 * wood-brown or brass. This is the only thing on screen that is hot — orange
 * flame, a glow that spills onto the floor, and rising heat. Nothing else in
 * the parlour is allowed to be that colour.
 *
 * It is also the tallest thing on the ground, so the silhouette agrees with
 * the colour instead of relying on it.
 */
export const Burner = memo(function Burner({ w, h }: { w: number; h: number }) {
  return (
    <div style={{ width: w, height: h, position: 'absolute', willChange: 'transform' }}>
      {/* the heat it throws — under everything, so it can never read as solid */}
      <div className="jrHeat" style={{
        position: 'absolute', left: -14, right: -14, top: -18, bottom: -6,
        background: `radial-gradient(ellipse at 50% 70%, rgba(255,138,42,0.42) 0%, rgba(255,90,20,0.14) 46%, rgba(255,90,20,0) 74%)`,
      }} />
      {/* stove body */}
      <div style={{
        position: 'absolute', left: 3, right: 3, bottom: 0, height: h * 0.44,
        background: '#4A3038', border: `2px solid ${INK}`, borderRadius: 2,
      }} />
      {/* flame mouth */}
      <div className="jrFlame" style={{
        position: 'absolute', left: 8, right: 8, bottom: 3, height: h * 0.3,
        background: `linear-gradient(0deg, #FFD166 0%, #FF8A2A 46%, #E8402A 100%)`,
        borderRadius: '40% 40% 3px 3px',
      }} />
      {/* the pot, and the syrup boiling over the rim */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 6, height: h * 0.46,
        background: `linear-gradient(180deg, ${BRASS} 0%, ${BRASS_DK} 100%)`,
        border: `2px solid ${INK}`, borderRadius: '3px 3px 8px 8px',
      }} />
      <div style={{
        position: 'absolute', left: -2, right: -2, top: 2, height: 7,
        background: BRASS_LT, border: `2px solid ${INK}`, borderRadius: 3,
      }} />
      <div className="jrBoil" style={{
        position: 'absolute', left: 4, right: 4, top: 6, height: 6,
        background: '#FF6B3D', borderRadius: 3,
      }} />
      <style jsx>{`
        .jrFlame { animation: jrFlicker 0.24s steps(2, jump-none) infinite; transform-origin: 50% 100%; }
        .jrHeat  { animation: jrHeatPulse 0.9s ease-in-out infinite; }
        .jrBoil  { animation: jrBoilUp 0.5s steps(2, jump-none) infinite; }
        @keyframes jrFlicker  { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.28) scaleX(0.9); } }
        @keyframes jrHeatPulse{ 0%,100% { opacity: 0.75; } 50% { opacity: 1; } }
        @keyframes jrBoilUp   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @media (prefers-reduced-motion: reduce) {
          .jrFlame, .jrHeat, .jrBoil { animation: none; }
        }
      `}</style>
    </div>
  )
})

/**
 * The glider canopy. Opens over Eren's head while he holds a fall.
 *
 * A jelly-shop parasol rather than a hang-glider, because it has to look like
 * it came out of this room. Drawn by the game rather than by the sprite so it
 * can scale and fade independently of the 20x20 cat.
 */
export const Glider = memo(function Glider({ w }: { w: number }) {
  return (
    <div style={{ width: w, height: w * 0.52, position: 'absolute', pointerEvents: 'none' }}>
      <div className="jrCanopy" style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: '32%',
          background: `linear-gradient(180deg, ${BERRY} 0%, ${BERRY_DK} 100%)`,
          border: `2px solid ${INK}`, borderRadius: '999px 999px 6px 6px',
        }} />
        {[26, 50, 74].map(p => (
          <div key={p} style={{
            position: 'absolute', left: `${p}%`, top: 2, bottom: '34%', width: 2,
            marginLeft: -1, background: CREAM, opacity: 0.5,
          }} />
        ))}
        {/* rigging down to the paws */}
        <div style={{ position: 'absolute', left: '20%', top: '62%', bottom: 0, width: 2, background: INK, transform: 'rotate(12deg)' }} />
        <div style={{ position: 'absolute', left: '78%', top: '62%', bottom: 0, width: 2, background: INK, transform: 'rotate(-12deg)' }} />
      </div>
      <style jsx>{`
        .jrCanopy { animation: jrCanopyBob 1.1s ease-in-out infinite; transform-origin: 50% 100%; }
        @keyframes jrCanopyBob {
          0%, 100% { transform: rotate(-3deg); }
          50%      { transform: rotate(3deg); }
        }
        @media (prefers-reduced-motion: reduce) { .jrCanopy { animation: none; } }
      `}</style>
    </div>
  )
})

/**
 * A dripping syrup pipe. Duck it — never jump it.
 *
 * `clear` is how far its underside floats above the floor, and it exists only
 * so the pipe can prove it is HANGING. Drawn as a bare bar it read as a low
 * table you might hop onto: a brass slab on three little legs, floating, with
 * nothing holding it up. In a runner, a thing that looks landable but is
 * actually a duck-or-be-hit is the worst kind of lie.
 *
 * So it gets stems climbing out of the top and fading away, and a syrup puddle
 * on the floor directly under it. Together they say the same thing twice: this
 * comes from ABOVE, and the space under it is the space you want.
 */
export const Pipe = memo(function Pipe({ w, h, clear }: { w: number; h: number; clear: number }) {
  const fade = 'linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0) 100%)'
  return (
    <div style={{ width: w, height: h, position: 'absolute', willChange: 'transform' }}>
      {/* stems up out of frame */}
      {[7, w - 13].map(x => (
        <div key={x} style={{
          position: 'absolute', left: x, bottom: h - 2, width: 5, height: 74,
          background: `linear-gradient(180deg, ${BRASS_DK} 0%, ${BRASS} 100%)`,
          maskImage: fade, WebkitMaskImage: fade,
        }} />
      ))}
      <div style={{ position: 'absolute', inset: 0, background: BRASS, border: `2px solid ${INK}`, borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 2, right: 2, top: 2, height: 2, background: BRASS_LT }} />
      {/* drips, at three different lengths so they read as falling */}
      {[[5, 9], [18, 14], [31, 7]].map(([x, len]) => (
        <div key={x} style={{
          position: 'absolute', left: x, top: h - 2, width: 4, height: len,
          background: BERRY, border: `1px solid ${INK}`, borderRadius: '0 0 3px 3px',
        }} />
      ))}
      {/* and the puddle they have been landing in */}
      <div style={{
        position: 'absolute', left: 2, right: 2, bottom: -clear - 3, height: 6,
        background: BERRY_DK, borderRadius: '50%', opacity: 0.85,
      }} />
      <div style={{
        position: 'absolute', left: 8, right: 8, bottom: -clear - 1, height: 3,
        background: BERRY, borderRadius: '50%',
      }} />
    </div>
  )
})

// ─── The tide ──────────────────────────────────────────────────────────────

/**
 * The wall of jelly chasing you.
 *
 * A flat coloured block reads as a rendering bug rather than a threat, so it
 * gets a scalloped leading edge and lighter streaks behind it. The wobble is a
 * CSS animation on the edge alone — the body is a solid the loop translates.
 */
export const Tide = memo(function Tide({ h }: { h: number }) {
  return (
    <div style={{ width: 300, height: h, position: 'absolute', willChange: 'transform' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 18, right: 0, background: `linear-gradient(90deg, ${BERRY_DK} 0%, ${BERRY} 70%)` }} />
      <div style={{ position: 'absolute', left: 40, top: '18%', width: 140, height: 6, background: '#FF7FA6', opacity: 0.5 }} />
      <div style={{ position: 'absolute', left: 80, top: '54%', width: 170, height: 5, background: '#FF7FA6', opacity: 0.35 }} />
      <div className="jrTideEdge" style={{ position: 'absolute', right: -1, top: 0, bottom: 0, width: 26 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', right: 0, top: `${i * 11.5}%`, width: 26, height: '13%',
            background: BERRY, borderRadius: '0 60% 60% 0',
          }} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, width: 4, background: BERRY_DK, opacity: 0.8 }} />
      <style jsx>{`
        .jrTideEdge { animation: jrTideWob 0.42s steps(2, jump-none) infinite; }
        @keyframes jrTideWob {
          0%, 100% { transform: translateX(0) scaleY(1); }
          50%      { transform: translateX(3px) scaleY(1.04); }
        }
        @media (prefers-reduced-motion: reduce) { .jrTideEdge { animation: none; } }
      `}</style>
    </div>
  )
})

/** A collectible jelly bead — the run's bananas. */
export const Bead = memo(function Bead({ size, color }: { size: number; color: string }) {
  return (
    <div style={{ width: size, height: size, position: 'absolute', willChange: 'transform' }}>
      <div style={{
        position: 'absolute', inset: 0, background: color,
        border: `2px solid ${INK}`, borderRadius: 5,
        boxShadow: `0 0 8px ${color}`,
      }} />
      <div style={{ position: 'absolute', left: 3, top: 2, width: 4, height: 3, background: CREAM, opacity: 0.85, borderRadius: 1 }} />
    </div>
  )
})
