'use client'

// ─── RoomScene ───────────────────────────────────────────────────────────────
// The two screens set in the living room (O9 "{cat} is home.", J1 "Meet
// {cat}"): the room fills the screen, the cat stands on the rug, and a white
// sheet rises over the bottom with the words and the button.
//
// Everything above the sheet is laid out in the boards' own coordinates (a
// 390x486 box whose bottom edge is the sheet's top) and anchored to the rug.
// On a taller or wider phone the room grows to keep covering the screen and
// the cat stays on the rug; on a short phone the cat and its bubble shrink
// around the rug so the bubble never slides under the status bar.
//
// A full screen with nothing to type, so it can be position:fixed (inside the
// desktop frame, fixed scopes to the frame).

import { useRef, type CSSProperties, type ReactNode } from 'react'
import { M } from '@/components/meadow'
import { useBoxSize } from './useBoxSize'

const SHEET_H = 358          // the board's sheet: y 486 to the bottom of 844 (its minimum)
const SHEET_GAP = 16         // between the sheet's words and its pinned button
const BUTTON_BOTTOM = 34     // the button's distance from the bottom edge (at least)
const DESIGN_H = 486         // the board's scene above the sheet
const RUG = { x: 214, y: 424 } // the rug's centre in board coordinates (the cat stands here)
const TOP_ROOM = 48          // keep the highest bubble at least this far below the top
const BOTTOM = 'max(34px, env(safe-area-inset-bottom, 0px))'

interface Props {
  /** Scene pieces (cat, shadow, bubble, sparkles), absolutely placed in board coordinates. */
  scene: ReactNode
  /** How far above the sheet the scene's top piece reaches (board px), to fit short phones. */
  sceneReach: number
  /** The sheet's words. */
  sheet: ReactNode
  /** Pinned actions at the bottom of the sheet. */
  footer: ReactNode
  label: string
}

export default function RoomScene({ scene, sceneReach, sheet, footer, label }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const { w, h } = useBoxSize(rootRef, { w: 390, h: 844 })
  // The sheet is the board's 358px unless its words wrap (a narrow phone, a
  // long name); then it grows so they never run under the button.
  const words = useBoxSize(wordsRef, { w: 390, h: 250 }).h
  const foot = useBoxSize(footRef, { w: 342, h: 54 }).h
  const sheetH = Math.max(SHEET_H, words + SHEET_GAP + foot + BUTTON_BOTTOM + 4)
  const sheetTop = h - sheetH
  const scale = Math.min(1, Math.max(0.6, (sheetTop - TOP_ROOM) / sceneReach))

  // The room image (500x896 on the board, rug at 64.8% / 73.66% of it) is
  // sized to cover the whole screen with the rug held under the cat.
  const rugX = w / 2 + (RUG.x - 195)
  const rugY = sheetTop - (DESIGN_H - RUG.y)
  const imgW = Math.max(500, (w - rugX) / 0.352, rugX / 0.648, rugY / 1.32) + 2
  const imgH = imgW * 1.792

  return (
    <div ref={rootRef} className="meadow-root" aria-label={label} role="region" style={{
      position: 'fixed', inset: 0, overflow: 'hidden', background: M.ground,
    }}>
      {/* The room is decoration; the cat's own label says who is in it. */}
      <img
        src="/HomeDay.png"
        alt=""
        draggable={false}
        style={{
          position: 'absolute', left: rugX - 0.648 * imgW, top: rugY - 0.7366 * imgH, width: imgW, height: imgH,
          maxWidth: 'none',
        }}
      />
      <div style={{
        position: 'absolute', left: w / 2 - 195, top: sheetTop - DESIGN_H, width: 390, height: DESIGN_H,
        transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: `${RUG.x}px ${RUG.y}px`,
      }}>
        {scene}
      </div>
      <div className="m-sheet-in" style={{ position: 'absolute', left: 0, right: 0, top: sheetTop, bottom: 0 }}>
        <div style={{
          position: 'absolute', inset: 0, boxSizing: 'border-box', borderRadius: '28px 28px 0 0', background: M.ground,
          overflow: 'hidden',
        }}>
          <div ref={wordsRef}>{sheet}</div>
        </div>
        <div ref={footRef} style={{
          position: 'absolute', left: 24, right: 24, bottom: BOTTOM, display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        }}>
          {footer}
        </div>
      </div>
    </div>
  )
}

/** Absolute placement in board coordinates, for scene pieces. */
export function at(left: number, top: number, extra?: CSSProperties): CSSProperties {
  return { position: 'absolute', left, top, ...extra }
}
