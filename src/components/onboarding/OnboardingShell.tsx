'use client'

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING SHELL — shared chrome for every step: the rewards-style night
// sky (gradient + drifting starfield + scanlines), the three progress pips,
// and the obsidian content panel. Scrollable column, NOT position:fixed —
// the iOS keyboard needs to be able to push/scroll the form.
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { OBSIDIAN_FACE, Rivets, accentA } from '@/components/obsidian'
import { ONB_BG, Starfield, Scanlines } from './pixelForm'

const PIPS = ['ACCOUNT', 'HOME', 'MEET EREN'] as const

function ProgressPips({ stage }: { stage: number }) {
  return (
    <div className="flex items-start justify-center gap-5" style={{ marginBottom: 18 }}>
      {PIPS.map((label, i) => {
        const done = i < stage
        const active = i === stage
        return (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <div style={{
              width: 11, height: 11,
              border: '2px solid #050507',
              boxShadow: active
                ? `2px 2px 0 #050507, 0 0 8px ${accentA(0.6)}`
                : '2px 2px 0 #050507',
              background: done || active
                ? 'linear-gradient(180deg, var(--accent-hi) 0%, var(--accent) 60%, var(--accent-lo) 100%)'
                : '#181420',
            }} />
            <span className="font-pixel" style={{
              fontSize: 5,
              letterSpacing: 1,
              color: active ? 'var(--accent-hi)' : '#7A6F96',
            }}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function OnboardingShell({
  stage,
  panel = true,
  children,
}: {
  /** 0=account, 1=household, 2=slides; null hides the pips (welcome/login) */
  stage: number | null
  /** false = hero layout without the obsidian panel (welcome step) */
  panel?: boolean
  children: ReactNode
}) {
  return (
    <div className="relative" style={{ minHeight: '100dvh', ...ONB_BG }}>
      <Starfield />
      <Scanlines />
      <style>{`
        @keyframes onbPop {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="relative flex flex-col items-center justify-center mx-auto"
        style={{
          minHeight: '100dvh',
          maxWidth: 380,
          padding: '0 20px',
          paddingTop: 'calc(var(--safe-top, 0px) + 28px)',
          paddingBottom: 'calc(var(--safe-bottom, 0px) + 28px)',
        }}
      >
        {stage !== null && <ProgressPips stage={stage} />}
        {panel ? (
          <div className="relative w-full" style={{
            border: '2px solid #050507',
            boxShadow: '3px 3px 0 #050507',
            borderRadius: 6,
          }}>
            <div className="relative" style={{ ...OBSIDIAN_FACE, padding: '22px 18px' }}>
              <Rivets />
              {children}
            </div>
          </div>
        ) : (
          <div className="relative w-full">{children}</div>
        )}
      </div>
    </div>
  )
}
