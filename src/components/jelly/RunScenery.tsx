'use client'

// ═══════════════════════════════════════════════════════════════════════════
// JELLY RUN — the scenery.
//
// Everything here is STATIC art. Nothing in this file knows the game is
// running: the page owns one rAF loop and moves these pieces by writing
// transforms to refs, so none of this re-renders during a run.
//
// The world is the parlour's stores in cross-section — a lit floor of shelving
// you run along, and below it the drop: a dark shaft ending in the jelly vat.
// Keeping the two halves visually opposite (warm and lit above, cold and dark
// below) is what makes a gap in the floor read as a HOLE rather than as a
// missing tile.
// ═══════════════════════════════════════════════════════════════════════════

import { memo } from 'react'
import {
  INK, CREAM, CREAM_DIM, WALL, WALL_STRIPE, WALL_DEEP,
  WOOD, WOOD_DK, WOOD_LT, CASE_IN, CASE_IN_LT, BERRY, BERRY_DK, BRASS, BRASS_LT, BRASS_DK, LEAF,
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

export const BackWall = memo(function BackWall({ floorY }: { floorY: number }) {
  return (
    <>
      {/* Lit upper half — the parlour's striped wall. Deliberately low
          contrast: the player is reading a silhouette moving at 500px/s, and a
          busy backdrop is what makes a runner feel noisy instead of fast. */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
        height: floorY,
        background: `linear-gradient(180deg, ${WALL} 0%, ${WALL_STRIPE} 62%, ${WALL_DEEP} 100%)`,
      }} />
      {/* The wallpaper's actual stripes. Fixed rather than scrolling: a moving
          repeating pattern at this pitch strobes against the frame rate. */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
        height: floorY, opacity: 0.5,
        background: `repeating-linear-gradient(90deg, transparent 0 22px, ${WALL_DEEP} 22px 44px)`,
        maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 78%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 78%, transparent 100%)',
      }} />
      {/* Ceiling. The floor sits low on a tall phone, so without this the top
          third is blank wall and the room reads as unfinished rather than as a
          room. */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{
        height: 34,
        background: `linear-gradient(180deg, ${recede(WOOD_DK, 0.5)} 0%, ${recede(WOOD, 0.55)} 62%, ${recede(WOOD_DK, 0.62)} 100%)`,
      }} />
      <div className="absolute inset-x-0 pointer-events-none" style={{
        top: 34, height: 5, background: recede(WOOD_DK, 0.35), opacity: 0.8,
      }} />
      {/*
        Below the floor: the drop.

        This used to be a second walkable storey. It is now a fall, and the art
        has to say so before the player finds out the hard way — so it goes
        dark fast and ends in jelly, the same jelly that is chasing him. A gap
        in the floor is a hole into the vat.
      */}
      <div className="absolute inset-x-0 pointer-events-none" style={{
        top: floorY, bottom: 0,
        background: `linear-gradient(180deg, ${CASE_IN_LT} 0%, ${CASE_IN} 34%, #150C11 78%)`,
      }} />
      <div className="absolute inset-x-0 pointer-events-none" style={{
        top: floorY - 2, height: 3, background: INK, opacity: 0.85,
      }} />
      <div className="jrVat absolute inset-x-0 bottom-0 pointer-events-none" style={{
        height: 34,
        background: `linear-gradient(180deg, ${BERRY_DK} 0%, #6E1B39 100%)`,
        boxShadow: `0 -8px 22px rgba(158,43,81,0.55)`,
      }} />
      <style jsx>{`
        .jrVat { animation: jrVatBreathe 2.4s ease-in-out infinite; }
        @keyframes jrVatBreathe {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @media (prefers-reduced-motion: reduce) { .jrVat { animation: none; } }
      `}</style>
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
  // Pushed further back than it used to be. The run now has REAL walkways at
  // roughly shelf height and in the same brown, and a background prop that a
  // player might try to land on is a lie the game charges for. Atmospheric
  // perspective is the whole defence, so it has to be worth something: at 0.42
  // the near band still read as a solid ledge with a lit top.
  const t = 0.56 + depth * 0.24
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
 * It keeps a dark underside: at the lip of a gap you see the slab end, and a
 * floor with no thickness reads as a painted line rather than as something you
 * are standing on top of.
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

// ─── Raised roads ──────────────────────────────────────────────────────────

/**
 * A suspended service walkway — the run's high road.
 *
 * It is a ONE-WAY platform: you pass up through it and land on top, and the
 * lit floor always continues underneath, so stepping off one is never a fall.
 * That is the whole reason it can afford to be generous — a high line worth
 * taking for the gems on it, with nothing punishing about missing it.
 *
 * Two hanging brass rods, exactly the language the pipe uses, because both are
 * bolted to the same ceiling. What separates them is the part you read at
 * speed: the pipe is a NARROW brass bar with syrup running off it; this is a
 * WIDE plank with a lit top edge. Wide-and-wooden means stand on it. The two
 * are also never dealt in the same stretch, so the question never comes up
 * with a hazard's timing attached to the answer.
 */
export const Road = memo(function Road() {
  const fade = 'linear-gradient(0deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 62%, rgba(0,0,0,0) 100%)'
  const hanger: React.CSSProperties = {
    position: 'absolute', bottom: '100%', width: 5, height: 96,
    background: `linear-gradient(180deg, ${BRASS_DK} 0%, ${BRASS} 78%, ${BRASS_LT} 100%)`,
    maskImage: fade, WebkitMaskImage: fade,
  }
  return (
    // No width or height of its own: road segments come in several lengths and
    // the pool node they are drawn into is reused, so the LOOP owns the box and
    // the art fills it. Anything that had to be measured in px here (seams) is
    // a repeating background instead.
    //
    // Drawn LIGHTER than the floor on purpose. It hangs in mid-air over a pink
    // wall with nothing beneath it, so it has to win the read against the
    // parallax shelving behind it — which is the same brown, receded. Wood-lit
    // plus a hard shadow plus visible hangers is what makes it a thing you
    // stand ON rather than a bar drawn across the room.
    <div style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
      <div style={{ ...hanger, left: 14 }} />
      <div style={{ ...hanger, right: 15 }} />
      <div style={{
        position: 'absolute', inset: 0, background: WOOD_LT,
        border: `2px solid ${INK}`, borderRadius: 2,
        // Thickness, in the app's hard-shadow language — no blur.
        boxShadow: `0 3px 0 ${INK}`,
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0 34px, ${WOOD} 34px 37px)`,
      }} />
      {/* the lit standing edge — the pixel row that says "this is a top" */}
      <div style={{ position: 'absolute', left: 2, right: 2, top: 0, height: 2, background: CREAM }} />
      {/* and the shaded underside, so it has a near face rather than an edge */}
      <div style={{ position: 'absolute', left: 2, right: 2, bottom: 0, height: 3, background: WOOD_DK, opacity: 0.9 }} />
      {/* brass end caps, so where the walkway RUNS OUT is legible early */}
      <div style={{
        position: 'absolute', left: -1, top: -3, bottom: -2, width: 8,
        background: `linear-gradient(180deg, ${BRASS_LT} 0%, ${BRASS} 60%, ${BRASS_DK} 100%)`,
        border: `2px solid ${INK}`, borderRadius: 2,
      }} />
      <div style={{
        position: 'absolute', right: -1, top: -3, bottom: -2, width: 8,
        background: `linear-gradient(180deg, ${BRASS_LT} 0%, ${BRASS} 60%, ${BRASS_DK} 100%)`,
        border: `2px solid ${INK}`, borderRadius: 2,
      }} />
    </div>
  )
})

// ─── More hazards ──────────────────────────────────────────────────────────

/**
 * Boiling syrup, spilled across the floor. LETHAL, and the second thing in
 * the run allowed to be orange.
 *
 * It exists to be the burner's opposite. The burner is TALL and NARROW: you
 * clear it with a hop and the only question is when. This is FLAT and WIDE, so
 * a hop off the wrong foot lands you back in the middle of it and the question
 * becomes where you take off from. Same colour, same verdict, completely
 * different read — which is what stops "jump the orange thing" collapsing into
 * one reflex.
 *
 * Nothing about it is standable, and the art says so: it has no top, only a
 * surface that is obviously liquid.
 */
export const Spill = memo(function Spill({ w, h }: { w: number; h: number }) {
  const bubbles: Array<[number, number]> = [[10, 3], [Math.round(w * 0.42), 4], [w - 20, 3]]
  return (
    <div style={{ width: w, height: h, position: 'absolute', willChange: 'transform' }}>
      <div className="jrSpillHeat" style={{
        position: 'absolute', left: -10, right: -10, top: -26, bottom: -4,
        background: `radial-gradient(ellipse at 50% 88%, rgba(255,138,42,0.4) 0%, rgba(255,90,20,0.13) 50%, rgba(255,90,20,0) 78%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, #FFB259 0%, #FF8A2A 42%, #C7401A 100%)`,
        border: `2px solid ${INK}`, borderRadius: '40% 40% 30% 30% / 70% 70% 40% 40%',
      }} />
      {bubbles.map(([bx, r], i) => (
        <div key={bx} className={`jrBub jrBub${i}`} style={{
          position: 'absolute', left: bx, top: 2, width: r * 2, height: r * 2,
          background: '#FFD166', borderRadius: '50%', opacity: 0.9,
        }} />
      ))}
      {[22, 55, 80].map((p, i) => (
        <div key={p} className={`jrWisp jrWisp${i}`} style={{
          position: 'absolute', left: `${p}%`, top: -18, width: 3, height: 16,
          background: `linear-gradient(0deg, rgba(255,209,102,0.55), rgba(255,209,102,0))`,
          borderRadius: 3,
        }} />
      ))}
      <style jsx>{`
        .jrSpillHeat { animation: jrSpillPulse 1.1s ease-in-out infinite; }
        .jrBub  { animation: jrBubUp 0.62s steps(2, jump-none) infinite; }
        .jrBub1 { animation-delay: 0.2s; }
        .jrBub2 { animation-delay: 0.4s; }
        .jrWisp  { animation: jrWispUp 1.3s ease-out infinite; }
        .jrWisp1 { animation-delay: 0.42s; }
        .jrWisp2 { animation-delay: 0.86s; }
        @keyframes jrSpillPulse { 0%,100% { opacity: 0.72; } 50% { opacity: 1; } }
        @keyframes jrBubUp  { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.25); } }
        @keyframes jrWispUp { 0% { transform: translateY(6px) scaleY(0.5); opacity: 0; } 40% { opacity: 0.9; } 100% { transform: translateY(-12px) scaleY(1.2); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .jrSpillHeat, .jrBub, .jrWisp { animation: none; }
        }
      `}</style>
    </div>
  )
})

/**
 * A runaway service trolley, rolling the WRONG way down the aisle.
 *
 * The only hazard in the run that moves, and so the only one whose timing you
 * cannot solve by reading the floor alone — it closes faster than the ground
 * does. It costs you rather than kills, because a moving lethal would make the
 * "every hazard is answerable" promise very hard to keep honest.
 *
 * Its top is a flat tray, and standing on it is a legitimate answer.
 */
export const Cart = memo(function Cart({ w, h }: { w: number; h: number }) {
  return (
    <div style={{ width: w, height: h, position: 'absolute', willChange: 'transform' }}>
      {/* tray — the landable top, lit the way the floor's top is lit */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 7,
        background: WOOD, border: `2px solid ${INK}`, borderRadius: 2,
      }} />
      <div style={{ position: 'absolute', left: 2, right: 2, top: 2, height: 2, background: WOOD_LT }} />
      <div style={{ position: 'absolute', left: 4, top: 7, width: 3, bottom: 7, background: BRASS_DK }} />
      <div style={{ position: 'absolute', right: 4, top: 7, width: 3, bottom: 7, background: BRASS_DK }} />
      <div style={{
        position: 'absolute', left: 3, right: 3, bottom: 6, height: 5,
        background: WOOD_DK, border: `2px solid ${INK}`, borderRadius: 2,
      }} />
      <div style={{
        position: 'absolute', left: '50%', marginLeft: -5, bottom: 10, width: 10, height: 8,
        background: BERRY, border: `2px solid ${INK}`, borderRadius: 2,
      }} />
      {[3, w - 13].map(wx => (
        <div key={wx} className="jrWheel" style={{
          position: 'absolute', left: wx, bottom: 0, width: 10, height: 10,
          background: BRASS, border: `2px solid ${INK}`, borderRadius: '50%',
        }}>
          <div style={{ position: 'absolute', left: 2, top: 0, width: 2, height: '100%', background: BRASS_DK }} />
        </div>
      ))}
      <style jsx>{`
        .jrWheel { animation: jrRoll 0.3s linear infinite; }
        @keyframes jrRoll { to { transform: rotate(-360deg); } }
        @media (prefers-reduced-motion: reduce) { .jrWheel { animation: none; } }
      `}</style>
    </div>
  )
})

/**
 * A boiler vent in the floor. Run over it and it throws you.
 *
 * The run's one piece of terrain that HELPS, and it is what finally gives the
 * glider a job on a single-floor map: the vent puts you two and a half jumps
 * up with nothing above you, and the canopy is how that height becomes
 * distance and a line of beads instead of just a trip back down.
 *
 * Deliberately NOT orange. Everything hot in this room ends the run, so the
 * one thing that saves you is drawn in the same cream the beads and the lamps
 * are lit with — and it points up.
 */
export const Vent = memo(function Vent({ w, h }: { w: number; h: number }) {
  return (
    <div style={{ width: w, height: h, position: 'absolute', willChange: 'transform' }}>
      {/* the jet, UNDER the grate so it can never read as a surface */}
      <div className="jrJet" style={{
        position: 'absolute', left: 2, right: 2, bottom: h - 2, height: 116,
        background: `linear-gradient(0deg, rgba(255,248,238,0.5) 0%, rgba(214,238,255,0.22) 46%, rgba(214,238,255,0) 100%)`,
        borderRadius: '50% 50% 8px 8px', transformOrigin: '50% 100%',
      }} />
      {/* chevrons — the jet says "up" twice, once in shape and once in motion */}
      {[0, 1, 2].map(i => (
        <div key={i} className={`jrChev jrChev${i}`} style={{
          position: 'absolute', left: '50%', marginLeft: -7, bottom: h + 10 + i * 22,
          width: 14, height: 8,
          borderLeft: `3px solid ${CREAM}`, borderTop: `3px solid ${CREAM}`,
          transform: 'rotate(45deg)', opacity: 0.75,
        }} />
      ))}
      <div style={{
        position: 'absolute', inset: 0, background: BRASS_DK,
        border: `2px solid ${INK}`, borderRadius: 2,
      }} />
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          position: 'absolute', left: 5 + i * ((w - 10) / 4), top: 3, bottom: 3,
          width: 3, background: CASE_IN, borderRadius: 1,
        }} />
      ))}
      <style jsx>{`
        .jrJet   { animation: jrJetPuff 0.44s steps(2, jump-none) infinite; }
        .jrChev  { animation: jrChevUp 0.9s ease-out infinite; }
        .jrChev1 { animation-delay: 0.3s; }
        .jrChev2 { animation-delay: 0.6s; }
        @keyframes jrJetPuff { 0%,100% { transform: scaleY(0.88) scaleX(0.94); } 50% { transform: scaleY(1.06) scaleX(1); } }
        @keyframes jrChevUp  { 0% { transform: translateY(10px) rotate(45deg); opacity: 0; } 45% { opacity: 0.8; } 100% { transform: translateY(-14px) rotate(45deg); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .jrJet, .jrChev { animation: none; } }
      `}</style>
    </div>
  )
})

// ─── Better pickups ────────────────────────────────────────────────────────

/** A cut jelly gem. Worth five beads, and only ever laid on the high road. */
export const Gem = memo(function Gem({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, position: 'absolute', willChange: 'transform' }}>
      <div className="jrGemGlow" style={{
        position: 'absolute', left: '-40%', top: '-40%', width: '180%', height: '180%',
        background: `radial-gradient(circle, rgba(93,232,158,0.55) 0%, rgba(93,232,158,0) 68%)`,
      }} />
      <div className="jrGem" style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(160deg, #7DF3C4 0%, ${LEAF} 52%, #14724A 100%)`,
          border: `2px solid ${INK}`,
          clipPath: 'polygon(50% 0%, 100% 34%, 78% 100%, 22% 100%, 0% 34%)',
        }} />
        <div style={{
          position: 'absolute', left: '22%', top: '16%', width: '26%', height: '30%',
          background: CREAM, opacity: 0.85, clipPath: 'polygon(0% 0%, 100% 22%, 60% 100%)',
        }} />
      </div>
      <style jsx>{`
        .jrGem     { animation: jrGemSpin 1.6s ease-in-out infinite; }
        .jrGemGlow { animation: jrGemGlow 1.1s ease-in-out infinite; }
        @keyframes jrGemSpin { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(0.55); } }
        @keyframes jrGemGlow { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .jrGem, .jrGemGlow { animation: none; } }
      `}</style>
    </div>
  )
})

/**
 * A dollop of cream in a bubble. Takes ONE hit for you — the burner included.
 *
 * It is here because the run now has two ways to die outright, and a runner
 * that can end on a single misread at 560px/s wants one layer between a
 * mistake and the results screen. Rare, and gone the instant it is spent.
 */
export const ShieldPickup = memo(function ShieldPickup({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, position: 'absolute', willChange: 'transform' }}>
      <div className="jrShield" style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `radial-gradient(circle at 34% 28%, rgba(255,248,238,0.9) 0%, rgba(255,248,238,0.28) 46%, rgba(255,248,238,0.1) 100%)`,
        border: `2px solid ${CREAM}`,
        boxShadow: `0 0 10px rgba(255,248,238,0.7)`,
      }} />
      <div style={{
        position: 'absolute', left: '26%', top: '22%', width: '48%', height: '30%',
        background: CREAM, borderRadius: '50% 50% 40% 40%', border: `2px solid ${INK}`,
      }} />
      <div style={{
        position: 'absolute', left: '20%', top: '46%', width: '60%', height: '30%',
        background: CREAM_DIM, borderRadius: '40% 40% 50% 50%', border: `2px solid ${INK}`,
      }} />
      <style jsx>{`
        .jrShield { animation: jrShieldBob 1.4s ease-in-out infinite; }
        @keyframes jrShieldBob { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        @media (prefers-reduced-motion: reduce) { .jrShield { animation: none; } }
      `}</style>
    </div>
  )
})
