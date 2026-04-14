'use client'

import { useState, useEffect, useRef } from 'react'

// ── Chibi Eren sprite frames (18 wide) ──
// K=outline M=dark_fur C=cream E=blue_eye P=pupil W=white N=pink S=grey .=transparent

// Frame 1: idle, eyes open, tail right
const F_IDLE1 = [
  '..KK..........KK..',
  '.KMMK........KMMK.',
  'KMMNK........KNMMK',
  'KMMCCCCCCCCCCCCMMK',
  'KMCCCCCCCCCCCCCCMK',
  'KCCCCCCCCCCCCCCCCK',
  'KCCCEEPCCCCCEEPCCK',
  'KCCCEWPCCCCCEWPCCK',
  'KCCCEEPCCCCCEEPCCK',
  '.KCCCCCCCNNCCCCCCK',
  '.KCCCCCCCKKCCCCCCK',
  '..KCCCCCCCCCCCCCCK',
  '...KKKCCCCCCKKK...',
  '....KCCCWWCCCCCK..',
  '....KCCWWWWCCCK...',
  '....KCCCCCCCCCCK..',
  '...KKCSSCCCCSSCCK.',
  '...K.KK.....KK..K.',
  '..........KMMMMK..',
  '...........KMMK...',
]

// Frame 2: idle, eyes open, tail up
const F_IDLE2 = [
  '..KK..........KK..',
  '.KMMK........KMMK.',
  'KMMNK........KNMMK',
  'KMMCCCCCCCCCCCCMMK',
  'KMCCCCCCCCCCCCCCMK',
  'KCCCCCCCCCCCCCCCCK',
  'KCCCEEPCCCCCEEPCCK',
  'KCCCEWPCCCCCEWPCCK',
  'KCCCEEPCCCCCEEPCCK',
  '.KCCCCCCCNNCCCCCCK',
  '.KCCCCCCCKKCCCCCCK',
  '..KCCCCCCCCCCCCCCK',
  '...KKKCCCCCCKKK...',
  '....KCCCWWCCCCK...',
  '....KCCWWWWCCCK...',
  '....KCCCCCCCCCCK..',
  '...KKCSSCCCCSSCCK.',
  '...K.KK.....KK..K.',
  '...........KMMK...',
  '..........KMMMMK..',
]

// Frame 3: blink (eyes closed)
const F_BLINK = [
  '..KK..........KK..',
  '.KMMK........KMMK.',
  'KMMNK........KNMMK',
  'KMMCCCCCCCCCCCCMMK',
  'KMCCCCCCCCCCCCCCMK',
  'KCCCCCCCCCCCCCCCCK',
  'KCCCCCCCCCCCCCCCCK',
  'KCCCKKKCCCCCKKKCCCK',
  'KCCCCCCCCCCCCCCCCK',
  '.KCCCCCCCNNCCCCCCK',
  '.KCCCCCCCKKCCCCCCK',
  '..KCCCCCCCCCCCCCCK',
  '...KKKCCCCCCKKK...',
  '....KCCCWWCCCCK...',
  '....KCCWWWWCCCK...',
  '....KCCCCCCCCCCK..',
  '...KKCSSCCCCSSCCK.',
  '...K.KK.....KK..K.',
  '..........KMMMMK..',
  '...........KMMK...',
]

// Frame 4: squish down (bounce bottom)
const F_SQUISH = [
  '..................',
  '..KK..........KK..',
  '.KMMK........KMMK.',
  'KMMNK........KNMMK',
  'KMMCCCCCCCCCCCCMMK',
  'KMCCCCCCCCCCCCCCMK',
  'KCCCCCCCCCCCCCCCCK',
  'KCCCEEPCCCCCEEPCCK',
  'KCCCEWPCCCCCEWPCCK',
  'KCCCEEPCCCCCEEPCCK',
  '.KCCCCCCCNNCCCCCCK',
  '.KCCCCCCCKKCCCCCCK',
  '..KCCCCCCCCCCCCCK.',
  '...KKKCCCCCCKKKK..',
  '...KCCCWWWWCCCK...',
  '...KCCCCCCCCCCCK..',
  '..KKCSSCCCCSSCCKK.',
  '..K.KK......KK.K..',
  '.........KMMMMK...',
  '..........KMMK....',
]

// Frame 5: stretch up (bounce top)
const F_STRETCH = [
  '..KK..........KK..',
  '.KMMK........KMMK.',
  'KMMNK........KNMMK',
  'KMMCCCCCCCCCCCCMMK',
  'KMCCCCCCCCCCCCCCMK',
  'KCCCCCCCCCCCCCCCCK',
  'KCCCEEPCCCCCEEPCCK',
  'KCCCEWPCCCCCEWPCCK',
  'KCCCEEPCCCCCEEPCCK',
  '.KCCCCCCCNNCCCCCCK',
  '.KCCCCCCCKKCCCCCCK',
  '..KCCCCCCCCCCCCCCK',
  '...KKKCCCCCCKKK...',
  '....KCCCWWCCCCK...',
  '....KCCWWWWCCCK...',
  '....KCCCCCCCCCCK..',
  '....KCCCCCCCCCCK..',
  '...KKCSSCCCCSSCCK.',
  '...K.KK.....KK..K.',
  '..........KMMMMK..',
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

// Animation sequence: idle1, idle1, idle2, idle2, idle1, blink, idle1, squish, stretch, idle1...
const SEQUENCE = [
  { frame: F_IDLE1, dur: 300 },
  { frame: F_IDLE1, dur: 300 },
  { frame: F_IDLE2, dur: 300 },
  { frame: F_IDLE2, dur: 300 },
  { frame: F_IDLE1, dur: 300 },
  { frame: F_IDLE1, dur: 400 },
  { frame: F_BLINK, dur: 100 },
  { frame: F_IDLE1, dur: 100 },
  { frame: F_BLINK, dur: 100 },
  { frame: F_IDLE1, dur: 400 },
  { frame: F_SQUISH, dur: 150 },
  { frame: F_STRETCH, dur: 150 },
  { frame: F_IDLE1, dur: 200 },
  { frame: F_SQUISH, dur: 120 },
  { frame: F_STRETCH, dur: 120 },
  { frame: F_IDLE1, dur: 350 },
]

function SpriteRenderer({ frame, px }: { frame: string[]; px: number }) {
  return (
    <div style={{ lineHeight: 0, imageRendering: 'pixelated' }}>
      {frame.map((row, y) => (
        <div key={y} style={{ display: 'flex', height: px }}>
          {row.split('').map((ch, x) => (
            <div key={x} style={{ width: px, height: px, background: PAL[ch] ?? 'transparent' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function SplashScreen() {
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing')
  const [frameIdx, setFrameIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Fade out after delay
  useEffect(() => {
    const timer = setTimeout(() => setPhase('fading'), 2800)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (phase === 'fading') {
      const timer = setTimeout(() => setPhase('done'), 400)
      return () => clearTimeout(timer)
    }
  }, [phase])

  // Sprite animation loop
  useEffect(() => {
    function tick() {
      setFrameIdx(i => {
        const next = (i + 1) % SEQUENCE.length
        timerRef.current = setTimeout(tick, SEQUENCE[next].dur)
        return next
      })
    }
    timerRef.current = setTimeout(tick, SEQUENCE[0].dur)
    return () => clearTimeout(timerRef.current)
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
        <SpriteRenderer frame={SEQUENCE[frameIdx].frame} px={5} />
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
