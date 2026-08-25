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
  WOOD, WOOD_DK, WOOD_LT, CASE_IN, CASE_IN_LT, BERRY, BERRY_DK, BRASS, BRASS_LT,
} from './parlourTheme'

/** One terrain column. The whole world grid is measured in these. */
export const TILE = 44

/** How tall a floor slab is drawn. */
export const FLOOR_H = 14

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

/** Far shelving that slides by slower than the floor. Placed by the loop. */
export const WallShelf = memo(function WallShelf() {
  return (
    <div style={{ width: 120, height: 26, position: 'absolute', willChange: 'transform' }}>
      <div style={{ position: 'absolute', inset: 0, background: WOOD, border: `2px solid ${INK}`, borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 2, height: 2, background: WOOD_LT }} />
      {[10, 44, 78].map(x => (
        <div key={x} style={{
          position: 'absolute', left: x, top: -12, width: 16, height: 14,
          background: x === 44 ? BERRY : BRASS, border: `2px solid ${INK}`, borderRadius: 3,
        }} />
      ))}
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

/** A dripping syrup pipe hanging from the ceiling. Duck it — never jump it. */
export const Pipe = memo(function Pipe({ w, h }: { w: number; h: number }) {
  return (
    <div style={{ width: w, height: h, position: 'absolute', willChange: 'transform' }}>
      <div style={{ position: 'absolute', inset: 0, background: BRASS, border: `2px solid ${INK}`, borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 2, right: 2, top: 2, height: 2, background: BRASS_LT }} />
      {[4, 18, 32].map(x => (
        <div key={x} style={{
          position: 'absolute', left: x, bottom: -5, width: 4, height: 6,
          background: BERRY, border: `1px solid ${INK}`, borderRadius: '0 0 3px 3px',
        }} />
      ))}
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
