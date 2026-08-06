'use client'

// ═══════════════════════════════════════════════════════════════════════════
// EREN HERO — the wave + wordmark + tagline block shared by the welcome step
// and the login screen. Both used to hand-roll it, and both got the same flat
// treatment: a cat floating in a void over gradient-filled text.
//
// What it adds: a bloom behind him so he's lit by something, a ground glow so
// he isn't hovering in nothing, and a wordmark built from two stacked layers —
// a hard offset plate under a gradient face — instead of one gradient fill.
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import SketchEren from '@/components/SketchEren'
import { pinkText, accentA } from '@/components/obsidian'
import { SPARKLE_CLIP } from '@/components/SparkleField'

function Sparkle({ size, delay }: { size: number; delay: number }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, flexShrink: 0, background: '#FFD86B',
      clipPath: SPARKLE_CLIP,
      filter: 'drop-shadow(0 0 5px rgba(255,216,107,0.8))',
      animation: 'mgTwinkleSoft 2.6s ease-in-out infinite',
      animationDelay: `${delay}s`,
    }} />
  )
}

export default function ErenHero({
  size, titleSize, tagline,
}: {
  size: number
  titleSize: number
  tagline: ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center relative">
      {/* Bloom — the light he's standing in. */}
      <div aria-hidden style={{
        position: 'absolute', top: size * 0.06, left: '50%',
        width: size * 1.9, height: size * 1.9, transform: 'translateX(-50%)',
        background: `radial-gradient(circle, ${accentA(0.22)} 0%, rgba(167,139,250,0.12) 42%, transparent 70%)`,
        animation: 'mgBloom 6s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: size, height: size * 1.1,
        filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.55))',
        animation: 'mgFloat 3.6s ease-in-out infinite',
      }}>
        <SketchEren state="wave" size={size} transparent noSpeech />
      </div>

      {/* Ground glow — reads as a shadow on a surface, not a blur behind him. */}
      <div aria-hidden style={{
        width: size * 0.52, height: 7, marginTop: -4,
        borderRadius: '50%',
        background: `radial-gradient(ellipse, ${accentA(0.4)} 0%, transparent 72%)`,
      }} />

      <div className="flex items-center justify-center" style={{ gap: titleSize * 0.5, marginTop: 12 }}>
        <Sparkle size={titleSize * 0.4} delay={0} />
        <span className="relative inline-block">
          {/* Hard plate under the face — the depth a single gradient fill
              can't give you. */}
          <span aria-hidden className="font-pixel absolute" style={{
            left: 3, top: 3, fontSize: titleSize, letterSpacing: titleSize * 0.16,
            color: '#07030F',
          }}>
            EREN
          </span>
          <span className="font-pixel relative" style={{
            ...pinkText, fontSize: titleSize, letterSpacing: titleSize * 0.16,
            filter: `drop-shadow(0 0 10px ${accentA(0.55)})`,
          }}>
            EREN
          </span>
        </span>
        <Sparkle size={titleSize * 0.4} delay={1.1} />
      </div>

      <div aria-hidden style={{
        width: titleSize * 5, height: 2, marginTop: 10,
        background: `linear-gradient(90deg, transparent, ${accentA(0.5)} 20%, rgba(255,216,107,0.7) 50%, ${accentA(0.5)} 80%, transparent)`,
      }} />

      <div style={{ marginTop: 10 }}>{tagline}</div>
    </div>
  )
}
