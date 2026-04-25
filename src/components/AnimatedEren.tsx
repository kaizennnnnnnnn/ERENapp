'use client'

import { useEffect, useRef, useState } from 'react'

// Full-body animated Eren — idle sway, blink, look around, paw lick, hop.
// Same sprite sheet as the app splash screen, usable on any loading surface.

const IDLE_R = [
  '.KK..........KK.......',
  'KMMK........KMMK......',
  'KMCKK......KKCMK......',
  'KMCCCCCCCCCCCCMK......',
  'KCCCCCCCCCCCCCCCK.....',
  'KCCEEPCCCCEEPCCK......',
  'KCCEWPCCCCEWPCCK......',
  'KCCCCCCCNNCCCCK.......',
  '.KCCCCCKKCCCCK........',
  '..KKCCCCCCCCKKK.......',
  '...KCCCCCCCCCCK..KMMK.',
  '...KCWCCCCCCWCKKMMMK..',
  '...KCCCCCCCCCCKMMMK...',
  '...KCCCCCCCCCCKMMK....',
  '..KKCSSCCCCSSCKKK.....',
  '..K.KK......KK.K.....',
  '.......................',
  '.......................',
]
const IDLE_L = [
  '.KK..........KK.......',
  'KMMK........KMMK......',
  'KMCKK......KKCMK......',
  'KMCCCCCCCCCCCCMK......',
  'KCCCCCCCCCCCCCCCK.....',
  'KCCEEPCCCCEEPCCK......',
  'KCCEWPCCCCEWPCCK......',
  'KCCCCCCCNNCCCCK.......',
  '.KCCCCCKKCCCCK........',
  '..KKCCCCCCCCKKK.......',
  '...KCCCCCCCCCCK.......',
  '...KCWCCCCCCWCK.......',
  '...KCCCCCCCCCCCK......',
  '...KCCCCCCCCCCCKKMMK..',
  '..KKCSSCCCCSSCCKMMMMK.',
  '..K.KK......KK.KKMMK.',
  '.......................',
  '.......................',
]
const BLINK = [
  '.KK..........KK.......',
  'KMMK........KMMK......',
  'KMCKK......KKCMK......',
  'KMCCCCCCCCCCCCMK......',
  'KCCCCCCCCCCCCCCCK.....',
  'KCCCCCCCCCCCCCCK......',
  'KCCKKKCCCKKKCCCK......',
  'KCCCCCCCNNCCCCK.......',
  '.KCCCCCKKCCCCK........',
  '..KKCCCCCCCCKKK.......',
  '...KCCCCCCCCCCK..KMMK.',
  '...KCWCCCCCCWCKKMMMK..',
  '...KCCCCCCCCCCKMMMK...',
  '...KCCCCCCCCCCKMMK....',
  '..KKCSSCCCCSSCKKK.....',
  '..K.KK......KK.K.....',
  '.......................',
  '.......................',
]
const LOOK_R = [
  '.KK..........KK.......',
  'KMMK........KMMK......',
  'KMCKK......KKCMK......',
  'KMCCCCCCCCCCCCMK......',
  'KCCCCCCCCCCCCCCCK.....',
  'KCCCEEPCCCCEEPCCK.....',
  'KCCCCWPCCCCEWPCCK.....',
  'KCCCCCCCNNCCCCK.......',
  '.KCCCCCKKCCCCK........',
  '..KKCCCCCCCCKKK.......',
  '...KCCCCCCCCCCK..KMMK.',
  '...KCWCCCCCCWCKKMMMK..',
  '...KCCCCCCCCCCKMMMK...',
  '...KCCCCCCCCCCKMMK....',
  '..KKCSSCCCCSSCKKK.....',
  '..K.KK......KK.K.....',
  '.......................',
  '.......................',
]
const LOOK_L2 = [
  '.KK..........KK.......',
  'KMMK........KMMK......',
  'KMCKK......KKCMK......',
  'KMCCCCCCCCCCCCMK......',
  'KCCCCCCCCCCCCCCCK.....',
  'KCEEPCCCCEEPCCCK......',
  'KCEWPCCCCEWPCCCK......',
  'KCCCCCCCNNCCCCK.......',
  '.KCCCCCKKCCCCK........',
  '..KKCCCCCCCCKKK.......',
  '...KCCCCCCCCCCK..KMMK.',
  '...KCWCCCCCCWCKKMMMK..',
  '...KCCCCCCCCCCKMMMK...',
  '...KCCCCCCCCCCKMMK....',
  '..KKCSSCCCCSSCKKK.....',
  '..K.KK......KK.K.....',
  '.......................',
  '.......................',
]
const PAW_UP = [
  '.KK..........KK.......',
  'KMMK........KMMK......',
  'KMCKK......KKCMK......',
  'KMCCCCCCCCCCCCMK......',
  'KCCCCCCCCCCCCCCCK.....',
  'KCCEEPCCCCEEPCCK......',
  'KCCEWPCCCCEWPCCK......',
  'KCCCCCCCNNCCCCK.......',
  '.KCCCCCKKCCCCK........',
  '..KKCCCCCCCCKKK.......',
  '..KCSK.CCCCCCCK..KMMK.',
  '..KSK..CWCCWCKKMMMK..',
  '..KK...CCCCCCKMMMK...',
  '.......CCCCCCKMMK....',
  '......KKCSSCKKK......',
  '......K.KK..KK.......',
  '.......................',
  '.......................',
]
const HOP_UP = [
  '.......................',
  '.KK..........KK.......',
  'KMMK........KMMK......',
  'KMCKK......KKCMK......',
  'KMCCCCCCCCCCCCMK......',
  'KCCCCCCCCCCCCCCCK.....',
  'KCCEEPCCCCEEPCCK......',
  'KCCEWPCCCCEWPCCK......',
  'KCCCCCCCNNCCCCK.......',
  '.KCCCCCKKCCCCK........',
  '..KKCCCCCCCCKKK.......',
  '...KCCCCCCCCCCK..KMMK.',
  '...KCWCCCCCCWCKKMMMK..',
  '...KCCCCCCCCCCKMMMK...',
  '...KCCCCCCCCCCKMMK....',
  '..KKCSSCCCCSSCKKK.....',
  '..K.KK......KK.K.....',
  '.......................',
]
const HOP_DN = [
  '.......................',
  '.......................',
  '.KK..........KK.......',
  'KMMK........KMMK......',
  'KMCKK......KKCMK......',
  'KMCCCCCCCCCCCCMK......',
  'KCCCCCCCCCCCCCCCK.....',
  'KCCEEPCCCCEEPCCK......',
  'KCCEWPCCCCEWPCCK......',
  'KCCCCCCCNNCCCCK.......',
  '.KCCCCCKKCCCCK........',
  '..KKCCCCCCCCKKK.......',
  '..KCCCCCCCCCCCK.KMMK..',
  '..KCWCCCCCCCCWKKMMMK..',
  '..KCCCCCCCCCCCCKMMMK..',
  '.KKCSSSCCCCSSSCKKMMK..',
  '.K.KK........KK.KK...',
  '.......................',
]

const PAL: Record<string, string> = {
  '.': 'transparent',
  K: '#2A2030',
  M: '#7E7272',
  C: '#F5F3EF',
  E: '#4898D4',
  P: '#1A1A2E',
  W: '#FFFFFF',
  N: '#F28898',
  S: '#D0CCC4',
}

const SEQUENCE = [
  { f: IDLE_R, d: 350 }, { f: IDLE_L, d: 350 }, { f: IDLE_R, d: 350 }, { f: IDLE_L, d: 300 },
  { f: BLINK,  d: 80  }, { f: IDLE_R, d: 80  }, { f: BLINK,  d: 80  }, { f: IDLE_R, d: 300 },
  { f: LOOK_R, d: 300 }, { f: LOOK_R, d: 250 }, { f: IDLE_R, d: 150 },
  { f: LOOK_L2, d: 300 }, { f: LOOK_L2, d: 250 }, { f: IDLE_R, d: 200 },
  { f: BLINK,  d: 80  }, { f: IDLE_R, d: 300 },
  { f: PAW_UP, d: 250 }, { f: IDLE_R, d: 120 }, { f: PAW_UP, d: 250 },
  { f: IDLE_R, d: 120 }, { f: PAW_UP, d: 200 }, { f: IDLE_R, d: 300 },
  { f: HOP_UP, d: 130 }, { f: IDLE_R, d: 100 }, { f: HOP_DN, d: 130 }, { f: IDLE_R, d: 200 },
  { f: HOP_UP, d: 130 }, { f: IDLE_R, d: 100 }, { f: HOP_DN, d: 130 }, { f: IDLE_R, d: 400 },
  { f: IDLE_L, d: 300 }, { f: IDLE_R, d: 300 },
]

function Sprite({ frame, px }: { frame: string[]; px: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cols = frame[0]?.length ?? 0
  const rows = frame.length

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = cols * px * dpr
    canvas.height = rows * px * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, cols * px, rows * px)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < frame[y].length; x++) {
        const color = PAL[frame[y][x]]
        if (color && color !== 'transparent') {
          ctx.fillStyle = color
          ctx.fillRect(x * px, y * px, px, px)
        }
      }
    }
  }, [frame, px, cols, rows])

  return <canvas ref={canvasRef} style={{ width: cols * px, height: rows * px, imageRendering: 'pixelated' }} />
}

interface Props { px?: number }

export default function AnimatedEren({ px = 5 }: Props) {
  const [fi, setFi] = useState(0)
  const ref = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    function tick() {
      setFi(i => {
        const next = (i + 1) % SEQUENCE.length
        ref.current = setTimeout(tick, SEQUENCE[next].d)
        return next
      })
    }
    ref.current = setTimeout(tick, SEQUENCE[0].d)
    return () => clearTimeout(ref.current)
  }, [])

  return (
    <div style={{ filter: 'drop-shadow(0 0 10px rgba(167,139,250,0.25))' }}>
      <Sprite frame={SEQUENCE[fi].f} px={px} />
    </div>
  )
}
