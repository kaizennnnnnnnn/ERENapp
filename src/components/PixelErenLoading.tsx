'use client'

import { useEffect, useRef, useState } from 'react'

// Tiny 12×14 loaf Eren — used only on loading screens
// Simpler, rounder, cuter than the main interactive PixelEren

const PAL: Record<string, string> = {
  '.': 'transparent',
  C: '#F9EDD5', // cream
  M: '#9B7A5C', // brown mask
  K: '#4A2E1A', // dark
  E: '#6BAED6', // blue eye
  P: '#1A1A2E', // pupil
  N: '#F48B9B', // pink nose
  B: '#EDE0C8', // muzzle
  W: '#FFFFFF', // highlight
}

// Two frames: eyes open / eyes closed (slow blink loop)
const FRAMES: string[][] = [
  // Frame A — eyes open
  [
    '...KK..KK...',   //  0  ear tips
    '..KMMK.KMK..',   //  1  ears
    '..MMMMMMMM..',   //  2  ear base / head top
    '.MMMMMMMMMM.',   //  3  head
    'MMMMMMMMMMMM',   //  4  head widest
    'MM.EPE.EPE.M',   //  5  eyes (left & right)
    'MMMMMMNMMMMM',   //  6  nose (N in middle)
    'MBBBBBBBBBMM',   //  7  muzzle
    '.BBBBBBBBBB.',   //  8  chin
    '..CCCCCCCC..',   //  9  chest / body loaf
    '..CCCCCCCC..',   // 10  body
    '..CKKCCKKC..',   // 11  paws
    '...KK..KK...',   // 12  paw tips
    '....MMMM....',   // 13  tail curl
  ],
  // Frame B — eyes half-closed (sleepy blink)
  [
    '...KK..KK...',
    '..KMMK.KMK..',
    '..MMMMMMMM..',
    '.MMMMMMMMMM.',
    'MMMMMMMMMMMM',
    'MM.MMM.MMM.M',   // lids down
    'MMMMMMNMMMMM',
    'MBBBBBBBBBMM',
    '.BBBBBBBBBB.',
    '..CCCCCCCC..',
    '..CCCCCCCC..',
    '..CKKCCKKC..',
    '...KK..KK...',
    '....MMMM....',
  ],
]

interface Props {
  size?: number   // px per pixel (default 8)
}

export default function PixelErenLoading({ size = 8 }: Props) {
  const [frame, setFrame] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Stay on frame 0 for a while, briefly close eyes, reopen
    function schedule() {
      timerRef.current = setTimeout(() => {
        setFrame(1)                          // close eyes
        timerRef.current = setTimeout(() => {
          setFrame(0)                        // open eyes
          schedule()                         // reschedule
        }, 200)
      }, 2500 + Math.random() * 3000)
    }
    schedule()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const grid = FRAMES[frame]

  return (
    <div
      className="pixel-art inline-block select-none"
      style={{ lineHeight: 0 }}
      aria-label="Loading…"
    >
      {grid.map((row, y) => (
        <div key={y} style={{ display: 'flex' }}>
          {row.split('').map((char, x) => (
            <div
              key={x}
              style={{
                width: size,
                height: size,
                backgroundColor: PAL[char] ?? 'transparent',
                imageRendering: 'pixelated',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
