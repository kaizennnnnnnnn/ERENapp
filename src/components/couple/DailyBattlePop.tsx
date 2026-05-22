'use client'

// DailyBattlePop — the cute little speech-bubble-style pop-up that
// floats above Eren when a care action lands. Shows who did what,
// how many points it counted for, and a mini live bar that visibly
// "shifts" toward the actor's side over the brief lifetime of the
// pop-up. Auto-dismisses after ~2.8 s.

import { useEffect, useState } from 'react'
import { useDailyBattle, type DailyActionSignal } from '@/hooks/useDailyBattle'

const ACTION_LABELS: Record<string, string> = {
  feed:     'FED EREN',
  play:     'PLAYED',
  sleep:    'TUCKED IN',
  wash:     'WASHED',
  medicine: 'MEDICINE',
}

// Care scenes (FeedScene, PlayScene, etc.) render full-screen at
// z-40, so the pop has to sit ABOVE them or it appears to "not
// fire" — the realtime event lands but the bubble renders
// underneath the scene overlay. Modals/popups (ErenMessagePopup,
// FortunePopup) are z-70, so 55 keeps the pop above scenes and
// below blocking modals.
const Z_POP = 55

interface Snapshot {
  signal: DailyActionSignal
  /** Bar position one tick BEFORE the action — so the bar visibly
   *  slides from "before" to "after" over the pop lifetime. */
  startPct: number
  endPct: number
}

export default function DailyBattlePop() {
  const { lastAction, myPct, hasPartner } = useDailyBattle()
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [animBar, setAnimBar] = useState(false)

  useEffect(() => {
    if (!lastAction || !hasPartner) return
    // The hook has already applied the new score, so myPct is the
    // POST-action value. Reconstruct the pre-action split by undoing
    // this single action's effect.
    const next: Snapshot = {
      signal: lastAction,
      startPct: myPct,  // starting visible state (before nudging)
      endPct:   myPct,  // current end state
    }
    // Subtle "starting from a slightly earlier position" so the bar
    // can be observed sliding even if myPct didn't change much.
    // The actor's side starts back by ~8 pct points, then slides.
    const nudge = 8
    if (lastAction.isMe) {
      next.startPct = Math.max(0, myPct - nudge)
    } else {
      next.startPct = Math.min(100, myPct + nudge)
    }
    setSnap(next)
    setAnimBar(false)
    // Two RAFs so the browser commits the start state before we
    // switch to end — without this both reads use the same width
    // and the CSS transition can't animate.
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimBar(true)))
    const dismiss = setTimeout(() => setSnap(null), 2800)
    return () => clearTimeout(dismiss)
  }, [lastAction?.ts, hasPartner]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!snap) return null
  const { signal } = snap
  const accent = signal.isMe ? '#FF6B9D' : '#A78BFA'
  const accentSoft = signal.isMe ? '#FFB0CC' : '#C8B5FA'
  const livePct = animBar ? snap.endPct : snap.startPct

  return (
    <div
      key={signal.ts}
      className="fixed pointer-events-none"
      style={{
        // Floats high above Eren so it doesn't fight the daily HUD.
        bottom: '56%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: Z_POP,
        animation: 'dbPopFloat 2.8s cubic-bezier(0.34,1.56,0.64,1) both',
      }}
    >
      <div style={{
        background: '#1F1F2E',
        border: `2px solid ${accent}`,
        boxShadow: `3px 3px 0 rgba(0,0,0,0.6), 0 0 10px ${accent}66`,
        padding: '5px 9px',
        textAlign: 'center',
        minWidth: 110,
      }}>
        <p className="font-pixel" style={{
          fontSize: 6, letterSpacing: 1.5, color: accent,
          textShadow: `0 0 4px ${accent}55`,
        }}>
          {signal.userName.toUpperCase()} {ACTION_LABELS[signal.action] ?? signal.action.toUpperCase()}
        </p>
        <p className="font-pixel mt-0.5" style={{
          fontSize: 11, color: accentSoft, lineHeight: 1,
        }}>+{signal.points}</p>

        {/* Mini bar — slides from startPct to endPct so the chunk
            visibly moves toward the actor's side. */}
        <div style={{
          position: 'relative',
          margin: '5px auto 0',
          width: 92, height: 6,
          border: '1px solid #1F1F2E',
          background: '#050507',
          boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.95)',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${livePct}%`,
            background: '#FF6B9D',
            transition: 'width 1.1s cubic-bezier(0.34,1.5,0.55,1)',
          }} />
          <div style={{
            position: 'absolute', left: `${livePct}%`, top: 0, bottom: 0,
            width: `${100 - livePct}%`,
            background: '#A78BFA',
            transition: 'all 1.1s cubic-bezier(0.34,1.5,0.55,1)',
          }} />
        </div>
      </div>

      {/* Pixel tail pointing down toward Eren */}
      <div style={{
        margin: '0 auto', width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `7px solid ${accent}`,
      }} />

      <style jsx>{`
        @keyframes dbPopFloat {
          0%   { transform: translateX(-50%) translateY(18px) scale(0.5); opacity: 0; }
          15%  { transform: translateX(-50%) translateY(-6px) scale(1.08); opacity: 1; }
          30%  { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
          75%  { transform: translateX(-50%) translateY(-10px); opacity: 1; }
          100% { transform: translateX(-50%) translateY(-30px) scale(0.92); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
