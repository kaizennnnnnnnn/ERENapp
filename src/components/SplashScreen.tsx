'use client'

import { useState, useEffect } from 'react'

/* ─── Pixel Eren — pure CSS Ragdoll cat ─── */
function PixelCat() {
  const P = 5 // pixel size
  // Ragdoll colors
  const cream  = '#F5E6D3'
  const point  = '#8B7355' // seal point (ears, face mask, paws, tail)
  const dark   = '#6B5642'
  const nose   = '#E8A0B0'
  const eye    = '#6BA4D6' // blue ragdoll eyes
  const eyeD   = '#4A80B8'
  const white  = '#FFF8F0'
  const cheek  = '#FFD0D8'

  return (
    <div className="relative" style={{ width: P * 22, height: P * 22 }}>
      {/* ── Ears ── */}
      {/* Left ear outer */}
      <div style={{ position:'absolute', left: P*4, top: 0, width: P*3, height: P*4, background: point, borderRadius: `${P}px ${P}px 0 0` }} />
      {/* Left ear inner */}
      <div style={{ position:'absolute', left: P*5, top: P, width: P, height: P*2, background: nose, borderRadius: P/2 }} />
      {/* Right ear outer */}
      <div style={{ position:'absolute', left: P*15, top: 0, width: P*3, height: P*4, background: point, borderRadius: `${P}px ${P}px 0 0` }} />
      {/* Right ear inner */}
      <div style={{ position:'absolute', left: P*16, top: P, width: P, height: P*2, background: nose, borderRadius: P/2 }} />

      {/* ── Head ── */}
      <div style={{ position:'absolute', left: P*3, top: P*3, width: P*16, height: P*10, background: cream, borderRadius: P*3 }} />
      {/* Forehead point marking (V shape) */}
      <div style={{ position:'absolute', left: P*9, top: P*3.5, width: P*4, height: P*2, background: point, borderRadius: P, opacity: 0.35 }} />

      {/* ── Eyes ── */}
      {/* Left eye */}
      <div style={{ position:'absolute', left: P*6, top: P*6.5, width: P*3, height: P*2.5, background: eye, borderRadius: '50%', boxShadow: `inset 0 ${P*0.5}px 0 ${eyeD}` }} />
      {/* Left pupil */}
      <div style={{ position:'absolute', left: P*7, top: P*7, width: P*1.2, height: P*1.5, background: '#1A1A2E', borderRadius: '50%' }} />
      {/* Left eye shine */}
      <div style={{ position:'absolute', left: P*7.5, top: P*6.8, width: P*0.7, height: P*0.7, background: 'white', borderRadius: '50%' }} />
      {/* Left eyelid — blinks */}
      <div style={{ position:'absolute', left: P*5.8, top: P*6.3, width: P*3.4, height: P*2.8, background: cream, borderRadius: '50%', animation: 'catBlink 4s ease-in-out infinite', transformOrigin: 'center top' }} />

      {/* Right eye */}
      <div style={{ position:'absolute', left: P*13, top: P*6.5, width: P*3, height: P*2.5, background: eye, borderRadius: '50%', boxShadow: `inset 0 ${P*0.5}px 0 ${eyeD}` }} />
      {/* Right pupil */}
      <div style={{ position:'absolute', left: P*14, top: P*7, width: P*1.2, height: P*1.5, background: '#1A1A2E', borderRadius: '50%' }} />
      {/* Right eye shine */}
      <div style={{ position:'absolute', left: P*14.5, top: P*6.8, width: P*0.7, height: P*0.7, background: 'white', borderRadius: '50%' }} />
      {/* Right eyelid — blinks */}
      <div style={{ position:'absolute', left: P*12.8, top: P*6.3, width: P*3.4, height: P*2.8, background: cream, borderRadius: '50%', animation: 'catBlink 4s ease-in-out infinite', transformOrigin: 'center top' }} />

      {/* ── Nose ── */}
      <div style={{ position:'absolute', left: P*10, top: P*9, width: P*2, height: P*1.2, background: nose, borderRadius: `0 0 ${P}px ${P}px` }} />

      {/* ── Mouth lines ── */}
      <div style={{ position:'absolute', left: P*9.5, top: P*10, width: P*1.2, height: P*0.6, borderRight: `${P*0.4}px solid ${dark}`, borderBottom: `${P*0.4}px solid ${dark}`, borderRadius: `0 0 ${P}px 0` }} />
      <div style={{ position:'absolute', left: P*11.3, top: P*10, width: P*1.2, height: P*0.6, borderLeft: `${P*0.4}px solid ${dark}`, borderBottom: `${P*0.4}px solid ${dark}`, borderRadius: `0 0 0 ${P}px` }} />

      {/* ── Cheeks ── */}
      <div style={{ position:'absolute', left: P*4.5, top: P*8.5, width: P*2.5, height: P*1.5, background: cheek, borderRadius: '50%', opacity: 0.4 }} />
      <div style={{ position:'absolute', left: P*15, top: P*8.5, width: P*2.5, height: P*1.5, background: cheek, borderRadius: '50%', opacity: 0.4 }} />

      {/* ── Whiskers ── */}
      {/* Left whiskers */}
      <div style={{ position:'absolute', left: P*1, top: P*8.5, width: P*5, height: P*0.3, background: white, borderRadius: P, opacity: 0.5, transform: 'rotate(-5deg)' }} />
      <div style={{ position:'absolute', left: P*1.5, top: P*9.5, width: P*4.5, height: P*0.3, background: white, borderRadius: P, opacity: 0.5, transform: 'rotate(5deg)' }} />
      {/* Right whiskers */}
      <div style={{ position:'absolute', left: P*16, top: P*8.5, width: P*5, height: P*0.3, background: white, borderRadius: P, opacity: 0.5, transform: 'rotate(5deg)' }} />
      <div style={{ position:'absolute', left: P*16.5, top: P*9.5, width: P*4.5, height: P*0.3, background: white, borderRadius: P, opacity: 0.5, transform: 'rotate(-5deg)' }} />

      {/* ── Body ── */}
      <div style={{ position:'absolute', left: P*4, top: P*12, width: P*14, height: P*8, background: cream, borderRadius: `${P*2}px ${P*2}px ${P*3}px ${P*3}px` }} />
      {/* Chest fluff */}
      <div style={{ position:'absolute', left: P*7.5, top: P*12, width: P*7, height: P*4, background: white, borderRadius: `${P}px ${P}px ${P*3}px ${P*3}px`, opacity: 0.6 }} />

      {/* ── Front paws ── */}
      <div style={{ position:'absolute', left: P*4, top: P*18, width: P*4, height: P*3, background: point, borderRadius: `0 0 ${P*1.5}px ${P*1.5}px` }} />
      {/* Paw pads */}
      <div style={{ position:'absolute', left: P*5, top: P*19.5, width: P*2, height: P*1, background: nose, borderRadius: P, opacity: 0.6 }} />
      <div style={{ position:'absolute', left: P*14, top: P*18, width: P*4, height: P*3, background: point, borderRadius: `0 0 ${P*1.5}px ${P*1.5}px` }} />
      <div style={{ position:'absolute', left: P*15, top: P*19.5, width: P*2, height: P*1, background: nose, borderRadius: P, opacity: 0.6 }} />

      {/* ── Tail — wags ── */}
      <div style={{
        position:'absolute', left: P*17, top: P*13, width: P*6, height: P*2.5,
        background: `linear-gradient(90deg, ${cream}, ${point})`,
        borderRadius: `0 ${P*3}px ${P*3}px 0`,
        transformOrigin: 'left center',
        animation: 'tailWag 1.8s ease-in-out infinite',
      }} />
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

      {/* Floating particles */}
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

      {/* CSS Pixel Eren — bounces in */}
      <div
        className="relative z-10 mb-4"
        style={{ animation: 'splashBounceIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
      >
        {/* Glow behind cat */}
        <div
          className="absolute rounded-full"
          style={{
            left: -20, top: -20, right: -20, bottom: -20,
            background: 'radial-gradient(circle, rgba(167,139,250,0.3) 0%, transparent 70%)',
            animation: 'splashPulseGlow 2s ease-in-out infinite',
          }}
        />
        <div style={{
          filter: 'drop-shadow(0 0 16px rgba(167,139,250,0.4)) drop-shadow(0 0 30px rgba(124,58,237,0.2))',
          animation: 'splashCatFloat 2.5s ease-in-out 0.8s infinite',
        }}>
          <PixelCat />
        </div>
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
          <div className="h-px" style={{ width: 40, background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)' }} />
          <span className="font-pixel" style={{ fontSize: 6, color: 'rgba(167,139,250,0.6)', letterSpacing: 3 }}>MEOW</span>
          <div className="h-px" style={{ width: 40, background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)' }} />
        </div>
      </div>

      {/* Loading bar */}
      <div className="relative z-10 mt-8" style={{ width: 160, animation: 'splashFadeUp 0.5s ease-out 0.8s both' }}>
        <div className="overflow-hidden" style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(167,139,250,0.15)' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, #7C3AED, #A78BFA, #C084FC, #FF6B9D)',
            backgroundSize: '200% 100%',
            animation: 'splashLoadBar 2s ease-in-out forwards, splashShimmer 1.5s linear infinite',
          }} />
        </div>
        <p className="font-pixel text-center mt-3" style={{ fontSize: 6, color: 'rgba(167,139,250,0.5)', animation: 'splashPulseText 1.2s ease-in-out infinite' }}>
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
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
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
        @keyframes catBlink {
          0%, 42%, 46%, 100% { transform: scaleY(0); }
          44% { transform: scaleY(1); }
        }
        @keyframes tailWag {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(12deg); }
        }
      `}</style>
    </div>
  )
}
