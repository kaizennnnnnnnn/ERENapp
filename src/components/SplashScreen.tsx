'use client'

import { useState, useEffect } from 'react'

export default function SplashScreen() {
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing')

  useEffect(() => {
    const timer = setTimeout(() => setPhase('fading'), 2800)
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
        width: 320, height: 320,
        left: '50%', top: '40%',
        transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)',
        animation: 'splBreath 3s ease-in-out infinite',
      }} />

      {/* ── Full body Eren ── */}
      <div style={{ animation: 'splBounceIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
        <div style={{
          animation: 'splFloat 3s ease-in-out 0.7s infinite',
          filter: 'drop-shadow(0 0 24px rgba(167,139,250,0.25))',
        }}>
          <svg width="120" height="150" viewBox="0 0 120 150" fill="none">

            {/* ── Tail (behind body, curled right) ── */}
            <path d="M88 105 Q110 100 112 80 Q114 65 105 58"
              stroke="#7E7272" strokeWidth="8" strokeLinecap="round" fill="none"
              style={{ animation: 'splTail 2s ease-in-out infinite' }} />
            <path d="M105 58 Q100 52 102 48"
              stroke="#5A5050" strokeWidth="7" strokeLinecap="round" fill="none"
              style={{ animation: 'splTail 2s ease-in-out infinite' }} />

            {/* ── Body (sitting, white/cream) ── */}
            <ellipse cx="60" cy="108" rx="30" ry="32" fill="#F5F3EF" />
            {/* Body outline */}
            <ellipse cx="60" cy="108" rx="30" ry="32" fill="none" stroke="#D0CCC4" strokeWidth="1" opacity="0.5" />
            {/* Chest fluff */}
            <ellipse cx="60" cy="100" rx="18" ry="14" fill="white" opacity="0.6" />

            {/* ── Front paws ── */}
            <ellipse cx="44" cy="134" rx="8" ry="5" fill="#F5F3EF" stroke="#D0CCC4" strokeWidth="0.8" />
            <ellipse cx="76" cy="134" rx="8" ry="5" fill="#F5F3EF" stroke="#D0CCC4" strokeWidth="0.8" />
            {/* Paw toes */}
            <circle cx="40" cy="134" r="1.5" fill="#E8E4DC" />
            <circle cx="44" cy="135.5" r="1.5" fill="#E8E4DC" />
            <circle cx="48" cy="134" r="1.5" fill="#E8E4DC" />
            <circle cx="72" cy="134" r="1.5" fill="#E8E4DC" />
            <circle cx="76" cy="135.5" r="1.5" fill="#E8E4DC" />
            <circle cx="80" cy="134" r="1.5" fill="#E8E4DC" />

            {/* ── Head ── */}
            <ellipse cx="60" cy="55" rx="30" ry="27" fill="#F5F3EF" />
            <ellipse cx="60" cy="55" rx="30" ry="27" fill="none" stroke="#D0CCC4" strokeWidth="0.8" opacity="0.4" />

            {/* ── Ears ── */}
            {/* Left ear */}
            <path d="M33 42 L22 10 L48 32 Z" fill="#7E7272" />
            <path d="M35 38 L27 16 L45 33 Z" fill="#AEA6A0" opacity="0.6" />
            <path d="M36 35 L30 20 L43 33 Z" fill="#F28898" opacity="0.3" />
            {/* Right ear */}
            <path d="M87 42 L98 10 L72 32 Z" fill="#7E7272" />
            <path d="M85 38 L93 16 L75 33 Z" fill="#AEA6A0" opacity="0.6" />
            <path d="M84 35 L90 20 L77 33 Z" fill="#F28898" opacity="0.3" />

            {/* ── Face markings (dark tabby V on forehead) ── */}
            <path d="M46 38 L60 30 L74 38" stroke="#7E7272" strokeWidth="3" fill="none" opacity="0.35" strokeLinecap="round" />
            {/* Cheek markings */}
            <ellipse cx="38" cy="55" rx="6" ry="8" fill="#AEA6A0" opacity="0.15" />
            <ellipse cx="82" cy="55" rx="6" ry="8" fill="#AEA6A0" opacity="0.15" />

            {/* ── Eyes ── */}
            {/* Left eye white */}
            <ellipse cx="46" cy="52" rx="7" ry="6.5" fill="white" />
            {/* Left iris */}
            <ellipse cx="46" cy="52" rx="5" ry="5.5" fill="#4898D4" />
            {/* Left pupil */}
            <ellipse cx="46" cy="52.5" rx="2.5" ry="3" fill="#1A1A2E" />
            {/* Left eye shine */}
            <circle cx="48.5" cy="50" r="2" fill="white" opacity="0.9" />
            <circle cx="44" cy="54" r="1" fill="white" opacity="0.5" />
            {/* Left eyelid (blinks) */}
            <ellipse cx="46" cy="52" rx="7.5" ry="7" fill="#F5F3EF"
              style={{ transformOrigin: '46px 52px', animation: 'splBlink 4s ease-in-out infinite' }} />

            {/* Right eye white */}
            <ellipse cx="74" cy="52" rx="7" ry="6.5" fill="white" />
            {/* Right iris */}
            <ellipse cx="74" cy="52" rx="5" ry="5.5" fill="#4898D4" />
            {/* Right pupil */}
            <ellipse cx="74" cy="52.5" rx="2.5" ry="3" fill="#1A1A2E" />
            {/* Right eye shine */}
            <circle cx="76.5" cy="50" r="2" fill="white" opacity="0.9" />
            <circle cx="72" cy="54" r="1" fill="white" opacity="0.5" />
            {/* Right eyelid (blinks) */}
            <ellipse cx="74" cy="52" rx="7.5" ry="7" fill="#F5F3EF"
              style={{ transformOrigin: '74px 52px', animation: 'splBlink 4s ease-in-out infinite' }} />

            {/* ── Nose ── */}
            <path d="M57 62 L60 65 L63 62 Z" fill="#F28898" />

            {/* ── Mouth ── */}
            <path d="M54 66.5 Q57 69.5 60 66.5" stroke="#AEA6A0" strokeWidth="1" fill="none" strokeLinecap="round" />
            <path d="M60 66.5 Q63 69.5 66 66.5" stroke="#AEA6A0" strokeWidth="1" fill="none" strokeLinecap="round" />

            {/* ── Whiskers ── */}
            <line x1="14" y1="57" x2="40" y2="60" stroke="white" strokeWidth="0.8" opacity="0.3" />
            <line x1="16" y1="63" x2="40" y2="63" stroke="white" strokeWidth="0.8" opacity="0.3" />
            <line x1="18" y1="69" x2="41" y2="65" stroke="white" strokeWidth="0.8" opacity="0.25" />
            <line x1="106" y1="57" x2="80" y2="60" stroke="white" strokeWidth="0.8" opacity="0.3" />
            <line x1="104" y1="63" x2="80" y2="63" stroke="white" strokeWidth="0.8" opacity="0.3" />
            <line x1="102" y1="69" x2="79" y2="65" stroke="white" strokeWidth="0.8" opacity="0.25" />
          </svg>
        </div>
      </div>

      {/* ── Title ── */}
      <div className="relative z-10 mt-5 flex flex-col items-center" style={{ animation: 'splFadeUp 0.5s ease-out 0.4s both' }}>
        <h1 className="font-pixel text-white" style={{ fontSize: 14, letterSpacing: 3, textShadow: '0 0 24px rgba(167,139,250,0.4)' }}>
          POCKET EREN
        </h1>
        <p className="font-pixel mt-1.5" style={{ fontSize: 6, color: 'rgba(167,139,250,0.4)', letterSpacing: 2 }}>
          your virtual ragdoll
        </p>
      </div>

      {/* ── Dots loader ── */}
      <div className="flex items-center gap-2 mt-8" style={{ animation: 'splFadeUp 0.4s ease-out 0.7s both' }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: 5, height: 5,
              background: '#A78BFA',
              animation: `splDot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes splBounceIn {
          0% { opacity: 0; transform: scale(0.4) translateY(30px); }
          60% { opacity: 1; transform: scale(1.05) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes splFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes splBreath {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.7; }
        }
        @keyframes splBlink {
          0%, 38%, 44%, 100% { transform: scaleY(0); }
          40%, 42% { transform: scaleY(1); }
        }
        @keyframes splTail {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(3deg); }
          60% { transform: rotate(-2deg); }
        }
        @keyframes splFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splDot {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
      `}</style>
    </div>
  )
}
