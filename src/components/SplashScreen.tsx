'use client'

import { useState, useEffect } from 'react'

export default function SplashScreen() {
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>('playing')

  useEffect(() => {
    // Minimum splash duration, then fade out
    const timer = setTimeout(() => setPhase('fading'), 2400)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (phase === 'fading') {
      const timer = setTimeout(() => setPhase('done'), 600)
      return () => clearTimeout(timer)
    }
  }, [phase])

  if (phase === 'done') return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(160deg, #1A0E2E 0%, #2D1B4E 40%, #1A0E2E 100%)',
        opacity: phase === 'fading' ? 0 : 1,
        transition: 'opacity 0.6s ease-out',
      }}
    >
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              left: `${(i * 37 + 13) % 100}%`,
              top: `${(i * 53 + 7) % 100}%`,
              background: i % 4 === 0 ? '#C084FC' : i % 3 === 0 ? '#FF6B9D' : 'rgba(255,255,255,0.6)',
              animation: `splashTwinkle ${1.5 + (i % 5) * 0.4}s ease-in-out ${(i % 7) * 0.3}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Floating particles around cat */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {['✦', '♥', '✧', '⭐', '♥', '✦', '✧', '♥'].map((char, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${30 + (i * 7) % 40}%`,
              top: `${25 + (i * 11) % 35}%`,
              fontSize: 8 + (i % 3) * 4,
              color: i % 2 === 0 ? '#C084FC' : '#FF6B9D',
              opacity: 0,
              animation: `splashFloat ${2 + (i % 3) * 0.5}s ease-in-out ${0.3 + i * 0.25}s infinite`,
            }}
          >
            {char}
          </div>
        ))}
      </div>

      {/* Eren cat — bounces in */}
      <div
        className="relative z-10 mb-2"
        style={{ animation: 'splashBounceIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
      >
        {/* Glow ring behind cat */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            transform: 'scale(1.4)',
            background: 'radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%)',
            animation: 'splashPulseGlow 2s ease-in-out infinite',
          }}
        />
        <img
          src="/erenGood.png"
          alt="Eren"
          draggable={false}
          style={{
            width: 140,
            height: 140,
            objectFit: 'contain',
            imageRendering: 'pixelated',
            filter: 'drop-shadow(0 0 20px rgba(167,139,250,0.4))',
            animation: 'splashCatFloat 2.5s ease-in-out 0.8s infinite',
          }}
        />
      </div>

      {/* Paw prints walking in */}
      <div className="flex items-center gap-3 mb-6 relative z-10">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              fontSize: 14,
              opacity: 0,
              animation: `splashPawStep 0.4s ease-out ${0.4 + i * 0.3}s forwards`,
            }}
          >
            🐾
          </div>
        ))}
      </div>

      {/* Title */}
      <div
        className="relative z-10 flex flex-col items-center"
        style={{ animation: 'splashFadeUp 0.6s ease-out 0.5s both' }}
      >
        <h1
          className="font-pixel text-white mb-2"
          style={{
            fontSize: 16,
            letterSpacing: 2,
            textShadow: '0 0 20px rgba(167,139,250,0.6), 0 0 40px rgba(167,139,250,0.3)',
          }}
        >
          POCKET EREN
        </h1>
        <div className="flex items-center gap-1.5">
          <div
            className="h-px flex-1"
            style={{
              width: 40,
              background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)',
            }}
          />
          <span
            className="font-pixel"
            style={{
              fontSize: 6,
              color: 'rgba(167,139,250,0.6)',
              letterSpacing: 3,
            }}
          >
            MEOW
          </span>
          <div
            className="h-px flex-1"
            style={{
              width: 40,
              background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)',
            }}
          />
        </div>
      </div>

      {/* Loading bar */}
      <div
        className="relative z-10 mt-8"
        style={{
          width: 160,
          animation: 'splashFadeUp 0.5s ease-out 0.8s both',
        }}
      >
        <div
          className="overflow-hidden"
          style={{
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(167,139,250,0.15)',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 2,
              background: 'linear-gradient(90deg, #7C3AED, #A78BFA, #C084FC, #FF6B9D)',
              backgroundSize: '200% 100%',
              animation: 'splashLoadBar 2s ease-in-out forwards, splashShimmer 1.5s linear infinite',
            }}
          />
        </div>
        <p
          className="font-pixel text-center mt-3"
          style={{
            fontSize: 6,
            color: 'rgba(167,139,250,0.5)',
            animation: 'splashPulseText 1.2s ease-in-out infinite',
          }}
        >
          WAKING UP EREN<span style={{ animation: 'splashDots 1.5s steps(4) infinite' }}>...</span>
        </p>
      </div>

      <style jsx>{`
        @keyframes splashTwinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        @keyframes splashBounceIn {
          0% { opacity: 0; transform: scale(0.3) translateY(40px); }
          60% { opacity: 1; transform: scale(1.08) translateY(-5px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes splashCatFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes splashPulseGlow {
          0%, 100% { opacity: 0.6; transform: scale(1.4); }
          50% { opacity: 1; transform: scale(1.6); }
        }
        @keyframes splashPawStep {
          0% { opacity: 0; transform: scale(0) translateY(10px); }
          60% { opacity: 1; transform: scale(1.2) translateY(-2px); }
          100% { opacity: 0.7; transform: scale(1) translateY(0); }
        }
        @keyframes splashFadeUp {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashFloat {
          0%, 100% { opacity: 0; transform: translateY(0) scale(0.8); }
          30% { opacity: 0.7; }
          50% { opacity: 0.5; transform: translateY(-15px) scale(1); }
          70% { opacity: 0.3; }
        }
        @keyframes splashLoadBar {
          0% { width: 0%; }
          30% { width: 40%; }
          60% { width: 70%; }
          100% { width: 100%; }
        }
        @keyframes splashShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes splashPulseText {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes splashDots {
          0% { content: ''; }
          25% { content: '.'; }
          50% { content: '..'; }
          75% { content: '...'; }
        }
      `}</style>
    </div>
  )
}
