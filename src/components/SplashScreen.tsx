'use client'

import { useState, useEffect, useRef } from 'react'

// 20 wide x 20 tall — smaller head, bigger body, more action
// K=outline M=dark O=mid_grey C=cream E=blue P=pupil W=white N=pink S=grey_paw .=transparent

// Sitting idle, tail right (curled up from right side)
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

// Sitting idle, tail swooped down
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

// Blink
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

// Look right (eyes shifted)
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

// Look left (eyes shifted)
const LOOK_L2 = [
  '.KK..........KK.......',
  'KMMK........KMMK......',
  'KMCKK......KKCMK......',
  'KMCCCCCCCCCCCCMK......',
  'KCCCCCCCCCCCCCCCK.....',
  'KCCEEPCCCCEEPCCK......',
  'KCCEWPCCCCWPCCK.......',
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

// Paw up (licking / waving)
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

// Hop up
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

// Hop down (squish)
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
  // Idle with tail sway
  { f: IDLE_R, d: 350 },
  { f: IDLE_L, d: 350 },
  { f: IDLE_R, d: 350 },
  { f: IDLE_L, d: 300 },
  // Blink
  { f: BLINK,  d: 80  },
  { f: IDLE_R, d: 80  },
  { f: BLINK,  d: 80  },
  { f: IDLE_R, d: 300 },
  // Look around
  { f: LOOK_R, d: 300 },
  { f: LOOK_R, d: 250 },
  { f: IDLE_R, d: 150 },
  { f: LOOK_L2, d: 300 },
  { f: LOOK_L2, d: 250 },
  { f: IDLE_R, d: 200 },
  // Blink
  { f: BLINK,  d: 80  },
  { f: IDLE_R, d: 300 },
  // Paw lick
  { f: PAW_UP, d: 250 },
  { f: IDLE_R, d: 120 },
  { f: PAW_UP, d: 250 },
  { f: IDLE_R, d: 120 },
  { f: PAW_UP, d: 200 },
  { f: IDLE_R, d: 300 },
  // Little hop
  { f: HOP_UP, d: 130 },
  { f: IDLE_R, d: 100 },
  { f: HOP_DN, d: 130 },
  { f: IDLE_R, d: 200 },
  { f: HOP_UP, d: 130 },
  { f: IDLE_R, d: 100 },
  { f: HOP_DN, d: 130 },
  { f: IDLE_R, d: 400 },
  // Tail sway back to start
  { f: IDLE_L, d: 300 },
  { f: IDLE_R, d: 300 },
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

    // Use device pixel ratio for sharp rendering
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

  return (
    <canvas
      ref={canvasRef}
      style={{ width: cols * px, height: rows * px, imageRendering: 'pixelated' }}
    />
  )
}

export default function SplashScreen() {
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing')
  const [fi, setFi] = useState(0)
  const ref = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const t = setTimeout(() => setPhase('fading'), 3200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (phase === 'fading') {
      const t = setTimeout(() => setPhase('done'), 400)
      return () => clearTimeout(t)
    }
  }, [phase])

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

  if (phase === 'done') return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5"
      style={{
        background: '#0F0A1E',
        opacity: phase === 'fading' ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      <div style={{ filter: 'drop-shadow(0 0 10px rgba(167,139,250,0.15))' }}>
        <Sprite frame={SEQUENCE[fi].f} px={4} />
      </div>

      <h1 className="font-pixel text-white" style={{ fontSize: 11, letterSpacing: 2, opacity: 0.85 }}>
        POCKET EREN
      </h1>

      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-full" style={{
            width: 4, height: 4, background: '#A78BFA',
            animation: `splDot 1s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>

      <style jsx>{`
        @keyframes splDot {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
