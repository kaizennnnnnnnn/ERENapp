'use client'

import { useState, useEffect } from 'react'

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
      {/* Tiny Eren — small, simple, looping */}
      <div style={{ animation: 'splBob 1.6s ease-in-out infinite' }}>
        <svg width="48" height="52" viewBox="0 0 48 52" fill="none">
          {/* Tail */}
          <path d="M38 36 Q46 32 45 26" stroke="#8B7B6B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          {/* Body */}
          <ellipse cx="24" cy="38" rx="14" ry="12" fill="#F0EDE8" />
          {/* Chest */}
          <ellipse cx="24" cy="36" rx="8" ry="6" fill="white" opacity="0.5" />
          {/* Head */}
          <ellipse cx="24" cy="22" rx="14" ry="12" fill="#F0EDE8" />
          {/* Left ear */}
          <path d="M13 17 L8 4 L20 14 Z" fill="#8B7B6B" />
          <path d="M14 15 L11 7 L19 14 Z" fill="#E8B0B8" opacity="0.4" />
          {/* Right ear */}
          <path d="M35 17 L40 4 L28 14 Z" fill="#8B7B6B" />
          <path d="M34 15 L37 7 L29 14 Z" fill="#E8B0B8" opacity="0.4" />
          {/* Eyes */}
          <ellipse cx="18" cy="21" rx="3" ry="3.2" fill="#4898D4" />
          <ellipse cx="30" cy="21" rx="3" ry="3.2" fill="#4898D4" />
          <circle cx="18" cy="21" r="1.5" fill="#1A1A2E" />
          <circle cx="30" cy="21" r="1.5" fill="#1A1A2E" />
          <circle cx="19.2" cy="19.8" r="1" fill="white" opacity="0.85" />
          <circle cx="31.2" cy="19.8" r="1" fill="white" opacity="0.85" />
          {/* Blink lids */}
          <ellipse cx="18" cy="21" rx="3.5" ry="3.5" fill="#F0EDE8"
            style={{ transformOrigin: '18px 21px', animation: 'splBlink 3.5s ease-in-out infinite' }} />
          <ellipse cx="30" cy="21" rx="3.5" ry="3.5" fill="#F0EDE8"
            style={{ transformOrigin: '30px 21px', animation: 'splBlink 3.5s ease-in-out infinite' }} />
          {/* Nose */}
          <path d="M22.5 25.5 L24 27.5 L25.5 25.5 Z" fill="#F28898" />
          {/* Mouth */}
          <path d="M21.5 28 Q24 30 26.5 28" stroke="#C0B8B0" strokeWidth="0.7" fill="none" strokeLinecap="round" />
          {/* Paws */}
          <ellipse cx="18" cy="47" rx="5" ry="3" fill="#F0EDE8" />
          <ellipse cx="30" cy="47" rx="5" ry="3" fill="#F0EDE8" />
        </svg>
      </div>

      {/* Title */}
      <h1 className="font-pixel text-white" style={{ fontSize: 11, letterSpacing: 2, opacity: 0.85 }}>
        POCKET EREN
      </h1>

      {/* Dots */}
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
        @keyframes splBlink {
          0%, 36%, 42%, 100% { transform: scaleY(0); }
          38%, 40% { transform: scaleY(1); }
        }
        @keyframes splDot {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
