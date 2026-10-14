'use client'

// DailyBattlePop — the little speech bubble that floats above Eren when a
// care action lands. Shows who did what, how many points it counted for, and
// a mini live bar that visibly "shifts" toward the actor's side over the
// brief lifetime of the pop-up. Auto-dismisses after ~2.8 s.
//
// A white Meadow bubble like the battle plate under it: the actor's initial
// in their household colour, the points in that colour, and the bar split in
// the two colours the plate uses.

import { useEffect, useState } from 'react'
import { useDailyBattle, type DailyActionSignal } from '@/hooks/useDailyBattle'
import { useCat } from '@/hooks/useCat'
import { useAuth } from '@/hooks/useAuth'
import { useCouple } from '@/hooks/useCouple'
import { Avatar, M, PERSON, personColor } from '@/components/meadow'

// lib/catWords templates, filled at render.
const ACTION_LABELS: Record<string, string> = {
  feed:     'fed {name}',
  play:     'played with {him}',
  sleep:    'tucked {him} in',
  wash:     'washed {him}',
  medicine: 'gave {him} medicine',
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
  const cat = useCat()
  const { profile } = useAuth()
  const { partner } = useCouple()
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
  // The same colours as the battle plate: missing on the partner, the other
  // of the two.
  const myColor = personColor(profile?.heart)
  const partnerColor = partner?.heart
    ? personColor(partner.heart)
    : profile?.heart === 'brown_heart' ? PERSON.pink : PERSON.brown
  const accent = signal.isMe ? myColor : partnerColor
  const livePct = animBar ? snap.endPct : snap.startPct
  const label = ACTION_LABELS[signal.action] ? cat.t(ACTION_LABELS[signal.action]) : signal.action
  const name = signal.userName.split(' ')[0]

  return (
    <div
      key={signal.ts}
      className="meadow-root fixed pointer-events-none"
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
        background: '#FFFFFF',
        borderRadius: 20,
        boxShadow: `0 3px 0 ${M.overArtLip}`,
        padding: '8px 12px 10px 8px',
        // Its own width, not the half-screen a left:50% box is offered,
        // which wrapped a short sentence onto three lines.
        width: 'max-content',
        maxWidth: 'min(280px, calc(100vw - 32px))',
      }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <Avatar name={name} color={accent} size={30} fontSize={14} />
          <span className="flex-1 min-w-0" style={{
            fontSize: 14, lineHeight: 1.25, fontWeight: 800, color: M.text, overflowWrap: 'anywhere', paddingRight: 4,
          }}>
            {name} {label}
          </span>
          <span style={{
            fontSize: 18, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>+{signal.points}</span>
        </div>

        {/* Mini bar — slides from startPct to endPct so the chunk
            visibly moves toward the actor's side. */}
        <div style={{
          position: 'relative', marginTop: 8, height: 8, borderRadius: 999,
          background: M.track, overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${livePct}%`,
            background: myColor,
            transition: 'width 1.1s cubic-bezier(0.34,1.5,0.55,1)',
          }} />
          <div style={{
            position: 'absolute', left: `${livePct}%`, top: 0, bottom: 0,
            width: `${100 - livePct}%`,
            background: partnerColor,
            transition: 'all 1.1s cubic-bezier(0.34,1.5,0.55,1)',
          }} />
        </div>
      </div>

      {/* Tail pointing down toward Eren */}
      <div style={{
        margin: '-1px auto 0', width: 0, height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '9px solid #FFFFFF',
        filter: `drop-shadow(0 2px 0 ${M.overArtLip})`,
      }} />

      {/* Plain <style> (not styled-jsx) so the keyframe name stays
          un-hashed — inline `animation: 'dbPopFloat ...'` resolves
          correctly. Under styled-jsx the keyframe gets scoped and
          the inline reference silently misses, causing the pop to
          render with its starting (opacity:0) state and look like
          nothing happened. */}
      <style>{`
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
