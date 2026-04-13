'use client'

import { useState, useEffect } from 'react'

export default function SplashScreen() {
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing')

  useEffect(() => {
    const timer = setTimeout(() => setPhase('fading'), 2600)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (phase === 'fading') {
      const timer = setTimeout(() => setPhase('done'), 500)
      return () => clearTimeout(timer)
    }
  }, [phase])

  if (phase === 'done') return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: '#0F0A1E',
        opacity: phase === 'fading' ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      {/* Subtle radial glow */}
      <div className="absolute" style={{
        width: 300, height: 300,
        left: '50%', top: '42%',
        transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
        animation: 'splashBreath 3s ease-in-out infinite',
      }} />

      {/* ── Cat face icon ── */}
      <div style={{ animation: 'splashFadeIn 0.6s ease-out both' }}>
        <div style={{ animation: 'splashFloat 3s ease-in-out 0.6s infinite' }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ filter: 'drop-shadow(0 0 20px rgba(167,139,250,0.3))' }}>
            {/* Left ear */}
            <path d="M16 32 L10 8 L28 22 Z" fill="#A78BFA" opacity="0.9" />
            <path d="M17 28 L14 14 L26 23 Z" fill="#C4B5FD" opacity="0.4" />
            {/* Right ear */}
            <path d="M64 32 L70 8 L52 22 Z" fill="#A78BFA" opacity="0.9" />
            <path d="M63 28 L66 14 L54 23 Z" fill="#C4B5FD" opacity="0.4" />
            {/* Head */}
            <ellipse cx="40" cy="44" rx="26" ry="24" fill="rgba(167,139,250,0.15)" stroke="#A78BFA" strokeWidth="1.5" strokeOpacity="0.6" />
            {/* Eyes */}
            <ellipse cx="30" cy="42" rx="3.5" ry="4" fill="#A78BFA" style={{ animation: 'splashBlink 4s ease-in-out infinite' }} />
            <ellipse cx="50" cy="42" rx="3.5" ry="4" fill="#A78BFA" style={{ animation: 'splashBlink 4s ease-in-out infinite' }} />
            {/* Eye shines */}
            <circle cx="31.5" cy="40.5" r="1.2" fill="white" opacity="0.8" />
            <circle cx="51.5" cy="40.5" r="1.2" fill="white" opacity="0.8" />
            {/* Nose */}
            <ellipse cx="40" cy="49" rx="2.2" ry="1.5" fill="#FF6B9D" opacity="0.7" />
            {/* Mouth */}
            <path d="M37 51 Q40 54 43 51" stroke="#A78BFA" strokeWidth="1" fill="none" opacity="0.4" strokeLinecap="round" />
            {/* Whiskers */}
            <line x1="10" y1="45" x2="25" y2="47" stroke="#A78BFA" strokeWidth="0.7" opacity="0.25" />
            <line x1="10" y1="50" x2="25" y2="49" stroke="#A78BFA" strokeWidth="0.7" opacity="0.25" />
            <line x1="70" y1="45" x2="55" y2="47" stroke="#A78BFA" strokeWidth="0.7" opacity="0.25" />
            <line x1="70" y1="50" x2="55" y2="49" stroke="#A78BFA" strokeWidth="0.7" opacity="0.25" />
          </svg>
        </div>
      </div>

      {/* ── Title ── */}
      <div className="relative z-10 mt-6" style={{ animation: 'splashFadeIn 0.5s ease-out 0.3s both' }}>
        <h1 className="font-pixel text-white" style={{ fontSize: 14, letterSpacing: 3, textShadow: '0 0 24px rgba(167,139,250,0.4)' }}>
          POCKET EREN
        </h1>
      </div>

      {/* ── Dots loader ── */}
      <div className="flex items-center gap-2 mt-8" style={{ animation: 'splashFadeIn 0.5s ease-out 0.6s both' }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: 6, height: 6,
              background: '#A78BFA',
              animation: `splashDot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes splashFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes splashBreath {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
        }
        @keyframes splashBlink {
          0%, 40%, 44%, 100% { transform: scaleY(1); }
          42% { transform: scaleY(0.1); }
        }
        @keyframes splashDot {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>
    </div>
  )
}
