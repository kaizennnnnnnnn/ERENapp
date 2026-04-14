'use client'

import { useState, useEffect } from 'react'

// Chibi gacha-style pixel Eren (18 wide x 20 tall)
// Big head, huge blue eyes, tiny body, stubby paws — Ragdoll colors
const SPRITE = [
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
  '...KKKCCCCCCCCKKK.',
  '....KCCCWWCCCCCK..',
  '....KCCWWWWCCCK...',
  '....KCCCCCCCCCCK..',
  '...KKCSSCCCCSSCCK.',
  '...K.KK.....KK.K.',
  '..........KMMMMK..',
  '...........KMMK...',
]

const PAL: Record<string, string> = {
  '.': 'transparent',
  K: '#2A2030',
  M: '#7E7272',
  C: '#F5F3EF',
  E: '#4898D4',
  P: '#1A1A2E',
  p: '#1A1A2E',
  W: '#FFFFFF',
  w: '#FFFFFF',
  N: '#F28898',
  S: '#D0CCC4',
}

function ChibiEren({ px = 4 }: { px?: number }) {
  return (
    <div style={{ lineHeight: 0 }}>
      {SPRITE.map((row, y) => (
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

  useEffect(() => {
    const timer = setTimeout(() => setPhase('fading'), 2400)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (phase === 'fading') {
      const timer = setTimeout(() => setPhase('done'), 400)
      return () => clearTimeout(timer)
    }
  }, [phase])

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
      <div style={{
        animation: 'splBob 1.6s ease-in-out infinite',
        filter: 'drop-shadow(0 0 10px rgba(167,139,250,0.15))',
      }}>
        <ChibiEren px={5} />
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
        @keyframes splBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes splDot {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
